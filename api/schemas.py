"""
Pydantic response models for the recommendation API.
"""

from __future__ import annotations

from pydantic import BaseModel


class MangaSummary(BaseModel):
    gold_id: str
    title: str
    year: int | None = None
    genres: list[str] = []
    sources: list[str] = []
    source_count: int
    match_confidence: str


class MangaDetail(MangaSummary):
    description: str | None = None
    status_raw: str | None = None
    chapters: int | None = None
    volumes: int | None = None
    rating_combined: float | None = None
    cover_image_url: str | None = None


class RecommendationResult(MangaSummary):
    similarity_score: float


class SearchResponse(BaseModel):
    query: str
    count: int
    results: list[MangaSummary]


class RecommendationResponse(BaseModel):
    query_manga: MangaSummary
    count: int
    results: list[RecommendationResult]


class HealthResponse(BaseModel):
    status: str
    total_gold_records: int
    indexed_records: int
