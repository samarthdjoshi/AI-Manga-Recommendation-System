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
    HealthResponse,
    MangaDetail,
    RecommendationResponse,
    RecommendationResult,
    SearchResponse,
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
