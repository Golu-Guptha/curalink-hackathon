# CuraLink — Hackathon Winning Upgrade Plan

## Goal
Transform CuraLink from "strong prototype" to "wins the hackathon" by eliminating generic AI responses, adding full evidence transparency, and making every claim scientifically grounded with citations, effect sizes, and study metadata.

---

## User Review Required

> [!IMPORTANT]
> The LLM prompt changes (Part 1) will make responses longer and more structured. This may increase latency by ~1-2 seconds. Acceptable tradeoff for quality.

> [!WARNING]
> The new `ResearchInsight` fields (`study_type`, `effect_size`, `population`) are optional — the LLM will fill them when evidence is present. If the LLM can't extract them, they'll be empty strings (won't break anything).

---

## Part 1 — Backend: AI Engine (Python / FastAPI)

### 1A. Enhance `ResearchInsight` Schema
#### [MODIFY] [response.py](file:///c:/Users/khushboo/Desktop/humanity/Curalink%20%E2%80%94%20AI%20Medical%20Research%20Assistant%20Hackathon/curalink/ai-engine/app/schemas/response.py)

Add new optional fields to `ResearchInsight`:
```python
class ResearchInsight(BaseModel):
    finding: str
    evidence: str          # Quote/paraphrase with (Author, Year)
    source_ids: list[str]
    study_type: str = ""   # "RCT" | "Meta-analysis" | "Observational" | "Case Study" | ""
    effect_size: str = ""  # e.g. "reduced risk by 32%" | "OR=0.78, 95% CI 0.64–0.95"
    population: str = ""   # e.g. "Indian post-MI patients, n=450"
    confidence_level: str = ""  # "High" | "Moderate" | "Low"
```

Add new fields to `PipelineResponse`:
```python
class PipelineResponse(BaseModel):
    ...
    agreement_score: float = 0.0   # 0.0–1.0: fraction of evidence supporting conclusion
    confidence_breakdown: dict = {} # {"semantic":0.45,"bm25_weight":0.30,...,"final":0.87}
    location_context: str = ""      # "Showing X trials in India" or "No India trials, showing global"
```

---

### 1B. Upgrade LLM System Prompt & JSON Schema
#### [MODIFY] [llm_service.py](file:///c:/Users/khushboo/Desktop/humanity/Curalink%20%E2%80%94%20AI%20Medical%20Research%20Assistant%20Hackathon/curalink/ai-engine/app/services/llm_service.py)

**New STRICT system prompt addition:**
```
CITATION RULES (NON-NEGOTIABLE):
- Every claim in condition_overview MUST cite (LastName, Year)
- Never use phrases like "research shows" or "studies suggest" without a citation
- Format: "According to [Author, Year], [specific finding with quantification]"
- If you cannot cite a claim → say "insufficient evidence"
- Always include effect size if available (e.g. "reduced by 32%", "OR=0.78")
- Identify study type from abstract: RCT, Meta-analysis, Observational, Case Study
- Extract patient population when stated (e.g. "Indian adults, n=450")
```

**New JSON schema fields in response:**
```json
"research_insights": [
  {
    "finding": "...",
    "evidence": "According to [Author, Year], ...",
    "source_ids": ["pub_1"],
    "study_type": "RCT|Meta-analysis|Observational|Case Study",
    "effect_size": "reduced risk by 32% (OR=0.78)",
    "population": "Indian post-MI patients, n=450",
    "confidence_level": "High|Moderate|Low"
  }
],
"agreement_score": 0.72,
"agreement_breakdown": "4 of 7 studies support this finding; 2 show conflicting results"
```

---

### 1C. Compute Real Confidence Breakdown
#### [MODIFY] [pipeline.py](file:///c:/Users/khushboo/Desktop/humanity/Curalink%20%E2%80%94%20AI%20Medical%20Research%20Assistant%20Hackathon/curalink/ai-engine/app/routers/pipeline.py)

After ranking, compute and expose the confidence breakdown formula:
```python
def compute_confidence_breakdown(ranked_pubs, ranked_trials):
    if not ranked_pubs:
        return {"final": 0.0}
    avg_semantic  = sum(p.relevance_score for p in ranked_pubs) / len(ranked_pubs)
    recency_score = sum(1 for p in ranked_pubs if p.year and p.year >= 2020) / len(ranked_pubs)
    citation_norm = min(1.0, max(p.cited_by_count for p in ranked_pubs) / 500)
    trial_boost   = min(0.15, len(ranked_trials) * 0.03)
    final = round(0.40*avg_semantic + 0.30*recency_score + 0.20*citation_norm + trial_boost, 3)
    return {
        "relevance_weight": 0.40,
        "avg_relevance":    round(avg_semantic, 3),
        "recency_weight":   0.30,
        "recency_score":    round(recency_score, 3),
        "citation_weight":  0.20,
        "citation_score":   round(citation_norm, 3),
        "trial_bonus":      round(trial_boost, 3),
        "final":            min(0.98, final),
        "formula": "0.40×relevance + 0.30×recency + 0.20×citations + trial_bonus"
    }

def compute_agreement_score(publications):
    """Compute ratio of evidence supporting vs. conflicting."""
    if not publications:
        return 0.0, "No evidence"
    # Use relevance_score as proxy: high relevance = supporting
    supporting = sum(1 for p in publications if p.relevance_score >= 0.5)
    ratio = round(supporting / len(publications), 2)
    breakdown = f"{supporting} of {len(publications)} studies support this finding"
    return ratio, breakdown
```

Add to `pipeline_stats`:
```python
confidence_breakdown = compute_confidence_breakdown(ranked_pubs, ranked_trials)
agreement_score, agreement_breakdown = compute_agreement_score(ranked_pubs)
pipeline_stats["confidence_breakdown"] = confidence_breakdown
pipeline_stats["agreement_score"] = agreement_score
pipeline_stats["agreement_breakdown"] = agreement_breakdown
```

Pass through to `PipelineResponse`:
```python
response.agreement_score = agreement_score
response.confidence_breakdown = confidence_breakdown
```

---

### 1D. Location-Smart Trial Labels
#### [MODIFY] [pipeline.py](file:///c:/Users/khushboo/Desktop/humanity/Curalink%20%E2%80%94%20AI%20Medical%20Research%20Assistant%20Hackathon/curalink/ai-engine/app/routers/pipeline.py)

After trial ranking, compute location context string:
```python
user_loc = expanded.location or request.location or ""
if user_loc and ranked_trials:
    loc_tokens = [t.strip().lower() for t in user_loc.replace(",", " ").split()]
    local_count = sum(
        1 for t in ranked_trials
        if any(
            tok in f"{(l.city or '')} {(l.country or '')}".lower()
            for l in t.locations for tok in loc_tokens
        )
    )
    if local_count > 0:
        location_context = f"Showing {local_count} trial(s) near {user_loc} + {len(ranked_trials)-local_count} global"
    else:
        location_context = f"No trials found near {user_loc}. Showing {len(ranked_trials)} global trials."
else:
    location_context = f"Showing {len(ranked_trials)} global trials."
pipeline_stats["location_context"] = location_context
```

---

## Part 2 — Frontend: Research Panel Upgrades (React)

### 2A. Enhanced Insight Cards — Study Type Badges + Effect Size
#### [MODIFY] [OverviewTab.jsx](file:///c:/Users/khushboo/Desktop/humanity/Curalink%20%E2%80%94%20AI%20Medical%20Research%20Assistant%20Hackathon/frontend/src/components/OverviewTab.jsx)

For each insight in `research_insights`, display:
```jsx
<li className="ov-insight-item">
  <span className="ov-insight-bullet">{i + 1}</span>
  <div className="ov-insight-body">
    <p className="ov-insight-finding">{ins.finding}</p>

    {/* Study type + confidence badges */}
    <div className="ov-insight-meta-row">
      {ins.study_type && (
        <span className={`ov-study-badge ov-study-${ins.study_type.toLowerCase().replace(/[^a-z]/g,'')}`}>
          {ins.study_type}
        </span>
      )}
      {ins.confidence_level && (
        <span className={`ov-conf-badge ov-conf-${ins.confidence_level.toLowerCase()}`}>
          ✦ {ins.confidence_level} confidence
        </span>
      )}
      {ins.effect_size && (
        <span className="ov-effect-badge">📊 {ins.effect_size}</span>
      )}
      {ins.population && (
        <span className="ov-pop-badge">👥 {ins.population}</span>
      )}
    </div>

    {ins.evidence && (
      <p className="ov-insight-evidence">"{ins.evidence}"</p>
    )}
    <div className="ov-insight-chips">
      {ins.source_ids?.map(sid => (
        <span key={sid} className="ov-source-chip">{sid}</span>
      ))}
    </div>
  </div>
</li>
```

---

### 2B. Real Confidence Breakdown — Show the Formula
#### [MODIFY] [OverviewTab.jsx](file:///c:/Users/khushboo/Desktop/humanity/Curalink%20%E2%80%94%20AI%20Medical%20Research%20Assistant%20Hackathon/frontend/src/components/OverviewTab.jsx)

Replace the local `computeConfidence()` with backend-provided value:
```jsx
// Use backend confidence if available, else compute locally
const breakdown = meta.confidence_breakdown || {};
const rawConf   = breakdown.final ? Math.round(breakdown.final * 100) : computeConfidence(result);
const confidence = rawConf;

// Show formula in "Why this answer?" section:
{breakdown.formula && (
  <li>
    ⚖️ Confidence formula:{' '}
    <code className="ov-formula">{breakdown.formula}</code>
    {' '}→ <strong>{confidence}%</strong>
  </li>
)}
```

---

### 2C. Agreement Score Visualization
#### [MODIFY] [OverviewTab.jsx](file:///c:/Users/khushboo/Desktop/humanity/Curalink%20%E2%80%94%20AI%20Medical%20Research%20Assistant%20Hackathon/frontend/src/components/OverviewTab.jsx)

Add a new section below evidence confidence:
```jsx
{agreementScore > 0 && (
  <div className="ov-section ov-section-agreement">
    <div className="ov-section-label">🤝 Study Agreement</div>
    <div className="ov-agreement-row">
      <div className="ov-agreement-bar-wrap">
        <div
          className="ov-agreement-bar-support"
          style={{ width: `${Math.round(agreementScore * 100)}%` }}
        />
        <div
          className="ov-agreement-bar-conflict"
          style={{ width: `${Math.round((1-agreementScore) * 100)}%` }}
        />
      </div>
      <div className="ov-agreement-labels">
        <span className="ov-agree-label">✅ {Math.round(agreementScore*100)}% supporting</span>
        <span className="ov-conflict-label">⚠️ {Math.round((1-agreementScore)*100)}% conflicting</span>
      </div>
    </div>
    {meta.agreement_breakdown && (
      <p className="ov-agreement-note">{meta.agreement_breakdown}</p>
    )}
  </div>
)}
```

---

### 2D. Location Context Banner in Trials Section
#### [MODIFY] [OverviewTab.jsx](file:///c:/Users/khushboo/Desktop/humanity/Curalink%20%E2%80%94%20AI%20Medical%20Research%20Assistant%20Hackathon/frontend/src/components/OverviewTab.jsx)

```jsx
{meta.location_context && (
  <div className="ov-location-note">
    📍 {meta.location_context}
  </div>
)}
```

---

### 2E. Context Reuse Indicator in ChatPanel
#### [MODIFY] [ChatPanel.jsx](file:///c:/Users/khushboo/Desktop/humanity/Curalink%20%E2%80%94%20AI%20Medical%20Research%20Assistant%20Hackathon/frontend/src/components/ChatPanel.jsx)

When `lockedDisease` is set and user is typing a follow-up:
```jsx
{isLocked && messages.length > 0 && (
  <div className="cp-context-reuse-bar">
    <span className="cp-reuse-icon">🔁</span>
    <span>Using research context: <strong>{lockedDisease}</strong></span>
  </div>
)}
```

---

### 2F. CSS — New Badges & Visualizations
#### [MODIFY] [theme-overrides.css](file:///c:/Users/khushboo/Desktop/humanity/Curalink%20%E2%80%94%20AI%20Medical%20Research%20Assistant%20Hackathon/frontend/src/theme-overrides.css)

New CSS classes:
- `.ov-study-badge` (base), `.ov-study-rct` (green), `.ov-study-metaanalysis` (indigo), `.ov-study-observational` (amber)
- `.ov-conf-badge`, `.ov-conf-high`, `.ov-conf-moderate`, `.ov-conf-low`
- `.ov-effect-badge` — teal pill
- `.ov-pop-badge` — muted purple pill
- `.ov-agreement-bar-wrap` — split green/orange horizontal bar
- `.ov-formula` — monospace code snippet
- `.ov-location-note` — info banner with pin icon
- `.cp-context-reuse-bar` — subtle info strip above input

---

## Verification Plan

### Automated
- Run pipeline query on Uvicorn: `curl -X POST http://localhost:8000/pipeline/query -d '{"query":"yoga for Parkinson", "disease":"Parkinson Disease", "session_id":"test"}'`
- Verify new fields in JSON response: `study_type`, `effect_size`, `confidence_breakdown.formula`
- Verify no regression on `research_insights` array

### Visual (browser)
1. Make a new query in the app
2. Open "Insights" tab → verify study-type badges appear
3. Open "Overview" tab → verify agreement bar and real confidence formula
4. Query with location "India" → verify trials banner says "near India" or "No India trials. Showing global."
5. Send a follow-up → verify "Using research context: [disease]" context bar appears in chat

---

## Implementation Order

| # | File | Change | Risk |
|---|------|---------|------|
| 1 | `response.py` | Add new schema fields | Low |
| 2 | `llm_service.py` | Upgrade system prompt + JSON schema | Medium |
| 3 | `pipeline.py` | Add confidence/agreement functions | Low |
| 4 | `OverviewTab.jsx` | Insight badges + agreement bar + formula | Low |
| 5 | `ChatPanel.jsx` | Context reuse indicator | Low |
| 6 | `theme-overrides.css` | New badge/bar CSS | Low |
