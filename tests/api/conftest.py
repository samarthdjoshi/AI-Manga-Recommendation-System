"""Small deterministic catalog used for FastAPI contract tests.

The production catalog and FAISS index are validated separately because loading
them for every endpoint assertion needs several gigabytes of memory.  These
tests verify routing, validation, serialization, and filter behavior quickly.
"""

from __future__ import annotations

import pytest

import api.main as api_main
from auth.routes import (
    configure_catalog_external_resolver,
    configure_catalog_id_validator,
    configure_catalog_title_getter,
    configure_catalog_title_resolver,
)
from ml.recommender.service import EXPLICIT_GENRES, MangaNotFoundError


class ContractCatalog:
    """In-memory implementation of the service surface exercised by the API."""

    records = [
        {
            "gold_id": "anilist:30002",
            "title": "Berserk",
            "year": 1989,
            "genres": ["Action", "Drama", "Fantasy"],
            "sources": ["anilist", "mangadex", "mangaupdates"],
            "source_count": 3,
            "match_confidence": "high",
            "cover_image_url": None,
            "rating_combined": 9.4,
            "rating_combined_sources": ["anilist", "mangaupdates"],
            "rating_anilist": 9.5,
            "rating_mangaupdates": 9.3,
            "chapters": 380,
            "description": "A dark fantasy epic.",
            "status_raw": "releasing",
            "media_type": "Manga",
            "format_raw": "MANGA",
            "demographic": "shounen",
            "authors": ["Kentaro Miura"],
            "artists": ["Kentaro Miura"],
            "volumes": 43,
        },
        {
            "gold_id": "anilist:21",
            "title": "One Piece",
            "year": 1997,
            "genres": ["Action", "Adventure"],
            "sources": ["anilist", "mangadex"],
            "source_count": 2,
            "match_confidence": "high",
            "cover_image_url": None,
            "rating_combined": 9.1,
            "rating_combined_sources": ["anilist"],
            "rating_anilist": 9.1,
            "rating_mangaupdates": None,
            "chapters": 1100,
            "status_raw": "completed",
            "official_links": {
                "read": [{"url": "https://mangaplus.shueisha.co.jp/titles/100020", "site": "MANGA Plus"}],
                "info": [],
            },
        },
        {
            "gold_id": "anilist:99",
            "title": "Quiet Drama",
            "year": 2018,
            "genres": ["Drama"],
            "sources": ["anilist"],
            "source_count": 1,
            "match_confidence": "medium",
            "cover_image_url": None,
            "rating_combined": 7.0,
            "rating_combined_sources": ["anilist"],
            "rating_anilist": 7.0,
            "rating_mangaupdates": None,
            "chapters": 20,
        },
        {
            "gold_id": "anilist:100",
            "title": "Explicit Test Title",
            "year": 2020,
            "genres": ["Hentai"],
            "sources": ["anilist"],
            "source_count": 1,
            "match_confidence": "medium",
            "cover_image_url": None,
            "rating_combined": 6.0,
            "chapters": 1,
        },
        {
            "gold_id": "anilist:101",
            "title": "Unrated Indie Story",
            "year": 2023,
            "genres": ["Slice of Life"],
            "sources": ["mangadex"],
            "source_count": 1,
            "match_confidence": "medium",
            "cover_image_url": None,
            "rating_combined": None,
            "rating_combined_sources": [],
            "rating_anilist": None,
            "rating_mangaupdates": None,
            "chapters": 5,
        },
    ]

    def __init__(self) -> None:
        self.records_by_gold_id = {record["gold_id"]: record for record in self.records}

    @property
    def total_records(self) -> int:
        return len(self.records)

    @property
    def indexed_records(self) -> int:
        return len(self.records)

    def search(self, query: str, limit: int = 25) -> list[dict]:
        normalized = query.lower()
        return [
            record for record in self.records if normalized in record["title"].lower()
        ][:limit]

    def get_by_id(self, gold_id: str) -> dict:
        try:
            return self.records_by_gold_id[gold_id]
        except KeyError as exc:
            raise MangaNotFoundError(f"Unknown catalog id: {gold_id}") from exc

    def recommend(self, gold_id: str, top_k: int = 10) -> list[dict]:
        self.get_by_id(gold_id)
        return [
            {**record, "similarity_score": 0.8}
            for record in self.records
            if record["gold_id"] != gold_id
        ][:top_k]

    def browse(
        self,
        q: str | None = None,
        genres: list[str] | None = None,
        exclude_genres: list[str] | None = None,
        genre_match: str = "and",
        hide_explicit: bool = True,
        hide_doujinshi: bool = True,
        status: str | None = None,
        year_min: int | None = None,
        year_max: int | None = None,
        min_chapters: int | None = None,
        max_chapters: int | None = None,
        min_rating: float | None = None,
        min_sources: int | None = None,
        has_official_links: bool | None = None,
        sort: str = "rating",
        limit: int = 24,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        filtered = self.records
        if q and q.strip():
            q_clean = q.strip().lower()
            filtered = [
                record for record in filtered
                if record.get("title") and q_clean in record["title"].lower()
            ]
        if genres:
            requested = {genre.strip().lower() for genre in genres if genre.strip()}
            if requested:
                if genre_match == "or":
                    filtered = [
                        record
                        for record in filtered
                        if requested & {genre.lower() for genre in (record.get("genres") or [])}
                    ]
                else:
                    filtered = [
                        record
                        for record in filtered
                        if requested.issubset({genre.lower() for genre in (record.get("genres") or [])})
                    ]
        if exclude_genres:
            unwanted = {genre.strip().lower() for genre in exclude_genres if genre.strip()}
            if unwanted:
                filtered = [
                    record
                    for record in filtered
                    if not (unwanted & {genre.lower() for genre in (record.get("genres") or [])})
                ]
        if status:
            status_lower = status.strip().lower()
            status_map = {
                "completed": {"completed", "finished"},
                "releasing": {"releasing", "ongoing"},
                "hiatus": {"hiatus"},
                "cancelled": {"cancelled"},
            }
            target_statuses = status_map.get(status_lower, {status_lower})
            filtered = [
                record for record in filtered
                if (record.get("status_raw") or "").lower() in target_statuses
            ]
        if hide_explicit:
            filtered = [
                record
                for record in filtered
                if not (EXPLICIT_GENRES & {genre.lower() for genre in (record.get("genres") or [])})
            ]
        if hide_doujinshi:
            filtered = [
                record
                for record in filtered
                if "doujinshi" not in {genre.lower() for genre in (record.get("genres") or [])}
            ]
        if year_min is not None:
            filtered = [record for record in filtered if record["year"] >= year_min]
        if year_max is not None:
            filtered = [record for record in filtered if record["year"] <= year_max]
        if min_chapters is not None:
            filtered = [record for record in filtered if record["chapters"] >= min_chapters]
        if max_chapters is not None:
            filtered = [record for record in filtered if record.get("chapters") is not None and record["chapters"] <= max_chapters]
        if min_rating is not None:
            filtered = [record for record in filtered if (record.get("rating_combined") or 0.0) >= min_rating]
        if min_sources is not None:
            filtered = [record for record in filtered if record.get("source_count", 0) >= min_sources]
        if has_official_links is not None:
            if has_official_links:
                filtered = [
                    record for record in filtered
                    if record.get("official_links") and (
                        (record["official_links"].get("read") and len(record["official_links"]["read"]) > 0)
                        or (record["official_links"].get("info") and len(record["official_links"]["info"]) > 0)
                    )
                ]
            else:
                filtered = [
                    record for record in filtered
                    if not (
                        record.get("official_links") and (
                            (record["official_links"].get("read") and len(record["official_links"]["read"]) > 0)
                            or (record["official_links"].get("info") and len(record["official_links"]["info"]) > 0)
                        )
                    )
                ]

        if sort in ("corroborated", "most_viewed_all"):
            filtered = sorted(
                filtered,
                key=lambda r: (r.get("source_count", 0), r.get("chapters") or 0, r.get("rating_combined") or 0.0),
                reverse=True,
            )
        elif sort in ("newest", "year_newest"):
            filtered = sorted(
                filtered,
                key=lambda r: (r.get("year") or 0, r.get("rating_combined") or 0.0),
                reverse=True,
            )
        elif sort == "year_oldest":
            filtered = sorted(
                filtered,
                key=lambda r: (r.get("year") or 9999, -(r.get("rating_combined") or 0.0)),
            )
        elif sort in ("title", "title_asc"):
            filtered = sorted(filtered, key=lambda r: (r.get("title") or "").strip().lower())
        elif sort == "title_desc":
            filtered = sorted(filtered, key=lambda r: (r.get("title") or "").strip().lower(), reverse=True)
        elif sort == "latest_update":
            filtered = sorted(
                filtered,
                key=lambda r: (
                    1 if (r.get("status_raw") or "").lower() in ("releasing", "ongoing") else 0,
                    r.get("year") or 0,
                    r.get("chapters") or 0,
                    r.get("rating_combined") or 0.0,
                ),
                reverse=True,
            )
        elif sort == "recently_added":
            filtered = sorted(
                filtered,
                key=lambda r: (
                    r.get("year") or 0,
                    r.get("gold_id") or "",
                ),
                reverse=True,
            )
        elif sort == "most_viewed_7d":
            filtered = sorted(
                filtered,
                key=lambda r: (
                    1 if (r.get("status_raw") or "").lower() in ("releasing", "ongoing") else 0,
                    r.get("source_count", 0),
                    r.get("rating_combined") or 0.0,
                ),
                reverse=True,
            )
        elif sort == "most_viewed_30d":
            filtered = sorted(
                filtered,
                key=lambda r: (
                    1 if (r.get("source_count", 0) >= 2) else 0,
                    r.get("rating_combined") or 0.0,
                    r.get("chapters") or 0,
                ),
                reverse=True,
            )
        elif sort == "most_viewed_90d":
            filtered = sorted(
                filtered,
                key=lambda r: (
                    r.get("source_count", 0),
                    r.get("rating_combined") or 0.0,
                    r.get("chapters") or 0,
                ),
                reverse=True,
            )
        elif sort == "most_followed":
            filtered = sorted(
                filtered,
                key=lambda r: (
                    r.get("source_count", 0),
                    r.get("rating_anilist") or 0.0,
                    r.get("rating_combined") or 0.0,
                ),
                reverse=True,
            )
        elif sort == "best_match":
            if q and q.strip():
                q_clean = q.strip().lower()

                def _match_score(r: dict) -> tuple:
                    t = (r.get("title") or "").strip().lower()
                    if t == q_clean:
                        tier = 3
                    elif t.startswith(q_clean):
                        tier = 2
                    elif q_clean in t:
                        tier = 1
                    else:
                        tier = 0
                    return (tier, r.get("rating_combined") or 0.0, r.get("source_count", 0))

                filtered = sorted(filtered, key=_match_score, reverse=True)
            else:
                filtered = sorted(
                    filtered,
                    key=lambda r: (r.get("rating_combined") or 0.0, r.get("source_count", 0)),
                    reverse=True,
                )
        else:  # "highest_rated" or legacy "rating"
            filtered = sorted(
                filtered,
                key=lambda r: (r.get("rating_combined") or 0.0, r.get("source_count", 0)),
                reverse=True,
            )
        return filtered[offset : offset + limit], len(filtered)

    def list_genres(self) -> list[str]:
        return sorted({genre for record in self.records for genre in record["genres"]})

    def find_titles_mentioned_in_text(self, text: str, limit: int = 3) -> list[dict]:
        text_lower = text.lower()
        matches = [r for r in self.records if r["title"].lower() in text_lower]
        return matches[:limit]

    def __init__(self) -> None:
        self.records = [dict(r) for r in self.__class__.records]
        self.records_by_gold_id = {r["gold_id"]: r for r in self.records}

    def ensure_catalog_record(self, gold_id: str, title: str | None = None) -> dict:
        if gold_id in self.records_by_gold_id:
            rec = self.records_by_gold_id[gold_id]
            if title and (not rec.get("title") or rec.get("title") == gold_id):
                rec["title"] = title
            return rec
        new_rec = {
            "gold_id": gold_id,
            "title": title or gold_id,
            "original_title": None,
            "cover_image_url": None,
            "year": 2020,
            "rating_combined": 8.0,
            "genres": ["Action"],
            "sources": [gold_id.split(":")[0]] if ":" in gold_id else ["external"],
            "source_count": 1,
            "match_confidence": "external",
            "chapters": 0,
        }
        self.records.append(new_rec)
        self.records_by_gold_id[gold_id] = new_rec
        return new_rec

    def resolve_external_id_to_gold_id(self, source: str, ext_id: str) -> str | None:
        src = (source or "").strip().lower()
        eid = str(ext_id or "").strip()
        for gid, r in self.records_by_gold_id.items():
            sids = r.get("source_ids") or {}
            if src in ("mal", "myanimelist") and str(sids.get("myanimelist") or "") == eid:
                return gid
        return None

    def resolve_title_to_gold_id(self, title: str) -> str | None:
        if not title:
            return None
        tl = title.strip().lower()
        for gid, r in self.records_by_gold_id.items():
            if (r.get("title") or "").strip().lower() == tl:
                return gid
        return None


@pytest.fixture(autouse=True)
def contract_catalog(monkeypatch: pytest.MonkeyPatch) -> ContractCatalog:
    import re
    catalog = ContractCatalog()
    monkeypatch.setattr(api_main, "service", catalog)

    def _validator(gid: str, title: str | None = None, allow_create: bool = False) -> bool:
        if gid in catalog.records_by_gold_id:
            return True
        if allow_create and re.match(r"^(anilist|mal|mangadex|mangaupdates|custom):[a-zA-Z0-9_\-]+$", str(gid).strip()):
            catalog.ensure_catalog_record(gid, title)
            return True
        return False

    configure_catalog_id_validator(_validator)
    configure_catalog_title_resolver(catalog.resolve_title_to_gold_id)
    configure_catalog_external_resolver(catalog.resolve_external_id_to_gold_id)
    configure_catalog_title_getter(
        lambda gid: catalog.records_by_gold_id.get(gid, {}).get("title", "")
    )
    return catalog
