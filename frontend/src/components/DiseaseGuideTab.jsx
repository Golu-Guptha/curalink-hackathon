import { useState } from 'react';

/* ── Stage colour palette ─────────────────────────── */
const STAGE_COLORS = [
    { dot: '#34d399', glow: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.25)' },   // emerald
    { dot: '#60a5fa', glow: 'rgba(96,165,250,0.15)', border: 'rgba(96,165,250,0.25)' },    // blue
    { dot: '#fbbf24', glow: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.25)' },    // amber
    { dot: '#f87171', glow: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.25)' },  // red
    { dot: '#a78bfa', glow: 'rgba(167,139,250,0.15)', border: 'rgba(167,139,250,0.25)' },  // purple
];

/* ── Sub-section toggle ───────────────────────────── */
const SECTIONS = [
    { id: 'overview',  label: '📋 Overview',  icon: '📋' },
    { id: 'diet',      label: '🥗 Diet',      icon: '🥗' },
    { id: 'exercise',  label: '🏃 Exercise',  icon: '🏃' },
    { id: 'lifestyle', label: '✅ Lifestyle',  icon: '✅' },
];

/* ── Reusable item card ───────────────────────────── */
function ReasonCard({ icon, label, reason, accentColor }) {
    return (
        <div className="dg-reason-card">
            <div className="dg-reason-header">
                <span className="dg-reason-icon">{icon}</span>
                <span className="dg-reason-label">{label}</span>
            </div>
            <p className="dg-reason-text">{reason}</p>
            <div className="dg-reason-accent-bar" style={{ background: accentColor }} />
        </div>
    );
}

/* ── Main component ───────────────────────────────── */
export default function DiseaseGuideTab({ result }) {
    const [openStage, setOpenStage] = useState(0);
    const [activeSection, setActiveSection] = useState('overview');

    const guide = result?.disease_guide;

    if (!guide || !guide.stages || guide.stages.length === 0) {
        return (
            <div className="dg-empty">
                <div className="dg-empty-icon">🧬</div>
                <p className="dg-empty-text">
                    Disease guide data is not available for this query.
                    <br />Try asking about a specific condition for detailed stage-by-stage guidance.
                </p>
            </div>
        );
    }

    const stage = guide.stages[openStage] || guide.stages[0];
    const palette = STAGE_COLORS[openStage % STAGE_COLORS.length];

    return (
        <div className="dg-root">

            {/* ═══ Header ═══ */}
            <div className="dg-header-block">
                <div className="dg-header-eyebrow">Disease Intelligence</div>
                <h2 className="dg-header-title">{guide.disease_name || 'Disease Guide'}</h2>
                {guide.overview && (
                    <p className="dg-header-overview">{guide.overview}</p>
                )}
            </div>

            {/* ═══ Stage Timeline ═══ */}
            <div className="dg-timeline">
                {guide.stages.map((s, i) => {
                    const c = STAGE_COLORS[i % STAGE_COLORS.length];
                    const isActive = i === openStage;
                    return (
                        <button
                            key={i}
                            className={`dg-stage-btn ${isActive ? 'dg-stage-active' : ''}`}
                            style={{
                                borderColor: isActive ? c.border : 'rgba(255,255,255,0.06)',
                                background: isActive ? c.glow : 'transparent',
                            }}
                            onClick={() => { setOpenStage(i); setActiveSection('overview'); }}
                        >
                            <span className="dg-stage-dot" style={{ background: c.dot, boxShadow: `0 0 8px ${c.dot}` }} />
                            <div className="dg-stage-info">
                                <span className="dg-stage-name">{s.name}</span>
                                {s.timeline && <span className="dg-stage-time">{s.timeline}</span>}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* ═══ Section Navigation ═══ */}
            <div className="dg-section-nav">
                {SECTIONS.map(sec => (
                    <button
                        key={sec.id}
                        className={`dg-sec-btn ${activeSection === sec.id ? 'dg-sec-active' : ''}`}
                        onClick={() => setActiveSection(sec.id)}
                    >
                        {sec.label}
                    </button>
                ))}
            </div>

            {/* ═══ Stage Content Panel ═══ */}
            <div className="dg-content" style={{ borderColor: palette.border }}>

                {/* ── OVERVIEW ── */}
                {activeSection === 'overview' && (
                    <div className="dg-section-body">
                        {stage.description && (
                            <p className="dg-stage-desc">{stage.description}</p>
                        )}

                        {/* Symptoms */}
                        {stage.symptoms?.length > 0 && (
                            <div className="dg-sub-block">
                                <div className="dg-sub-label">🔍 Common Symptoms</div>
                                <div className="dg-chip-row">
                                    {stage.symptoms.map((s, i) => (
                                        <span key={i} className="dg-symptom-chip">{s}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Treatments */}
                        {stage.treatments?.length > 0 && (
                            <div className="dg-sub-block">
                                <div className="dg-sub-label">💊 Treatment Options</div>
                                <div className="dg-treat-list">
                                    {stage.treatments.map((t, i) => (
                                        <div key={i} className="dg-treat-item">
                                            <span className="dg-treat-num">{String(i + 1).padStart(2, '0')}</span>
                                            <span className="dg-treat-text">{typeof t === 'string' ? t : t.name || JSON.stringify(t)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── DIET ── */}
                {activeSection === 'diet' && (
                    <div className="dg-section-body">
                        {/* Foods to eat */}
                        {stage.diet?.eat?.length > 0 && (
                            <div className="dg-sub-block">
                                <div className="dg-sub-label dg-label-green">✅ Foods to Include</div>
                                <div className="dg-reason-grid">
                                    {stage.diet.eat.map((item, i) => (
                                        <ReasonCard
                                            key={i}
                                            icon="🥬"
                                            label={item.item}
                                            reason={item.reason}
                                            accentColor="#34d399"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Foods to avoid */}
                        {stage.diet?.avoid?.length > 0 && (
                            <div className="dg-sub-block">
                                <div className="dg-sub-label dg-label-red">🚫 Foods to Avoid</div>
                                <div className="dg-reason-grid">
                                    {stage.diet.avoid.map((item, i) => (
                                        <ReasonCard
                                            key={i}
                                            icon="⚠️"
                                            label={item.item}
                                            reason={item.reason}
                                            accentColor="#f87171"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {!stage.diet?.eat?.length && !stage.diet?.avoid?.length && (
                            <p className="dg-no-data">No specific dietary guidance available for this stage.</p>
                        )}
                    </div>
                )}

                {/* ── EXERCISE ── */}
                {activeSection === 'exercise' && (
                    <div className="dg-section-body">
                        {/* Recommended */}
                        {stage.exercise?.recommended?.length > 0 && (
                            <div className="dg-sub-block">
                                <div className="dg-sub-label dg-label-green">✅ Recommended Activities</div>
                                <div className="dg-reason-grid">
                                    {stage.exercise.recommended.map((item, i) => (
                                        <ReasonCard
                                            key={i}
                                            icon="🏋️"
                                            label={item.activity}
                                            reason={item.reason}
                                            accentColor="#60a5fa"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Avoid */}
                        {stage.exercise?.avoid?.length > 0 && (
                            <div className="dg-sub-block">
                                <div className="dg-sub-label dg-label-red">🚫 Activities to Avoid</div>
                                <div className="dg-reason-grid">
                                    {stage.exercise.avoid.map((item, i) => (
                                        <ReasonCard
                                            key={i}
                                            icon="⛔"
                                            label={item.activity}
                                            reason={item.reason}
                                            accentColor="#f87171"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {!stage.exercise?.recommended?.length && !stage.exercise?.avoid?.length && (
                            <p className="dg-no-data">No specific exercise guidance available for this stage.</p>
                        )}
                    </div>
                )}

                {/* ── LIFESTYLE ── */}
                {activeSection === 'lifestyle' && (
                    <div className="dg-section-body">
                        {/* Do's */}
                        {stage.lifestyle?.dos?.length > 0 && (
                            <div className="dg-sub-block">
                                <div className="dg-sub-label dg-label-green">✅ Do&apos;s — What to Practice</div>
                                <div className="dg-reason-grid">
                                    {stage.lifestyle.dos.map((item, i) => (
                                        <ReasonCard
                                            key={i}
                                            icon="👍"
                                            label={item.action}
                                            reason={item.reason}
                                            accentColor="#34d399"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Don'ts */}
                        {stage.lifestyle?.donts?.length > 0 && (
                            <div className="dg-sub-block">
                                <div className="dg-sub-label dg-label-red">❌ Don&apos;ts — What to Avoid</div>
                                <div className="dg-reason-grid">
                                    {stage.lifestyle.donts.map((item, i) => (
                                        <ReasonCard
                                            key={i}
                                            icon="👎"
                                            label={item.action}
                                            reason={item.reason}
                                            accentColor="#fbbf24"
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {!stage.lifestyle?.dos?.length && !stage.lifestyle?.donts?.length && (
                            <p className="dg-no-data">No specific lifestyle guidance available for this stage.</p>
                        )}
                    </div>
                )}
            </div>

            {/* ═══ Medical Disclaimer ═══ */}
            <div className="dg-disclaimer">
                ⚕️ This guide is generated from research literature for informational purposes only.
                Always consult a qualified healthcare professional before making changes to your diet,
                exercise routine, or lifestyle.
            </div>
        </div>
    );
}
