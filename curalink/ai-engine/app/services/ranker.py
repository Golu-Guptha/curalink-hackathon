from rank_bm25 import BM25Okapi
from app.schemas.response import Publication, ClinicalTrial
from app.services.embedder import (
    compute_semantic_scores,
    compute_recency_score,
    normalize_citation_score,
)
from app.utils.text_cleaner import build_searchable_text, extract_key_sentence
from app.config import get_settings

settings = get_settings()


def rank_publications(
    query: str,
    publications: list[Publication],
    top_k: int | None = None,
    patient_profile=None,
) -> list[Publication]:
    """
    Phase 2 — Hybrid Publication Ranker

    Scoring formula:
        final = (α × semantic) + (β × bm25) + (γ × recency) + (δ × citation)
        α=0.45  β=0.30  γ=0.15  δ=0.10

    Why hybrid?
    - BM25 is great for exact keyword matches (drug names, conditions)
    - Semantic catches synonyms and paraphrased abstracts
    - Recency ensures latest research surfaces even if less cited
    - Citation count rewards high-impact established papers

    Returns top_k publications sorted by final_score descending.
    Each publication gets its relevance_score and supporting_snippet set.
    """
    k = top_k or settings.top_publications

    if not publications:
        return []

    # ── Build corpus for BM25 ─────────────────────────────────────────────────
    corpus = [
        build_searchable_text(p.title, p.abstract).lower().split()
        for p in publications
    ]
    bm25 = BM25Okapi(corpus)
    bm25_scores_raw = bm25.get_scores(query.lower().split())

    # Normalize BM25 scores to [0, 1]
    bm25_max = max(bm25_scores_raw) if max(bm25_scores_raw) > 0 else 1.0
    bm25_scores = [s / bm25_max for s in bm25_scores_raw]

    # ── Semantic scores ───────────────────────────────────────────────────────
    doc_texts = [build_searchable_text(p.title, p.abstract) for p in publications]
    semantic_scores = compute_semantic_scores(query, doc_texts)

    # ── Compute hybrid final score ────────────────────────────────────────────
    α, β, γ, δ = 0.45, 0.30, 0.15, 0.10

    scored = []
    for i, pub in enumerate(publications):
        sem = semantic_scores[i] if i < len(semantic_scores) else 0.0
        bm25_s = bm25_scores[i]
        recency = compute_recency_score(pub.year)
        citation = normalize_citation_score(pub.cited_by_count)

        final_score = (α * sem) + (β * bm25_s) + (γ * recency) + (δ * citation)

        # ── Profile-based personalization boost ────────────────────────────────
        if patient_profile:
            profile_boost = _compute_profile_boost(pub, patient_profile)
            final_score = final_score * (1.0 + profile_boost)

        # Set score and extract supporting snippet
        pub.relevance_score = round(final_score, 4)
        pub.supporting_snippet = extract_key_sentence(pub.abstract, query)
        scored.append(pub)

    # Sort descending and return top_k
    scored.sort(key=lambda p: p.relevance_score, reverse=True)
    return scored[:k]


def _compute_profile_boost(pub: Publication, profile) -> float:
    """
    Compute a personalization boost (0.0 to ~0.45) based on how well
    a publication matches the patient profile.
    """
    boost = 0.0
    text = f"{pub.title} {pub.abstract}".lower()

    # Age-group matching
    if hasattr(profile, 'age') and profile.age:
        age = profile.age
        age_terms = []
        if age >= 65: age_terms = ["elderly", "older adult", "geriatric", "aged", "senior"]
        elif age >= 18: age_terms = ["adult", "middle-aged", "middle aged"]
        elif age >= 12: age_terms = ["adolescent", "teenager", "young adult"]
        else: age_terms = ["pediatric", "child", "infant", "neonatal"]
        if any(t in text for t in age_terms):
            boost += 0.15

    # Gender matching
    if hasattr(profile, 'sex') and profile.sex:
        sex_lower = profile.sex.lower()
        if sex_lower in ["male", "female"]:
            sex_terms = [sex_lower, "men" if sex_lower == "male" else "women"]
            if any(t in text for t in sex_terms):
                boost += 0.10

    # Condition/comorbidity matching
    if hasattr(profile, 'conditions') and profile.conditions:
        conditions = [c.strip().lower() for c in profile.conditions.split(",")]
        for cond in conditions:
            if cond and len(cond) > 2 and cond in text:
                boost += 0.20
                break  # Cap at one condition match

    # Medication matching (drug interaction relevance)
    if hasattr(profile, 'current_meds') and profile.current_meds:
        meds = [m.strip().lower() for m in profile.current_meds.split(",")]
        for med in meds:
            if med and len(med) > 2 and med in text:
                boost += 0.10
                break

    return min(boost, 0.45)  # Cap total boost


def rank_clinical_trials(
    query: str,
    trials: list[ClinicalTrial],
    location: str | None = None,
    top_k: int | None = None,
) -> list[ClinicalTrial]:
    """
    Phase 2 — Clinical Trial Ranker

    Scoring:
    - BM25 on title + eligibility text
    - Semantic on title
    - Status boost: RECRUITING > ACTIVE_NOT_RECRUITING > COMPLETED
    - Location proximity boost if user location provided

    Returns top_k trials sorted by relevance.
    """
    k = top_k or settings.top_trials

    if not trials:
        return []

    # ── Build BM25 corpus from title + eligibility ────────────────────────────
    corpus = [
        f"{t.title} {t.eligibility_summary}".lower().split()
        for t in trials
    ]
    bm25 = BM25Okapi(corpus)
    bm25_scores_raw = bm25.get_scores(query.lower().split())
    bm25_max = max(bm25_scores_raw) if max(bm25_scores_raw) > 0 else 1.0
    bm25_scores = [s / bm25_max for s in bm25_scores_raw]

    # ── Semantic scores on titles ─────────────────────────────────────────────
    titles = [t.title for t in trials]
    semantic_scores = compute_semantic_scores(query, titles)

    # ── Status score map ──────────────────────────────────────────────────────
    status_scores = {
        "RECRUITING": 1.0,
        "ACTIVE_NOT_RECRUITING": 0.8,
        "ENROLLING_BY_INVITATION": 0.7,
        "COMPLETED": 0.5,
        "TERMINATED": 0.1,
        "WITHDRAWN": 0.0,
        "UNKNOWN": 0.2,
    }

    # Location tokens for proximity boost
    location_tokens = []
    if location:
        location_tokens = [t.strip().lower() for t in location.replace(",", " ").split()]

    scored = []
    for i, trial in enumerate(trials):
        sem = semantic_scores[i] if i < len(semantic_scores) else 0.0
        bm25_s = bm25_scores[i]
        status_s = status_scores.get(trial.status, 0.3)

        # Location proximity boost (0.0 or +0.2)
        location_boost = 0.0
        if location_tokens:
            for loc in trial.locations:
                combined = f"{(loc.city or '')} {(loc.country or '')}".lower()
                if any(token in combined for token in location_tokens):
                    location_boost = 0.2
                    break

        final_score = (0.40 * sem) + (0.30 * bm25_s) + (0.20 * status_s) + location_boost

        trial.relevance_score = round(min(final_score, 1.0), 4)
        scored.append(trial)

    scored.sort(key=lambda t: t.relevance_score, reverse=True)
    return scored[:k]
