"""
Computes genre/tag frequency across the entire Gold dataset. This is
step 1 of the tag-normalization pass: before building any mapping
table, we need to see the REAL tag landscape - which tags exist, how
often each appears, and which look like likely near-duplicates (case
variants, plurals, synonyms like Yaoi/Boys'' Love) - rather than
guessing at a mapping blind.

Read-only. Outputs a sorted frequency table and groups tags by a loose
normalized key so that likely duplicate clusters are visually adjacent
for review.
"""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict

from common.paths import SILVER_DIR


def load_gold_records() -> list[dict]:
    gold_dir = SILVER_DIR.parent / "gold"
    records = []
    for page_file in sorted(gold_dir.glob("page_*.json")):
        data = json.loads(page_file.read_text(encoding="utf-8"))
        records.extend(data.get("records", []))
    return records


def loose_key(tag: str) -> str:
    key = tag.lower()
    key = re.sub(r"[^a-z0-9]+", "", key)
    if key.endswith("s") and len(key) > 3:
        key = key[:-1]
    return key


def main() -> None:
    print("Loading Gold records...")
    records = load_gold_records()
    print(f"Total Gold records: {len(records)}")

    tag_counts: Counter[str] = Counter()
    for record in records:
        for genre in record.get("genres") or []:
            tag_counts[genre] += 1

    print(f"\nTotal distinct raw tags: {len(tag_counts)}")

    clusters: dict[str, list[tuple[str, int]]] = defaultdict(list)
    for tag, count in tag_counts.items():
        clusters[loose_key(tag)].append((tag, count))

    multi_variant_clusters = {
        key: variants for key, variants in clusters.items() if len(variants) > 1
    }

    print(f"Clusters with 2+ spelling/case/plural variants: {len(multi_variant_clusters)}")

    print("\n" + "=" * 70)
    print("MULTI-VARIANT CLUSTERS (likely same tag, different spelling/case)")
    print("sorted by total combined frequency, descending")
    print("=" * 70)

    sorted_clusters = sorted(
        multi_variant_clusters.items(),
        key=lambda kv: sum(c for _, c in kv[1]),
        reverse=True,
    )

    for key, variants in sorted_clusters:
        total = sum(c for _, c in variants)
        variants_sorted = sorted(variants, key=lambda v: -v[1])
        variant_str = ", ".join(f"{tag!r}={count}" for tag, count in variants_sorted)
        print(f"  [{total:>6}] {variant_str}")

    print("\n" + "=" * 70)
    print("TOP 80 TAGS OVERALL BY FREQUENCY (for full-picture context)")
    print("=" * 70)
    for tag, count in tag_counts.most_common(80):
        print(f"  {count:>6}  {tag}")

    output_dir = SILVER_DIR.parent / "entity_resolution"
    output_path = output_dir / "genre_tag_frequency.json"
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(
            {
                "tag_counts": dict(tag_counts.most_common()),
                "multi_variant_clusters": {
                    key: variants for key, variants in sorted_clusters
                },
            },
            f,
            ensure_ascii=False,
            indent=2,
        )
    print(f"\nFull frequency table + cluster data written to: {output_path}")


if __name__ == "__main__":
    main()
