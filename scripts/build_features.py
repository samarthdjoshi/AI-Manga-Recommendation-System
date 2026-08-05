"""
Builds the feature set for content-based recommendation from the Gold
layer's records. Description embedding is checkpointed: encodes in
chunks of 5,000 texts, saving progress after each chunk, so an
interrupted run can resume instead of restarting from 0%.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import numpy as np
from scipy import sparse
from sklearn.preprocessing import MultiLabelBinarizer

from common.paths import SILVER_DIR

EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_BATCH_SIZE = 128
CHUNK_SIZE = 5000


def load_gold_records() -> list[dict]:
    gold_dir = SILVER_DIR.parent / "gold"
    records = []
    for page_file in sorted(gold_dir.glob("page_*.json")):
        data = json.loads(page_file.read_text(encoding="utf-8"))
        records.extend(data.get("records", []))
    return records


def build_genre_features(records: list[dict], output_dir: Path) -> None:
    print("\n--- Genre multi-hot features ---")
    genre_lists = [record.get("genres") or [] for record in records]

    mlb = MultiLabelBinarizer(sparse_output=True)
    genre_matrix = mlb.fit_transform(genre_lists)
    print(f"  Genre matrix shape: {genre_matrix.shape} (sparse)")
    print(f"  Vocabulary size: {len(mlb.classes_)}")

    sparse.save_npz(output_dir / "genre_multihot.npz", genre_matrix.tocsr())
    with (output_dir / "genre_vocab.json").open("w", encoding="utf-8") as f:
        json.dump(list(mlb.classes_), f, ensure_ascii=False, indent=2)
    print(f"  Saved genre_multihot.npz + genre_vocab.json")


def build_description_embeddings(records: list[dict], output_dir: Path) -> np.ndarray:
    print("\n--- Description embeddings (sentence-transformers, checkpointed) ---")
    from sentence_transformers import SentenceTransformer

    print(f"  Loading model: {EMBEDDING_MODEL_NAME} (first run downloads ~80MB)")
    model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    embedding_dim = model.get_sentence_embedding_dimension()
    print(f"  Embedding dimension: {embedding_dim}")

    texts_to_embed: list[str] = []
    used_description = 0
    used_title_fallback = 0
    truly_empty = 0

    for record in records:
        desc = record.get("description")
        title = record.get("title")

        if desc and desc.strip():
            texts_to_embed.append(desc)
            used_description += 1
        elif title and title.strip():
            texts_to_embed.append(title)
            used_title_fallback += 1
        else:
            texts_to_embed.append("")
            truly_empty += 1

    total = len(texts_to_embed)
    print(f"  Records from real description: {used_description} ({used_description/total*100:.1f}%)")
    print(f"  Records from title fallback: {used_title_fallback} ({used_title_fallback/total*100:.1f}%)")
    print(f"  Records with neither: {truly_empty} ({truly_empty/total*100:.1f}%)")

    embeddings_path = output_dir / "description_embeddings.npy"
    checkpoint_path = output_dir / "description_embeddings_checkpoint.json"

    if checkpoint_path.exists() and embeddings_path.exists():
        with checkpoint_path.open("r", encoding="utf-8") as f:
            checkpoint = json.load(f)

        completed_rows = checkpoint.get("completed_rows", 0)
        checkpoint_total = checkpoint.get("total", 0)

        if checkpoint_total != total:
            print(f"  WARNING: checkpoint was built for {checkpoint_total} records, "
                  f"but current Gold dataset has {total}. Discarding checkpoint, starting fresh.")
            completed_rows = 0
            embeddings = np.zeros((total, embedding_dim), dtype=np.float32)
        else:
            embeddings = np.load(embeddings_path)
            print(f"  Resuming from checkpoint: {completed_rows} / {total} rows already done "
                  f"({completed_rows/total*100:.1f}%)")
    else:
        completed_rows = 0
        embeddings = np.zeros((total, embedding_dim), dtype=np.float32)
        print("  No checkpoint found, starting fresh.")

    start = time.time()
    row = completed_rows

    while row < total:
        chunk_end = min(row + CHUNK_SIZE, total)
        chunk_texts = texts_to_embed[row:chunk_end]

        print(f"\n  Encoding chunk {row}-{chunk_end} of {total}...")
        chunk_embeddings = model.encode(
            chunk_texts,
            batch_size=EMBEDDING_BATCH_SIZE,
            show_progress_bar=True,
            convert_to_numpy=True,
            normalize_embeddings=True,
        ).astype(np.float32)

        embeddings[row:chunk_end] = chunk_embeddings

        np.save(embeddings_path, embeddings)
        with checkpoint_path.open("w", encoding="utf-8") as f:
            json.dump({"completed_rows": chunk_end, "total": total}, f)

        elapsed = time.time() - start
        pct = chunk_end / total * 100
        print(f"  Checkpoint saved: {chunk_end}/{total} ({pct:.1f}%) — "
              f"{elapsed:.0f}s elapsed this session. Safe to stop here if needed.")

        row = chunk_end

    checkpoint_path.unlink(missing_ok=True)
    print(f"\n  All {total} texts encoded. Checkpoint file removed.")
    print(f"  Saved description_embeddings.npy, shape={embeddings.shape}")

    has_description = np.array(
        [bool(r.get("description") and r["description"].strip()) for r in records],
        dtype=bool,
    )
    return has_description


def build_numeric_features(records: list[dict], has_description: np.ndarray, output_dir: Path) -> None:
    print("\n--- Numeric features ---")

    years = np.array([r.get("year") if r.get("year") is not None else np.nan for r in records], dtype=np.float64)
    ratings = np.array([r.get("rating_combined") if r.get("rating_combined") is not None else np.nan for r in records], dtype=np.float64)
    chapters = np.array([r.get("chapters") if r.get("chapters") is not None else np.nan for r in records], dtype=np.float64)
    volumes = np.array([r.get("volumes") if r.get("volumes") is not None else np.nan for r in records], dtype=np.float64)
    source_count = np.array([r.get("source_count", 1) for r in records], dtype=np.float64)

    def impute_and_flag(arr: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        missing = np.isnan(arr)
        median = np.nanmedian(arr) if not np.all(missing) else 0.0
        imputed = np.where(missing, median, arr)
        return imputed, missing.astype(np.float64)

    year_imputed, year_missing = impute_and_flag(years)
    rating_imputed, rating_missing = impute_and_flag(ratings)
    chapters_imputed, chapters_missing = impute_and_flag(chapters)
    volumes_imputed, volumes_missing = impute_and_flag(volumes)

    feature_columns = {
        "year": year_imputed,
        "year_missing": year_missing,
        "rating_combined": rating_imputed,
        "rating_combined_missing": rating_missing,
        "chapters": chapters_imputed,
        "chapters_missing": chapters_missing,
        "volumes": volumes_imputed,
        "volumes_missing": volumes_missing,
        "source_count": source_count,
        "has_description": has_description.astype(np.float64),
    }

    feature_names = list(feature_columns.keys())
    numeric_matrix = np.stack([feature_columns[name] for name in feature_names], axis=1).astype(np.float32)

    print(f"  Numeric matrix shape: {numeric_matrix.shape}")
    print(f"  Columns: {feature_names}")
    print(f"  Missing rates: year={year_missing.mean()*100:.1f}%, "
          f"rating={rating_missing.mean()*100:.1f}%, "
          f"chapters={chapters_missing.mean()*100:.1f}%, "
          f"volumes={volumes_missing.mean()*100:.1f}%")

    np.save(output_dir / "numeric_features.npy", numeric_matrix)
    with (output_dir / "numeric_feature_names.json").open("w", encoding="utf-8") as f:
        json.dump(feature_names, f, ensure_ascii=False, indent=2)
    print(f"  Saved numeric_features.npy + numeric_feature_names.json")


def main() -> None:
    print("Loading Gold records...")
    records = load_gold_records()
    print(f"Total Gold records: {len(records)}")

    output_dir = SILVER_DIR.parent / "features"
    output_dir.mkdir(parents=True, exist_ok=True)

    gold_ids = [r["gold_id"] for r in records]
    with (output_dir / "gold_ids.json").open("w", encoding="utf-8") as f:
        json.dump(gold_ids, f, ensure_ascii=False, indent=2)
    print(f"Saved gold_ids.json ({len(gold_ids)} ids - defines row order for all feature blocks)")

    build_genre_features(records, output_dir)
    has_description = build_description_embeddings(records, output_dir)
    build_numeric_features(records, has_description, output_dir)

    print("\n" + "=" * 60)
    print("Feature Engineering - Done")
    print("=" * 60)
    print(f"All feature blocks written to: {output_dir}")
    print("Row alignment: index i in every array corresponds to gold_ids[i]")


if __name__ == "__main__":
    main()
