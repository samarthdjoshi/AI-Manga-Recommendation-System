"""
Semantic retrieval for the RAG chatbot: embeds a natural-language query
with the same sentence-transformer model used to build the catalog''s
description embeddings, then searches a dedicated FAISS index built
from ONLY the description embeddings - not the fused genre+description
+numeric vectors used by RecommenderService''s main similarity index,
since a raw text query has no natural genre/numeric representation to
fuse with.

Loaded once at API startup, reused across every /chat request.
"""

from __future__ import annotations

import json

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

from common.paths import SILVER_DIR

EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"


class ChatRetriever:
    def __init__(self) -> None:
        features_dir = SILVER_DIR.parent / "features"

        print("Loading sentence-transformer model for chat retrieval...")
        self.model = SentenceTransformer(EMBEDDING_MODEL_NAME)

        embeddings = np.load(features_dir / "description_embeddings.npy").astype(np.float32)
        with (features_dir / "gold_ids.json").open("r", encoding="utf-8") as f:
            self.gold_ids: list[str] = json.load(f)

        self.index = faiss.IndexFlatIP(embeddings.shape[1])
        self.index.add(embeddings)

        print(f"Chat retrieval index ready: {self.index.ntotal} description vectors.")

    def semantic_search(
        self, query: str, top_k: int = 5, min_score: float = 0.30
    ) -> list[tuple[str, float]]:
        """Returns [(gold_id, score), ...] for the most semantically similar titles.

        Records with no real description were zero-vectored at feature-build
        time, so they naturally score 0 here and never surface - no special
        casing needed.

        min_score filters out weak matches. FAISS always returns its top_k
        nearest vectors regardless of how weak the actual similarity is -
        without a floor, a vague/generic query (e.g. a single common word)
        would still return SOMETHING, and the LLM would then generate a
        plausible-sounding but ungrounded answer instead of honestly saying
        nothing relevant was found. 0.30 is a conservative starting point
        for all-MiniLM-L6-v2 cosine similarity - worth tuning against real
        usage over time.
        """
        query = (query or "").strip()
        if not query:
            return []

        query_vec = self.model.encode(
            [query], convert_to_numpy=True, normalize_embeddings=True
        ).astype(np.float32)
        scores, row_indices = self.index.search(query_vec, top_k)

        results = []
        for score, row_idx in zip(scores[0], row_indices[0]):
            if row_idx < 0:
                continue
            if float(score) < min_score:
                continue
            results.append((self.gold_ids[row_idx], float(score)))
        return results
