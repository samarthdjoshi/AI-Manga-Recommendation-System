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
