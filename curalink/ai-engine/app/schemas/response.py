from pydantic import BaseModel
from typing import Optional


# ─── Publication ──────────────────────────────────────────────────────────────

class Publication(BaseModel):
    id: str                          # PMID or OpenAlex ID
    title: str
    abstract: str
    authors: list[str]
    year: Optional[int] = None
    source: str                      # "PubMed" | "OpenAlex"
    url: str
    cited_by_count: int = 0
    relevance_score: float = 0.0     # Final hybrid score
    supporting_snippet: str = ""     # Key sentence used in LLM response


# ─── Clinical Trial ───────────────────────────────────────────────────────────

class TrialLocation(BaseModel):
    facility: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None


class TrialContact(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class ClinicalTrial(BaseModel):
    nct_id: str
    title: str
    status: str
    phase: Optional[str] = None
    eligibility_summary: str
    locations: list[TrialLocation] = []
    contacts: list[TrialContact] = []
    start_date: Optional[str] = None
    url: str
    relevance_score: float = 0.0


# ─── Source Attribution ───────────────────────────────────────────────────────

class Source(BaseModel):
    id: str
    title: str
    authors: list[str]
    year: Optional[int]
    platform: str
    url: str
    snippet: str


# ─── Research Insight (with evidence quality metadata) ────────────────────────

class ResearchInsight(BaseModel):
    finding: str
    evidence: str                    # Must include (Author, Year) citation
    source_ids: list[str]            # e.g. ["pub_1", "pub_3"]
    # ── Evidence quality metadata (new) ──────────────────────────────────────
    study_type: str = ""             # "RCT" | "Meta-analysis" | "Observational" | "Case Study"
    effect_size: str = ""            # e.g. "reduced risk by 32%" | "OR=0.78 (95% CI 0.64–0.95)"
    population: str = ""             # e.g. "Indian post-MI patients, n=450"
    confidence_level: str = ""       # "High" | "Moderate" | "Low"


# ─── Full Pipeline Response ───────────────────────────────────────────────────

class PipelineResponse(BaseModel):
    """
    The complete structured response returned to Node.js backend
    and ultimately rendered in the React frontend.
    """
    session_id: str
    condition_overview: str
    key_insight: str = ""                  # ★ Single most important finding
    contradictions: list[str] = []         # ⚠ Conflicting / limiting evidence
    research_insights: list[ResearchInsight]
    publications: list[Publication]        # Top 6-8 ranked
    clinical_trials: list[ClinicalTrial]  # Top 4-6 ranked
    recommendation: str
    follow_up_questions: list[str] = []   # AI-generated follow-up suggestions
    sources: list[Source]
    metadata: dict                         # Pipeline stats for logging
    # ── Transparency fields (new) ─────────────────────────────────────────────
    agreement_score: float = 0.0           # 0.0–1.0: fraction of evidence supporting conclusion
    confidence_breakdown: dict = {}        # {"avg_relevance":0.82,"formula":"..."}
    location_context: str = ""             # "3 trials near India" or "No India trials, showing global"
    disease_guide: dict = {}               # Structured disease stages, lifestyle, diet, exercise guide


# ─── Expanded Query ───────────────────────────────────────────────────────────

class ExpandedQuery(BaseModel):
    disease: str
    intent: str
    location: Optional[str]
    expanded_queries: list[str]    # 3–5 variations for broad retrieval
    clinical_trial_terms: str      # Optimized for ClinicalTrials.gov search
