"""
Bronze layer quality review.

Inspects a sample page from each source and reports:
  - Total pages/records (from metadata.json)
  - Raw key structure of a sample record (so we can see the ACTUAL
    shape returned by each API, not an assumed one)
  - Field completeness: what % of records in the sample page have a
    non-null, non-empty value for each top-level key

Uses the first NON-EMPTY page for each source, since some sources
(e.g. AniList's ID-batch enumeration) can have legitimately empty
pages early on.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from common.paths import (
    ANILIST_BRONZE_DIR,
    MANGADEX_BRONZE_DIR,
    MANGAUPDATES_BRONZE_DIR,
)


def load_metadata(bronze_dir: Path) -> dict:
    metadata_path = bronze_dir / "metadata.json"
    if not metadata_path.exists():
        return {}
    with metadata_path.open("r", encoding="utf-8") as file:
        return json.load(file)


def load_first_non_empty_page(bronze_dir: Path, extractor) -> tuple[dict | None, str | None]:
    page_files = sorted(bronze_dir.glob("page_*.json"))
    for page_file in page_files:
        with page_file.open("r", encoding="utf-8") as file:
            data = json.load(file)
        if extractor(data):
            return data, page_file.name
    return None, None


def is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, (str, list, dict)) and len(value) == 0:
        return True
    return False


def field_completeness(records: list[dict]) -> dict[str, float]:
    if not records:
        return {}

    all_keys: set[str] = set()
    for record in records:
        all_keys.update(record.keys())

    completeness: dict[str, float] = {}
    for key in sorted(all_keys):
        non_empty = sum(1 for r in records if not is_empty(r.get(key)))
        completeness[key] = round((non_empty / len(records)) * 100, 1)

    return completeness


def review_source(
    name: str,
    bronze_dir: Path,
    extractor,
) -> None:
    print("=" * 60)
    print(f"{name}")
    print("=" * 60)

    metadata = load_metadata(bronze_dir)
    if metadata:
        print(f"Total pages recorded in metadata.json : {metadata.get('total_pages')}")
        print(f"Total records recorded in metadata.json: {metadata.get('total_records')}")
    else:
        print("No metadata.json found.")

    page, page_name = load_first_non_empty_page(bronze_dir, extractor)

    if page is None:
        print("No non-empty page files found — cannot inspect.")
        print()
        return

    records = extractor(page)
    sample = records[0]

    print(f"\nSample taken from: {page_name} ({len(records)} records on this page)")

    print(f"\nSample record raw keys:")
    print(list(sample.keys()))

    print(f"\nSample record (pretty-printed, first record):")
    print(json.dumps(sample, indent=2, ensure_ascii=False)[:2000])

    print(f"\nField completeness across {len(records)} records on this page:")
    completeness = field_completeness(records)
    for key, pct in completeness.items():
        flag = "  <-- LOW" if pct < 90 else ""
        print(f"  {key:.<30} {pct:>5.1f}%{flag}")

    print()


def main() -> None:
    review_source(
        "AniList",
        ANILIST_BRONZE_DIR,
        extractor=lambda page: page.get("media", []),
    )

    review_source(
        "MangaDex",
        MANGADEX_BRONZE_DIR,
        extractor=lambda page: page.get("data", []),
    )

    review_source(
        "MangaUpdates",
        MANGAUPDATES_BRONZE_DIR,
        extractor=lambda page: page.get("media", []),
    )


if __name__ == "__main__":
    main()
