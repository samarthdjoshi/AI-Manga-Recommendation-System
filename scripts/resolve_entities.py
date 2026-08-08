"""
Phase A entity resolution: exact-ID matching using MangaDex as a
cross-reference hub.

MangaDex records optionally carry a links field with al (AniList
numeric ID) and mu (MangaUpdates URL slug). Where present, these
give zero-ambiguity connections between sources without any string
matching. Union-find merges records transitively, so a MangaDex
record linking to AniList and a DIFFERENT MangaDex record for the
same series linking to MangaUpdates still correctly end up in one
group.

Does NOT attempt fuzzy title matching - that is Phase B, built only
if this phase leaves a large enough unmatched remainder to justify it.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from common.paths import SILVER_DIR
from ml.entity_resolution.union_find import UnionFind

MU_SLUG_PATTERN = re.compile(r"/series/([^/]+)/")


def load_silver_records(source_name: str) -> list[dict]:
    silver_dir = SILVER_DIR / source_name
    records: list[dict] = []
    for page_file in sorted(silver_dir.glob("page_*.json")):
        with page_file.open("r", encoding="utf-8") as file:
            data = json.load(file)
        records.extend(data.get("records", []))
    return records


def extract_mu_slug(url: str | None) -> str | None:
    if not url:
        return None
    match = MU_SLUG_PATTERN.search(url)
    return match.group(1) if match else None


def main() -> None:
    print("Loading Silver records...")
    anilist_records = load_silver_records("anilist")
    mangadex_records = load_silver_records("mangadex")
    mangaupdates_records = load_silver_records("mangaupdates")

    print(f"  AniList: {len(anilist_records)}")
    print(f"  MangaDex: {len(mangadex_records)}")
    print(f"  MangaUpdates: {len(mangaupdates_records)}")

    anilist_ids = {r["source_id"] for r in anilist_records}

    mu_slug_to_id: dict[str, str] = {}
    for record in mangaupdates_records:
        slug = extract_mu_slug(record.get("url"))
        if slug:
            mu_slug_to_id[slug] = record["source_id"]

    uf = UnionFind()

    for record in anilist_records:
        uf.add(("anilist", record["source_id"]))
    for record in mangadex_records:
        uf.add(("mangadex", record["source_id"]))
    for record in mangaupdates_records:
        uf.add(("mangaupdates", record["source_id"]))

    al_hits = 0
    al_misses = 0
    mu_hits = 0
    mu_misses = 0

    for record in mangadex_records:
        md_node = ("mangadex", record["source_id"])
        links = (record.get("extra") or {}).get("links") or {}

        al_id = links.get("al")
        if al_id:
            if al_id in anilist_ids:
                uf.union(md_node, ("anilist", al_id))
                al_hits += 1
            else:
                al_misses += 1

        mu_link = links.get("mu")
        if mu_link:
            mu_id = mu_slug_to_id.get(mu_link)
            if mu_id:
                uf.union(md_node, ("mangaupdates", mu_id))
                mu_hits += 1
            else:
                mu_misses += 1

    groups = uf.groups()

    entity_groups: list[dict] = []
    source_count_distribution: dict[int, int] = {}
    singleton_counts = {"anilist": 0, "mangadex": 0, "mangaupdates": 0}
    matched_counts = {"anilist": 0, "mangadex": 0, "mangaupdates": 0}

    for root, members in groups.items():
        sources_in_group = {source for source, _ in members}
        size = len(sources_in_group)
        source_count_distribution[size] = source_count_distribution.get(size, 0) + 1

        confidence = "exact_id" if size > 1 else "singleton"

        if size == 1:
            singleton_counts[members[0][0]] += 1
        else:
            for source, _ in members:
                matched_counts[source] += 1

        entity_groups.append(
            {
                "group_id": f"{root[0]}:{root[1]}",
                "match_confidence": confidence,
                "source_count": size,
                "members": [{"source": s, "source_id": sid} for s, sid in members],
            }
        )

    output_dir = SILVER_DIR.parent / "entity_resolution"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "entity_groups.json"

    with output_path.open("w", encoding="utf-8") as file:
        json.dump({"groups": entity_groups}, file, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print("Phase A Entity Resolution — Summary")
    print("=" * 60)
    print(f"Total entity groups       : {len(entity_groups)}")
    print(f"\nMangaDex -> AniList link resolution:")
    print(f"  Hits (matched a real AniList record)     : {al_hits}")
    print(f"  Misses (link pointed to nothing we have)  : {al_misses}")
    print(f"\nMangaDex -> MangaUpdates link resolution:")
    print(f"  Hits (matched a real MangaUpdates record) : {mu_hits}")
    print(f"  Misses (link pointed to nothing we have)  : {mu_misses}")
    print(f"\nGroup size distribution (sources per group):")
    for size in sorted(source_count_distribution):
        print(f"  {size} source(s): {source_count_distribution[size]} groups")
    print(f"\nSingletons (unmatched, single-source only):")
    for source, count in singleton_counts.items():
        total = {"anilist": len(anilist_records), "mangadex": len(mangadex_records), "mangaupdates": len(mangaupdates_records)}[source]
        pct = (count / total * 100) if total else 0
        print(f"  {source}: {count} / {total} ({pct:.1f}%)")
    print(f"\nMatched (part of a multi-source group):")
    for source, count in matched_counts.items():
        total = {"anilist": len(anilist_records), "mangadex": len(mangadex_records), "mangaupdates": len(mangaupdates_records)}[source]
        pct = (count / total * 100) if total else 0
        print(f"  {source}: {count} / {total} ({pct:.1f}%)")
    print(f"\nWritten to: {output_path}")


if __name__ == "__main__":
    main()
