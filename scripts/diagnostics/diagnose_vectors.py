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

titles = ["A Secretary's Love Story", "Ma'am! There's a delivery for you!!", "Tentei Shounen", "Egoistic Trap"]

vectors = {}
for title in titles:
    match = next((r for r in records if r.get("title") == title), None)
    row = gold_id_to_row.get(match["gold_id"])
    vec = index.reconstruct(row)
    vectors[title] = vec
    print(f"{title!r}: row={row}, gold_id={match['gold_id']}, vector[:6]={vec[:6]}, vector_norm={np.linalg.norm(vec):.4f}")

print("\nPairwise cosine similarities (direct, bypassing search):")
names = list(vectors.keys())
for i in range(len(names)):
    for j in range(i + 1, len(names)):
        a, b = vectors[names[i]], vectors[names[j]]
        cos_sim = float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))
        print(f"  {names[i]!r} vs {names[j]!r}: {cos_sim:.6f}")

print(f"\nDuplicate gold_id check: {len(index_gold_ids)} total, {len(set(index_gold_ids))} unique")

secretary_id = next(r["gold_id"] for r in records if r.get("title") == "A Secretary's Love Story")
count_in_index = index_gold_ids.count(secretary_id)
print(f"'A Secretary's Love Story' gold_id appears {count_in_index} time(s) in index_gold_ids")
