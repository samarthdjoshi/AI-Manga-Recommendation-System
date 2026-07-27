"""
Unified Silver-layer record schema.

Each source-specific normalizer converts its own Bronze record shape
into this common structure. Status and rating are intentionally kept
source-native (not mapped to a shared vocabulary/scale yet) - that
harmonization is deferred until we've reviewed real value
distributions across all sources, rather than guessing a mapping now.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class UnifiedMangaRecord:
    source: str
    source_id: str

    title: str
    title_source: str
    original_title: str | None = None

    description: str | None = None
    genres: list[str] = field(default_factory=list)

    status_raw: str | None = None
    chapters: int | None = None
    volumes: int | None = None
    year: int | None = None

    rating_raw: float | None = None
    rating_scale: str | None = None

    cover_image_url: str | None = None
    url: str | None = None

    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


def safe_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
