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

# Tried in order. gemini-3.6-flash and gemini-3.5-flash offer
# ultra-fast response times (<2s) and highest reliability for tools and recommendations.
MODEL_CHAIN = ["gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-flash-latest"]

GEMINI_TIMEOUT_MS = 10000  # 10 seconds server-side timeout
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

Rules:
- For any request asking for recommendations, genres, tropes, characters, or descriptions, you MUST call \
`semantic_search_manga` or `search_manga` before giving your answer.
- Examples:
  * "a manhwa with strong fl/fmc" -> call semantic_search_manga(description="manhwa with strong female lead fmc")
  * "dark fantasy with deep lore" -> call semantic_search_manga(description="dark fantasy with deep lore")
  * "action manga after 2018" -> call search_manga(query="", genres=["Action"], year_min=2018)
  * "something like Solo Leveling" -> call get_similar_manga(title="Solo Leveling")
- Base all your recommendations only on the titles returned by these tool calls. Mention their real title, year, rating, and briefly why they match.
- If no results are found, suggest alternative catalog genres to explore.
- Keep answers concise, clear, and helpful.
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
        "description": (record.get("description") or "")[:300],
    }


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
            # Tool output is available to the model and can be reflected back
            # to the user. Never place exception strings, schemas, or storage
            # details in it.
            return {"error": "This catalog tool is temporarily unavailable."}
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
        else:
            page, _total = svc.browse(
                genres=genres, year_min=year_min, year_max=year_max,
                min_chapters=min_chapters, hide_explicit=hide_explicit,
                sort=sort, limit=limit * 2,
            )
            results.extend(page)

        if genres:
            wanted = {g.lower() for g in genres}
            results = [r for r in results if wanted & {g.lower() for g in (r.get("genres") or [])}]
        if year_min is not None:
            results = [r for r in results if r.get("year") and r["year"] >= year_min]
        if year_max is not None:
            results = [r for r in results if r.get("year") and r["year"] <= year_max]
        if min_chapters is not None:
            results = [r for r in results if (r.get("chapters") or 0) >= min_chapters]

        results = [r for r in results if _passes_filters(r, hide_explicit, hide_doujinshi)][:limit]
        _record_sources(results)
        return [_simplify(r) for r in results]

    def semantic_search_manga(description: str, top_k: int = 8) -> list[dict]:
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

    def get_similar_manga(title: str, top_k: int = 8) -> list[dict]:
        """Get manga similar to a specific named title, using the app's real
        content-based similarity engine. Use this whenever the user references a
        specific title and wants "more like this" - including when they say
        "it"/"this"/"that" while viewing a manga's page.

        Args:
            title: The reference title to find similar manga to.
            top_k: Max results, up to 15.
        """
        top_k = max(1, min(top_k, 15))
        matches = svc.search(title, limit=1)
        if not matches:
            return []
        gold_id = matches[0]["gold_id"]
        try:
            results = svc.recommend(gold_id, top_k=top_k * 2)
        except Exception:
            # Fallback to search if similarity index is unavailable for this title
            results = svc.search(title, limit=top_k)
        results = [r for r in results if _passes_filters(r, hide_explicit, hide_doujinshi)][:top_k]
        _record_sources(results)
        return [_simplify(r) for r in results]

    def get_user_favorites() -> dict:
        """Get the current logged-in user's favorited manga. Returns
        {"logged_in": False} if there is no logged-in user, or
        {"logged_in": True, "favorites": [...]} otherwise."""
        if current_user_id is None:
            return {"logged_in": False}
        from auth.database import Favorite
        rows = db.query(Favorite.gold_id).filter(Favorite.user_id == current_user_id).all()
        gold_ids = [row[0] for row in rows]
        records = [svc.records_by_gold_id[g] for g in gold_ids if g in svc.records_by_gold_id]
        records = [r for r in records if _passes_filters(r, hide_explicit, hide_doujinshi)]
        _record_sources(records)
        return {"logged_in": True, "favorites": [_simplify(r) for r in records]}

    def get_personalized_recommendations(top_k: int = 8) -> dict:
        """Get personalized recommendations for the current logged-in user, blending
        favorites (content similarity) with similar users' favorites (collaborative
        signal). Returns {"logged_in": False} if no user is logged in."""
        if current_user_id is None:
            return {"logged_in": False}
        from auth.database import Favorite
        top_k = max(1, min(top_k, 15))

        user_rows = db.query(Favorite.gold_id).filter(Favorite.user_id == current_user_id).all()
        favorite_gold_ids = [row[0] for row in user_rows]
        if not favorite_gold_ids:
            return {"logged_in": True, "recommendations": [], "note": "user has no favorites yet"}

        all_rows = db.query(Favorite.user_id, Favorite.gold_id).all()
        all_users_favorites: dict[int, list[str]] = {}
        for uid, gid in all_rows:
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
            if not collected:
                if hasattr(svc, "find_titles_mentioned_in_text"):
                    for m in svc.find_titles_mentioned_in_text(reply_text, limit=6):
                        if _passes_filters(m, hide_explicit, hide_doujinshi):
                            gid = m.get("gold_id")
                            if gid and gid not in collected:
                                collected[gid] = m
                if not collected and helpers and "semantic_search_manga" in helpers:
                    helpers["semantic_search_manga"](message, top_k=4)
            return AgentChatResult(reply_text, list(collected.values()), "gemini")
        except (genai_errors.APIError, httpx.RequestError, TimeoutError, ConnectionError, OSError) as exc:
            err_type = type(exc).__name__
            print(f"[agent] Gemini model {model_name!r} failed ({err_type}), trying next in chain: {exc}")
            last_gemini_error = exc
            continue

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

    if not collected and hasattr(svc, "find_titles_mentioned_in_text"):
        for m in svc.find_titles_mentioned_in_text(reply_text, limit=6):
            if _passes_filters(m, hide_explicit, hide_doujinshi):
                gid = m.get("gold_id")
                if gid and gid not in collected:
                    collected[gid] = m

    return AgentChatResult(reply_text, list(collected.values()), "ollama")


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
                    yield text
            yield ("__SOURCES__", list(collected.values()))
            return
        except (genai_errors.APIError, httpx.RequestError, TimeoutError, ConnectionError, OSError) as exc:
            err_type = type(exc).__name__
            if any_output:
                # Already streamed real content to the user - don't
                # silently retry on a different model mid-answer, that
                # would produce a garbled duplicate response. Just stop.
                print(f"[agent] Gemini model {model_name!r} failed mid-stream ({err_type}): {exc}")
                yield ("__SOURCES__", list(collected.values()))
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
