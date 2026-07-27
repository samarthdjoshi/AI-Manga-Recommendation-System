"""
Audits English title availability across the full AniList Bronze dataset.

AniList's title field is {romaji, english, native} - english is only
populated when AniList has one on file, same underlying risk as
MangaDex's title.en gap. This checks how often we'd need to fall back
to romaji/native for a unified Silver-layer title field.
"""

from __future__ import annotations

import json
from collections import Counter

from common.paths import ANILIST_BRONZE_DIR


def main() -> None:
    page_files = sorted(ANILIST_BRONZE_DIR.glob("page_*.json"))

    tier_counts: Counter[str] = Counter()
    samples: list[str] = []

    for page_file in page_files:
        with page_file.open("r", encoding="utf-8") as file:
            data = json.load(file)

        for record in data.get("media", []):
            title = record.get("title", {}) or {}

            if title.get("english"):
                tier_counts["english"] += 1
            elif title.get("romaji"):
                tier_counts["romaji_fallback"] += 1
                if len(samples) < 10:
                    samples.append(f"romaji={title.get('romaji')!r}, native={title.get('native')!r}")
            elif title.get("native"):
                tier_counts["native_fallback"] += 1
            else:
                tier_counts["no_title_at_all"] += 1

    total = sum(tier_counts.values())

    print("=" * 60)
    print("AniList Title Availability Audit")
    print("=" * 60)
    print(f"Total records scanned: {total}\n")

    for tier, count in tier_counts.most_common():
        pct = (count / total * 100) if total else 0
        print(f"{tier:.<20} {count:>7} ({pct:5.1f}%)")

    print("\nSample titles that needed romaji fallback (no English title on file):")
    for example in samples:
        print(f"  - {example}")

    print()


if __name__ == "__main__":
    main()
