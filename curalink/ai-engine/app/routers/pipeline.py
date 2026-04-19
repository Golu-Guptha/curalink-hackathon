import math
import asyncio
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from app.services.pubmed_fetcher import fetch_pubmed_publications
from app.services.openalex_fetcher import fetch_openalex_publications
from app.services.clinical_trials_fetcher import fetch_clinical_trials
from app.services.query_expander import expand_query
from app.services.ranker import rank_publications, rank_clinical_trials
from app.services.llm_service import generate_structured_response
from app.schemas.request import QueryRequest, FetchRequest
from app.schemas.response import Publication, ClinicalTrial, PipelineResponse

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


# ─── Transparency Helpers ──────────────────────────────────────────────────────

def compute_confidence_breakdown(ranked_pubs: list, ranked_trials: list) -> dict:
    """Expose the real hybrid ranking formula weights and component scores."""
    if not ranked_pubs:
        return {"final": 0.0, "formula": "No publications retrieved"}

    avg_relevance = sum(p.relevance_score for p in ranked_pubs) / len(ranked_pubs)
    recency_score = sum(1 for p in ranked_pubs if p.year and p.year >= 2020) / len(ranked_pubs)
    max_citations  = max((p.cited_by_count for p in ranked_pubs), default=1)
    citation_norm  = min(1.0, math.log1p(max_citations) / math.log1p(500))
    trial_bonus    = min(0.15, len(ranked_trials) * 0.03)

    final = round(
        0.40 * avg_relevance +
        0.30 * recency_score +
        0.20 * citation_norm +
        trial_bonus,
        3,
    )

    return {
        "relevance_weight":  0.40,
        "avg_relevance":     round(avg_relevance, 3),
        "recency_weight":    0.30,
        "recency_score":     round(recency_score, 3),
        "citation_weight":   0.20,
        "citation_score":    round(citation_norm, 3),
        "trial_bonus":       round(trial_bonus, 3),
        "final":             min(0.98, final),
        "formula":           "0.40 × relevance + 0.30 × recency + 0.20 × citations + trial_bonus",
    }


def compute_agreement_score(publications: list) -> tuple[float, str]:
    """Fraction of top-ranked pubs strongly supporting the query (score >= 0.5)."""
    if not publications:
        return 0.0, "No evidence available"
    supporting = sum(1 for p in publications if p.relevance_score >= 0.5)
    total = len(publications)
    ratio = round(supporting / total, 2)
    conflict = total - supporting
    breakdown = (
        f"{supporting} of {total} studies strongly support this finding"
        + (f"; {conflict} show weaker or conflicting relevance" if conflict else "")
    )
    return ratio, breakdown


def compute_location_context(ranked_trials: list, user_loc: str) -> str:
    """Generate a human-readable string describing trial location coverage."""
    if not ranked_trials:
        return "No clinical trials found."
    if not user_loc:
        return f"Showing {len(ranked_trials)} global clinical trial(s)."
    loc_tokens = [t.strip().lower() for t in user_loc.replace(",", " ").split() if t.strip()]
    local_count = sum(
        1 for t in ranked_trials
        if any(
            tok in f"{(loc.city or '')} {(loc.country or '')}".lower()
            for loc in t.locations for tok in loc_tokens
        )
    )
    if local_count > 0:
        global_count = len(ranked_trials) - local_count
        return (
            f"{local_count} trial(s) found near {user_loc}"
            + (f" + {global_count} global" if global_count else "")
        )
    return f"No trials found near {user_loc}. Showing {len(ranked_trials)} global trial(s)."




# ─── Phase 1: Individual Fetch Test Endpoints ─────────────────────────────────

@router.get("/fetch/pubmed", response_model=dict)
async def test_pubmed(
    disease: str = Query(..., description="Disease name e.g. 'lung cancer'"),
    query: str = Query("", description="Additional search term e.g. 'immunotherapy'"),
    max_results: int = Query(20, le=100),
):
    """
    TEST ENDPOINT — Phase 1
    Fetch raw PubMed publications for a disease+query.
    Use this to verify the fetcher works before Phase 2.
    """
    pubs = await fetch_pubmed_publications(disease, query, max_results)
    return {
        "source": "PubMed",
        "total_fetched": len(pubs),
        "results": [p.model_dump() for p in pubs[:5]],  # Preview first 5
        "message": f"Successfully fetched {len(pubs)} publications from PubMed",
    }


@router.get("/fetch/openalex", response_model=dict)
async def test_openalex(
    disease: str = Query(..., description="Disease name e.g. 'parkinson disease'"),
    query: str = Query("", description="Additional search term"),
    max_results: int = Query(50, le=200),
):
    """
    TEST ENDPOINT — Phase 1
    Fetch raw OpenAlex publications for a disease+query.
    """
    pubs = await fetch_openalex_publications(disease, query, max_results)
    return {
        "source": "OpenAlex",
        "total_fetched": len(pubs),
        "results": [p.model_dump() for p in pubs[:5]],  # Preview first 5
        "message": f"Successfully fetched {len(pubs)} publications from OpenAlex",
    }


@router.get("/fetch/trials", response_model=dict)
async def test_clinical_trials(
    disease: str = Query(..., description="Disease name e.g. 'diabetes'"),
    query: str = Query("", description="Additional search term"),
    location: Optional[str] = Query(None, description="Location e.g. 'Toronto, Canada'"),
    max_results: int = Query(30, le=50),
):
    """
    TEST ENDPOINT — Phase 1
    Fetch raw clinical trials for a disease+query+location.
    """
    trials = await fetch_clinical_trials(disease, query, location, max_results)
    return {
        "source": "ClinicalTrials.gov",
        "total_fetched": len(trials),
        "location_filter": location or "none",
        "results": [t.model_dump() for t in trials[:5]],  # Preview first 5
        "message": f"Successfully fetched {len(trials)} clinical trials",
    }


@router.get("/fetch/all", response_model=dict)
async def test_all_sources(
    disease: str = Query(..., description="Disease name"),
    query: str = Query("", description="Additional search term"),
    location: Optional[str] = Query(None, description="Location for trial filtering"),
):
    """
    TEST ENDPOINT — Phase 1
    Fetch from ALL three sources in parallel.
    This is the combined Phase 1 smoke test.
    """
    pubmed_task = fetch_pubmed_publications(disease, query, max_results=30)
    openalex_task = fetch_openalex_publications(disease, query, max_results=50)
    trials_task = fetch_clinical_trials(disease, query, location, max_results=20)

    pubmed_pubs, openalex_pubs, trials = await asyncio.gather(
        pubmed_task, openalex_task, trials_task
    )

    return {
        "disease": disease,
        "query": query,
        "location": location or "not provided",
        "summary": {
            "pubmed_count": len(pubmed_pubs),
            "openalex_count": len(openalex_pubs),
            "trials_count": len(trials),
            "total_raw_candidates": len(pubmed_pubs) + len(openalex_pubs),
        },
        "pubmed_preview": [
            {"title": p.title, "year": p.year, "authors": p.authors[:2]}
            for p in pubmed_pubs[:3]
        ],
        "openalex_preview": [
            {"title": p.title, "year": p.year, "cited_by_count": p.cited_by_count}
            for p in openalex_pubs[:3]
        ],
        "trials_preview": [
            {"title": t.title, "status": t.status, "locations": [l.model_dump() for l in t.locations[:2]]}
            for t in trials[:3]
        ],
        "message": "Phase 1 fetch successful. Proceed to Phase 2 (ranking).",
    }


# ─── Phase 2: Query Expansion + Ranking Endpoints ────────────────────────────

@router.post("/expand", response_model=dict)
async def test_query_expansion(
    query: str = Query(..., description="Raw user query e.g. 'latest treatment for lung cancer'"),
    disease: Optional[str] = Query(None, description="Known disease if already extracted"),
    location: Optional[str] = Query(None, description="User location e.g. 'Toronto, Canada'"),
):
    """
    TEST ENDPOINT — Phase 2
    Tests the LLM-powered query expansion.
    Shows extracted disease/intent/location + 4 search variations.
    Requires GROQ_API_KEY in .env — falls back to rule-based if missing.
    """
    expanded = expand_query(
        raw_query=query,
        disease=disease,
        location=location,
        conversation_history=[],
    )
    return {
        "original_query": query,
        "expanded": expanded.model_dump(),
        "message": "Query expansion successful",
    }


@router.post("/rank", response_model=dict)
async def test_rank_pipeline(
    query: str = Query(..., description="User query e.g. 'deep brain stimulation Parkinson'"),
    disease: str = Query(..., description="Disease name"),
    location: Optional[str] = Query(None, description="Location for trial filtering"),
):
    """
    TEST ENDPOINT — Phase 2
    Full pipeline: expand query → fetch from all 3 sources → rank.
    Returns top 7 publications + top 5 trials with scores.
    This is the complete Phase 2 smoke test.
    """
    # Step 1: Expand query
    expanded = expand_query(raw_query=query, disease=disease, location=location)

    # Step 2: Use best expanded query for fetching
    best_query = expanded.expanded_queries[0] if expanded.expanded_queries else query

    # Step 3: Parallel fetch from all sources
    pubmed_task = fetch_pubmed_publications(expanded.disease, best_query, max_results=80)
    openalex_task = fetch_openalex_publications(expanded.disease, best_query, max_results=100)
    trials_task = fetch_clinical_trials(
        expanded.disease, expanded.clinical_trial_terms, expanded.location
    )

    pubmed_pubs, openalex_pubs, trials = await asyncio.gather(
        pubmed_task, openalex_task, trials_task
    )

    # Step 4: Merge publications
    all_pubs = pubmed_pubs + openalex_pubs

    # Step 5: Rank
    ranked_pubs = rank_publications(query=best_query, publications=all_pubs)
    ranked_trials = rank_clinical_trials(
        query=expanded.clinical_trial_terms,
        trials=trials,
        location=expanded.location,
    )

    return {
        "expanded_query": expanded.model_dump(),
        "pipeline_stats": {
            "pubmed_fetched": len(pubmed_pubs),
            "openalex_fetched": len(openalex_pubs),
            "total_candidates": len(all_pubs),
            "trials_fetched": len(trials),
            "publications_after_ranking": len(ranked_pubs),
            "trials_after_ranking": len(ranked_trials),
        },
        "top_publications": [
            {
                "rank": i + 1,
                "title": p.title,
                "year": p.year,
                "source": p.source,
                "authors": p.authors[:3],
                "relevance_score": p.relevance_score,
                "cited_by_count": p.cited_by_count,
                "snippet": p.supporting_snippet[:200] if p.supporting_snippet else "",
                "url": p.url,
            }
            for i, p in enumerate(ranked_pubs)
        ],
        "top_trials": [
            {
                "rank": i + 1,
                "title": t.title,
                "status": t.status,
                "phase": t.phase,
                "relevance_score": t.relevance_score,
                "locations": [f"{l.city}, {l.country}" for l in t.locations[:2] if l.city],
                "url": t.url,
            }
            for i, t in enumerate(ranked_trials)
        ],
        "message": "Phase 2 ranking complete. Scores verify hybrid BM25+semantic pipeline.",
    }


# ─── Phase 3: Full End-to-End Pipeline ───────────────────────────────────────

@router.post("/query", response_model=PipelineResponse)
async def run_full_pipeline(request: QueryRequest):
    """
    PRODUCTION ENDPOINT — Phase 3
    Full 6-step RAG pipeline:
      1. Query Expansion (LLM)
      2. Parallel Data Fetch (PubMed + OpenAlex + ClinicalTrials)
      3. Hybrid Ranking (BM25 + Semantic + Recency + Citation)
      4. Prompt Engineering (RAG context injection)
      5. LLM Reasoning (Groq Llama-3.1-70b)
      6. Structured Response (PipelineResponse)

    Called by the Node.js backend on every user chat message.
    Returns a fully structured, source-attributed, research-backed response.
    """

    # ── Step 1: Query Expansion ───────────────────────────────────────────────
    expanded = expand_query(
        raw_query=request.query,
        disease=request.disease,
        location=request.location,
        conversation_history=request.conversation_history,
    )
    print(f"[Pipeline] Disease: {expanded.disease} | Intent: {expanded.intent}")
    print(f"[Pipeline] Expanded queries: {expanded.expanded_queries[:2]}")

    # Use the most specific expanded query for fetching
    best_query = expanded.expanded_queries[0] if expanded.expanded_queries else request.query

    # ── Step 2: Parallel Data Fetch ───────────────────────────────────────────
    pubmed_task = fetch_pubmed_publications(
        disease=expanded.disease,
        query=best_query,
        max_results=80,
    )
    openalex_task = fetch_openalex_publications(
        disease=expanded.disease,
        query=best_query,
        max_results=120,
    )
    trials_task = fetch_clinical_trials(
        disease=expanded.disease,
        query=expanded.clinical_trial_terms,
        location=expanded.location or request.location,
    )

    pubmed_pubs, openalex_pubs, trials = await asyncio.gather(
        pubmed_task, openalex_task, trials_task
    )

    all_publications = pubmed_pubs + openalex_pubs
    total_candidates = len(all_publications)
    print(f"[Pipeline] Fetched: PubMed={len(pubmed_pubs)}, OpenAlex={len(openalex_pubs)}, Trials={len(trials)}")

    if total_candidates == 0:
        raise HTTPException(
            status_code=404,
            detail=f"No research publications found for '{expanded.disease}'. Try a different disease name or query."
        )

    # ── Step 3: Hybrid Ranking ────────────────────────────────────────────────
    user_loc = expanded.location or request.location or ""
    ranked_pubs = rank_publications(
        query=best_query,
        publications=all_publications,
    )
    ranked_trials = rank_clinical_trials(
        query=expanded.clinical_trial_terms,
        trials=trials,
        location=user_loc,
    )
    print(f"[Pipeline] Ranked: {len(ranked_pubs)} publications, {len(ranked_trials)} trials")

    # ── Transparency calculations ─────────────────────────────────────────────
    confidence_breakdown = compute_confidence_breakdown(ranked_pubs, ranked_trials)
    agreement_score, agreement_breakdown = compute_agreement_score(ranked_pubs)
    location_context = compute_location_context(ranked_trials, user_loc)

    # ── Pipeline stats for metadata ───────────────────────────────────────────
    pipeline_stats = {
        "pubmed_fetched":       len(pubmed_pubs),
        "openalex_fetched":     len(openalex_pubs),
        "total_candidates":     total_candidates,
        "trials_fetched":       len(trials),
        "publications_ranked":  len(ranked_pubs),
        "trials_ranked":        len(ranked_trials),
        "expanded_disease":     expanded.disease,
        "expanded_intent":      expanded.intent,
        "expanded_queries":     expanded.expanded_queries,
        "ranking_method":       "BM25 + Semantic + Recency + Citation Count",
        "location":             user_loc,
        "confidence_breakdown": confidence_breakdown,
        "agreement_breakdown":  agreement_breakdown,
        "location_context":     location_context,
    }

    # ── Steps 4-6: Prompt → LLM → Structured Response ────────────────────────
    response = generate_structured_response(
        request=request,
        ranked_publications=ranked_pubs,
        ranked_trials=ranked_trials,
        expanded_disease=expanded.disease,
        expanded_intent=expanded.intent,
        pipeline_stats=pipeline_stats,
    )

    # Attach transparency fields directly to response
    response.confidence_breakdown = confidence_breakdown
    response.agreement_score = max(response.agreement_score, agreement_score)
    response.location_context = location_context

    print(f"[Pipeline] Done. Insights: {len(response.research_insights)}, Confidence: {confidence_breakdown['final']:.0%}")
    return response
