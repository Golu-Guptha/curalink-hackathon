import { useState } from 'react';
import ReasoningTimeline from './ReasoningTimeline.jsx';

/** Compute 0-100 confidence from result data (fallback if backend doesn't provide) */
function computeLocalConfidence(result) {
    if (!result) return 0;
    const pubs = result.publications?.length || 0;
    const trials = result.clinical_trials?.length || 0;
    const insights = result.research_insights?.length || 0;
    const score =
        Math.min(40, pubs * 6) +
        Math.min(25, trials * 5) +
        Math.min(20, insights * 4) +
        (pubs > 0 ? 10 : 0);
    return Math.min(95, score);
}

/** Simple evidence bar */
function EvidenceBar({ value, max, color }) {
    const pct = Math.round((value / Math.max(max, 1)) * 100);
    return (
        <div className="evb-wrap">
            <div className="evb-track">
                <div className="evb-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="evb-count">{value}</span>
        </div>
    );
}

/** Study-type badge color mapping */
const STUDY_TYPE_CLASS = {
    'rct': 'ov-study-rct',
    'meta-analysis': 'ov-study-meta',
    'observational': 'ov-study-obs',
    'case study': 'ov-study-case',
};

export default function OverviewTab({ result }) {
    const [whyOpen, setWhyOpen] = useState(true);

    if (!result) return null;

    const meta = result.metadata || {};
    const pubs = result.publications || [];
    const trials = result.clinical_trials || [];
    const insights = result.research_insights || [];
    const pubMed = meta.pubmed_fetched || 0;
    const openAlex = meta.openalex_fetched || 0;
    const rankMethod = meta.ranking_method || 'BM25 + Semantic + Recency + Citation Count';
    const recruiting = trials.filter(t => t.status === 'RECRUITING').length;
    const years = pubs.map(p => p.year).filter(Boolean);
    const maxYear = years.length ? Math.max(...years) : null;
    const recentCt = years.filter(y => y >= 2020).length;
    const contradictions = result.contradictions || [];
    const keyInsight = result.key_insight || '';
    const maxForBar = Math.max(pubs.length, trials.length, recentCt, pubMed, 1);

    // ── Confidence (prefer backend breakdown) ─────────────────────────────────
    const breakdown = result.confidence_breakdown || meta.confidence_breakdown || {};
    const confidence = breakdown.final
        ? Math.round(breakdown.final * 100)
        : computeLocalConfidence(result);
    const confidenceLabel =
        confidence >= 80 ? 'High' :
            confidence >= 55 ? 'Moderate' : 'Limited';
    const confidenceColor =
        confidence >= 80 ? '#4ade80' :
            confidence >= 55 ? '#60a5fa' : '#fbbf24';

    // ── Agreement score ───────────────────────────────────────────────────────
    const rawAgreement = result.agreement_score || 0;
    const agreementPct = Math.round(rawAgreement * 100);
    const conflictPct = 100 - agreementPct;
    const agreementBreakdown = meta.agreement_breakdown || '';

    // ── Location context ──────────────────────────────────────────────────────
    const locationContext = result.location_context || meta.location_context || '';

    // ── Expanded queries ──────────────────────────────────────────────────────
    const expandedQueries = meta.expanded_queries || [];

    return (
        <div className="ov-root">

            {/* ── ★ Key Insight ───────────────────────────────────── */}
            {keyInsight && (
                <div className="ov-key-insight">
                    <span className="ov-key-insight-icon"></span>
                    <p className="ov-key-insight-text">{keyInsight}</p>
                </div>
            )}

            {/* ── 🤖 AI Reasoning Timeline ──────────────────────── */}
            <ReasoningTimeline result={result} />

            {/* ── 🧠 Condition Overview ─────────────────────────── */}
            {result.condition_overview && (
                <div className="ov-section ov-section-blue">
                    <div className="ov-section-label"> Condition Overview</div>
                    <p className="ov-section-text">{result.condition_overview}</p>
                </div>
            )}

            {/* ── 🔬 Research Insights with evidence badges ─────── */}
            {insights.length > 0 && (
                <div className="ov-section ov-section-purple">
                    <div className="ov-section-label"> Key Research Insights</div>
                    <ul className="ov-insights-list">
                        {insights.map((ins, i) => {
                            const typeKey = ins.study_type?.toLowerCase() || '';
                            const typeClass = STUDY_TYPE_CLASS[typeKey] || 'ov-study-default';
                            return (
                                <li key={i} className="ov-insight-item">
                                    <span className="ov-insight-bullet">{i + 1}</span>
                                    <div className="ov-insight-body">
                                        <p className="ov-insight-finding">{ins.finding}</p>

                                        {/* Evidence quality badges */}
                                        {(ins.study_type || ins.confidence_level || ins.effect_size || ins.population) && (
                                            <div className="ov-insight-meta-row">
                                                {ins.study_type && (
                                                    <span className={`ov-study-badge ${typeClass}`}>
                                                        {ins.study_type}
                                                    </span>
                                                )}
                                                {ins.confidence_level && (
                                                    <span className={`ov-conf-badge ov-conf-${ins.confidence_level.toLowerCase()}`}>
                                                        ✦ {ins.confidence_level} confidence
                                                    </span>
                                                )}
                                                {ins.effect_size && (
                                                    <span className="ov-effect-badge">
                                                        {ins.effect_size}
                                                    </span>
                                                )}
                                                {ins.population && (
                                                    <span className="ov-pop-badge">
                                                        {ins.population}
                                                    </span>
                                                )}
                                            </div>
                                        )}

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
                            );
                        })}
                    </ul>
                </div>
            )}

            {/* ── 📊 Evidence Distribution ──────────────────────── */}
            <div className="ov-section ov-section-chart">
                <div className="ov-section-label"> Evidence Distribution</div>
                <div className="ov-evd-grid">
                    <span className="ov-evd-label">Publications</span>
                    <EvidenceBar value={pubs.length} max={maxForBar} color="#60a5fa" />
                    <span className="ov-evd-label">Clinical Trials</span>
                    <EvidenceBar value={trials.length} max={maxForBar} color="#22d3ee" />
                    <span className="ov-evd-label">Recent (2020+)</span>
                    <EvidenceBar value={recentCt} max={maxForBar} color="#4ade80" />
                    <span className="ov-evd-label">PubMed sources</span>
                    <EvidenceBar value={pubMed} max={maxForBar} color="#a78bfa" />
                </div>
            </div>

            {/* ── 📊 Evidence Confidence with real formula ──────── */}
            <div className="ov-section ov-section-confidence">
                <div className="ov-section-label"> Evidence Confidence</div>
                <div className="ov-confidence-row">
                    <div className="ov-confidence-bar-wrap">
                        <div className="ov-confidence-bar-fill"
                            style={{ width: `${confidence}%`, background: confidenceColor }} />
                    </div>
                    <span className="ov-confidence-pct" style={{ color: confidenceColor }}>
                        {confidence}%
                    </span>
                    <span className="ov-confidence-label" style={{ color: confidenceColor }}>
                        {confidenceLabel}
                    </span>
                </div>
                {breakdown.formula && (
                    <p className="ov-confidence-formula">
                        <span className="ov-formula-label">Formula:</span>{' '}
                        <code className="ov-formula">{breakdown.formula}</code>
                        {breakdown.avg_relevance !== undefined && (
                            <span className="ov-formula-breakdown">
                                {' '}→ relevance {Math.round(breakdown.avg_relevance * 100)}% ·
                                recency {Math.round(breakdown.recency_score * 100)}% ·
                                citations {Math.round(breakdown.citation_score * 100)}%
                            </span>
                        )}
                    </p>
                )}
                <p className="ov-confidence-reason">
                    {confidenceLabel} confidence —{' '}
                    {pubs.length > 0 && `${pubs.length} publication${pubs.length > 1 ? 's' : ''}`}
                    {pubs.length > 0 && trials.length > 0 && ' + '}
                    {trials.length > 0 && `${trials.length} clinical trial${trials.length > 1 ? 's' : ''}`}
                    {recentCt > 0 && `, ${recentCt} from 2020+`}
                </p>
            </div>

            {/* ── 🤝 Study Agreement Score ──────────────────────── */}
            {rawAgreement > 0 && (
                <div className="ov-section ov-section-agreement">
                    <div className="ov-section-label"> Study Agreement</div>
                    <div className="ov-agreement-bar-wrap">
                        <div
                            className="ov-agreement-bar-support"
                            style={{ width: `${agreementPct}%` }}
                            title={`${agreementPct}% supporting`}
                        />
                        <div
                            className="ov-agreement-bar-conflict"
                            style={{ width: `${conflictPct}%` }}
                            title={`${conflictPct}% conflicting`}
                        />
                    </div>
                    <div className="ov-agreement-labels">
                        <span className="ov-agree-label">✅ {agreementPct}% supporting</span>
                        <span className="ov-conflict-label">⚠️ {conflictPct}% conflicting</span>
                    </div>
                    {agreementBreakdown && (
                        <p className="ov-agreement-note">{agreementBreakdown}</p>
                    )}
                </div>
            )}

            {/* ── ✅ Recommendation ─────────────────────────────── */}
            {result.recommendation && (
                <div className="ov-section ov-section-green">
                    <div className="ov-section-label">✅ Recommendation</div>
                    <p className="ov-section-text">{result.recommendation}</p>
                </div>
            )}

            {/* ── ⚠ Contradictions / Limitations ──────────────── */}
            {contradictions.length > 0 && (
                <div className="ov-section ov-section-warn">
                    <div className="ov-section-label">⚠️ Conflicting Evidence & Limitations</div>
                    <ul className="ov-contradictions-list">
                        {contradictions.map((c, i) => (
                            <li key={i} className="ov-contradiction-item">
                                <span className="ov-contradiction-dot" />
                                {c}
                            </li>
                        ))}
                    </ul>
                    <p className="ov-contradiction-note">
                        These limitations do not invalidate the findings but should be considered when interpreting results.
                    </p>
                </div>
            )}

            {/* ── 🧾 Why This Answer? ───────────────────────────── */}
            <div className="ov-why-full">
                <div className="ov-why-full-header">
                    <span>📌 Why this answer?</span>
                    <button className="ov-why-toggle-btn" onClick={() => setWhyOpen(v => !v)}>
                        {whyOpen ? '▲' : '▼'}
                    </button>
                </div>
                {whyOpen && (
                    <div className="ov-why-body-full">
                        <ul className="ov-why-list">
                            {pubMed > 0 && (
                                <li>✔ <strong>{pubMed}</strong> PubMed publications analyzed
                                    <span className="ov-why-badge">High credibility</span>
                                </li>
                            )}
                            {openAlex > 0 && (
                                <li>✔ <strong>{openAlex}</strong> OpenAlex studies cross-referenced</li>
                            )}
                            {trials.length > 0 && (
                                <li>✔ <strong>{trials.length}</strong> clinical trials support findings
                                    {recruiting > 0 && ` (${recruiting} actively recruiting)`}
                                </li>
                            )}
                            {recentCt > 0 && (
                                <li>✔ <strong>{recentCt}</strong> studies published after 2020
                                    <span className="ov-why-badge ov-badge-green">Recent evidence</span>
                                </li>
                            )}
                            <li>✔ Ranked by <strong>{rankMethod}</strong></li>
                            {breakdown.formula && (
                                <li>
                                    ✔ Confidence formula:{' '}
                                    <code className="ov-formula">{breakdown.formula}</code>
                                    {' '}→ <strong>{confidence}%</strong>
                                </li>
                            )}
                            <li>✔ Synthesized by <strong>Llama 3.3-70B</strong> over full evidence set</li>
                        </ul>

                        {/* Expanded queries transparency */}
                        {expandedQueries.length > 0 && (
                            <div className="ov-expanded-queries">
                                <p className="ov-eq-label"> Expanded search queries used:</p>
                                <ul className="ov-eq-list">
                                    {expandedQueries.map((q, i) => (
                                        <li key={i} className="ov-eq-item">• {q}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── 🧪 Trials Summary ─────────────────────────────── */}
            {trials.length > 0 && (
                <div className="ov-section ov-section-cyan">
                    <div className="ov-section-label"> Clinical Trials Summary</div>
                    {locationContext && (
                        <div className="ov-location-note">
                            📍 {locationContext}
                        </div>
                    )}
                    <div className="ov-trials-row">
                        <div className="ov-trial-stat">
                            <span className="ov-trial-stat-val">{trials.length}</span>
                            <span className="ov-trial-stat-lbl">total</span>
                        </div>
                        <div className="ov-trial-stat ov-trial-stat-recruit">
                            <span className="ov-trial-stat-val">{recruiting}</span>
                            <span className="ov-trial-stat-lbl">recruiting</span>
                        </div>
                        <div className="ov-trial-stat">
                            <span className="ov-trial-stat-val">{trials.length - recruiting}</span>
                            <span className="ov-trial-stat-lbl">completed</span>
                        </div>
                    </div>
                    {recruiting > 0 && (
                        <div className="ov-recruiting-note">
                            ✔ {recruiting > 1 ? `${recruiting} trials are` : '1 trial is'} actively recruiting participants
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
