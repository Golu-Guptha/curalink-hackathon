"""
embedder.py — Memory-optimised semantic scoring for Render free tier (512 MB RAM)

CHANGE: Replaced sentence-transformers (torch + ~400 MB RAM) with
        lightweight TF-IDF cosine similarity (~0 MB overhead, stdlib only).

Quality trade-off: TF-IDF is slightly less semantically rich, but
        BM25 already carries the keyword relevance; TF-IDF adds term-overlap
        context that keeps ranking quality high without blowing the memory budget.

When you upgrade to a paid instance, restore the SentenceTransformer block.
"""

import math
import re
from collections import Counter
from typing import Optional


# ─── TF-IDF helpers ──────────────────────────────────────────────────────────

def _tokenize(text: str) -> list[str]:
    """Lowercase + split on non-alpha chars, remove empty tokens."""
    return [t for t in re.split(r"[^a-z0-9]+", text.lower()) if t]


def _tfidf_vectors(query_tokens: list[str], doc_token_lists: list[list[str]]):
    """
    Build TF-IDF vectors for query and each document.
    Returns (query_vec dict, list of doc_vec dicts).
    """
    # Collect all docs (query treated as doc 0 for IDF purposes)
    all_docs = [query_tokens] + doc_token_lists
    N = len(all_docs)

    # Document frequency
    df: dict[str, int] = {}
    for doc in all_docs:
        for term in set(doc):
            df[term] = df.get(term, 0) + 1

    def idf(term: str) -> float:
        return math.log((N + 1) / (df.get(term, 0) + 1)) + 1

    def tf_idf_vec(tokens: list[str]) -> dict[str, float]:
        tf = Counter(tokens)
        total = max(len(tokens), 1)
        return {t: (c / total) * idf(t) for t, c in tf.items()}

    query_vec = tf_idf_vec(query_tokens)
    doc_vecs  = [tf_idf_vec(dt) for dt in doc_token_lists]
    return query_vec, doc_vecs


def _cosine(vec_a: dict[str, float], vec_b: dict[str, float]) -> float:
    """Cosine similarity between two sparse TF-IDF vectors."""
    if not vec_a or not vec_b:
        return 0.0
    dot = sum(vec_a.get(t, 0.0) * s for t, s in vec_b.items())
    mag_a = math.sqrt(sum(v * v for v in vec_a.values()))
    mag_b = math.sqrt(sum(v * v for v in vec_b.values()))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


# ─── Public API (same signature as before) ───────────────────────────────────

def compute_semantic_scores(query: str, documents: list[str]) -> list[float]:
    """
    TF-IDF cosine similarity between the query and each document.
    Returns scores in [0, 1].

    Replaces sentence-transformers to stay within 512 MB RAM (Render free tier).
    """
    if not documents:
        return []

    query_tokens    = _tokenize(query)
    doc_token_lists = [_tokenize(d) for d in documents]

    query_vec, doc_vecs = _tfidf_vectors(query_tokens, doc_token_lists)
    return [_cosine(query_vec, dv) for dv in doc_vecs]


def compute_recency_score(year: Optional[int]) -> float:
    """
    Recency score using exponential decay.
    Papers from current year = 1.0, older papers decay toward 0.

    Formula: exp(-0.15 * years_ago)
    - 2025: ~1.00  |  2023: ~0.74  |  2020: ~0.64  |  2015: ~0.47
    """
    if not year:
        return 0.3
    current_year = 2025
    years_ago = max(0, current_year - year)
    return math.exp(-0.15 * years_ago)


def normalize_citation_score(cited_by_count: int) -> float:
    """
    Log-scale citation normalisation to [0, 1].
    0 → 0.0 | 10 → ~0.50 | 100 → ~0.75 | 1000+ → ~1.0
    """
    if cited_by_count <= 0:
        return 0.0
    return min(1.0, math.log10(cited_by_count + 1) / 3.0)
