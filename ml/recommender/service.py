"""
Shared recommendation service: loads Gold records + FAISS index once,
and exposes title search + similarity lookup. Used by both the
FastAPI layer and scripts/recommend.py, so the core logic lives in
exactly one tested place.
"""

from __future__ import annotations

import json
from pathlib import Path

import faiss

from common.paths import SILVER_DIR

DEFAULT_TOP_K = 10
MAX_TOP_K = 50
MAX_SEARCH_RESULTS = 25

# Genre tags that unambiguously indicate explicit sexual content. This is a
# heuristic proxy, not MangaDex's real per-title content_rating field (that
# field exists in Silver but was dropped during the Gold merge - see TODO
# in the entity-resolution/gold-build step to carry it through properly).
EXPLICIT_GENRES = {
    "hentai", "rape", "sexual violence", "ahegao", "nakadashi", "scat",
    "watersports", "ero guro", "zoophilia", "cervix penetration",
    "deepthroat", "double penetration", "fisting", "irrumatio", "rimjob",
    "scissoring", "sumata", "shimaidon", "netorare", "netorase", "netori",
    "anal sex", "ashikoki", "boobjob", "bondage", "cumflation",
    "cunnilingus", "defloration", "erotic piercings", "facial",
    "fellatio", "fingering", "group sex", "handjob", "public sex",
    "sex toys", "squirting", "oyakodon", "lolicon", "shotacon",
}


class MangaNotFoundError(Exception):
    pass


class RecommenderService:
    def __init__(self) -> None:
        gold_dir = SILVER_DIR.parent / "gold"
        model_dir = SILVER_DIR.parent / "model"

        records: list[dict] = []
        for page_file in sorted(gold_dir.glob("page_*.json")):
            data = json.loads(page_file.read_text(encoding="utf-8"))
            records.extend(data.get("records", []))

        self.records: list[dict] = records
        self.records_by_gold_id: dict[str, dict] = {r["gold_id"]: r for r in records}

        self.index = faiss.read_index(str(model_dir / "similarity_index.faiss"))
        with (model_dir / "index_gold_ids.json").open("r", encoding="utf-8") as f:
            self.index_gold_ids: list[str] = json.load(f)

        self.gold_id_to_row: dict[str, int] = {gid: i for i, gid in enumerate(self.index_gold_ids)}

    @property
    def total_records(self) -> int:
        return len(self.records)

    @property
    def indexed_records(self) -> int:
        return len(self.index_gold_ids)

    def search(self, query: str, limit: int = MAX_SEARCH_RESULTS) -> list[dict]:
        query_clean = (query or "").strip().lower()
        if not query_clean:
            return []

        limit = max(1, min(limit, MAX_SEARCH_RESULTS))

        matches = [
            r for r in self.records
            if r.get("title") and query_clean in r["title"].lower()
        ]
        matches.sort(key=lambda r: r.get("source_count", 0), reverse=True)
        return matches[:limit]

    def get_by_id(self, gold_id: str) -> dict:
        record = self.records_by_gold_id.get(gold_id)
        if record is None:
            raise MangaNotFoundError(f"No manga found with gold_id={gold_id!r}")
        return record

    def recommend(self, gold_id: str, top_k: int = DEFAULT_TOP_K) -> list[dict]:
        if gold_id not in self.records_by_gold_id:
            raise MangaNotFoundError(f"No manga found with gold_id={gold_id!r}")

        if gold_id not in self.gold_id_to_row:
            raise MangaNotFoundError(f"gold_id={gold_id!r} exists but is not in the similarity index")

        top_k = max(1, min(top_k, MAX_TOP_K))

        row = self.gold_id_to_row[gold_id]
        query_vector = self.index.reconstruct(row).reshape(1, -1)
        scores, row_indices = self.index.search(query_vector, top_k + 1)

        results = []
        for score, row_idx in zip(scores[0], row_indices[0]):
            candidate_gold_id = self.index_gold_ids[row_idx]
            if candidate_gold_id == gold_id:
                continue
            record = self.records_by_gold_id.get(candidate_gold_id)
            if record is None:
                continue
            results.append({**record, "similarity_score": float(score)})
            if len(results) >= top_k:
                break

        return results

    def discover(self, sort: str = "rating", limit: int = 12) -> list[dict]:
        """
        Returns a curated list of records for homepage discovery rails.

        sort="rating": ranked by rating_combined, weighted by total vote
        confidence (AniList favourites + MangaUpdates rating votes) as a
        popularity proxy - NOT a time-based "trending" signal, since we
        have no live update/activity data to base that on honestly.

        sort="corroborated": records confirmed across all 3 sources
        (source_count == 3), ranked by rating. This is a signal unique
        to this project's multi-source entity resolution work.
        """

        limit = max(1, min(limit, 25))

        if sort == "corroborated":
            candidates = [r for r in self.records if r.get("source_count") == 3]
        else:
            candidates = [r for r in self.records if r.get("rating_combined") is not None]

        def sort_key(record: dict) -> tuple[float, float]:
            rating = record.get("rating_combined") or 0
            confidence = (
                (record.get("rating_anilist_confidence") or 0)
                + (record.get("rating_mangaupdates_confidence") or 0)
            )
            return (rating, confidence)

        candidates.sort(key=sort_key, reverse=True)
        return candidates[:limit]

    def browse(
        self,
        genres: list[str] | None = None,
        genre_match: str = "and",
        hide_explicit: bool = True,
        year_min: int | None = None,
        year_max: int | None = None,
        min_chapters: int | None = None,
        sort: str = "rating",
        limit: int = 24,
        offset: int = 0,
    ) -> tuple[list[dict], int]:
        """
        Filters and sorts the full gold catalog for the Browse page.

        Deliberately only filters on fields we actually have real data
        for: genres, year, and chapter count. No Type/Demographic/
        Author/Artist filters until those exist in the gold schema.
        """
        records = self.records

        filtered = records

        if genres:
            wanted = {g.lower() for g in genres}
            if genre_match == "or":
                filtered = [
                    r for r in filtered
                    if wanted & {g.lower() for g in r.get("genres", [])}
                ]
            else:
                filtered = [
                    r for r in filtered
                    if wanted.issubset({g.lower() for g in r.get("genres", [])})
                ]

        if year_min is not None:
            filtered = [r for r in filtered if r.get("year") and r["year"] >= year_min]

        if year_max is not None:
            filtered = [r for r in filtered if r.get("year") and r["year"] <= year_max]

        if min_chapters is not None:
            filtered = [r for r in filtered if (r.get("chapters") or 0) >= min_chapters]

        if hide_explicit:
            filtered = [
                r for r in filtered
                if not (EXPLICIT_GENRES & {g.lower() for g in r.get("genres", [])})
            ]

        if sort == "corroborated":
            filtered = sorted(
                filtered,
                key=lambda r: (r.get("source_count", 0), r.get("rating_combined") or 0),
                reverse=True,
            )
        elif sort == "newest":
            filtered = sorted(filtered, key=lambda r: r.get("year") or 0, reverse=True)
        elif sort == "title":
            filtered = sorted(filtered, key=lambda r: r.get("title", "").lower())
        else:  # "rating" default
            filtered = sorted(filtered, key=lambda r: r.get("rating_combined") or 0, reverse=True)

        total = len(filtered)
        page = filtered[offset : offset + limit]
        return page, total

    def list_genres(self) -> list[str]:
        """All distinct genres in the gold catalog, for the filter UI."""
        seen: set[str] = set()
        for r in self.records:
            seen.update(r.get("genres", []))
        return sorted(seen)




