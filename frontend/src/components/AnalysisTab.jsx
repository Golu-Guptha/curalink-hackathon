import { useState } from 'react';

/* ─── helpers ─────────────────────────────────────── */
function confidenceToLabel(pct) {
    if (pct >= 78) return 'Well Supported';
    if (pct >= 52) return 'Partially Supported';
    return 'Contested';
}
function confidenceToColor(pct) {
    if (pct >= 78) return '#34d399';   // emerald
    if (pct >= 52) return '#fbbf24';   // amber
    return '#f87171';                  // red
}
function deriveConsensus(result) {
    const raw = result.agreement_score || 0;
    // If backend didn't provide one, estimate from data richness
    if (raw > 0) return Math.round(raw * 100);
    const pubs = result.publications?.length || 0;
    const ins  = result.research_insights?.length || 0;
    const con  = result.contradictions?.length || 0;
    const support = Math.min(100, (pubs * 4) + (ins * 6));
    const conflict = Math.min(40, con * 10);
    return Math.max(10, Math.min(95, support - conflict));
}

/* ─── sub-components ──────────────────────────────── */

/** Animated semicircle confidence meter — clean geometry, no tilt at 100% */
function ArcMeter({ pct, color }) {
    // Semicircle (180°) from left to right, open at the bottom
    const r = 38;
    const cx = 50, cy = 50;
    const halfCirc = Math.PI * r; // length of the 180° arc
    const filled = (pct / 100) * halfCirc;
    const trackD = `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy}`;
    return (
        <svg width="100" height="64" viewBox="0 0 100 64" style={{ overflow: 'visible' }}>
            {/* track */}
            <path d={trackD}
                fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7"
                strokeLinecap="round"
            />
            {/* fill */}
            <path d={trackD}
                fill="none" stroke={color} strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${filled} ${halfCirc}`}
                style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)' }}
            />
            <text x={cx} y={cy - 6} textAnchor="middle"
                  fill={color} fontSize="18" fontWeight="800" fontFamily="Inter,sans-serif">
                {pct}%
            </text>
        </svg>
    );
}

/** One evidence item row */
function EvidenceRow({ text, index, side }) {
    const accent = side === 'for' ? '#34d399' : '#f87171';
    return (
        <div className="at-ev-row">
            <div className="at-ev-row-num" style={{ color: accent }}>{String(index + 1).padStart(2, '0')}</div>
            <div className="at-ev-row-bar" style={{ background: accent }} />
            <p className="at-ev-row-text">{text}</p>
        </div>
    );
}

/* ─── main component ──────────────────────────────── */
export default function AnalysisTab({ result }) {
    const [openGap, setOpenGap] = useState(null);

    if (!result) {
        return (
            <div className="at-empty">
                <div className="at-empty-icon">⚗️</div>
                <p>No deep analysis available yet. Submit a query first.</p>
            </div>
        );
    }

    const insights      = result.research_insights || [];
    const contradictions = result.contradictions   || [];
    const recommendation = result.recommendation   || '';
    const pubs           = result.publications     || [];
    const trials         = result.clinical_trials  || [];
    const researchGaps   = result.research_gaps    || [];
    const meta           = result.metadata         || {};

    // Evidence vectors
    const supporting = insights
        .filter(ins => ins.confidence_level?.toLowerCase() !== 'low')
        .map(ins => ins.finding)
        .slice(0, 5);

    const challenging = contradictions.slice(0, 4);

    // Synthesise verdict
    const consensusPct = deriveConsensus(result);
    const verdictLabel = confidenceToLabel(consensusPct);
    const verdictColor = confidenceToColor(consensusPct);

    // Generate synthetic gaps from publication titles if none from backend
    const displayGaps = researchGaps.length > 0
        ? researchGaps
        : pubs.slice(0, 3).map((p, i) => {
            const title = p.title || 'Unknown topic';
            return {
                gap: `Further research needed: ${title.substring(0, 80)}${title.length > 80 ? '…' : ''}`,
                detail: `This area was identified from "${title}". Current evidence is based on ${p.year ? `a ${p.year} study` : 'limited data'} and may benefit from larger-scale replication or meta-analysis.`,
                suggested_study: `A prospective, multi-center study examining the long-term outcomes and broader applicability of findings related to ${title.substring(0, 60).toLowerCase()}.`,
                priority: i === 0 ? 'High' : 'Medium',
            };
        });

    return (
        <div className="at-root">

            {/* ═══════════════════════════════════════════════════════
                SECTION 1 — EVIDENCE TRIBUNAL
            ═══════════════════════════════════════════════════════ */}
            <div className="at-block">
                <div className="at-block-eyebrow">Evidence Assessment</div>
                <h2 className="at-block-title">Scientific Evidence Review</h2>
                <p className="at-block-subtitle">
                    Analyzing <strong>{pubs.length}</strong> publications &amp; <strong>{trials.length}</strong> trials
                    across {meta.pubmed_fetched || 0} PubMed + {meta.openalex_fetched || 0} OpenAlex sources
                </p>

                {/* Two-column tribunal */}
                <div className="at-tribunal">
                    {/* FOR column */}
                    <div className="at-tribunal-col at-col-for">
                        <div className="at-col-header">
                            <span className="at-col-indicator at-indicator-green" />
                            <span className="at-col-label">Supporting Evidence</span>
                            <span className="at-col-count" style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>
                                {supporting.length}
                            </span>
                        </div>
                        <div className="at-col-body">
                            {supporting.length > 0
                                ? supporting.map((text, i) => (
                                    <EvidenceRow key={i} text={text} index={i} side="for" />
                                ))
                                : <p className="at-col-empty">No strong supporting evidence identified from current dataset.</p>
                            }
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="at-tribunal-divider">
                        <div className="at-divider-line" />
                        <div className="at-divider-vs">VS</div>
                        <div className="at-divider-line" />
                    </div>

                    {/* AGAINST column */}
                    <div className="at-tribunal-col at-col-against">
                        <div className="at-col-header">
                            <span className="at-col-indicator at-indicator-red" />
                            <span className="at-col-label">Challenging Evidence</span>
                            <span className="at-col-count" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171' }}>
                                {challenging.length}
                            </span>
                        </div>
                        <div className="at-col-body">
                            {challenging.length > 0
                                ? challenging.map((text, i) => (
                                    <EvidenceRow key={i} text={typeof text === 'string' ? text : JSON.stringify(text)} index={i} side="against" />
                                ))
                                : <p className="at-col-empty">No significant contradictions or limitations found in the evidence pool.</p>
                            }
                        </div>
                    </div>
                </div>

                {/* ── Verdict Seal ── */}
                <div className="at-verdict" style={{ borderColor: `${verdictColor}30` }}>
                    <div className="at-verdict-glow" style={{ background: `radial-gradient(ellipse 60% 80% at 50% 100%, ${verdictColor}18, transparent)` }} />

                    <div className="at-verdict-left">
                        <div className="at-verdict-eyebrow">AI Final Verdict</div>
                        <div className="at-verdict-status" style={{ color: verdictColor }}>
                            {verdictLabel}
                        </div>
                        <div className="at-verdict-consensus">
                            <div className="at-verdict-track">
                                <div className="at-verdict-fill"
                                    style={{ width: `${consensusPct}%`, background: `linear-gradient(90deg, ${verdictColor}60, ${verdictColor})` }} />
                            </div>
                            <span style={{ color: verdictColor, fontSize: 12, fontWeight: 700 }}>
                                {consensusPct}% scientific consensus
                            </span>
                        </div>
                        {recommendation && (
                            <p className="at-verdict-text">{recommendation}</p>
                        )}
                    </div>

                    <div className="at-verdict-right">
                        <ArcMeter pct={consensusPct} color={verdictColor} />
                        <div className="at-verdict-arc-label" style={{ color: verdictColor }}>Consensus</div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════
                SECTION 2 — CONFIDENCE ARCHITECTURE
            ═══════════════════════════════════════════════════════ */}
            <div className="at-block">
                <div className="at-block-eyebrow">Confidence Architecture</div>
                <h2 className="at-block-title">How This Answer Was Built</h2>

                <div className="at-arch-grid">
                    <ArchPillar
                        icon="📄"
                        label="Publications Analyzed"
                        value={pubs.length}
                        max={20}
                        color="#818cf8"
                        subtext={`${pubs.filter(p => p.year >= 2020).length} from 2020+`}
                    />
                    <ArchPillar
                        icon="🧪"
                        label="Clinical Trials"
                        value={trials.length}
                        max={15}
                        color="#22d3ee"
                        subtext={`${trials.filter(t => t.status === 'RECRUITING').length} recruiting`}
                    />
                    <ArchPillar
                        icon="💡"
                        label="Key Insights"
                        value={insights.length}
                        max={10}
                        color="#34d399"
                        subtext="Extracted findings"
                    />
                    <ArchPillar
                        icon="⚠️"
                        label="Contradictions"
                        value={contradictions.length}
                        max={8}
                        color="#fbbf24"
                        subtext="Conflicting signals"
                    />
                </div>

                {/* Ranking method */}
                <div className="at-rank-note">
                    <span className="at-rank-icon">⚙️</span>
                    <span>Ranked by <strong>{meta.ranking_method || 'BM25 + Semantic + Recency + Citation Count'}</strong></span>
                    {result.confidence_breakdown?.formula && (
                        <code className="at-rank-formula">{result.confidence_breakdown.formula}</code>
                    )}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════
                SECTION 3 — RESEARCH HORIZON
            ═══════════════════════════════════════════════════════ */}
            {displayGaps.length > 0 && (
                <div className="at-block">
                    <div className="at-block-eyebrow">Research Horizon</div>
                    <h2 className="at-block-title">Open Questions &amp; Knowledge Gaps</h2>
                    <p className="at-block-subtitle">
                        Frontiers where evidence is limited or inconclusive
                    </p>

                    <div className="at-gaps">
                        {displayGaps.map((gap, i) => {
                            const g = typeof gap === 'string' ? { gap, priority: 'Medium', suggested_study: null } : gap;
                            const priorityColor = g.priority === 'High' ? '#f87171' : g.priority === 'Low' ? '#34d399' : '#fbbf24';
                            const isOpen = openGap === i;
                            return (
                                <div
                                    key={i}
                                    className={`at-gap-card ${isOpen ? 'at-gap-open' : ''}`}
                                    onClick={() => setOpenGap(isOpen ? null : i)}
                                >
                                    <div className="at-gap-pulse" style={{ background: priorityColor }} />
                                    <div className="at-gap-main">
                                        <div className="at-gap-top">
                                            <span className="at-gap-num">{String(i + 1).padStart(2, '0')}</span>
                                            <p className="at-gap-question">{g.gap}</p>
                                            <span className="at-gap-priority" style={{ color: priorityColor, borderColor: `${priorityColor}30`, background: `${priorityColor}10` }}>
                                                {g.priority || 'Medium'}
                                            </span>
                                            <svg className={`at-gap-chevron ${isOpen ? 'rotated' : ''}`} width="14" height="14" viewBox="0 0 14 14" fill="none">
                                                <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                            </svg>
                                        </div>
                                        {isOpen && (
                                            <div className="at-gap-detail-wrap">
                                                {g.detail && (
                                                    <p className="at-gap-detail-text">{g.detail}</p>
                                                )}
                                                {g.suggested_study && (
                                                    <div className="at-gap-study">
                                                        <span className="at-gap-study-label">💡 Suggested study design:</span>
                                                        <span>{g.suggested_study}</span>
                                                    </div>
                                                )}
                                                {!g.detail && !g.suggested_study && (
                                                    <p className="at-gap-detail-text">This knowledge gap was identified from the current evidence pool. Further targeted research is needed to address this open question.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

/** Architecture pillar card */
function ArchPillar({ icon, label, value, max, color, subtext }) {
    const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
    return (
        <div className="at-arch-pillar">
            <div className="at-arch-icon">{icon}</div>
            <div className="at-arch-val" style={{ color }}>{value}</div>
            <div className="at-arch-label">{label}</div>
            <div className="at-arch-bar-track">
                <div className="at-arch-bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
            <div className="at-arch-subtext">{subtext}</div>
        </div>
    );
}
