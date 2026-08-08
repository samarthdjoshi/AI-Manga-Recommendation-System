import json
import numpy as np
import faiss

from common.paths import SILVER_DIR

model_dir = SILVER_DIR.parent / "model"
gold_dir = SILVER_DIR.parent / "gold"

index = faiss.read_index(str(model_dir / "similarity_index.faiss"))
with (model_dir / "index_gold_ids.json").open("r", encoding="utf-8") as f:
    index_gold_ids = json.load(f)

gold_id_to_row = {gid: i for i, gid in enumerate(index_gold_ids)}

records = []
for page_file in sorted(gold_dir.glob("page_*.json")):
    data = json.loads(page_file.read_text(encoding="utf-8"))
    records.extend(data.get("records", []))

# How many Gold records share the exact title "Egoistic Trap"?
matches = [r for r in records if r.get("title") == "Egoistic Trap"]
print(f"Records titled 'Egoistic Trap': {len(matches)}")
for m in matches:
    row = gold_id_to_row.get(m["gold_id"])
    vec = index.reconstruct(row) if row is not None else None
    print(f"  gold_id={m['gold_id']}, source_count={m.get('source_count')}, genres={m.get('genres')}, row={row}")

# Now actually run the real search from "A Secretary's Love Story" and
# print the RAW gold_ids FAISS returns, not a title-based re-lookup.
secretary = next(r for r in records if r.get("title") == "A Secretary's Love Story")
row = gold_id_to_row[secretary["gold_id"]]
query_vector = index.reconstruct(row).reshape(1, -1)
scores, row_indices = index.search(query_vector, 5)

print("\nRaw FAISS search results for 'A Secretary's Love Story':")
for score, row_idx in zip(scores[0], row_indices[0]):
    gid = index_gold_ids[row_idx]
    rec = next((r for r in records if r.get("gold_id") == gid), None)
    print(f"  row={row_idx}, gold_id={gid}, score={score:.6f}, title={rec.get('title') if rec else 'UNKNOWN'!r}")
