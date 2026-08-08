"""
Query utility for the similarity index: search Gold records by title
substring, pick one, and get its top-N most similar manga.

Usage: python -m scripts.recommend "search text"
"""

from __future__ import annotations

import json
import sys

import faiss
import numpy as np

from common.paths import SILVER_DIR

TOP_K = 10


def load_gold_records() -> list[dict]:
    gold_dir = SILVER_DIR.parent / "gold"
    records = []
    for page_file in sorted(gold_dir.glob("page_*.json")):
        data = json.loads(page_file.read_text(encoding="utf-8"))
        records.extend(data.get("records", []))
    return records


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python -m scripts.recommend \"search text\"")
        return

    query_text = " ".join(sys.argv[1:]).lower()

    print("Loading Gold records and index...")
    records = load_gold_records()
    records_by_gold_id = {r["gold_id"]: r for r in records}

    model_dir = SILVER_DIR.parent / "model"
    index = faiss.read_index(str(model_dir / "similarity_index.faiss"))
    with (model_dir / "index_gold_ids.json").open("r", encoding="utf-8") as f:
        index_gold_ids = json.load(f)

    gold_id_to_row = {gid: i for i, gid in enumerate(index_gold_ids)}

    matches = [
        r for r in records
        if r.get("title") and query_text in r["title"].lower()
    ]

    if not matches:
        print(f"No titles matched '{query_text}'.")
        return

    matches.sort(key=lambda r: r.get("source_count", 0), reverse=True)

    if len(matches) > 1:
        print(f"\nFound {len(matches)} matches. Showing top 5, using the first for recommendations:\n")
        for i, r in enumerate(matches[:5], 1):
            print(f"  [{i}] {r['title']!r} ({r.get('year')}) - "
                  f"confidence={r['match_confidence']}, sources={r['sources']}")
        print()

    target = matches[0]
    target_row = gold_id_to_row[target["gold_id"]]

    print(f"Getting recommendations similar to: {target['title']!r} ({target.get('year')})")
    print(f"  genres: {target.get('genres')}")
    print()

    query_vector = index.reconstruct(target_row).reshape(1, -1)
    scores, row_indices = index.search(query_vector, TOP_K + 1)

    print(f"Top {TOP_K} similar manga:\n")
    shown = 0
    for score, row_idx in zip(scores[0], row_indices[0]):
        gold_id = index_gold_ids[row_idx]
        if gold_id == target["gold_id"]:
            continue
        record = records_by_gold_id.get(gold_id)
        if record is None:
            continue
        shown += 1
        print(f"  [{shown}] {record['title']!r} ({record.get('year')})  score={score:.4f}")
        print(f"      genres: {record.get('genres')[:8]}")
        print(f"      confidence: {record['match_confidence']}, sources: {record['sources']}")
        print()
        if shown >= TOP_K:
            break


if __name__ == "__main__":
    main()
