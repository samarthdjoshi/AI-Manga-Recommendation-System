"""
Pydantic response models for the recommendation API.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class MangaSummary(BaseModel):
    gold_id: str
    title: str
    year: int | None = None
    genres: list[str] = []
    sources: list[str] = []
    source_count: int
    match_confidence: str
    cover_image_url: str | None = None
    rating_combined: float | None = None
    chapters: int | None = None


class OfficialLink(BaseModel):
    url: str
    site: str | None = None
    language: str | None = None


class OfficialLinks(BaseModel):
    read: list[OfficialLink] = []
    info: list[OfficialLink] = []


class MangaDetail(MangaSummary):
    description: str | None = None
    status_raw: str | None = None
    media_type: str | None = None
    format_raw: str | None = None
    demographic: str | None = None
    authors: list[str] = []
    artists: list[str] = []
    volumes: int | None = None
    official_links: OfficialLinks | None = None
    source_urls: dict[str, str] | None = None
    rating_combined_sources: list[str] = []
    rating_anilist: float | None = None
    rating_mangaupdates: float | None = None



class RecommendationResult(MangaSummary):
    similarity_score: float


class SearchResponse(BaseModel):
    query: str
    count: int
    results: list[MangaSummary]


class RecommendationResponse(BaseModel):
    query_manga: MangaSummary | None = None
    count: int
    results: list[RecommendationResult]


class DiscoverResponse(BaseModel):
    sort: str
    count: int
    results: list[MangaSummary]


class SuggestResult(BaseModel):
    gold_id: str
    title: str
    cover_image_url: str | None = None
    year: int | None = None
    rating_combined: float | None = None
    genres: list[str] = Field(default_factory=list)
    type: str | None = None


class SuggestResponse(BaseModel):
    query: str
    results: list[SuggestResult]


class HealthResponse(BaseModel):
    status: str
    total_gold_records: int
    indexed_records: int
    version: str | None = None


class BrowseResponse(BaseModel):
    count: int
    total: int
    results: list[MangaSummary]


class GenreListResponse(BaseModel):
    genres: list[str]


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=4_000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4_000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)
    hide_explicit: bool = True
    hide_doujinshi: bool = True
    page_context_gold_id: str | None = None


class ChatSource(BaseModel):
    gold_id: str
    title: str
    cover_image_url: str | None = None
    year: int | None = None
    rating: float | None = None
    genres: list[str] = Field(default_factory=list)
    reason: str | None = None


class ChatResponse(BaseModel):
    reply: str
    sources: list[ChatSource] = Field(default_factory=list)
    status: str = Field(default="ok", pattern="^(ok|assistant_unavailable)$")
    provider: str | None = None
    suggestions: list[str] = Field(default_factory=list)


class BatchMangaRequest(BaseModel):
    gold_ids: list[str] = Field(default_factory=list, max_length=500)


class BatchMangaResponse(BaseModel):
    results: dict[str, MangaDetail]
