import json
import re
from typing import Optional
from app.config import get_settings
from app.services.groq_client import call_with_rotation
from app.schemas.response import ExpandedQuery

settings = get_settings()


def expand_query(
    raw_query: str,
    disease: Optional[str] = None,
    location: Optional[str] = None,
    conversation_history: list[dict] = [],
    patient_profile=None,
) -> ExpandedQuery:
    """
    Phase 2 â€” Query Expansion

    Uses Groq Llama-3.1-70b to:
    1. Extract disease, intent, location from raw user input
    2. Generate 4 diverse search query variations for broad retrieval
    3. Build optimized ClinicalTrials.gov search term

    Falls back to simple extraction if Groq fails (no API key in Phase 1).

    Returns: ExpandedQuery with all extracted + generated fields.
    """

    # â”€â”€ Pull disease/location from conversation history if not provided â”€â”€â”€â”€â”€â”€â”€â”€
    extracted_disease = disease
    extracted_location = location

    if conversation_history and not extracted_disease:
        for msg in reversed(conversation_history):
            meta = msg.get("metadata", {})
            if meta.get("disease"):
                extracted_disease = meta["disease"]
                break

    # â”€â”€ Try LLM expansion first â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    try:
        result = _llm_expand(
            raw_query=raw_query,
            known_disease=extracted_disease,
            known_location=extracted_location,
            history_summary=_summarize_history(conversation_history),
            patient_profile=patient_profile,
        )
        return result
    except Exception as e:
        print(f"[QueryExpander] LLM expansion failed ({e}), using fallback")
        return _fallback_expand(raw_query, extracted_disease, extracted_location)


# â”€â”€â”€ LLM Expansion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _llm_expand(
    raw_query: str,
    known_disease: Optional[str],
    known_location: Optional[str],
    history_summary: str,
    patient_profile=None,
) -> ExpandedQuery:
    """Call Groq to do structured query expansion."""

    system_prompt = """You are a medical research query expansion expert.
Given a user query about a medical condition, extract structured information and 
generate diverse search queries for maximum research coverage.
When patient context is provided, include age-group-specific and comorbidity-aware terms.

Always respond with ONLY valid JSON, no other text."""

    # Build patient context block for the prompt
    patient_context = ""
    if patient_profile:
        pp = patient_profile
        parts = []
        if hasattr(pp, 'age') and pp.age: parts.append(f"Age: {pp.age}")
        if hasattr(pp, 'sex') and pp.sex: parts.append(f"Sex: {pp.sex}")
        if hasattr(pp, 'current_disease') and pp.current_disease: parts.append(f"Condition: {pp.current_disease}")
        if hasattr(pp, 'conditions') and pp.conditions: parts.append(f"Comorbidities: {pp.conditions}")
        if hasattr(pp, 'current_meds') and pp.current_meds: parts.append(f"Medications: {pp.current_meds}")
        if hasattr(pp, 'location') and pp.location and not known_location:
            known_location = pp.location
        if parts:
            patient_context = "Patient Context: " + ", ".join(parts)

    user_prompt = f"""
User Query: "{raw_query}"
{f'Known Disease: {known_disease}' if known_disease else ''}
{f'Known Location: {known_location}' if known_location else ''}
{f'Conversation Context: {history_summary}' if history_summary else ''}
{patient_context}

Extract and generate the following JSON:
{{
  "disease": "primary disease/condition name (standardized medical term)",
  "intent": "what the user specifically wants to know or find",
  "location": "city, country if mentioned (or null)",
  "expanded_queries": [
    "query variation 1 (disease + intent)",
    "query variation 2 (alternative medical terminology)",
    "query variation 3 (treatment/intervention focused)",
    "query variation 4 (recent research focused with year)"
  ],
  "clinical_trial_terms": "optimized search string for ClinicalTrials.gov"
}}

Rules:
- expanded_queries must have 4 items
- Use proper medical terminology
- Make each query variation meaningfully different
- clinical_trial_terms should be 2-5 words, specific to the condition + intent
- If patient context is provided, include age-group-specific terms in at least one query (e.g. 'elderly', 'pediatric')
- If comorbidities exist, include drug-interaction or contraindication terms in one query
- If location is provided, include it in one query variation for geographic relevance
"""

    raw_json = call_with_rotation(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
        max_tokens=600,
    )

    # Strip markdown code fences if present
    raw_json = re.sub(r"```(?:json)?", "", raw_json).strip()

    data = json.loads(raw_json)

    return ExpandedQuery(
        disease=data.get("disease") or _extract_disease_simple(raw_json),
        intent=data.get("intent", raw_query),
        location=data.get("location") or None,
        expanded_queries=data.get("expanded_queries", [raw_query]),
        clinical_trial_terms=data.get("clinical_trial_terms", raw_query),
    )


# â”€â”€â”€ Fallback (no Groq key / API failure) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _fallback_expand(
    raw_query: str,
    known_disease: Optional[str],
    known_location: Optional[str],
) -> ExpandedQuery:
    """
    Simple rule-based expansion when LLM is unavailable.
    Good enough for Phase 1 testing, replaced by LLM in Phase 3.
    """
    disease = known_disease or raw_query.strip()
    intent = raw_query.strip()
    location = known_location

    expanded = [
        f"{disease} {intent}",
        f"{disease} treatment research",
        f"{disease} clinical outcomes",
        f"{disease} therapy 2023 2024",
    ]

    return ExpandedQuery(
        disease=disease,
        intent=intent,
        location=location,
        expanded_queries=expanded,
        clinical_trial_terms=f"{disease} {intent}",
    )


# â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _summarize_history(history: list[dict]) -> str:
    """Turn last 3 turns into a short text summary for context injection."""
    if not history:
        return ""
    recent = history[-3:]
    lines = []
    for msg in recent:
        role = msg.get("role", "unknown")
        content = str(msg.get("content", ""))[:200]
        lines.append(f"{role.capitalize()}: {content}")
    return "\n".join(lines)


def _extract_disease_simple(text: str) -> str:
    """Last-resort disease extraction from text."""
    # Very basic: just return first 4 words of text
    words = text.strip().split()
    return " ".join(words[:4]) if words else "unknown condition"

