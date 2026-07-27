"""
Normalizes MangaUpdates Bronze records into UnifiedMangaRecord.

MangaUpdates search endpoint exposes only a single flat title field
with no language variants - unlike AniList/MangaDex, there is no
fallback tier to resolve; whatever they give us IS the title.
"""

from __future__ import annotations

from ml.normalization.schema import UnifiedMangaRecord, safe_int


def normalize_mangaupdates_record(record: dict) -> UnifiedMangaRecord:
    genres = [g.get("genre") for g in (record.get("genres") or []) if g.get("genre")]

    image = record.get("image") or {}
    image_url = (image.get("url") or {}).get("original")

    return UnifiedMangaRecord(
        source="mangaupdates",
        source_id=str(record.get("series_id")),
        title=record.get("title") or "Unknown Title",
        title_source="direct",
        original_title=None,
        description=record.get("description") or None,
        genres=genres,
        status_raw=None,
        chapters=None,
        volumes=None,
        year=safe_int(record.get("year")),
        rating_raw=record.get("bayesian_rating"),
        rating_scale="0-10",
        cover_image_url=image_url,
        url=record.get("url"),
        extra={
            "type": record.get("type"),
            "rating_votes": record.get("rating_votes"),
        },
    )
