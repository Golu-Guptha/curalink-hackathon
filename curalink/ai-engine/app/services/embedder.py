import math
from functools import lru_cache
from typing import Optional

# Lazy import â€” only load model when first needed
# This prevents slow startup if only Phase 1 endpoints are hit
_model = None


def _get_model():
    """
    Lazy-load the sentence-transformer model.
    Uses all-MiniLM-L6-v2: 22M params, 384-dim embeddings,
    fast on CPU, good semantic similarity for scientific text.
    """
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        print("[Embedder] Loading sentence-transformer model (first call)...")
        _model = SentenceTransformer("all-MiniLM-L6-v2")
        print("[Embedder] Model loaded [OK]")
    return _model


def compute_semantic_scores(query: str, documents: list[str]) -> list[float]:
    """
    Compute cosine similarity between the query embedding and
    each document embedding.

    Args:
        query:     The expanded search query string
        documents: List of document strings (title + abstract combined)

    Returns:
        List of float scores in [0, 1], one per document.
    """
    if not documents:
        return []

    from sentence_transformers import util
    import torch

    model = _get_model()

    # Encode query + all docs in one batch (efficient)
    query_embedding = model.encode(query, convert_to_tensor=True, show_progress_bar=False)
    doc_embeddings = model.encode(
        documents,
        convert_to_tensor=True,
        show_progress_bar=False,
        batch_size=32,
    )

    # Cosine similarity: shape [1, N]
    cosine_scores = util.cos_sim(query_embedding, doc_embeddings)[0]

    # Normalize from [-1, 1] to [0, 1]
    scores = [(float(s) + 1) / 2 for s in cosine_scores]
    return scores


def compute_recency_score(year: Optional[int]) -> float:
    """
    Recency score using exponential decay.
    Papers from current year = 1.0, older papers decay toward 0.

    Formula: exp(-0.15 * years_ago)
    - 2025: ~1.00
    - 2023: ~0.74
    - 2020: ~0.64
    - 2015: ~0.47
    - 2010: ~0.22
    """
    if not year:
        return 0.3  # Unknown year gets neutral low score

    current_year = 2025
    years_ago = max(0, current_year - year)
    return math.exp(-0.15 * years_ago)


def normalize_citation_score(cited_by_count: int) -> float:
    """
    Normalize citation count to [0, 1] using log scaling.
    0 citations â†’ 0.0
    10 citations â†’ ~0.50
    100 citations â†’ ~0.75
    1000+ citations â†’ ~1.0
    """
    if cited_by_count <= 0:
        return 0.0
    return min(1.0, math.log10(cited_by_count + 1) / 3.0)

