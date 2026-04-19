"""
Phase 3 -- LLM Reasoning Service
==================================
Uses Groq key rotation (call_with_rotation) to call the LLM.
Model: llama-3.3-70b-versatile (llama-3.1-70b-versatile was decommissioned).
"""

import json
import re
from app.config import get_settings
from app.services.groq_client import call_with_rotation
from app.schemas.response import (
    PipelineResponse, Publication, ClinicalTrial,
    ResearchInsight, Source,
)
from app.schemas.request import QueryRequest

settings = get_settings()


def generate_structured_response(
    request: QueryRequest,
    ranked_publications: list[Publication],
    ranked_trials: list[ClinicalTrial],
    expanded_disease: str,
    expanded_intent: str,
    pipeline_stats: dict,
) -> PipelineResponse:
    """Core LLM reasoning. Falls back gracefully on any error."""
    try:
        system_prompt = _build_system_prompt(request.research_mode)
        user_prompt = _build_user_prompt(
            query=request.query,
            disease=expanded_disease,
            intent=expanded_intent,
            location=request.location,
            publications=ranked_publications,
            trials=ranked_trials,
            conversation_history=request.conversation_history,
            research_mode=request.research_mode,
            patient_profile=request.patient_profile,
        )

        # Adjust token budget & temperature by mode
        mode_cfg = {
            "fast":     {"temperature": 0.1, "max_tokens": 2500},
            "thinking": {"temperature": 0.2, "max_tokens": 5000},
            "deep":     {"temperature": 0.3, "max_tokens": 7500},
        }.get(request.research_mode, {"temperature": 0.2, "max_tokens": 5000})

        raw_json = call_with_rotation(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=mode_cfg["temperature"],
            max_tokens=mode_cfg["max_tokens"],
            response_format={"type": "json_object"},
        )
        raw_json = re.sub(r"```(?:json)?", "", raw_json).strip()

        return _parse_llm_response(
            raw_json=raw_json,
            session_id=request.session_id,
            publications=ranked_publications,
            trials=ranked_trials,
            pipeline_stats=pipeline_stats,
        )

    except Exception as e:
        print(f"[LLM] Generation failed: {e} -- using structured fallback")
        return _fallback_response(
            request=request,
            publications=ranked_publications,
            trials=ranked_trials,
            disease=expanded_disease,
            pipeline_stats=pipeline_stats,
            error=str(e),
        )


# -- Prompt Construction -------------------------------------------------------

def _build_system_prompt(research_mode: str = "thinking") -> str:
    base = (
        "You are CuraLink, an AI Medical Research Assistant that directly answers user questions "
        "using the latest medical literature and clinical trial data.\n\n"
        "CRITICAL RULES:\n"
        "1. DIRECTLY ANSWER the user's specific question — do NOT give a generic disease overview.\n"
        "2. ONLY use information from the provided publications and clinical trials. Never hallucinate.\n"
        "3. Every research insight MUST reference a source by ID (e.g., pub_1, pub_2).\n"
        "4. Be empathetic, clear, and non-prescriptive. Always recommend consulting a doctor.\n"
        "5. Highlight RECRUITING clinical trials especially near the user's location.\n"
        "6. Respond ONLY in valid JSON. No text outside JSON.\n\n"
        "STRICT CITATION RULES (NON-NEGOTIABLE):\n"
        "- Every claim in condition_overview MUST cite (LastName, Year) from the provided abstracts.\n"
        "- NEVER use vague phrases like 'research shows' or 'studies suggest' without a citation.\n"
        "- Format: 'According to [LastName et al., Year], [specific finding with data].'\n"
        "- If you cannot cite a claim from the provided papers → say 'insufficient evidence'.\n"
        "- Always include effect size when available (e.g. 'reduced by 32%', 'OR=0.78').\n"
        "- For each insight, identify study type from the abstract: RCT, Meta-analysis, Observational, Case Study.\n"
        "- Extract patient population when stated (e.g. 'Indian adults, n=450').\n"
        "- Rate confidence level: High (RCT/Meta-analysis), Moderate (Observational), Low (Case Study/unclear).\n\n"
        "You are a research assistant, NOT a doctor. Never provide direct medical advice."
    )

    mode_instructions = {
        "fast": (
            "\n\nRESPONSE MODE: FAST\n"
            "- Write condition_overview in 2-3 SHORT sentences. Cite at least one paper per sentence.\n"
            "- Include only 2-3 key research_insights (most important ones with citations).\n"
            "- Keep recommendation to 1-2 sentences.\n"
            "- Prioritize clarity and brevity. Every claim must have a citation."
        ),
        "thinking": (
            "\n\nRESPONSE MODE: THINKING (BALANCED)\n"
            "- Write a well-structured condition_overview of 3-5 sentences, each with at least one (Author, Year) citation.\n"
            "- Include 3-5 research_insights, each with study_type, effect_size, population, and confidence_level.\n"
            "- Provide a thorough recommendation paragraph with citations."
        ),
        "deep": (
            "\n\nRESPONSE MODE: DEEP RESEARCH\n"
            "- Write COMPREHENSIVE condition_overview (5-8 sentences), every sentence must cite at least one study.\n"
            "- Include ALL 5+ research_insights with full effect sizes, study types, populations, confidence levels.\n"
            "- Explore multiple perspectives, compare findings, note real contradictions with citations.\n"
            "- Provide detailed recommendation citing specific papers and trials by NCT ID or author name.\n"
            "- This is for clinical researchers — be thorough, precise, and fully evidence-grounded."
        ),
    }
    return base + mode_instructions.get(research_mode, mode_instructions["thinking"])


def _build_user_prompt(
    query: str,
    disease: str,
    intent: str,
    location,
    publications: list[Publication],
    trials: list[ClinicalTrial],
    conversation_history: list[dict],
    research_mode: str = "thinking",
    patient_profile=None,
) -> str:
    # Patient profile block (deep research only)
    profile_block = ""
    if patient_profile and research_mode == "deep":
        lines = ["PATIENT PROFILE (use this to personalize the answer):"]
        if patient_profile.name:            lines.append(f"  Name: {patient_profile.name}")
        if patient_profile.age:             lines.append(f"  Age: {patient_profile.age}")
        if patient_profile.sex:             lines.append(f"  Sex: {patient_profile.sex}")
        if patient_profile.weight_kg:       lines.append(f"  Weight: {patient_profile.weight_kg} kg")
        if patient_profile.location:        lines.append(f"  Location: {patient_profile.location}")
        if patient_profile.current_disease: lines.append(f"  Current disease: {patient_profile.current_disease}")
        if patient_profile.conditions:      lines.append(f"  Other conditions: {patient_profile.conditions}")
        if patient_profile.current_meds:    lines.append(f"  Current medications: {patient_profile.current_meds}")
        if patient_profile.allergies:       lines.append(f"  Allergies: {patient_profile.allergies}")
        if patient_profile.medical_history: lines.append(f"  Medical history: {patient_profile.medical_history}")
        if patient_profile.lab_values:      lines.append(f"  Lab values: {patient_profile.lab_values}")
        if patient_profile.research_focus:  lines.append(f"  Research focus: {patient_profile.research_focus}")
        detail_map = {
            "patient":  "Plain language for patient/caregiver. Avoid jargon.",
            "balanced": "Balanced mix of clinical and plain language.",
            "clinical": "Full technical depth for clinical researchers.",
        }
        lines.append(f"  Detail level: {detail_map.get(patient_profile.detail_level, 'balanced')}")
        lines.append("IMPORTANT: Tailor insights and recommendations specifically to this patient profile.")
        lines.append("Flag any medication interactions, age-specific concerns, or condition conflicts.")
        profile_block = "\n".join(lines) + "\n\n---\n\n"

    # Conversation history
    history_text = "This is the first message."
    if conversation_history:
        recent = conversation_history[-6:]
        lines = [f"[{m.get('role','?').capitalize()}]: {str(m.get('content',''))[:300]}" for m in recent]
        history_text = "\n".join(lines)

    # Publications block
    pub_lines = []
    for i, pub in enumerate(publications, 1):
        authors_str = ", ".join(pub.authors[:3])
        if len(pub.authors) > 3:
            authors_str += " et al."
        snippet = (pub.abstract or "No abstract.")[:600]
        pub_lines.append(
            f"[pub_{i}]\n"
            f"  Title: {pub.title}\n"
            f"  Authors: {authors_str} ({pub.year})\n"
            f"  Source: {pub.source} | URL: {pub.url}\n"
            f"  Abstract: {snippet}"
        )
    pubs_text = "\n\n".join(pub_lines) if pub_lines else "No publications retrieved."

    # Trials block
    trial_lines = []
    for i, trial in enumerate(trials, 1):
        locs = [f"{l.city}, {l.country}" for l in trial.locations[:3] if l.city]
        loc_str = "; ".join(locs) if locs else "Locations not listed"
        trial_lines.append(
            f"[trial_{i}]\n"
            f"  Title: {trial.title}\n"
            f"  Status: {trial.status} | Phase: {trial.phase or 'N/A'}\n"
            f"  Locations: {loc_str}\n"
            f"  Eligibility: {(trial.eligibility_summary or '')[:300]}\n"
            f"  URL: {trial.url}"
        )
    trials_text = "\n\n".join(trial_lines) if trial_lines else "No clinical trials retrieved."

    loc_note = f"User location: {location}" if location else "Location: not specified"

    # Detect query intent for targeted instructions
    query_lower = query.lower()
    is_trial_query = any(w in query_lower for w in ["trial", "trials", "recruit", "study", "studies", "enroll", "participate", "clinical"])
    is_treatment_query = any(w in query_lower for w in ["treatment", "therapy", "drug", "medication", "cure", "manage", "option"])
    is_side_effect_query = any(w in query_lower for w in ["side effect", "adverse", "risk", "safe", "safety"])

    if is_trial_query:
        overview_instruction = (
            '"condition_overview": "Directly answer about the clinical trials retrieved. '
            'State HOW MANY trials were found, how many are RECRUITING, '
            'and briefly describe the most relevant ones. Be specific — do not give a generic disease description.",'
        )
        insight_focus = "Focus insights on what the trials are studying and their results."
    elif is_treatment_query:
        overview_instruction = (
            '"condition_overview": "Directly answer what the research says about the treatment options asked. '
            'Summarize key treatment findings from the retrieved publications. '
            'Do not just describe the disease — answer the treatment question.",'
        )
        insight_focus = "Focus insights on treatment effectiveness and mechanisms from the publications."
    elif is_side_effect_query:
        overview_instruction = (
            '"condition_overview": "Directly answer the safety/side-effect question based on the retrieved research. '
            'Cite specific findings. Do not give a generic disease overview.",'
        )
        insight_focus = "Focus insights on safety data and adverse events from the publications."
    else:
        overview_instruction = (
            '"condition_overview": "Directly answer the user\'s question using the retrieved research. '
            'Be specific and informative. Do not give a generic disease description — answer the actual question asked.",'
        )
        insight_focus = "Extract the most relevant findings that directly answer the user's question."

    return (
        f"{profile_block}"
        f"CONVERSATION HISTORY:\n{history_text}\n\n---\n\n"
        f"USER QUESTION: {query}\n"
        f"DISEASE CONTEXT: {disease}\n"
        f"SPECIFIC INTENT: {intent}\n"
        f"{loc_note}\n\n---\n\n"
        f"RETRIEVED PUBLICATIONS ({len(publications)} total):\n{pubs_text}\n\n---\n\n"
        f"RETRIEVED CLINICAL TRIALS ({len(trials)} total):\n{trials_text}\n\n---\n\n"
        f"INSTRUCTIONS: Generate a JSON response. DIRECTLY ANSWER the user's question. {insight_focus}\n"
        "JSON schema:\n"
        "{\n"
        f"  {overview_instruction}\n"
        '  "key_insight": "ONE powerful headline sentence — specific claim with (Author, Year) and effect size if available.",\n'
        '  "research_insights": [\n'
        '    {\n'
        '      "finding": "Specific evidence-grounded finding that directly answers the question",\n'
        '      "evidence": "According to [LastName et al., Year], [exact finding with data from abstract]",\n'
        '      "source_ids": ["pub_1"],\n'
        '      "study_type": "RCT|Meta-analysis|Observational|Case Study",\n'
        '      "effect_size": "e.g. reduced risk by 32%, OR=0.78 (95% CI 0.64-0.95), or empty string if not stated",\n'
        '      "population": "e.g. Indian post-MI patients n=450, or empty string if not stated",\n'
        '      "confidence_level": "High|Moderate|Low"\n'
        '    }\n'
        "  ],\n"
        '  "contradictions": [\n'
        '    "A SPECIFIC conflicting finding with citation (Author, Year) and reason for conflict",\n'
        '    "Another limitation with citation or acknowledgment of insufficient evidence"\n'
        '  ],\n'
        '  "agreement_score": 0.72,\n'
        '  "agreement_breakdown": "X of Y studies support this finding; Z show conflicting results",\n'
        '  "recommendation": "Evidence-based, query-specific guidance citing (Author, Year). '
        'End with: Please consult your healthcare provider before making any medical decisions.",\n'
        '  "sources_summary": "Quality and recency note: X RCTs, Y observational, Z post-2020",\n'
        '  "follow_up_questions": [\n'
        '    "A specific follow-up question the user might ask next",\n'
        '    "Another relevant follow-up question",\n'
        '    "A third question"\n'
        '  ],\n'
        '  "disease_guide": {\n'
        '    "disease_name": "Full medical name of the condition",\n'
        '    "overview": "2-3 sentence plain-language summary of the disease, pathophysiology, and prognosis",\n'
        '    "stages": [\n'
        '      {\n'
        '        "name": "Early Stage",\n'
        '        "timeline": "Years 0-2",\n'
        '        "description": "What happens at this stage in simple terms",\n'
        '        "symptoms": ["symptom1", "symptom2"],\n'
        '        "treatments": ["medication/therapy with brief why"],\n'
        '        "diet": {\n'
        '          "eat": [{"item": "food name", "reason": "WHY this food helps at molecular/physiological level"}],\n'
        '          "avoid": [{"item": "food name", "reason": "WHY this food is harmful and what it does"}]\n'
        '        },\n'
        '        "exercise": {\n'
        '          "recommended": [{"activity": "exercise name", "reason": "WHY this exercise helps and how"}],\n'
        '          "avoid": [{"activity": "exercise name", "reason": "WHY this exercise is risky at this stage"}]\n'
        '        },\n'
        '        "lifestyle": {\n'
        '          "dos": [{"action": "what to do", "reason": "WHY — physiological or evidence-based explanation"}],\n'
        '          "donts": [{"action": "what not to do", "reason": "WHY — risk or mechanism explained simply"}]\n'
        '        }\n'
        '      }\n'
        '    ]\n'
        '  }\n'
        "}\n\n"
        "STRICT RULES:\n"
        "- Every claim in condition_overview must cite (Author, Year) from the provided abstracts.\n"
        "- Every insight's evidence field must start with 'According to [Author, Year],...'\n"
        "- study_type: infer from abstract keywords (randomized=RCT, pooled/systematic=Meta-analysis, cohort/cross-sectional=Observational).\n"
        "- effect_size: extract exact numbers from abstract (%, OR, HR, RR, NNT). Leave empty string if not stated.\n"
        "- population: extract sample description (disease, country, n=). Leave empty string if not stated.\n"
        "- confidence_level: High for RCT/Meta-analysis, Moderate for Observational, Low for Case Study/unclear.\n"
        "- agreement_score: float 0.0-1.0 reflecting how consistently the papers support the main finding.\n"
        "- key_insight must be bold, specific, evidence-grounded — never generic.\n"
        "- contradictions: 2 items max. Only real conflicts/limitations from the retrieved evidence.\n"
        "- follow_up_questions: exactly 3, natural questions a patient/researcher would ask next.\n"
        "- disease_guide: ALWAYS generate 3-4 disease stages with detailed diet/exercise/lifestyle info.\n"
        "  Each diet item must explain the molecular/physiological WHY (e.g. 'omega-3 reduces neuroinflammation via COX-2 inhibition').\n"
        "  Each exercise must explain WHY (e.g. 'tai chi improves proprioception and reduces fall risk by 30%').\n"
        "  Each lifestyle do/don't must explain the scientific reason simply.\n"
        "- Do NOT invent or hallucinate any facts. Use ONLY the provided publications."
    )


# -- Response Parsing ----------------------------------------------------------

def _parse_llm_response(
    raw_json: str,
    session_id: str,
    publications: list[Publication],
    trials: list[ClinicalTrial],
    pipeline_stats: dict,
) -> PipelineResponse:
    data = json.loads(raw_json)

    # ── Parse insights with new evidence quality fields ───────────────────────
    insights_raw = data.get("research_insights", [])
    research_insights = [
        ResearchInsight(
            finding=item.get("finding", ""),
            evidence=item.get("evidence", ""),
            source_ids=item.get("source_ids", []),
            study_type=item.get("study_type", ""),
            effect_size=item.get("effect_size", ""),
            population=item.get("population", ""),
            confidence_level=item.get("confidence_level", ""),
        )
        for item in insights_raw
    ]

    sources = _build_sources(publications)

    follow_ups_raw = data.get("follow_up_questions", [])
    follow_up_questions = [
        str(q).strip() for q in follow_ups_raw if isinstance(q, str) and q.strip()
    ][:3]

    # ── Agreement score from LLM ──────────────────────────────────────────────
    llm_agreement = data.get("agreement_score", 0.0)
    try:
        llm_agreement = float(llm_agreement)
    except (TypeError, ValueError):
        llm_agreement = 0.0
    agreement_breakdown = data.get("agreement_breakdown", "")

    return PipelineResponse(
        session_id=session_id,
        condition_overview=data.get("condition_overview", ""),
        key_insight=data.get("key_insight", ""),
        contradictions=[
            str(c).strip() for c in data.get("contradictions", [])
            if isinstance(c, str) and c.strip()
        ][:3],
        research_insights=research_insights,
        publications=publications,
        clinical_trials=trials,
        recommendation=data.get("recommendation", "Consult your healthcare provider."),
        follow_up_questions=follow_up_questions,
        sources=sources,
        agreement_score=min(1.0, max(0.0, llm_agreement)),
        disease_guide=data.get("disease_guide", {}),
        metadata={
            **pipeline_stats,
            "sources_summary": data.get("sources_summary", ""),
            "agreement_breakdown": agreement_breakdown,
            "model": settings.model_name,
            "fallback": False,
        },
    )


def _build_sources(publications: list[Publication]) -> list[Source]:
    return [
        Source(
            id=f"pub_{i}",
            title=pub.title,
            authors=pub.authors,
            year=pub.year,
            platform=pub.source,
            url=pub.url,
            snippet=pub.supporting_snippet or (pub.abstract[:200] if pub.abstract else ""),
        )
        for i, pub in enumerate(publications, 1)
    ]


# -- Fallback ------------------------------------------------------------------

def _fallback_response(
    request: QueryRequest,
    publications: list[Publication],
    trials: list[ClinicalTrial],
    disease: str,
    pipeline_stats: dict,
    error: str,
) -> PipelineResponse:
    print(f"[LLM] Fallback due to: {error}")
    insights = [
        ResearchInsight(
            finding=f"Finding from: {pub.title}",
            evidence=pub.supporting_snippet[:400] if pub.supporting_snippet else "",
            source_ids=[f"pub_{i}"],
        )
        for i, pub in enumerate(publications[:3], 1)
        if pub.supporting_snippet
    ]
    return PipelineResponse(
        session_id=request.session_id,
        condition_overview=(
            f"Research publications and clinical trials retrieved for {disease}. "
            "Please review with your healthcare provider."
        ),
        research_insights=insights,
        publications=publications,
        clinical_trials=trials,
        recommendation=(
            "Relevant studies and clinical trials are available. "
            "Please consult your healthcare provider before making any medical decisions."
        ),
        sources=_build_sources(publications),
        metadata={**pipeline_stats, "llm_error": error, "fallback": True, "model": settings.model_name},
    )
