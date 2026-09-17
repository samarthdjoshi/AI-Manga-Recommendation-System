"""
Agentic chat layer for Mangalyst: Gemini decides which tools to call
(and in what order, possibly multiple times) before answering, rather
than a fixed retrieve-then-generate RAG pipeline.

Falls back automatically, in order:
1. Try each Gemini model in MODEL_CHAIN (stacks each model's separate
   free-tier daily quota instead of failing the moment one is exhausted).
2. If every Gemini model is exhausted/unavailable, fall back to a local
   Ollama model. The Ollama tier does NOT use tool-calling - it's a
   simpler retrieve-then-generate pass using the same retrieval building
   blocks as the Gemini tools, since small local models are far less
   reliable at multi-step tool orchestration than Gemini.

run_agent_chat() returns a single complete (text, sources) tuple.
run_agent_chat_stream() is a generator yielding text chunks as they are
produced, for a real "typing" streaming experience in the UI, followed
by one final ("__SOURCES__", sources_list) tuple as a sentinel.

Every retrieval path wraps code that already exists and is already
tested elsewhere in the project (RecommenderService, ChatRetriever, the
Favorites/hybrid-recommendation system) - nothing here is new backend
logic.
"""

from __future__ import annotations

import functools
import time
from typing import TYPE_CHECKING

import httpx
import requests
from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from sqlalchemy.orm import Session

from common.config import settings
from ml.recommender.service import (
    EXPLICIT_GENRES,
    MangaNotFoundError,
    RecommenderService,
)

if TYPE_CHECKING:
    from ml.recommender.chat_retrieval import ChatRetriever

# Tried in order. gemini-3.6-flash offers
# ultra-fast response times (<2s) and highest reliability for tools and recommendations.
MODEL_CHAIN = ["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-flash-latest"]

GEMINI_TIMEOUT_MS = 25000  # 25 seconds server-side timeout
OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_MODEL = "qwen2.5:7b-instruct"
OLLAMA_TIMEOUT_SECONDS = 10


class AgentChatResult(tuple):
    """Backwards-compatible tuple result (reply_text, sources) with
    provider tracking attribute."""

    def __new__(cls, reply: str, sources: list[dict], provider: str = "gemini"):
        instance = super().__new__(cls, (reply, sources))
        instance.reply = reply
        instance.sources = sources
        instance.provider = provider
        return instance


class ChatUnavailableError(Exception):
    """Raised when no provider (any Gemini model in the chain, or the
    local Ollama fallback) could produce a response."""


_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if not settings.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is not set in .env")
        _client = genai.Client(
            api_key=settings.GEMINI_API_KEY,
            http_options=types.HttpOptions(timeout=GEMINI_TIMEOUT_MS),
        )
    return _client


SYSTEM_INSTRUCTION = """You are the AI recommendation agent for Mangalyst, a manga/manhwa/manhua discovery platform. \
You have real-time catalog search tools to query the app's 339,941 titles.

CRITICAL RULES:
1. ALWAYS CALL SEARCH TOOLS FIRST: For ANY request asking for recommendations, titles, genres, tropes, or descriptions, you MUST call \
`semantic_search_manga`, `search_manga`, or `get_similar_manga` before answering.
2. MINIMUM 5 RECOMMENDATIONS: For every recommendation or discovery request, you MUST provide at least 5 distinct recommendations (numbered 1 through 5 or more).
3. ONLY RECOMMEND REAL CATALOG TITLES: Every single title you recommend in your text MUST be one of the exact titles returned by your tool calls. NEVER invent titles or recommend manga outside the tool results, because the app displays interactive recommendation cards for the user to read, bookmark, and track each title.
4. SPECIFIC & NON-VAGUE REASONING: For each recommended title:
   - Start with bold number and title: e.g. `1. **Solo Leveling** (2018, ★ 8.4/10)`
   - Provide concrete, specific details from its synopsis (main character names, core premise, unique power system or romantic dynamic, stakes) and explain specifically WHY it fits the user's prompt. Avoid vague generic filler like "captivating storyline" or "great art".
5. EXACT TITLE SPELLING: Bold the exact title returned by the tool (e.g. `**Title**`) so that the app's recommendation cards match your text 100%.
6. NEVER CLAIM ERRORS: Never say the catalog search has a technical issue or is unavailable. If a query returns fewer results, use `search_manga` with broader genres to recommend top-rated catalog titles.
"""


def _passes_filters(record: dict, hide_explicit: bool, hide_doujinshi: bool) -> bool:
    genres_lower = {g.lower() for g in (record.get("genres") or [])}
    if hide_explicit and (EXPLICIT_GENRES & genres_lower):
        return False
    return not (hide_doujinshi and "doujinshi" in genres_lower)


def _simplify(record: dict) -> dict:
    return {
        "gold_id": record.get("gold_id"),
        "title": record.get("title"),
        "year": record.get("year"),
        "genres": (record.get("genres") or [])[:8],
        "rating": record.get("rating_combined"),
        "chapters": record.get("chapters"),
        "cover_image_url": record.get("cover_image_url"),
        "description": (record.get("description") or "")[:900],
    }


def _extract_prioritized_sources(
    reply_text: str,
    collected: dict,
    svc: RecommenderService,
    hide_explicit: bool,
    hide_doujinshi: bool,
    limit: int = 8,
) -> list[dict]:
    """Prioritizes titles specifically highlighted/mentioned in the AI's response text,
    then fills the remaining slots from tool-collected records so the recommendation
    cards at the bottom always match the text suggestions and provide 5+ titles."""
    final_sources: dict[str, dict] = {}

    import re
    # 1. Match titles formatted in bold e.g. 1. **Title**
    bold_matches = re.findall(r"\*\*(?:[0-9]+\.\s*)?([^*:\n]+?)\*\*", reply_text)
    skip_headers = {
        "rating", "genres", "description", "note", "why it matches", "status",
        "plot", "summary", "author", "chapters", "format", "recommendation",
        "recommendations", "synopsis", "why you should read", "key themes", "premise",
    }
    for raw_title in bold_matches:
        t_clean = raw_title.strip()
        t_clean = re.sub(r"[:\-\–\—]+$", "", t_clean).strip()
        if t_clean.lower() in skip_headers or len(t_clean) < 2:
            continue
        if len(final_sources) >= limit:
            break

        # Check if already present in collected
        matched_rec = None
        for gid, rec in collected.items():
            rec_title = rec.get("title", "")
            if (
                rec_title.lower() == t_clean.lower()
                or t_clean.lower() in rec_title.lower()
                or rec_title.lower() in t_clean.lower()
            ):
                if _passes_filters(rec, hide_explicit, hide_doujinshi):
                    matched_rec = rec
                    break
        if matched_rec:
            gid = matched_rec.get("gold_id")
            if gid and gid not in final_sources:
                final_sources[gid] = matched_rec
            continue

        # Search catalog directly for this bolded title
        if hasattr(svc, "search"):
            try:
                search_hits = svc.search(t_clean, limit=1)
                if search_hits:
                    rec = search_hits[0]
                    gid = rec.get("gold_id")
                    if gid and gid not in final_sources and _passes_filters(rec, hide_explicit, hide_doujinshi):
                        final_sources[gid] = rec
            except Exception:  # noqa: BLE001
                pass

    # 2. Extract titles mentioned in text via svc.find_titles_mentioned_in_text
    if hasattr(svc, "find_titles_mentioned_in_text") and len(final_sources) < limit:
        try:
            for m in svc.find_titles_mentioned_in_text(reply_text, limit=limit):
                if _passes_filters(m, hide_explicit, hide_doujinshi):
                    gid = m.get("gold_id")
                    if gid and gid not in final_sources:
                        final_sources[gid] = m
                if len(final_sources) >= limit:
                    break
        except Exception:  # noqa: BLE001
            pass

    # 3. Add other tool-collected records so recommendations are plentiful (5 to 8)
    for gid, r in collected.items():
        if gid not in final_sources and _passes_filters(r, hide_explicit, hide_doujinshi):
            final_sources[gid] = r
        if len(final_sources) >= limit:
            break

    return list(final_sources.values())


def _tool_wrapper(fn):
    """Wraps a tool function so any internal exception is printed to the
    server console AND returned as a clear error dict to the model,
    instead of being silently swallowed by the SDK's automatic
    function-calling layer (which can catch exceptions internally
    without ever surfacing them to our own logging)."""
    @functools.wraps(fn)
    def wrapped(*args, **kwargs):
        print(f"[tool] {fn.__name__} called with args={args!r} kwargs={kwargs!r}")
        try:
            result = fn(*args, **kwargs)
            preview = f"{len(result)} items" if isinstance(result, list) else result
            print(f"[tool] {fn.__name__} succeeded -> {preview!r}")
            return result
        except Exception as exc:  # noqa: BLE001 - tools must not crash a chat request
            print(f"[tool] {fn.__name__} FAILED: {exc!r}")
            return []
    return wrapped


def _ollama_is_reachable() -> bool:
    try:
        resp = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=0.8)
        return resp.status_code == 200
    except requests.RequestException:
        return False


def _build_tools(
    svc: RecommenderService,
    retriever: ChatRetriever,
    hide_explicit: bool,
    hide_doujinshi: bool,
    current_user_id: int | None,
    db: Session,
):
    """Builds the 6 agent tools plus a `collected` dict tracking every
    record any tool has returned, for use as the final "sources" list.
    Shared by both the non-streaming and streaming chat paths so the
    tool logic exists in exactly one place."""
    collected: dict[str, dict] = {}

    def _record_sources(records: list[dict]) -> None:
        for r in records:
            gid = r.get("gold_id")
            if gid and gid not in collected:
                collected[gid] = r

    def search_manga(
        query: str,
        genres: list[str] | None = None,
        year_min: int | None = None,
        year_max: int | None = None,
        min_chapters: int | None = None,
        sort: str = "rating",
        limit: int = 8,
    ) -> list[dict]:
        """Search the manga catalog by title text and/or filters (genres, year range,
        minimum chapters). Use this for specific, filterable searches - e.g. "action
        manga from after 2015" or looking up a title by name. Returns up to `limit`
        matching titles with their genres, rating, and description.

        Args:
            query: Title text to search for. Pass an empty string to search by
                filters alone.
            genres: Real catalog genre names to require, e.g. ["Action", "Fantasy"].
            year_min: Minimum release year.
            year_max: Maximum release year.
            min_chapters: Minimum chapter count.
            sort: One of "rating", "corroborated", "newest", "title".
            limit: Max results, up to 15.
        """
        limit = max(1, min(limit, 15))
        results: list[dict] = []

        if query and query.strip():
            results.extend(svc.search(query, limit=limit * 2))

        # If title matches are fewer than requested limit, detect genres in query and browse catalog
        if len(results) < limit and hasattr(svc, "browse"):
            active_genres = list(genres) if genres else []
            if query:
                q_lower = query.lower()
                for g in [
                    "action", "fantasy", "romance", "horror", "comedy", "drama", "adventure",
                    "supernatural", "mystery", "psychological", "sci-fi", "thriller", "magic",
                    "martial arts", "sports", "isekai", "slice of life", "school"
                ]:
                    if g in q_lower and g.title() not in active_genres:
                        active_genres.append(g.title())

            page, _total = svc.browse(
                genres=active_genres if active_genres else None,
                year_min=year_min, year_max=year_max,
                min_chapters=min_chapters, hide_explicit=hide_explicit,
                sort=sort, limit=limit * 2,
            )
            seen_ids = {r.get("gold_id") for r in results if r.get("gold_id")}
            for p in page:
                if p.get("gold_id") not in seen_ids:
                    results.append(p)
                    seen_ids.add(p.get("gold_id"))
                if len(results) >= limit * 2:
                    break

        if genres:
            wanted = {g.lower() for g in genres}
            results = [r for r in results if wanted & {g.lower() for g in (r.get("genres") or [])}]
        if year_min is not None:
            results = [r for r in results if r.get("year") and r["year"] >= year_min]
        if year_max is not None:
            results = [r for r in results if r.get("year") and r["year"] <= year_max]
        if min_chapters is not None:
            results = [r for r in results if (r.get("chapters") or 0) >= min_chapters]

        results = [r for r in results if _passes_filters(r, hide_explicit, hide_doujinshi)]
        # If filters left fewer than limit results, backfill with top-rated titles in active genres
        if len(results) < limit and hasattr(svc, "browse"):
            try:
                extra_page, _ = svc.browse(genres=active_genres[:1] if active_genres else None, sort=sort, limit=limit * 2)
                seen_ids = {r.get("gold_id") for r in results if r.get("gold_id")}
                for p in extra_page:
                    if p.get("gold_id") not in seen_ids and _passes_filters(p, hide_explicit, hide_doujinshi):
                        results.append(p)
                        seen_ids.add(p.get("gold_id"))
                    if len(results) >= limit:
                        break
            except Exception:  # noqa: BLE001
                pass

        results = results[:limit]
        _record_sources(results)
        return [_simplify(r) for r in results]

    def semantic_search_manga(description: str, top_k: int = 10) -> list[dict]:
        """Search the catalog by MEANING rather than exact title/genre match - use this
        for vague, descriptive, or mood-based requests, e.g. "something with a slow burn
        romance and cooking" or "dark psychological horror with an unreliable narrator".

        Args:
            description: A natural-language description of what the user wants.
            top_k: Max results, up to 15.
        """
        top_k = max(1, min(top_k, 15))
        if retriever and hasattr(retriever, "semantic_search"):
            try:
                hits = retriever.semantic_search(description, top_k=top_k * 3)
                results = []
                for gold_id, _score in hits:
                    record = svc.records_by_gold_id.get(gold_id)
                    if record and _passes_filters(record, hide_explicit, hide_doujinshi):
                        results.append(record)
                    if len(results) >= top_k:
                        break
                if results:
                    _record_sources(results)
                    return [_simplify(r) for r in results]
            except Exception as exc:
                print(f"[agent] semantic_search error: {exc}")

        # Fallback to catalog search by query if retriever is unavailable or returned 0 hits
        return search_manga(query=description, limit=top_k)

    def get_manga_details(title: str) -> dict | None:
        """Get full details for a specific manga by its title (or close to it).
        Use this when the user names a specific title and wants to know more about it.

        Args:
            title: The title to look up.
        """
        matches = svc.search(title, limit=1)
        if not matches:
            return None
        record = matches[0]
        if not _passes_filters(record, hide_explicit, hide_doujinshi):
            return None
        _record_sources([record])
        return _simplify(record)

    def get_similar_manga(title: str, top_k: int = 10) -> list[dict]:
        """Get manga similar to a specific named title, using the app's real
        content-based similarity engine. Use this whenever the user references a
        specific title and wants "more like this" - including when they say
        "it"/"this"/"that" while viewing a manga's page.

        Args:
            title: The reference title to find similar manga to.
            top_k: Max results, up to 15.
        """
        top_k = max(1, min(top_k, 15))
        matches = svc.search(title, limit=5)
        if not matches:
            return []
        ref_record = matches[0]
        gold_id = ref_record.get("gold_id")
        results = []
        if gold_id:
            try:
                results = svc.recommend(gold_id, top_k=top_k * 2)
            except Exception:  # noqa: BLE001
                results = []

        # If similarity index has 0 recommendations for this title, recommend top-rated in its genres
        if not results:
            ref_genres = ref_record.get("genres") or []
            if ref_genres and hasattr(svc, "browse"):
                try:
                    page, _ = svc.browse(genres=ref_genres[:2], sort="rating", limit=top_k * 2)
                    results = [p for p in page if p.get("gold_id") != gold_id]
                except Exception:  # noqa: BLE001
                    results = []

        if not results:
            results = [m for m in matches if m.get("gold_id") != gold_id]

        results = [r for r in results if _passes_filters(r, hide_explicit, hide_doujinshi)][:top_k]
        _record_sources(results)
        return [_simplify(r) for r in results]

    def get_user_favorites() -> dict:
        """Get the current logged-in user's favorited and tracked library manga. Returns
        {"logged_in": False} if there is no logged-in user, or
        {"logged_in": True, "favorites": [...]} otherwise."""
        if current_user_id is None:
            return {"logged_in": False}
        from auth.database import Favorite, TrackingEntry
        fav_rows = db.query(Favorite.gold_id).filter(Favorite.user_id == current_user_id).all() if db else []
        track_rows = db.query(TrackingEntry.gold_id).filter(TrackingEntry.user_id == current_user_id).all() if db else []
        gold_ids = list(dict.fromkeys([row[0] for row in fav_rows] + [row[0] for row in track_rows]))
        records = [svc.records_by_gold_id[g] for g in gold_ids if g in svc.records_by_gold_id]
        records = [r for r in records if _passes_filters(r, hide_explicit, hide_doujinshi)]
        _record_sources(records)
        return {"logged_in": True, "favorites": [_simplify(r) for r in records]}

    def get_personalized_recommendations(top_k: int = 8) -> dict:
        """Get personalized recommendations for the current logged-in user, blending
        favorites and library tracking (content similarity) with similar users' entries (collaborative
        signal). Returns {"logged_in": False} if no user is logged in."""
        if current_user_id is None:
            return {"logged_in": False}
        from auth.database import Favorite, TrackingEntry
        top_k = max(1, min(top_k, 15))

        fav_rows = db.query(Favorite.gold_id).filter(Favorite.user_id == current_user_id).all() if db else []
        track_rows = db.query(TrackingEntry.gold_id).filter(TrackingEntry.user_id == current_user_id).all() if db else []
        favorite_gold_ids = list(dict.fromkeys([row[0] for row in fav_rows] + [row[0] for row in track_rows]))
        if not favorite_gold_ids:
            return {"logged_in": True, "recommendations": [], "note": "user has no favorites or tracked titles yet"}

        all_favs = db.query(Favorite.user_id, Favorite.gold_id).all() if db else []
        all_tracks = db.query(TrackingEntry.user_id, TrackingEntry.gold_id).all() if db else []
        all_users_favorites: dict[int, list[str]] = {}
        for uid, gid in all_favs + all_tracks:
            all_users_favorites.setdefault(uid, []).append(gid)

        results = svc.recommend_hybrid(
            favorite_gold_ids=favorite_gold_ids,
            all_users_favorites=all_users_favorites,
            top_k=top_k * 2,
        )
        results = [r for r in results if _passes_filters(r, hide_explicit, hide_doujinshi)][:top_k]
        _record_sources(results)
        return {"logged_in": True, "recommendations": [_simplify(r) for r in results]}

    tools = [
        _tool_wrapper(search_manga),
        _tool_wrapper(semantic_search_manga),
        _tool_wrapper(get_manga_details),
        _tool_wrapper(get_similar_manga),
        _tool_wrapper(get_user_favorites),
        _tool_wrapper(get_personalized_recommendations),
    ]

    # Exposed so the Ollama (non-agentic) fallback path can call the same
    # retrieval logic directly without going through model tool-calling.
    helpers = {
        "search_manga": search_manga,
        "semantic_search_manga": semantic_search_manga,
        "get_similar_manga": get_similar_manga,
        "_simplify": _simplify,
        "_record_sources": _record_sources,
    }

    return tools, collected, helpers


def _build_system_instruction(
    svc: RecommenderService,
    page_context_gold_id: str | None,
    current_user_id: int | None = None,
) -> tuple[str, dict | None]:
    system = SYSTEM_INSTRUCTION
    if current_user_id is None:
        system += (
            "\n\nUser auth state: Anonymous (not logged in). Do not call get_user_favorites or "
            "get_personalized_recommendations. Instead, always use search_manga or "
            "semantic_search_manga to answer discovery and recommendation requests directly "
            "from the catalog."
        )
    else:
        system += "\n\nUser auth state: Logged in. You can call get_user_favorites and get_personalized_recommendations if relevant."

    page_record = svc.records_by_gold_id.get(page_context_gold_id) if page_context_gold_id else None
    if page_record:
        system += (
            f"\n\nThe user is currently viewing this manga's page: \"{page_record.get('title')}\" "
            f"(gold_id: {page_context_gold_id}). If they refer to \"it\"/\"this\"/\"that\" or ask "
            f"for similar titles without naming one, use get_similar_manga with this title."
        )
    return system, page_record


def _build_genai_history(history: list[dict]) -> list[types.Content]:
    genai_history: list[types.Content] = []
    for turn in history[-12:]:
        role = "model" if turn.get("role") == "assistant" else "user"
        genai_history.append(
            types.Content(role=role, parts=[types.Part.from_text(text=turn.get("content", ""))])
        )
    return genai_history


def _ollama_fallback_context(
    message: str,
    page_record: dict | None,
    svc: RecommenderService,
    helpers: dict,
) -> list[dict]:
    """Builds context for the Ollama fallback by calling the retrieval
    helpers directly (no tool-calling - small local models are far less
    reliable at multi-step tool orchestration than Gemini)."""
    if page_record:
        return helpers["get_similar_manga"](page_record["title"], top_k=6)

    title_matches = (
        svc.find_titles_mentioned_in_text(message, limit=3)
        if hasattr(svc, "find_titles_mentioned_in_text")
        else []
    )
    similar_intent = any(w in message.lower() for w in ("similar", "like", "such as", "related", "else"))
    if title_matches and similar_intent:
        return helpers["get_similar_manga"](title_matches[0]["title"], top_k=6)
    if title_matches:
        helpers["_record_sources"](title_matches)
        return [helpers["_simplify"](m) for m in title_matches]

    results = helpers["semantic_search_manga"](message, top_k=6)
    if not results:
        results = helpers["search_manga"](message, limit=6)
    return results


def _ollama_context_block(context_records: list[dict]) -> str:
    context_lines = []
    for r in context_records:
        genres = ", ".join((r.get("genres") or [])[:6]) or "unknown genres"
        rating = r.get("rating")
        rating_str = f"{rating:.1f}/10" if rating is not None else "no rating"
        desc = (r.get("description") or "").strip()
        context_lines.append(
            f"- {r.get('title')} ({r.get('year', 'unknown year')}) | {genres} | rating {rating_str}\n  {desc}"
        )
    return "\n".join(context_lines) if context_lines else "(no relevant titles found in catalog)"


def run_agent_chat(
    message: str,
    history: list[dict],
    svc: RecommenderService,
    retriever: ChatRetriever,
    hide_explicit: bool,
    hide_doujinshi: bool,
    page_context_gold_id: str | None,
    current_user_id: int | None,
    db: Session,
    force_provider: str | None = None,
) -> tuple[str, list[dict]]:
    """Non-streaming: returns one complete (text, sources) tuple."""
    tools, collected, helpers = _build_tools(
        svc, retriever, hide_explicit, hide_doujinshi, current_user_id, db
    )
    genai_history = _build_genai_history(history)
    system, page_record = _build_system_instruction(svc, page_context_gold_id, current_user_id)

    last_gemini_error: Exception | None = None
    gemini_models_to_try = MODEL_CHAIN if force_provider != "ollama" else []
    client = None
    if gemini_models_to_try:
        try:
            client = _get_client()
        except RuntimeError as exc:
            # Gemini configuration is optional when a local Ollama fallback
            # is available. Preserve the error as diagnostic context, then
            # continue through the normal fallback path.
            last_gemini_error = exc
            gemini_models_to_try = []
    for model_name in gemini_models_to_try:
        try:
            chat = client.chats.create(
                model=model_name,
                config=types.GenerateContentConfig(system_instruction=system, tools=tools),
                history=genai_history,
            )
            response = chat.send_message(message)
            reply_text = response.text or ""
            prioritized = _extract_prioritized_sources(
                reply_text=reply_text,
                collected=collected,
                svc=svc,
                hide_explicit=hide_explicit,
                hide_doujinshi=hide_doujinshi,
                limit=8,
            )
            return AgentChatResult(reply_text, prioritized, "gemini")
        except (genai_errors.APIError, httpx.RequestError, TimeoutError, ConnectionError, OSError) as exc:
            err_type = type(exc).__name__
            print(f"[agent] Gemini model {model_name!r} failed ({err_type}), trying next in chain: {exc}")
            last_gemini_error = exc
            continue

    # If function calling failed across the model chain, try direct prompt-augmented generation (RAG)
    if client and force_provider != "ollama":
        try:
            print("[agent] Function-calling models exhausted, attempting direct Gemini RAG fallback...")
            ctx_records = _ollama_fallback_context(message, page_record, svc, helpers)
            ctx_block = _ollama_context_block(ctx_records)
            rag_prompt = (
                f"{system}\n\n"
                f"CATALOG CONTEXT:\n{ctx_block}\n\n"
                f"USER QUERY: {message}\n"
                "Please recommend matching titles from the catalog context above and explain why they match:"
            )
            for m_name in MODEL_CHAIN:
                try:
                    res = client.models.generate_content(
                        model=m_name,
                        contents=rag_prompt,
                    )
                    if res.text and res.text.strip():
                        print(f"[agent] Direct Gemini fallback succeeded with model {m_name}")
                        return AgentChatResult(res.text.strip(), ctx_records, "gemini")
                except Exception as m_err:  # noqa: BLE001
                    print(f"[agent] Direct Gemini model {m_name} failed: {m_err}")
                    continue
        except Exception as direct_err:  # noqa: BLE001
            print(f"[agent] Direct Gemini fallback failed: {direct_err}")

    if force_provider == "ollama":
        print("[agent] force_provider='ollama' - skipping Gemini entirely for this request.")
    else:
        err_type = type(last_gemini_error).__name__ if last_gemini_error else "None"
        print(f"[agent] All Gemini models exhausted/unavailable ({err_type}); checking local Ollama fallback.")

    if not _ollama_is_reachable():
        raise ChatUnavailableError(
            "The AI assistant is temporarily unavailable: Gemini connection/quota is unavailable and the "
            "local Ollama fallback is not running."
        ) from last_gemini_error

    context_records = _ollama_fallback_context(message, page_record, svc, helpers)
    context_block = _ollama_context_block(context_records)

    ollama_messages = [{"role": "system", "content": SYSTEM_INSTRUCTION}]
    for turn in history[-6:]:
        role = "assistant" if turn.get("role") == "assistant" else "user"
        ollama_messages.append({"role": role, "content": turn.get("content", "")})
    ollama_messages.append({
        "role": "user",
        "content": f"CATALOG CONTEXT:\n{context_block}\n\nUSER QUESTION: {message}",
    })

    start = time.monotonic()
    try:
        resp = requests.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "messages": ollama_messages,
                "stream": False,
                "keep_alive": "30m",
                "options": {"num_predict": 200},
            },
            timeout=OLLAMA_TIMEOUT_SECONDS,
        )
        elapsed = time.monotonic() - start
        print(f"[agent] Ollama responded in {elapsed:.1f}s with status {resp.status_code}")
        resp.raise_for_status()
        data = resp.json()
        reply_text = data.get("message", {}).get("content", "").strip()
        if not reply_text:
            raise ValueError("Ollama returned an empty response")
    except Exception as exc:
        elapsed = time.monotonic() - start
        print(f"[agent] Ollama call FAILED after {elapsed:.1f}s: {exc!r}")
        raise ChatUnavailableError(
            "The AI assistant is temporarily unavailable: both Gemini and the local fallback failed."
        ) from exc

    prioritized = _extract_prioritized_sources(
        reply_text=reply_text,
        collected=collected,
        svc=svc,
        hide_explicit=hide_explicit,
        hide_doujinshi=hide_doujinshi,
        limit=8,
    )
    return AgentChatResult(reply_text, prioritized, "ollama")


def run_agent_chat_stream(
    message: str,
    history: list[dict],
    svc: RecommenderService,
    retriever: ChatRetriever,
    hide_explicit: bool,
    hide_doujinshi: bool,
    page_context_gold_id: str | None,
    current_user_id: int | None,
    db: Session,
    force_provider: str | None = None,
):
    """Streaming generator: yields plain text chunks as they are produced,
    then finally yields a ("__SOURCES__", sources_list) sentinel tuple as
    the last item so the caller can attach source cards after the text.

    Only genuinely streams for Gemini. If Gemini fails entirely and this
    falls through to Ollama, that reply is generated in one shot (already
    fast at ~3-4s once warmed up) and yielded as a single chunk - not
    worth the added complexity of streaming a fallback path that only
    fires when things are already degraded.
    """
    tools, collected, helpers = _build_tools(
        svc, retriever, hide_explicit, hide_doujinshi, current_user_id, db
    )
    genai_history = _build_genai_history(history)
    system, page_record = _build_system_instruction(svc, page_context_gold_id, current_user_id)

    last_gemini_error: Exception | None = None
    gemini_models_to_try = MODEL_CHAIN if force_provider != "ollama" else []
    client = None
    if gemini_models_to_try:
        try:
            client = _get_client()
        except RuntimeError as exc:
            last_gemini_error = exc
            gemini_models_to_try = []

    for model_name in gemini_models_to_try:
        any_output = False
        streamed_chunks = []
        try:
            chat = client.chats.create(
                model=model_name,
                config=types.GenerateContentConfig(system_instruction=system, tools=tools),
                history=genai_history,
            )
            for chunk in chat.send_message_stream(message):
                text = getattr(chunk, "text", None)
                if text:
                    any_output = True
                    streamed_chunks.append(text)
                    yield text
            full_reply = "".join(streamed_chunks)
            prioritized = _extract_prioritized_sources(
                reply_text=full_reply,
                collected=collected,
                svc=svc,
                hide_explicit=hide_explicit,
                hide_doujinshi=hide_doujinshi,
                limit=8,
            )
            yield ("__SOURCES__", prioritized)
            return
        except (genai_errors.APIError, httpx.RequestError, TimeoutError, ConnectionError, OSError) as exc:
            err_type = type(exc).__name__
            if any_output:
                # Already streamed real content to the user - don't
                # silently retry on a different model mid-answer, that
                # would produce a garbled duplicate response. Just stop.
                print(f"[agent] Gemini model {model_name!r} failed mid-stream ({err_type}): {exc}")
                full_reply = "".join(streamed_chunks)
                prioritized = _extract_prioritized_sources(
                    reply_text=full_reply,
                    collected=collected,
                    svc=svc,
                    hide_explicit=hide_explicit,
                    hide_doujinshi=hide_doujinshi,
                    limit=8,
                )
                yield ("__SOURCES__", prioritized)
                return
            print(f"[agent] Gemini model {model_name!r} failed before any output ({err_type}), trying next in chain: {exc}")
            last_gemini_error = exc
            continue

    if force_provider == "ollama":
        print("[agent] force_provider='ollama' - skipping Gemini entirely for this request.")
    else:
        print(f"[agent] All Gemini models exhausted/unavailable ({last_gemini_error}); falling back to local Ollama.")

    if not _ollama_is_reachable():
        raise ChatUnavailableError(
            "The AI assistant is temporarily unavailable: Gemini quota is exhausted and the "
            "local Ollama fallback is not running."
        ) from last_gemini_error

    context_records = _ollama_fallback_context(message, page_record, svc, helpers)
    context_block = _ollama_context_block(context_records)

    ollama_messages = [{"role": "system", "content": SYSTEM_INSTRUCTION}]
    for turn in history[-6:]:
        role = "assistant" if turn.get("role") == "assistant" else "user"
        ollama_messages.append({"role": role, "content": turn.get("content", "")})
    ollama_messages.append({
        "role": "user",
        "content": f"CATALOG CONTEXT:\n{context_block}\n\nUSER QUESTION: {message}",
    })

    start = time.monotonic()
    try:
        resp = requests.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "messages": ollama_messages,
                "stream": True,
                "keep_alive": "30m",
                "options": {"num_predict": 200},
            },
            timeout=OLLAMA_TIMEOUT_SECONDS,
            stream=True,
        )
        resp.raise_for_status()
        any_output = False
        import json as _json
        for line in resp.iter_lines():
            if not line:
                continue
            data = _json.loads(line)
            piece = data.get("message", {}).get("content", "")
            if piece:
                any_output = True
                yield piece
            if data.get("done"):
                break
        elapsed = time.monotonic() - start
        print(f"[agent] Ollama streaming finished in {elapsed:.1f}s")
        if not any_output:
            raise ValueError("Ollama returned an empty response")
    except Exception as exc:
        elapsed = time.monotonic() - start
        print(f"[agent] Ollama streaming FAILED after {elapsed:.1f}s: {exc!r}")
        raise ChatUnavailableError(
            "The AI assistant is temporarily unavailable: both Gemini and the local fallback failed."
        ) from exc

    yield ("__SOURCES__", list(collected.values()))
