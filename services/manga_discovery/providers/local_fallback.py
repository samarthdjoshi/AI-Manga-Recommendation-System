"""
Local Fallback Discovery Provider.
Uses the local Gold catalog via RecommenderService when external APIs are unavailable.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from services.manga_discovery.base import BaseDiscoveryProvider
from services.manga_discovery.schemas import MangaDiscoveryItem

if TYPE_CHECKING:
    from ml.recommender.service import RecommenderService


def _normalize_gold_record(record: dict[str, Any], rank: int | None = None) -> MangaDiscoveryItem:
    gold_id = record.get("gold_id", "")
    title = record.get("title") or "Untitled"
    cover = record.get("cover_image_url")
    score = record.get("rating_combined")
    
    # Authors and artists
    authors = record.get("authors") or []
    artists = record.get("artists") or []
    genres = record.get("genres") or []

    return MangaDiscoveryItem(
        external_id=gold_id,
        provider="local_gold",
        title=title,
        alternative_titles=[],
        cover_url=cover,
        banner_url=None,
        score=score,
        popularity=record.get("source_count", 1) * 100,
        rank=rank,
        trend=None,
        status="FINISHED" if record.get("chapters") else "RELEASING",
        type=record.get("type") or "MANGA",
        genres=genres,
        authors=authors,
        artists=artists,
        demographic=record.get("demographic"),
        description=record.get("description"),
        country=None,
        source_url=None,
        gold_id=gold_id,
    )


class LocalFallbackProvider(BaseDiscoveryProvider):
    """Fallback provider serving discovery feeds from the offline Gold catalog."""

    def __init__(self, service: RecommenderService) -> None:
        self.service = service

    @property
    def name(self) -> str:
        return "local_gold"

    def get_trending(self, limit: int = 20, page: int = 1) -> list[MangaDiscoveryItem]:
        # Corroborated consensus titles represent high-confidence trending favorites
        records = self.service.discover(sort="corroborated", limit=min(limit * page, 50))
        slice_start = (page - 1) * limit
        selected = records[slice_start : slice_start + limit]
        return [_normalize_gold_record(r, rank=slice_start + idx + 1) for idx, r in enumerate(selected)]

    def get_popular(self, limit: int = 20, page: int = 1) -> list[MangaDiscoveryItem]:
        # Top rated titles
        records = self.service.discover(sort="rating", limit=min(limit * page, 50))
        slice_start = (page - 1) * limit
        selected = records[slice_start : slice_start + limit]
        return [_normalize_gold_record(r, rank=slice_start + idx + 1) for idx, r in enumerate(selected)]

    def get_top_100(self, limit: int = 100, page: int = 1) -> list[MangaDiscoveryItem]:
        records, _ = self.service.browse(
            sort="rating",
            limit=limit,
            offset=(page - 1) * limit,
            hide_explicit=True,
        )
        return [_normalize_gold_record(r, rank=(page - 1) * limit + idx + 1) for idx, r in enumerate(records)]

    def get_popular_manhwa(self, limit: int = 20, page: int = 1) -> list[MangaDiscoveryItem]:
        # Filter browse for manhwa or webtoon genres
        records, _ = self.service.browse(
            genres=["Manhwa"],
            sort="rating",
            limit=limit,
            offset=(page - 1) * limit,
            hide_explicit=True,
        )
        if not records:
            # Fallback to webtoon or popular if genre tag isn't explicitly 'Manhwa'
            records, _ = self.service.browse(
                sort="rating",
                limit=limit,
                offset=(page - 1) * limit,
                hide_explicit=True,
            )
        return [_normalize_gold_record(r, rank=(page - 1) * limit + idx + 1) for idx, r in enumerate(records)]
