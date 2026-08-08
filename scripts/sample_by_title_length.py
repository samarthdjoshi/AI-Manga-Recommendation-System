"""
Splits the ''no_year_insufficient_signal'' ambiguous bucket by title
specificity (word count of the normalized title, used as a cheap proxy
for collision risk - short/generic titles are more likely to produce
false-positive matches than long/specific ones) and samples each
bucket for manual review.

Purpose: decide whether the genre-overlap requirement can be safely
dropped (or loosened) for exact-title, no-year-conflict matches - and
if so, whether that should apply to all title lengths or only to
sufficiently distinctive (longer) titles.

Read-only - does not change any data.
"""

from __future__ import annotations

import json
import random
from collections import defaultdict

from common.paths import SILVER_DIR

SAMPLE_SIZE_PER_BUCKET = 10
RANDOM_SEED = 42

BUCKETS = [
    ("short (1-2 words)", 1, 2),
    ("medium (3-4 words)", 3, 4),
    ("long (5+ words)", 5, None),
]


def load_silver_records(source_name: str) -> dict[str, dict]:
    silver_dir = SILVER_DIR / source_name
    records = {}
    for page_file in sorted(silver_dir.glob("page_*.json")):
        data = json.loads(page_file.read_text(encoding="utf-8"))
        for record in data.get("records", []):
            records[record["source_id"]] = record
    return records


def bucket_for(word_count: int) -> str:
    for label, lo, hi in BUCKETS:
        if hi is None:
            if word_count >= lo:
                return label
        elif lo <= word_count <= hi:
            return label
    return "unknown"


def format_record(source: str, source_id: str, records_by_source: dict) -> str:
    record = records_by_source.get(source, {}).get(source_id)
    if not record:
        return f"    [{source}:{source_id}] <record not found in Silver>"
    title = record.get("title")
    year = record.get("year")
    genres = record.get("genres") or []
    return (
        f"    [{source}:{source_id}] title={title!r} year={year} "
        f"genres={genres[:6]}{'...' if len(genres) > 6 else ''}"
    )


def main() -> None:
    random.seed(RANDOM_SEED)

    ambiguous_path = SILVER_DIR.parent / "entity_resolution" / "phase_b_ambiguous.json"
    data = json.loads(ambiguous_path.read_text(encoding="utf-8"))
    cases = [
        c for c in data["ambiguous_cases"]
        if c["reason"] == "no_year_data, insufficient genre signal"
    ]

    print(f"Total no_year_insufficient_signal cases: {len(cases)}")

    print("Loading Silver records for lookup (this may take a moment)...")
    records_by_source = {
        "anilist": load_silver_records("anilist"),
        "mangadex": load_silver_records("mangadex"),
        "mangaupdates": load_silver_records("mangaupdates"),
    }

    by_bucket: dict[str, list[dict]] = defaultdict(list)
    for case in cases:
        title = case.get("title") or ""
        word_count = len(title.split())
        by_bucket[bucket_for(word_count)].append(case)

    print("\nCase counts by title-length bucket:")
    for label, _, _ in BUCKETS:
        print(f"  {label}: {len(by_bucket.get(label, []))}")

    for label, _, _ in BUCKETS:
        items = by_bucket.get(label, [])
        if not items:
            continue

        print("\n" + "=" * 70)
        print(f"BUCKET: {label}  (showing up to {SAMPLE_SIZE_PER_BUCKET} of {len(items)})")
        print("=" * 70)

        sample = random.sample(items, min(SAMPLE_SIZE_PER_BUCKET, len(items)))

        for i, case in enumerate(sample, 1):
            title = case.get("title")
            print(f"\n[{i}] normalized_title={title!r}")
            for member in case["members"]:
                print(format_record(member["source"], member["source_id"], records_by_source))


if __name__ == "__main__":
    main()
