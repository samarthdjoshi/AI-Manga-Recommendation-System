"""
Post-download deduplication for MangaUpdates Bronze data.

MangaUpdates' `letter` search filter does not reliably anchor to the
first character of a title (confirmed via direct testing - searching
for "Naruto" under letter=A/R/U/T/O returned unrelated titles). Since
our partitioning scheme relies on type + letter + year to produce
disjoint buckets, and letter doesn't behave as a strict partition key,
overlapping records across pages is expected.

Rather than trying to perfectly reverse-engineer MangaUpdates' search
relevance behavior, this script guarantees a clean final dataset by
merging all downloaded pages, keeping only the first occurrence of
each unique series_id, and rewriting clean sequential page files.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from common.paths import MANGAUPDATES_BRONZE_DIR

PAGE_SIZE = 100


def deduplicate() -> None:
    page_files = sorted(MANGAUPDATES_BRONZE_DIR.glob("page_*.json"))

    if not page_files:
        print("No page files found. Nothing to deduplicate.")
        return

    seen_ids: set[int] = set()
    unique_records: list[dict] = []
    total_records_seen = 0
    invalid_files: list[str] = []

    for page_file in page_files:
        try:
            with page_file.open("r", encoding="utf-8") as file:
                data = json.load(file)
        except (json.JSONDecodeError, OSError):
            invalid_files.append(page_file.name)
            continue

        records = data.get("media", [])
        total_records_seen += len(records)

        for record in records:
            series_id = record.get("series_id")

            if series_id is None:
                continue

            if series_id in seen_ids:
                continue

            seen_ids.add(series_id)
            unique_records.append(record)

    duplicates_removed = total_records_seen - len(unique_records)

    print("=" * 50)
    print("MangaUpdates Deduplication")
    print("")
    print(f"Pages scanned        : {len(page_files)}")
    print(f"Invalid/corrupt files: {len(invalid_files)}")
    print(f"Total records seen   : {total_records_seen}")
    print(f"Unique records       : {len(unique_records)}")
    print(f"Duplicates removed   : {duplicates_removed}")
    print("=" * 50)

    if invalid_files:
        print("\nInvalid files (skipped):")
        for name in invalid_files:
            print(f"  - {name}")

    backup_dir = MANGAUPDATES_BRONZE_DIR.parent / "mangaupdates_raw_backup"
    backup_dir.mkdir(parents=True, exist_ok=True)

    for page_file in page_files:
        shutil.move(str(page_file), str(backup_dir / page_file.name))

    print(f"\nOriginal pages moved to: {backup_dir}")

    for index in range(0, len(unique_records), PAGE_SIZE):
        chunk = unique_records[index : index + PAGE_SIZE]
        page_number = (index // PAGE_SIZE) + 1
        output_path = MANGAUPDATES_BRONZE_DIR / f"page_{page_number:04d}.json"

        with output_path.open("w", encoding="utf-8") as file:
            json.dump({"media": chunk}, file, ensure_ascii=False, indent=2)

    print(f"Wrote {len(unique_records)} unique records across "
          f"{-(-len(unique_records) // PAGE_SIZE)} clean pages to {MANGAUPDATES_BRONZE_DIR}")


if __name__ == "__main__":
    deduplicate()
