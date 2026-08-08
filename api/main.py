"""
FastAPI wrapper over the content-based manga recommendation pipeline.

Run with:
    uvicorn api.main:app --reload

Then visit http://127.0.0.1:8000/docs for interactive API docs.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from api.schemas import (
    BrowseResponse,
    GenreListResponse,
    DiscoverResponse,
    HealthResponse,
    MangaDetail,
    RecommendationResponse,
    RecommendationResult,
    SearchResponse,
    SuggestResponse,
    SuggestResult,
)
from ml.recommender.service import MangaNotFoundError, RecommenderService

service: RecommenderService | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global service
    print("Loading Gold records and similarity index...")
    service = RecommenderService()
    print(f"Loaded {service.total_records} Gold records, "
          f"{service.indexed_records} indexed for similarity search.")
    yield
    print("Shutting down.")


app = FastAPI(
    title="Manga Recommendation API",
    description="Content-based manga recommendations built from AniList, MangaDex, and MangaUpdates.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def get_service() -> RecommenderService:
    if service is None:
        raise HTTPException(status_code=503, detail="Service is still starting up")
    return service


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


@app.get("/recommend/{gold_id}", response_model=RecommendationResponse)
def recommend(
    gold_id: str,
    top_k: int = Query(10, ge=1, le=50, description="Number of recommendations to return"),
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
    genre: list[str] | None = Query(None, description="Repeat param for multiple genres (AND match)"),
    year_min: int | None = Query(None, description="Minimum release year"),
    year_max: int | None = Query(None, description="Maximum release year"),
    min_chapters: int | None = Query(None, ge=0, description="Minimum chapter count"),
    genre_match: str = Query("and", pattern="^(and|or)$"),
    hide_explicit: bool = Query(True, description="Exclude titles tagged with explicit-content genres"),
    sort: str = Query("rating", pattern="^(rating|corroborated|newest|title)$"),
    limit: int = Query(24, ge=1, le=100, description="Max results to return"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
) -> BrowseResponse:
    svc = get_service()
    results, total = svc.browse(
        genres=genre,
        genre_match=genre_match,
        hide_explicit=hide_explicit,
        year_min=year_min,
        year_max=year_max,
        min_chapters=min_chapters,
        sort=sort,
        limit=limit,
        offset=offset,
    )
    return BrowseResponse(count=len(results), total=total, results=results)


@app.get("/genres", response_model=GenreListResponse)
def genres() -> GenreListResponse:
    svc = get_service()
    return GenreListResponse(genres=svc.list_genres())


