"""
Comprehensive pre-API test suite for the recommendation pipeline.
"""

from __future__ import annotations

import json
import time

import faiss
import numpy as np

from common.paths import SILVER_DIR

TOP_K = 5

TEST_TITLES = [
    "One Piece",
    "Death Note",
    "Attack on Titan",
    "Fruits Basket",
    "Vagabond",
    "Chainsaw Man",
]

UNICODE_TEST_TITLES = [
    "進撃の巨人",
    "海賊王",
]


def load_gold_records() -> list[dict]:
    gold_dir = SILVER_DIR.parent / "gold"
    records = []
    for page_file in sorted(gold_dir.glob("page_*.json")):
        data = json.loads(page_file.read_text(encoding="utf-8"))
        records.extend(data.get("records", []))
    return records


def section(title: str) -> None:
    print("\n" + "=" * 60)
    print(title)
    print("=" * 60)


def run_query(records_by_gold_id, gold_id_to_row, index, index_gold_ids, target, top_k=TOP_K):
    target_row = gold_id_to_row[target["gold_id"]]
    query_vector = index.reconstruct(target_row).reshape(1, -1)
    scores, row_indices = index.search(query_vector, top_k + 1)

    results = []
    for score, row_idx in zip(scores[0], row_indices[0]):
        gold_id = index_gold_ids[row_idx]
        if gold_id == target["gold_id"]:
            continue
        record = records_by_gold_id.get(gold_id)
        if record is None:
            continue
        results.append((record, float(score)))
        if len(results) >= top_k:
            break
    return results


def find_matches(records, query_text):
    query_lower = query_text.lower().strip()
    if not query_lower:
        return []
    return [
        r for r in records
        if r.get("title") and query_lower in r["title"].lower()
    ]


def test_multi_title(records, records_by_gold_id, gold_id_to_row, index, index_gold_ids):
    section("1. Multi-Title Validation")

    for query_text in TEST_TITLES:
        matches = find_matches(records, query_text)
        if not matches:
            print(f"\n'{query_text}': NO MATCH FOUND")
            continue

        matches.sort(key=lambda r: r.get("source_count", 0), reverse=True)
        target = matches[0]

        if target["gold_id"] not in gold_id_to_row:
            print(f"\n'{query_text}': matched but not in index")
            continue

        target_genres = set(target.get("genres") or [])
        results = run_query(records_by_gold_id, gold_id_to_row, index, index_gold_ids, target)

        print(f"\n'{query_text}' -> '{target['title']}' ({target.get('year')})")
        overlaps = []
        for i, (record, score) in enumerate(results, 1):
            result_genres = set(record.get("genres") or [])
            overlap = len(target_genres & result_genres)
            overlap_pct = (overlap / len(target_genres) * 100) if target_genres else 0
            overlaps.append(overlap_pct)
            print(f"    [{i}] {record['title']!r} ({record.get('year')})  score={score:.3f}  overlap={overlap_pct:.0f}%")

        if overlaps:
            avg = sum(overlaps) / len(overlaps)
            flag = "  <-- LOW" if avg < 20 else ""
            print(f"  Average overlap: {avg:.0f}%{flag}")


def test_zero_vectors(index_gold_ids):
    section("2. Zero-Vector Data Quality")

    features_dir = SILVER_DIR.parent / "features"
    numeric_features = np.load(features_dir / "numeric_features.npy")
    description_embeddings = np.load(features_dir / "description_embeddings.npy")

    zero_description = int(np.sum(~description_embeddings.any(axis=1)))
    zero_numeric = int(np.sum(~numeric_features.any(axis=1)))

    print(f"Total records in index: {len(index_gold_ids)}")
    print(f"Zero description embedding: {zero_description} ({zero_description/len(index_gold_ids)*100:.1f}%)")
    print(f"Zero numeric features: {zero_numeric} ({zero_numeric/len(index_gold_ids)*100:.1f}%)")


def test_edge_cases(records):
    section("3. Edge Cases")

    print("\nEmpty string query:")
    result = find_matches(records, "")
    print(f"  Matches found: {len(result)} (expected: 0)")

    print("\nWhitespace-only query:")
    result = find_matches(records, "   ")
    print(f"  Matches found: {len(result)} (expected: 0)")

    print("\nQuery for a title that definitely does not exist:")
    result = find_matches(records, "Xyzzyplugh Nonexistent Manga Title 12345")
    print(f"  Matches found: {len(result)} (expected: 0)")

    print("\nSingle-character query (very broad, stress test):")
    result = find_matches(records, "a")
    print(f"  Matches found: {len(result)} (expect: very large number)")


def test_sparse_singletons(records, records_by_gold_id, gold_id_to_row, index, index_gold_ids):
    section("4. Sparse Singleton Records")

    singletons_no_genres = [
        r for r in records
        if r.get("source_count") == 1 and not r.get("genres") and r.get("gold_id") in gold_id_to_row
    ]
    singletons_no_description = [
        r for r in records
        if r.get("source_count") == 1 and not r.get("description") and r.get("gold_id") in gold_id_to_row
    ]

    print(f"Singleton records with NO genres: {len(singletons_no_genres)}")
    print(f"Singleton records with NO description: {len(singletons_no_description)}")

    if singletons_no_genres:
        sample = singletons_no_genres[0]
        print(f"\nSample: {sample['title']!r} (source_count=1, no genres)")
        results = run_query(records_by_gold_id, gold_id_to_row, index, index_gold_ids, sample, top_k=3)
        for i, (record, score) in enumerate(results, 1):
            print(f"    [{i}] {record['title']!r}  score={score:.3f}")
        if results and results[0][1] < 0.3:
            print("  NOTE: low top score - expected for sparse records, not necessarily a bug")


def test_unicode(records, records_by_gold_id, gold_id_to_row, index, index_gold_ids):
    section("5. Unicode / Non-English Title Search")

    for query_text in UNICODE_TEST_TITLES:
        matches = find_matches(records, query_text)
        print(f"\n'{query_text}': {len(matches)} match(es)")
        for m in matches[:3]:
            print(f"    - {m['title']!r} ({m.get('year')})")


def test_latency(records, records_by_gold_id, gold_id_to_row, index, index_gold_ids):
    section("6. Query Latency")

    sample_targets = [r for r in records if r.get("gold_id") in gold_id_to_row][:50]

    start = time.perf_counter()
    for target in sample_targets:
        run_query(records_by_gold_id, gold_id_to_row, index, index_gold_ids, target)
    elapsed = time.perf_counter() - start

    avg_ms = (elapsed / len(sample_targets)) * 1000
    print(f"Ran {len(sample_targets)} queries in {elapsed:.3f}s")
    print(f"Average latency per query: {avg_ms:.2f}ms")
    flag = "  <-- consider approximate index (IVF/HNSW) if this becomes a bottleneck" if avg_ms > 100 else "  (fine for exact search at this scale)"
    print(f"{flag}")


def main() -> None:
    print("Loading Gold records and index...")
    records = load_gold_records()
    records_by_gold_id = {r["gold_id"]: r for r in records}

    model_dir = SILVER_DIR.parent / "model"
    index = faiss.read_index(str(model_dir / "similarity_index.faiss"))
    with (model_dir / "index_gold_ids.json").open("r", encoding="utf-8") as f:
        index_gold_ids = json.load(f)

    gold_id_to_row = {gid: i for i, gid in enumerate(index_gold_ids)}

    test_multi_title(records, records_by_gold_id, gold_id_to_row, index, index_gold_ids)
    test_zero_vectors(index_gold_ids)
    test_edge_cases(records)
    test_sparse_singletons(records, records_by_gold_id, gold_id_to_row, index, index_gold_ids)
    test_unicode(records, records_by_gold_id, gold_id_to_row, index, index_gold_ids)
    test_latency(records, records_by_gold_id, gold_id_to_row, index, index_gold_ids)

    print("\n" + "=" * 60)
    print("Full test suite complete. Review flagged items above.")
    print("=" * 60)


if __name__ == "__main__":
    main()
