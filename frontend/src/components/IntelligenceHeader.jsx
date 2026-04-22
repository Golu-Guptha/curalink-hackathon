import { useState } from 'react';

export default function IntelligenceHeader({ result, isLoading, onAIChat }) {
    const [showQueries, setShowQueries] = useState(false);
    const [showProfile, setShowProfile] = useState(false);

    if (!result && !isLoading) return (
        <div className="ih-empty">
            <h2 className="ih-title-plain">Research Workspace</h2>
            <p className="ih-empty-sub">Submit a query to begin your research session</p>
        </div>
    );

    const meta = result?.metadata || {};
    const disease = meta.expanded_disease || '—';
    const intent = meta.expanded_intent || '—';
    const location = meta.location || '';
    const total = meta.total_candidates || 0;
    const pubMed = meta.pubmed_fetched || 0;
    const openAlex = meta.openalex_fetched || 0;
    const ranked = meta.publications_ranked || result?.publications?.length || 0;
    const trials = meta.trials_ranked || result?.clinical_trials?.length || 0;
    const rankMethod = meta.ranking_method || 'BM25 + Recency + Citation Count';
    const queries = meta.expanded_queries || [];
    const locationCtx = meta.location_context || result?.location_context || '';
    const patientSummary = meta.patient_summary || '';
    const profileTrace = meta.profile_trace || [];
    const evidenceMix = meta.evidence_mix || null;

    const locationIsLocal = locationCtx.startsWith('✔');
    const locationIsGlobal = locationCtx.startsWith('0 trials');

    return (
        <div className="ih-root">

            {/* ── Line 1: Workspace title + Quick AI button ──── */}
            <div className="ih-workspace-title-row">
                <span className="ih-workspace-title">{disease} Research Analysis</span>
                {onAIChat && (
                    <button className="ih-quick-ai-btn" onClick={onAIChat}>
                        <span>⚡</span>
                        <span>Ask AI</span>
                    </button>
                )}
            </div>

            {/* ── Line 2: Context chips ────────────────────────── */}
            <div className="ih-context-row">
                {location && <span className="ih-chip ih-chip-location">📍 {location}</span>}
                <span className="ih-chip ih-chip-intent" title={intent}>
                    {intent.length > 50 ? intent.slice(0, 48) + '…' : intent}
                </span>
                {patientSummary && (
                    <button
                        className="ih-chip ih-chip-patient"
                        onClick={() => setShowProfile(v => !v)}
                        title="Click to see personalization details"
                    >
                        👤 {patientSummary}
                    </button>
                )}
            </div>

            {/* ── Profile trace panel ───────────────────────────── */}
            {showProfile && profileTrace.length > 0 && (
                <div className="ih-profile-trace">
                    <div className="ih-queries-label">🎯 Personalization Applied</div>
                    <ul className="ih-profile-list">
                        {profileTrace.map((item, i) => (
                            <li key={i} className="ih-profile-item">{item}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* ── Location context ──────────────────────────────── */}
            {locationCtx && (
                <div className={`ih-location-ctx ${locationIsLocal ? 'ih-loc-local' : locationIsGlobal ? 'ih-loc-global' : ''}`}>
                    {locationIsLocal ? '🎯' : locationIsGlobal ? '🌍' : '📋'} {locationCtx}
                </div>
            )}

            {/* ── Divider ──────────────────────────────────────── */}
            <div className="ih-rule" />

            {/* ── Line 3: Retrieval stats ──────────────────────── */}
            <div className="ih-stats-row">
                <div className="ih-stat-group">
                    <span className="ih-stat-val">{total}</span>
                    <span className="ih-stat-arrow">→</span>
                    <span className="ih-stat-val ih-stat-selected">{ranked}</span>
                    <span className="ih-stat-lbl">papers retrieved → selected</span>
                </div>
                <div className="ih-stat-sep" />
                <div className="ih-stat-group">
                    <span className="ih-stat-val">{trials}</span>
                    <span className="ih-stat-lbl">clinical trials</span>
                </div>
                <div className="ih-stat-sep" />
                <div className="ih-stat-group ih-stat-sources">
                    <span className="ih-mini-badge ih-badge-pubmed">PubMed {pubMed}</span>
                    <span className="ih-mini-badge ih-badge-openalex">OpenAlex {openAlex}</span>
                </div>
            </div>

            {/* ── Evidence Mix ─────────────────────────────────── */}
            {evidenceMix && evidenceMix.total > 0 && (
                <div className="ih-evidence-mix">
                    <span className="ih-em-label">Evidence:</span>
                    {evidenceMix.meta_analysis > 0 && (
                        <span className="ih-em-badge ih-em-meta">🟢 {evidenceMix.meta_analysis} Meta-analysis</span>
                    )}
                    {evidenceMix.rct > 0 && (
                        <span className="ih-em-badge ih-em-rct">🟢 {evidenceMix.rct} RCT</span>
                    )}
                    {evidenceMix.observational > 0 && (
                        <span className="ih-em-badge ih-em-obs">🟡 {evidenceMix.observational} Observational</span>
                    )}
                    {evidenceMix.review > 0 && (
                        <span className="ih-em-badge ih-em-review">🔵 {evidenceMix.review} Review</span>
                    )}
                    {evidenceMix.other > 0 && (
                        <span className="ih-em-badge ih-em-other">⚪ {evidenceMix.other} Other</span>
                    )}
                </div>
            )}

            {/* ── Line 4: Ranking method ───────────────────────── */}
            <div className="ih-method-row">
                <span className="ih-method-text">Ranked via {rankMethod}</span>
                {queries.length > 0 && (
                    <button
                        className="ih-queries-toggle"
                        onClick={() => setShowQueries(v => !v)}
                    >
                        {showQueries ? '▲' : '▼'} {queries.length} expanded queries
                    </button>
                )}
            </div>

            {/* ── Expanded queries panel ───────────────────────── */}
            {showQueries && queries.length > 0 && (
                <div className="ih-queries-panel">
                    <div className="ih-queries-label"> LLM-Generated Search Variations</div>
                    <ul className="ih-queries-list">
                        {queries.map((q, i) => (
                            <li key={i} className="ih-query-item">
                                <span className="ih-query-idx">{i + 1}</span>
                                {q}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
