"""
Audits title resolution across the full MangaDex Bronze dataset.

Reports how often each resolution tier is used, and prints a sample
of records that needed a fallback beyond the simple title.en case,
so we can visually sanity-check the logic against real titles before
trusting it in the Silver layer.
"""

from __future__ import annotations

import json
from collections import Counter

from common.paths import MANGADEX_BRONZE_DIR
from ml.normalization.mangadex_titles import resolve_title_with_source

SAMPLE_SIZE_PER_TIER = 5


def main() -> None:
    page_files = sorted(MANGADEX_BRONZE_DIR.glob("page_*.json"))

    tier_counts: Counter[str] = Counter()
    samples: dict[str, list[str]] = {}

    for page_file in page_files:
        with page_file.open("r", encoding="utf-8") as file:
            data = json.load(file)

        for record in data.get("data", []):
            attributes = record.get("attributes", {})
            title, tier = resolve_title_with_source(attributes)

            tier_counts[tier] += 1

            if tier != "title.en":
                samples.setdefault(tier, [])
                if len(samples[tier]) < SAMPLE_SIZE_PER_TIER:
                    original_title_dict = attributes.get("title", {})
                    samples[tier].append(f"{title!r}  (raw title field: {original_title_dict})")

    total = sum(tier_counts.values())

    print("=" * 60)
    print("MangaDex Title Resolution Audit")
    print("=" * 60)
    print(f"Total records scanned: {total}\n")

    for tier, count in tier_counts.most_common():
        pct = (count / total * 100) if total else 0
        print(f"{tier:.<20} {count:>7} ({pct:5.1f}%)")

    print()

    for tier, examples in samples.items():
        print(f"\nSample resolved titles using tier '{tier}':")
        for example in examples:
            print(f"  - {example}")

    print()


if __name__ == "__main__":
    main()
