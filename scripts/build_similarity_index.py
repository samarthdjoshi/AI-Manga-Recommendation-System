"""
Builds a content-based similarity index over the Gold dataset, fusing
the three feature blocks (genre multi-hot, description embeddings,
numeric features) into one weighted vector per record, then indexing
with FAISS for fast nearest-neighbor lookup.

Weighting rationale:
  - Genre (0.50): the clearest, most reliable "what kind of story is
    this" signal - given highest weight.
  - Description embedding (0.35): captures semantic/narrative
    similarity beyond genre tags.
  - Numeric features (0.15): year/rating/chapters/volumes act as a
    tie-breaker, not a primary similarity driver.

These weights are a reasonable content-based-recsys default, not
empirically tuned - once there is any user feedback signal, these
should be tuned against real behavior.

Per-block preprocessing before fusion:
  - Genre rows L2-normalized individually.
  - Description embeddings already L2-normalized (build_features.py).
  - Numeric features standardized (zero mean, unit variance).

Scale note: IndexFlatIP does exact brute-force search. At ~340K
records this is still sub-second per query - no need for an
approximate index (IVF/HNSW) yet.
"""

from __future__ import annotations

import json

import faiss
import numpy as np
from scipy import sparse
from sklearn.preprocessing import StandardScaler, normalize

from common.paths import SILVER_DIR

GENRE_WEIGHT = 0.50
DESCRIPTION_WEIGHT = 0.35
NUMERIC_WEIGHT = 0.15


def main() -> None:
    features_dir = SILVER_DIR.parent / "features"

    print("Loading feature blocks...")
    with (features_dir / "gold_ids.json").open("r", encoding="utf-8") as f:
        gold_ids = json.load(f)
    print(f"  gold_ids: {len(gold_ids)}")

    genre_matrix = sparse.load_npz(features_dir / "genre_multihot.npz")
    print(f"  genre_multihot: {genre_matrix.shape}")

    description_embeddings = np.load(features_dir / "description_embeddings.npy")
    print(f"  description_embeddings: {description_embeddings.shape}")

    numeric_features = np.load(features_dir / "numeric_features.npy")
    print(f"  numeric_features: {numeric_features.shape}")

    print("\nPreprocessing blocks before fusion...")

    genre_dense = genre_matrix.astype(np.float32).toarray()
    genre_normalized = normalize(genre_dense, norm="l2", axis=1)
    print(f"  Genre block L2-normalized per row")

    description_normalized = description_embeddings.astype(np.float32)

    scaler = StandardScaler()
    numeric_scaled = scaler.fit_transform(numeric_features).astype(np.float32)
    print(f"  Numeric block standardized")

    print("\nFusing blocks with weights: "
          f"genre={GENRE_WEIGHT}, description={DESCRIPTION_WEIGHT}, numeric={NUMERIC_WEIGHT}")

    fused = np.concatenate(
        [
            genre_normalized * GENRE_WEIGHT,
            description_normalized * DESCRIPTION_WEIGHT,
            numeric_scaled * NUMERIC_WEIGHT,
        ],
        axis=1,
    ).astype(np.float32)

    print(f"  Fused vector shape: {fused.shape}")

    fused_normalized = normalize(fused, norm="l2", axis=1)

    zero_rows = np.where(~fused_normalized.any(axis=1))[0]
    if len(zero_rows) > 0:
        print(f"  WARNING: {len(zero_rows)} records have an all-zero fused vector")

    print("\nBuilding FAISS index (exact cosine similarity via inner product)...")
    dimension = fused_normalized.shape[1]
    index = faiss.IndexFlatIP(dimension)
    index.add(fused_normalized)
    print(f"  Index built: {index.ntotal} vectors, dimension={dimension}")

    output_dir = SILVER_DIR.parent / "model"
    output_dir.mkdir(parents=True, exist_ok=True)

    faiss.write_index(index, str(output_dir / "similarity_index.faiss"))
    print(f"  Saved similarity_index.faiss")

    with (output_dir / "index_gold_ids.json").open("w", encoding="utf-8") as f:
        json.dump(gold_ids, f, ensure_ascii=False, indent=2)
    print(f"  Saved index_gold_ids.json")

    print("\n" + "=" * 60)
    print("Similarity Index Build - Done")
    print("=" * 60)
    print(f"Written to: {output_dir}")


if __name__ == "__main__":
    main()
