"""
Pulls a random sample of Gold records across all match_confidence tiers
(exact_id, title_year_corroborated, singleton) for visual review, to
confirm the merge logic produced coherent, sensible records - not just
correct-looking aggregate counts.

Read-only.
"""

from __future__ import annotations

import json
import random
from collections import defaultdict

from common.paths import SILVER_DIR

SAMPLE_SIZE_PER_TIER = 5
RANDOM_SEED = 42


def load_gold_records() -> list[dict]:
    gold_dir = SILVER_DIR.parent / "gold"
    records = []
    for page_file in sorted(gold_dir.glob("page_*.json")):
        data = json.loads(page_file.read_text(encoding="utf-8"))
        records.extend(data.get("records", []))
    return records


def print_record(record: dict) -> None:
    print(f"  gold_id           : {record['gold_id']}")
    print(f"  match_confidence  : {record['match_confidence']}  (sources: {record['sources']})")
    print(f"  title             : {record['title']!r}  (from {record['title_source']})")
    print(f"  original_title    : {record['original_title']!r}")
    desc = (record.get('description') or '')[:120]
    trailer = '...' if record.get('description') and len(record['description']) > 120 else ''
    print(f"  description       : {desc!r}{trailer}  (from {record['description_source']})")
    print(f"  genres ({len(record['genres'])})     : {record['genres'][:10]}{'...' if len(record['genres']) > 10 else ''}")
    print(f"  status_raw        : {record['status_raw']!r}  (from {record['status_source']})")
    print(f"  chapters/volumes  : {record['chapters']} / {record['volumes']}")
    print(f"  year              : {record['year']}")
    print(f"  rating_anilist    : {record['rating_anilist']}  (confidence={record['rating_anilist_confidence']})")
    print(f"  rating_mangaupd.  : {record['rating_mangaupdates']}  (confidence={record['rating_mangaupdates_confidence']})")
    print(f"  rating_combined   : {record['rating_combined']}  (from {record['rating_combined_sources']})")
    print(f"  cover_image_url   : {record['cover_image_url']}  (from {record['cover_image_source']})")
    print(f"  source_urls       : {record['source_urls']}")


def main() -> None:
    random.seed(RANDOM_SEED)

    print("Loading Gold records...")
    records = load_gold_records()
    print(f"Total Gold records: {len(records)}")

    by_tier: dict[str, list[dict]] = defaultdict(list)
    for record in records:
        by_tier[record["match_confidence"]].append(record)

    for tier in ["exact_id", "title_year_corroborated", "singleton"]:
        items = by_tier.get(tier, [])
        if not items:
            continue

        print("\n" + "=" * 70)
        print(f"TIER: {tier}  (showing {min(SAMPLE_SIZE_PER_TIER, len(items))} of {len(items)})")
        print("=" * 70)

        sample = random.sample(items, min(SAMPLE_SIZE_PER_TIER, len(items)))
        for i, record in enumerate(sample, 1):
            print(f"\n[{i}]")
            print_record(record)


if __name__ == "__main__":
    main()
