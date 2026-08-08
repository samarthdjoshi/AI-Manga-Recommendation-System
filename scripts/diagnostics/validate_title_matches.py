"""
Validates the exact normalized-title matches found between AniList and
MangaUpdates singletons.

Two records sharing a normalized title could be the same series (true
positive) or two unrelated series that happen to share a short/generic
name (false positive, e.g. "Akiko", "Air Pocket"). Publication year is
a cheap, independent corroborating signal: if two records that "match"
on title also have wildly different years, that is a strong sign they
are actually different series.

This does NOT decide merges - it only estimates how dirty the raw
exact-title-match signal is, to inform how much guardrail logic
Phase B''s real fuzzy matcher will need (e.g. requiring year proximity
or genre overlap as an additional condition, not just title equality).
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from common.paths import SILVER_DIR


YEAR_MISMATCH_THRESHOLD = 3  # years; beyond this, treat as suspicious


def normalize(title: str) -> str:
    title = title.lower()
    title = re.sub(r"[^a-z0-9]+", " ", title)
    return title.strip()


def load_silver_records(source_name: str) -> list[dict]:
    silver_dir = SILVER_DIR / source_name
    records = []
    for page_file in sorted(silver_dir.glob("page_*.json")):
        data = json.loads(page_file.read_text(encoding="utf-8"))
        records.extend(data.get("records", []))
    return records


def load_singleton_ids(source_name: str) -> set[str]:
    groups_path = SILVER_DIR.parent / "entity_resolution" / "entity_groups.json"
    data = json.loads(groups_path.read_text(encoding="utf-8"))
    ids = set()
    for group in data["groups"]:
        if group["source_count"] == 1:
            for member in group["members"]:
                if member["source"] == source_name:
                    ids.add(member["source_id"])
    return ids


def main() -> None:
    anilist_records = load_silver_records("anilist")
    mangaupdates_records = load_silver_records("mangaupdates")

    anilist_singleton_ids = load_singleton_ids("anilist")
    mangaupdates_singleton_ids = load_singleton_ids("mangaupdates")

    anilist_index: dict[str, list[tuple[str, int | None]]] = {}
    for record in anilist_records:
        if record["source_id"] in anilist_singleton_ids:
            norm = normalize(record["title"])
            anilist_index.setdefault(norm, []).append(
                (record["source_id"], record.get("year"))
            )

    total_matches = 0
    year_available_pairs = 0
    year_agree = 0
    year_mismatch = 0
    year_missing_one_side = 0
    mismatch_examples = []
    agree_examples = []

    for record in mangaupdates_records:
        if record["source_id"] not in mangaupdates_singleton_ids:
            continue
        norm = normalize(record["title"])
        candidates = anilist_index.get(norm)
        if not candidates:
            continue

        mu_year = record.get("year")

        for al_id, al_year in candidates:
            total_matches += 1

            if mu_year is None or al_year is None:
                year_missing_one_side += 1
                continue

            year_available_pairs += 1
            diff = abs(int(mu_year) - int(al_year))

            if diff <= YEAR_MISMATCH_THRESHOLD:
                year_agree += 1
                if len(agree_examples) < 8:
                    agree_examples.append(
                        (record["title"], mu_year, al_id, al_year, diff)
                    )
            else:
                year_mismatch += 1
                if len(mismatch_examples) < 15:
                    mismatch_examples.append(
                        (record["title"], mu_year, al_id, al_year, diff)
                    )

    print("=" * 60)
    print("Title-Match Validation - Year Corroboration")
    print("=" * 60)
    print(f"Total title-match instances       : {total_matches}")
    print(f"  Missing year on one/both sides   : {year_missing_one_side}")
    print(f"  Year available on both sides     : {year_available_pairs}")
    print(f"    Agree (within {YEAR_MISMATCH_THRESHOLD}yr)             : {year_agree}"
          f" ({(year_agree / year_available_pairs * 100 if year_available_pairs else 0):.1f}%)")
    print(f"    Mismatch (>{YEAR_MISMATCH_THRESHOLD}yr apart)          : {year_mismatch}"
          f" ({(year_mismatch / year_available_pairs * 100 if year_available_pairs else 0):.1f}%)")

    print(f"\nSample AGREEING matches (likely true positives):")
    for mu_title, mu_year, al_id, al_year, diff in agree_examples:
        print(f"  - {mu_title!r}: MU year={mu_year}, AniList[{al_id}] year={al_year} (diff={diff})")

    print(f"\nSample MISMATCHED matches (likely false positives):")
    for mu_title, mu_year, al_id, al_year, diff in mismatch_examples:
        print(f"  - {mu_title!r}: MU year={mu_year}, AniList[{al_id}] year={al_year} (diff={diff})")

    print(f"\nNote: {year_missing_one_side} instances could not be checked (missing year data)")
    print("and are neither confirmed nor refuted by this test.")


if __name__ == "__main__":
    main()
