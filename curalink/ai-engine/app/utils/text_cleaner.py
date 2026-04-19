import re
from typing import Optional


def clean_text(text: Optional[str]) -> str:
    """
    Normalize whitespace, strip HTML artifacts, and clean text
    for embedding & LLM consumption.
    """
    if not text:
        return ""
    # Remove HTML tags
    text = re.sub(r"<[^>]+>", " ", text)
    # Remove special chars but keep punctuation
    text = re.sub(r"[^\w\s.,;:()\-']", " ", text)
    # Collapse multiple whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def truncate_text(text: str, max_chars: int = 1500) -> str:
    """
    Truncate text to max_chars, breaking at last sentence boundary.
    Used to keep abstracts within token limits.
    """
    if len(text) <= max_chars:
        return text
    truncated = text[:max_chars]
    # Find last sentence boundary
    last_period = truncated.rfind(".")
    if last_period > max_chars * 0.7:
        return truncated[: last_period + 1]
    return truncated + "..."


def extract_key_sentence(abstract: str, query: str) -> str:
    """
    Extract the single most relevant sentence from an abstract
    to use as the 'supporting snippet' in source attribution.
    Uses simple keyword overlap scoring.
    """
    if not abstract:
        return ""

    sentences = re.split(r"(?<=[.!?])\s+", abstract)
    if not sentences:
        return ""

    query_words = set(query.lower().split())
    best_sentence = ""
    best_score = -1

    for sentence in sentences:
        sentence_words = set(sentence.lower().split())
        overlap = len(query_words & sentence_words)
        if overlap > best_score:
            best_score = overlap
            best_sentence = sentence

    return best_sentence.strip()


def build_searchable_text(title: str, abstract: str) -> str:
    """
    Combines title (weighted 2x) + abstract into one string
    for BM25 and embedding indexing.
    """
    cleaned_title = clean_text(title)
    cleaned_abstract = clean_text(abstract)
    # Title repeated twice to give it more weight in BM25
    return f"{cleaned_title} {cleaned_title} {cleaned_abstract}"
