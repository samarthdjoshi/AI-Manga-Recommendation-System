from __future__ import annotations

from pydantic import BaseModel, Field


class MangaDiscoveryItem(BaseModel):
    """Normalized external/discovery manga representation."""

    external_id: str
    provider: str
    title: str
    alternative_titles: list[str] = Field(default_factory=list)
    cover_url: str | None = None
    banner_url: str | None = None
    score: float | None = None  # Normalized to 10.0 scale
    popularity: int | None = None
    rank: int | None = None
    trend: int | None = None
    status: str | None = None
    type: str | None = "MANGA"
    genres: list[str] = Field(default_factory=list)
    authors: list[str] = Field(default_factory=list)
    artists: list[str] = Field(default_factory=list)
    demographic: str | None = None
    description: str | None = None
    country: str | None = None
    source_url: str | None = None
    gold_id: str | None = None  # Populated when mapped to local catalog


class DiscoveryFeedResponse(BaseModel):
    """Normalized response envelope for discovery feeds."""

    feed_type: str
    provider: str
    total: int
    page: int
    per_page: int
    cached: bool = False
    results: list[MangaDiscoveryItem]
