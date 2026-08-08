"""
Phase B entity resolution (v3): title-based matching among singletons
left unresolved by Phase A, corroborated by year proximity, and - for
no-year cases - gated by title specificity (word count) rather than
genre overlap alone.

Why the change from v2: sampling showed that for exact-title matches
with no year conflict, genre overlap was rejecting large numbers of
clear true positives whenever one side (usually MangaDex) had sparse
or missing genre tags, or when adult-content taxonomies differed
across sources (e.g. MangaUpdates tags ''Hentai''/''Adult''/''Yaoi''
while MangaDex tags the same oneshot just ''Oneshot'' or leaves genres
empty). That is a metadata-sparsity/taxonomy problem, not evidence the
records are different series.

Title length is a much better proxy for collision risk in this
specific situation:
  - 3+ word exact-normalized-title matches are extremely unlikely to
    be coincidental -> merge directly, genre overlap not required.
  - 1-2 word titles are short/generic enough that coincidental
    collisions are real (e.g. ''Pandora'', ''Split'', ''Present'') ->
    these still require genre-overlap corroboration. If not decisive,
    they stay in the ambiguous log for manual review.

Note: genre reconciliation (unioning tags from both sources into one
richer set) is a Gold-layer decision, made only AFTER identity is
resolved here.

Conflict detection is component-based (same as v2): a node with
multiple confirmed edges is only a genuine conflict if it pulls in
more than one record from the same source. Clean mutual matches
(including 3-way corroboration across all sources) are merged intact.
"""

from __future__ import annotations

import json
import re
from itertools import combinations

from common.paths import SILVER_DIR
from ml.entity_resolution.union_find import UnionFind

YEAR_MISMATCH_THRESHOLD = 3
GENRE_JACCARD_THRESHOLD = 0.5
SHORT_TITLE_MAX_WORDS = 2

SOURCES = ["anilist", "mangadex", "mangaupdates"]


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


def load_entity_groups() -> dict:
    path = SILVER_DIR.parent / "entity_resolution" / "entity_groups.json"
    return json.loads(path.read_text(encoding="utf-8"))


def load_singleton_ids(groups_data: dict, source_name: str) -> set[str]:
    ids = set()
    for group in groups_data["groups"]:
        if group["source_count"] == 1:
            for member in group["members"]:
                if member["source"] == source_name:
                    ids.add(member["source_id"])
    return ids


def genre_jaccard(genres_a, genres_b) -> float | None:
    set_a = {g.lower() for g in (genres_a or [])}
    set_b = {g.lower() for g in (genres_b or [])}
    if not set_a or not set_b:
        return None
    union = set_a | set_b
    if not union:
        return None
    return len(set_a & set_b) / len(union)


def main() -> None:
    print("Loading Silver records and Phase A groups...")
    records_by_source = {s: load_silver_records(s) for s in SOURCES}
    groups_data = load_entity_groups()
    singleton_ids = {s: load_singleton_ids(groups_data, s) for s in SOURCES}

    print("Singleton pool sizes:")
    for s in SOURCES:
        print(f"  {s}: {len(singleton_ids[s])}")

    record_lookup: dict[tuple[str, str], dict] = {}
    for s in SOURCES:
        by_id = {r["source_id"]: r for r in records_by_source[s]}
        for sid in singleton_ids[s]:
            if sid in by_id:
                record_lookup[(s, sid)] = by_id[sid]

    title_index: dict[str, list[tuple[str, str]]] = {}
    for (s, sid), record in record_lookup.items():
        title = record.get("title")
        if not title:
            continue
        norm = normalize(title)
        if norm:
            title_index.setdefault(norm, []).append((s, sid))

    confirmed_edges: list[tuple[tuple[str, str], tuple[str, str], str]] = []
    ambiguous_cases = []
    rejected_pairs = 0
    long_title_no_year_merges = 0
    short_title_no_year_genre_decisive = 0

    for norm_title, members in title_index.items():
        if len(members) < 2:
            continue

        word_count = len(norm_title.split())
        is_short_title = word_count <= SHORT_TITLE_MAX_WORDS

        for (s1, id1), (s2, id2) in combinations(members, 2):
            if s1 == s2:
                continue

            rec1 = record_lookup[(s1, id1)]
            rec2 = record_lookup[(s2, id2)]

            year1, year2 = rec1.get("year"), rec2.get("year")
            jaccard = genre_jaccard(rec1.get("genres"), rec2.get("genres"))

            if year1 is not None and year2 is not None:
                diff = abs(int(year1) - int(year2))
                if diff <= YEAR_MISMATCH_THRESHOLD:
                    confirmed_edges.append(((s1, id1), (s2, id2), f"year_diff={diff}"))
                else:
                    rejected_pairs += 1
                    if jaccard is not None and jaccard >= GENRE_JACCARD_THRESHOLD:
                        ambiguous_cases.append({
                            "title": norm_title,
                            "members": [
                                {"source": s1, "source_id": id1, "year": year1},
                                {"source": s2, "source_id": id2, "year": year2},
                            ],
                            "reason": f"year_mismatch(diff={diff}) but genre_overlap={jaccard:.2f}",
                        })
                continue

            if not is_short_title:
                confirmed_edges.append(((s1, id1), (s2, id2), "long_title_no_year"))
                long_title_no_year_merges += 1
                continue

            if jaccard is not None and jaccard >= GENRE_JACCARD_THRESHOLD:
                confirmed_edges.append(((s1, id1), (s2, id2), f"short_title_genre={jaccard:.2f}"))
                short_title_no_year_genre_decisive += 1
            else:
                ambiguous_cases.append({
                    "title": norm_title,
                    "members": [
                        {"source": s1, "source_id": id1, "year": year1},
                        {"source": s2, "source_id": id2, "year": year2},
                    ],
                    "reason": "short_title, no_year_data, insufficient genre signal",
                })

    print(f"\nConfirmed edges (year-corroborated): "
          f"{sum(1 for _, _, r in confirmed_edges if r.startswith('year_diff'))}")
    print(f"Confirmed edges (long title, no year, no genre required): {long_title_no_year_merges}")
    print(f"Confirmed edges (short title, no year, genre-decisive): {short_title_no_year_genre_decisive}")
    print(f"Rejected pairs (year mismatch, no genre override): {rejected_pairs}")

    component_uf = UnionFind()
    for a, b, _ in confirmed_edges:
        component_uf.union(a, b)

    component_groups = component_uf.groups()

    safe_edges = []
    conflict_components = 0
    demoted_nodes = 0

    edges_by_component_root: dict[tuple[str, str], list] = {}
    for a, b, reason in confirmed_edges:
        root = component_uf.find(a)
        edges_by_component_root.setdefault(root, []).append((a, b, reason))

    for root, members in component_groups.items():
        sources_seen: dict[str, list[tuple[str, str]]] = {}
        for node in members:
            sources_seen.setdefault(node[0], []).append(node)

        has_conflict = any(len(nodes) > 1 for nodes in sources_seen.values())
        component_edges = edges_by_component_root.get(root, [])

        if has_conflict:
            conflict_components += 1
            demoted_nodes += len(members)
            for node in members:
                ambiguous_cases.append({
                    "title": None,
                    "members": [{"source": node[0], "source_id": node[1]}],
                    "reason": f"component_conflict(component_size={len(members)}, "
                              f"duplicate_source={[s for s, n in sources_seen.items() if len(n) > 1]})",
                })
        else:
            safe_edges.extend(component_edges)

    print(f"\nConfirmed-edge connected components   : {len(component_groups)}")
    print(f"  Clean (>=1 per source) - merged      : {len(component_groups) - conflict_components}")
    print(f"  Genuine conflicts - demoted           : {conflict_components}"
          f" ({demoted_nodes} records logged as ambiguous)")
    print(f"Safe edges to merge: {len(safe_edges)}")

    uf = UnionFind()
    for group in groups_data["groups"]:
        members = [(m["source"], m["source_id"]) for m in group["members"]]
        for node in members:
            uf.add(node)
        for node in members[1:]:
            uf.union(members[0], node)

    touched_nodes = set()
    for a, b, _ in safe_edges:
        uf.union(a, b)
        touched_nodes.add(a)
        touched_nodes.add(b)

    merged_groups = uf.groups()

    output_groups = []
    for root, members in merged_groups.items():
        sources_in_group = {s for s, _ in members}
        size = len(sources_in_group)

        if size == 1:
            confidence = "singleton"
        elif any(node in touched_nodes for node in members):
            confidence = "title_year_corroborated"
        else:
            confidence = "exact_id"

        output_groups.append({
            "group_id": f"{root[0]}:{root[1]}",
            "match_confidence": confidence,
            "source_count": size,
            "members": [{"source": s, "source_id": sid} for s, sid in members],
        })

    output_dir = SILVER_DIR.parent / "entity_resolution"

    groups_path = output_dir / "entity_groups_phase_b.json"
    with groups_path.open("w", encoding="utf-8") as f:
        json.dump({"groups": output_groups}, f, ensure_ascii=False, indent=2)

    ambiguous_path = output_dir / "phase_b_ambiguous.json"
    with ambiguous_path.open("w", encoding="utf-8") as f:
        json.dump({"ambiguous_cases": ambiguous_cases}, f, ensure_ascii=False, indent=2)

    confidence_counts: dict[str, int] = {}
    for g in output_groups:
        confidence_counts[g["match_confidence"]] = confidence_counts.get(g["match_confidence"], 0) + 1

    print("\n" + "=" * 60)
    print("Phase B Entity Resolution (v3) - Summary")
    print("=" * 60)
    print(f"Total entity groups (post Phase B): {len(output_groups)}")
    for label, count in sorted(confidence_counts.items()):
        print(f"  {label}: {count}")
    print(f"\nTotal ambiguous cases logged: {len(ambiguous_cases)}")
    print(f"Written merged groups to  : {groups_path}")
    print(f"Written ambiguous log to  : {ambiguous_path}")


if __name__ == "__main__":
    main()
