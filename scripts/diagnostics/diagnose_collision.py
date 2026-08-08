import json
import numpy as np

from common.paths import SILVER_DIR

features_dir = SILVER_DIR.parent / "features"
gold_dir = SILVER_DIR.parent / "gold"

with (features_dir / "gold_ids.json").open("r", encoding="utf-8") as f:
    gold_ids = json.load(f)

gold_id_to_row = {gid: i for i, gid in enumerate(gold_ids)}

records = []
for page_file in sorted(gold_dir.glob("page_*.json")):
    data = json.loads(page_file.read_text(encoding="utf-8"))
    records.extend(data.get("records", []))

targets = ["A Secretary's Love Story", "Ma'am! There's a delivery for you!!", "Tentei Shounen", "Egoistic Trap"]

genre_matrix = None
numeric_features = np.load(features_dir / "numeric_features.npy")
description_embeddings = np.load(features_dir / "description_embeddings.npy")

for title in targets:
    match = next((r for r in records if r.get("title") == title), None)
    if not match:
        print(f"{title!r}: NOT FOUND")
        continue
    row = gold_id_to_row.get(match["gold_id"])
    if row is None:
        print(f"{title!r}: not in feature index")
        continue

    numeric_row = numeric_features[row]
    desc_row = description_embeddings[row]

    print(f"\n{title!r}")
    print(f"  genres: {match.get('genres')}")
    print(f"  description present: {bool(match.get('description'))}")
    print(f"  numeric_features raw row: {numeric_row}")
    print(f"  description_embedding all-zero: {not desc_row.any()}")
    print(f"  year: {match.get('year')}, rating: {match.get('ratings')}, chapters: {match.get('chapters')}, volumes: {match.get('volumes')}")
