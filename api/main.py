"""
FastAPI wrapper over the content-based manga recommendation pipeline.

Run with:
    uvicorn api.main:app --reload

Then visit http://127.0.0.1:8000/docs for interactive API docs.
"""

from __future__ import annotations

import threading
import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from api.routes_discovery import configure_discovery_fallback, router as discovery_router
from api.schemas import (
    BrowseResponse,
    ChatRequest,
    ChatResponse,
    ChatSource,
    DiscoverResponse,
    GenreListResponse,
    HealthResponse,
    MangaDetail,
    RecommendationResponse,
    RecommendationResult,
    SearchResponse,
    SuggestResponse,
    SuggestResult,
)
from auth.database import Favorite, TrackingEntry, User, get_db, init_db
from auth.routes import (
    configure_catalog_external_resolver,
    configure_catalog_id_validator,
    configure_catalog_title_getter,
    configure_catalog_title_resolver,
    get_current_user,
    get_optional_user,
    router as auth_router,
)
from common.config import settings
from ml.recommender.agent import ChatUnavailableError, run_agent_chat
from ml.recommender.service import EXPLICIT_GENRES, MangaNotFoundError, RecommenderService

service: RecommenderService | None = None
chat_retriever = None
chat_retriever_lock = threading.Lock()
optional_bearer_scheme = HTTPBearer(auto_error=False)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global service
    init_db()
    if service is None:
        print("Loading Gold records and similarity index...")
        service = RecommenderService()
        print(f"Loaded {service.total_records} Gold records, "
              f"{service.indexed_records} indexed for similarity search.")
    
    import re

    def _catalog_validator(gid: str, title: str | None = None, allow_create: bool = False) -> bool:
        if gid in service.records_by_gold_id:
            if title and (not service.records_by_gold_id[gid].get("title") or service.records_by_gold_id[gid].get("title") == gid):
                service.records_by_gold_id[gid]["title"] = title
            return True
        if allow_create and hasattr(service, "ensure_catalog_record") and re.match(r"^(anilist|mal|mangadex|mangaupdates|custom):[a-zA-Z0-9_\-]+$", str(gid).strip()):
            service.ensure_catalog_record(gid, title)
            return True
        return False

    configure_catalog_id_validator(_catalog_validator)
    if hasattr(service, "resolve_external_id_to_gold_id"):
        configure_catalog_external_resolver(service.resolve_external_id_to_gold_id)
    if hasattr(service, "resolve_title_to_gold_id"):
        configure_catalog_title_resolver(service.resolve_title_to_gold_id)
    else:
        configure_catalog_title_resolver(
            lambda title: next(
                (gid for gid, r in service.records_by_gold_id.items() if (r.get("title") or "").strip().lower() == title.strip().lower()),
                None,
            )
        )
    configure_catalog_title_getter(
        lambda gid: service.records_by_gold_id.get(gid, {}).get("title", "")
    )
    configure_discovery_fallback(service)
    yield
    print("Shutting down.")


app = FastAPI(
    title="Manga Recommendation API",
    description="Content-based manga recommendations built from AniList, MangaDex, and MangaUpdates.",
    version="1.0.0",
    lifespan=lifespan,
)

cors_origins = [
    origin.strip()
    for origin in settings.CORS_ALLOWED_ORIGINS.split(",")
    if origin.strip()
]
default_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "https://ai-manga-recommendation-system.vercel.app",
]
for o in default_origins:
    if o not in cors_origins:
        cors_origins.append(o)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(discovery_router)


def extract_current_user_id_from_auth_token(token: str | None) -> int | None:
    if not token:
        return None
    try:
        import jwt as _jwt
        decoded = _jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        raw_id = decoded.get("sub") or decoded.get("user_id") or decoded.get("id")
        return int(raw_id) if raw_id is not None else None
    except Exception:
        return None


def get_service() -> RecommenderService:
    if service is None:
        raise HTTPException(status_code=503, detail="Service is still starting up")
    return service


def get_chat_retriever():
    global chat_retriever
    if chat_retriever is not None:
        return chat_retriever

    with chat_retriever_lock:
        if chat_retriever is None:
            try:
                from ml.recommender.chat_retrieval import ChatRetriever
                chat_retriever = ChatRetriever()
            except Exception as exc:
                raise HTTPException(
                    status_code=503,
                    detail="The AI assistant is temporarily unavailable. Please try again shortly.",
                ) from exc
    return chat_retriever


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    svc = get_service()
    return HealthResponse(
        status="ok",
        total_gold_records=svc.total_records,
        indexed_records=svc.indexed_records,
    )


@app.get("/search", response_model=SearchResponse)
def search(
    q: str = Query(..., min_length=1, description="Title text to search for"),
    limit: int = Query(10, ge=1, le=25, description="Max results to return"),
) -> SearchResponse:
    svc = get_service()
    results = svc.search(q, limit=limit)
    return SearchResponse(query=q, count=len(results), results=results)


@app.get("/manga/{gold_id}", response_model=MangaDetail)
def get_manga(gold_id: str) -> MangaDetail:
    svc = get_service()
    try:
        record = svc.get_by_id(gold_id)
    except MangaNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return record


@app.get("/recommend/for-me", response_model=RecommendationResponse)
def recommend_for_me(
    top_k: int = Query(60, ge=1, le=100, description="Number of recommendations to return"),
    alpha: float = Query(0.6, ge=0, le=1, description="Weight for content score vs collaborative score"),
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> RecommendationResponse:
    svc = get_service()

    favorite_gold_ids: list[str] = []
    if current_user:
        user_favorites = (
            db.query(Favorite.gold_id)
            .filter(Favorite.user_id == current_user.id)
            .all()
        )
        fav_gids = [row[0] for row in user_favorites]

        tracking_entries = (
            db.query(TrackingEntry.gold_id)
            .filter(TrackingEntry.user_id == current_user.id)
            .order_by(TrackingEntry.score.desc().nullslast(), TrackingEntry.updated_at.desc())
            .all()
        )
        track_gids = [row[0] for row in tracking_entries]

        favorite_gold_ids = list(dict.fromkeys(fav_gids + track_gids))

    if not favorite_gold_ids:
        # Fall back gracefully to top catalog records so recommendations are never empty
        pop_records = getattr(svc, "_records_by_popularity", svc.records)
        records = pop_records[:top_k]
        return RecommendationResponse(
            query_manga=None,
            count=len(records),
            results=[
                RecommendationResult(
                    **r,
                    similarity_score=round(1.0 - (i / max(len(records), 1)) * 0.35, 3),
                )
                for i, r in enumerate(records)
            ],
        )

    all_favorites_rows = db.query(Favorite.user_id, Favorite.gold_id).all()
    all_users_favorites: dict[int, list[str]] = {}
    for user_id, gold_id in all_favorites_rows:
        all_users_favorites.setdefault(user_id, []).append(gold_id)

    results = svc.recommend_hybrid(
        favorite_gold_ids=favorite_gold_ids,
        all_users_favorites=all_users_favorites,
        top_k=top_k,
        alpha=alpha,
    )

    # If hybrid returned fewer than top_k, top up with highest-popularity catalog titles
    if len(results) < top_k:
        existing_gids = {r["gold_id"] for r in results} | set(favorite_gold_ids)
        pop_records = getattr(svc, "_records_by_popularity", svc.records)
        for r in pop_records:
            if r["gold_id"] not in existing_gids:
                results.append({**r, "similarity_score": 0.5})
                existing_gids.add(r["gold_id"])
                if len(results) >= top_k:
                    break

    return RecommendationResponse(
        query_manga=None,
        count=len(results),
        results=[RecommendationResult(**r) for r in results],
    )


@app.get("/recommend/{gold_id}", response_model=RecommendationResponse)
def recommend(
    gold_id: str,
    top_k: int = Query(10, ge=1, le=100, description="Number of recommendations to return"),
) -> RecommendationResponse:
    svc = get_service()
    try:
        query_manga = svc.get_by_id(gold_id)
        results = svc.recommend(gold_id, top_k=top_k)
    except MangaNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return RecommendationResponse(
        query_manga=query_manga,
        count=len(results),
        results=[RecommendationResult(**r) for r in results],
    )


@app.get("/discover", response_model=DiscoverResponse)
def discover(
    sort: str = Query("rating", pattern="^(rating|corroborated)$", description="rating or corroborated"),
    limit: int = Query(12, ge=1, le=25, description="Max results to return"),
) -> DiscoverResponse:
    svc = get_service()
    results = svc.discover(sort=sort, limit=limit)
    return DiscoverResponse(sort=sort, count=len(results), results=results)


@app.get("/search/suggest", response_model=SuggestResponse)
def search_suggest(
    q: str = Query(..., min_length=1, description="Partial title text for autocomplete"),
    limit: int = Query(6, ge=1, le=10, description="Max suggestions to return"),
) -> SuggestResponse:
    svc = get_service()
    results = svc.search(q, limit=limit)
    return SuggestResponse(query=q, results=[SuggestResult(**r) for r in results])


@app.get("/browse", response_model=BrowseResponse)
def browse(
    q: str | None = Query(None, description="Title search term to filter results"),
    genre: list[str] | None = Query(None, description="Repeat param for multiple genres (AND match)"),
    exclude_genre: list[str] | None = Query(None, description="Repeat param for genres to exclude"),
    status: str | None = Query(None, pattern="^(completed|releasing|hiatus|cancelled)$", description="Publication status"),
    year_min: int | None = Query(None, description="Minimum release year"),
    year_max: int | None = Query(None, description="Maximum release year"),
    min_chapters: int | None = Query(None, ge=0, description="Minimum chapter count"),
    max_chapters: int | None = Query(None, ge=0, description="Maximum chapter count"),
    min_rating: float | None = Query(None, ge=0.0, le=10.0, description="Minimum combined rating (0-10)"),
    min_sources: int | None = Query(None, ge=1, le=3, description="Minimum corroborating sources (1-3)"),
    has_official_links: bool | None = Query(None, description="Filter for titles with official read/info links"),
    genre_match: str = Query("and", pattern="^(and|or)$"),
    hide_explicit: bool = Query(True, description="Exclude titles tagged with explicit-content genres"),
    hide_doujinshi: bool = Query(True, description="Exclude titles tagged as doujinshi"),
    sort: str = Query("rating", pattern="^(rating|highest_rated|corroborated|newest|year_newest|year_oldest|title|title_asc|title_desc|best_match|latest_update|recently_added|most_viewed_7d|most_viewed_30d|most_viewed_90d|most_viewed_all|most_followed)$", description="Sort ordering for catalog results"),
    limit: int = Query(24, ge=1, le=100, description="Max results to return"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
) -> BrowseResponse:
    svc = get_service()
    results, total = svc.browse(
        q=q,
        genres=genre,
        exclude_genres=exclude_genre,
        status=status,
        genre_match=genre_match,
        hide_explicit=hide_explicit,
        hide_doujinshi=hide_doujinshi,
        year_min=year_min,
        year_max=year_max,
        min_chapters=min_chapters,
        max_chapters=max_chapters,
        min_rating=min_rating,
        min_sources=min_sources,
        has_official_links=has_official_links,
        sort=sort,
        limit=limit,
        offset=offset,
    )
    return BrowseResponse(count=len(results), total=total, results=results)


@app.get("/genres", response_model=GenreListResponse)
def genres() -> GenreListResponse:
    svc = get_service()
    return GenreListResponse(genres=svc.list_genres())


def _passes_content_filters(record: dict, hide_explicit: bool, hide_doujinshi: bool) -> bool:
    genres_lower = {g.lower() for g in (record.get("genres") or [])}
    if hide_explicit and (EXPLICIT_GENRES & genres_lower):
        return False
    if hide_doujinshi and ("doujinshi" in genres_lower):
        return False
    return True


def _build_fallback_catalog_records(
    svc: RecommenderService,
    retriever: object,
    query: str,
    hide_explicit: bool,
    hide_doujinshi: bool,
    limit: int = 6,
) -> list[dict]:
    results: list[dict] = []
    seen_ids: set[str] = set()

    # 1. Semantic search if retriever available
    if retriever and hasattr(retriever, "semantic_search"):
        try:
            hits = retriever.semantic_search(query, top_k=limit * 2)
            for gid, _score in hits:
                rec = svc.records_by_gold_id.get(gid)
                if rec and _passes_content_filters(rec, hide_explicit, hide_doujinshi):
                    if gid not in seen_ids:
                        seen_ids.add(gid)
                        r_copy = dict(rec)
                        r_copy["reason"] = "Semantic catalog match"
                        results.append(r_copy)
                if len(results) >= limit:
                    break
        except Exception as exc:  # noqa: BLE001
            print(f"[chat] Fallback semantic search error: {exc}")

    # 2. Keyword/title text search if more results needed
    if len(results) < limit:
        try:
            text_matches = svc.search(query, limit=limit * 2)
            for rec in text_matches:
                gid = rec.get("gold_id")
                if gid and gid not in seen_ids and _passes_content_filters(rec, hide_explicit, hide_doujinshi):
                    seen_ids.add(gid)
                    r_copy = dict(rec)
                    r_copy["reason"] = "Catalog keyword match"
                    results.append(r_copy)
                if len(results) >= limit:
                    break
        except Exception as exc:  # noqa: BLE001
            print(f"[chat] Fallback text search error: {exc}")

    return results


@app.post("/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer_scheme),
    db: Session = Depends(get_db),
) -> ChatResponse:
    svc = get_service()
    retriever = get_chat_retriever()

    current_user_id = extract_current_user_id_from_auth_token(
        credentials.credentials if credentials else None
    )

    correlation_id = uuid.uuid4().hex[:8]
    status = "ok"
    provider = "gemini"
    suggestions: list[str] = []

    try:
        agent_res = run_agent_chat(
            message=payload.message,
            history=[m.model_dump() for m in payload.history],
            svc=svc,
            retriever=retriever,
            hide_explicit=payload.hide_explicit,
            hide_doujinshi=payload.hide_doujinshi,
            page_context_gold_id=payload.page_context_gold_id,
            current_user_id=current_user_id,
            db=db,
            force_provider=None,
        )
        reply_text, source_records = agent_res
        provider = getattr(agent_res, "provider", "gemini")
    except Exception as exc:  # noqa: BLE001
        err_type = type(exc).__name__
        print(f"[chat:{correlation_id}] Assistant provider failure ({err_type}): {exc}")
        status = "assistant_unavailable"
        provider = None

        fallback_records = _build_fallback_catalog_records(
            svc=svc,
            retriever=retriever,
            query=payload.message,
            hide_explicit=payload.hide_explicit,
            hide_doujinshi=payload.hide_doujinshi,
        )
        source_records = fallback_records

        reply_text = (
            "The AI assistant is temporarily offline. Here are relevant matching titles "
            "found directly in our catalog for your search:"
            if fallback_records
            else (
                "The AI assistant is temporarily offline, and no direct catalog matches were found "
                "for your query. Try searching by specific genres or titles."
            )
        )
        suggestions = [
            "Action & Adventure",
            "Top Rated Romance",
            "Dark Fantasy & Horror",
            "Popular Manhwa",
        ]

    sources = [
        ChatSource(
            gold_id=r["gold_id"],
            title=r.get("title", ""),
            cover_image_url=r.get("cover_image_url"),
            year=r.get("year"),
            rating=r.get("rating") if r.get("rating") is not None else r.get("rating_combined"),
            genres=(r.get("genres") or [])[:5],
            reason=r.get("reason"),
        )
        for r in source_records
    ]

    return ChatResponse(
        reply=reply_text,
        sources=sources,
        status=status,
        provider=provider,
        suggestions=suggestions,
    )
