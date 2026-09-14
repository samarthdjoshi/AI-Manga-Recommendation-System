"""Tests for real source metadata carried into the canonical Gold record."""

from __future__ import annotations

from ml.normalization.mangadex_normalizer import normalize_mangadex_record
from scripts.build_gold import build_gold_record


def test_mangadex_contributors_are_preserved() -> None:
    record = normalize_mangadex_record(
        {
            "id": "mangadex-id",
            "attributes": {
                "title": {"en": "A Title"},
                "publicationDemographic": "shounen",
                "status": "ongoing",
            },
            "relationships": [
                {"type": "author", "attributes": {"name": "Author One"}},
                {"type": "artist", "attributes": {"name": "Artist One"}},
                {"type": "artist", "attributes": {"name": "Artist One"}},
            ],
        }
    )

    assert record.extra["authors"] == ["Author One"]
    assert record.extra["artists"] == ["Artist One"]


def test_gold_metadata_uses_source_native_values() -> None:
    group = {
        "group_id": "gold:1",
        "match_confidence": "high",
        "source_count": 2,
        "members": [
            {"source": "mangadex", "source_id": "md-1"},
            {"source": "mangaupdates", "source_id": "mu-1"},
        ],
    }
    records_by_source = {
        "anilist": {},
        "mangadex": {
            "md-1": {
                "title": "A Title", "original_title": None, "description": None,
                "status_raw": "ongoing", "chapters": None, "volumes": None,
                "year": 2020, "cover_image_url": None, "genres": [], "url": None,
                "extra": {
                    "publication_demographic": "shounen",
                    "authors": ["Author One"], "artists": ["Artist One"],
                },
            }
        },
        "mangaupdates": {
            "mu-1": {
                "title": "A Title", "original_title": None, "description": None,
                "status_raw": None, "chapters": None, "volumes": None,
                "year": 2020, "cover_image_url": None, "genres": [], "url": None,
                "extra": {"type": "Manhwa"},
            }
        },
    }

    gold = build_gold_record(group, records_by_source)
    assert gold["media_type"] == "Manhwa"
    assert gold["demographic"] == "shounen"
    assert gold["authors"] == ["Author One"]
    assert gold["artists"] == ["Artist One"]
