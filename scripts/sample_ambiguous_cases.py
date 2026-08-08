"""
Pulls a readable, random sample of Phase B''s ambiguous cases, grouped by
reason category, with full record detail (title, year, genres, source)
so they can be manually reviewed before Phase B is considered final.

This does not change any data - it is read-only, for human inspection.
"""

from __future__ import annotations

import json
import random
from collections import defaultdict

from common.paths import SILVER_DIR

SAMPLE_SIZE_PER_CATEGORY = 8
RANDOM_SEED = 42


def load_silver_records(source_name: str) -> dict[str, dict]:
    silver_dir = SILVER_DIR / source_name
    records = {}
    for page_file in sorted(silver_dir.glob("page_*.json")):
        data = json.loads(page_file.read_text(encoding="utf-8"))
        for record in data.get("records", []):
            records[record["source_id"]] = record
    return records


def categorize(reason: str) -> str:
    if reason.startswith("multi_candidate_conflict"):
        return "multi_candidate_conflict"
    if reason.startswith("year_mismatch"):
        return "year_mismatch_genre_override"
    if reason.startswith("no_year_data, genre_overlap"):
        return "no_year_genre_decisive"
    if reason.startswith("no_year_data, insufficient"):
        return "no_year_insufficient_signal"
    return "other"


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
    cases = data["ambiguous_cases"]

    print(f"Total ambiguous cases: {len(cases)}")

    print("Loading Silver records for lookup (this may take a moment)...")
    records_by_source = {
        "anilist": load_silver_records("anilist"),
        "mangadex": load_silver_records("mangadex"),
        "mangaupdates": load_silver_records("mangaupdates"),
    }

    by_category: dict[str, list[dict]] = defaultdict(list)
    for case in cases:
        by_category[categorize(case["reason"])].append(case)

    print("\nCase counts by category:")
    for category, items in sorted(by_category.items()):
        print(f"  {category}: {len(items)}")

    for category, items in sorted(by_category.items()):
        print("\n" + "=" * 70)
        print(f"CATEGORY: {category}  (showing up to {SAMPLE_SIZE_PER_CATEGORY} of {len(items)})")
        print("=" * 70)

        sample = random.sample(items, min(SAMPLE_SIZE_PER_CATEGORY, len(items)))

        for i, case in enumerate(sample, 1):
            title = case.get("title")
            reason = case["reason"]
            print(f"\n[{i}] normalized_title={title!r}")
            print(f"    reason: {reason}")
            for member in case["members"]:
                print(format_record(member["source"], member["source_id"], records_by_source))


if __name__ == "__main__":
    main()
