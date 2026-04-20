import { useState } from 'react';
import PublicationCard from './PublicationCard.jsx';
import TrialCard from './TrialCard.jsx';
import DetailModal from './DetailModal.jsx';
import IntelligenceHeader from './IntelligenceHeader.jsx';
import OverviewTab from './OverviewTab.jsx';
import AnalysisTab from './AnalysisTab.jsx';
import DiseaseGuideTab from './DiseaseGuideTab.jsx';
import QuickAIChat from './QuickAIChat.jsx';
import { exportResultToPDF } from '../utils/exportPDF.js';


const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'analysis', label: 'Deep Analysis' },
    { id: 'guide', label: 'Disease Guide' },
    { id: 'insights', label: 'Insights' },
    { id: 'publications', label: 'Publications' },
    { id: 'trials', label: 'Trials' },
    { id: 'sources', label: '🔗 Sources' },
];

export default function ResultsPanel({ result, activeTab, onTabChange, isLoading, analysisState, onToggleExpand }) {
    const isExpanded = analysisState === 'expanded';
    const isPreview = analysisState === 'preview';

    if (isPreview) {
        return (
            <div className="analysis-preview-tab" onClick={onToggleExpand}>
                🔍 RESEARCH ANALYSIS &middot; CLICK TO EXPAND &rarr;
            </div>
        );
    }

    const [modalItem, setModalItem] = useState(null);
    const [modalType, setModalType] = useState(null);
    const [exporting, setExporting] = useState(false);
    const [qcOpen, setQcOpen] = useState(false);

    const openModal = (item, type) => { setModalItem(item); setModalType(type); };
    const closeModal = () => { setModalItem(null); setModalType(null); };

    const hasResult = !!result;
    const meta = result?.metadata || {};
    const totalPubs = meta.total_candidates || 0;
    const rankedPubs = result?.publications?.length || 0;
    const rankedTrials = result?.clinical_trials?.length || 0;
    const insights = result?.research_insights || [];
    const sources = result?.sources || [];

    // Context chips for sticky header
    const disease = meta.disease || result?.disease || '';
    const location = meta.location || '';

    return (
        <section className={`results-panel ${isExpanded ? 'rp-expanded' : ''}`}>
            {modalItem && <DetailModal item={modalItem} type={modalType} onClose={closeModal} />}

            {/* ── Content ─────────────────────────────────────────── */}
            <div className={`results-scroll ${isExpanded ? 'rp-scroll-expanded' : ''}`}>

                {/* ── Sticky context header ─────────────────────────────── */}
                {isExpanded && hasResult && (
                    <div className="rp-sticky-bar">
                        {/* Left: back */}
                        <button className="rp-back-btn" onClick={onToggleExpand}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Continue Conversation
                        </button>

                        {/* Center: mode badge */}
                        <div className="rp-sticky-mode">
                            <span className="rp-mode-dot" />
                            Research Mode Active
                        </div>

                        {/* Right: chips + export */}
                        <div className="rp-sticky-chips">
                            {disease && <span className="rp-ctx-chip">🔬 {disease}</span>}
                            {location && <span className="rp-ctx-chip">📍 {location}</span>}
                            <button
                                className="rp-export-btn"
                                onClick={async () => {
                                    setExporting(true);
                                    try { exportResultToPDF(result); }
                                    finally { setTimeout(() => setExporting(false), 1500); }
                                }}
                                disabled={exporting || !result}
                                title="Export research report as PDF"
                            >
                                {exporting ? (
                                    <><span className="rp-export-spinner" /> Exporting…</>
                                ) : (
                                    <>
                                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                                            <path d="M8 2v9M4 7l4 4 4-4M2 13h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        Export PDF
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}


                {/* ── Intelligence Header (moved into scroll) ────────── */}
                <IntelligenceHeader result={result} isLoading={isLoading} onAIChat={result ? () => setQcOpen(true) : null} />

                {/* ── Expand toggle (compact mode only) ───────────────── */}
                {!isExpanded && hasResult && (
                    <div className="rp-expand-bar">
                        <button
                            className={`rp-expand-btn ${isLoading ? 'rp-expand-btn-loading' : ''}`}
                            onClick={onToggleExpand}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <span className="rp-expand-spinner" />
                                    Generating Analysis…
                                </>
                            ) : (
                                <>🔍 View Full Research Analysis →</>
                            )}
                        </button>
                    </div>
                )}

                {/* Notify dot: show when loading completes (result exists, not expanded) */}
                {!isExpanded && !hasResult && isLoading && (
                    <div className="rp-expand-bar">
                        <button className="rp-expand-btn rp-expand-btn-loading" disabled>
                            <span className="rp-expand-spinner" />
                            Generating Analysis…
                        </button>
                    </div>
                )}

                {/* ── Tab bar (moved into scroll) ─────────────────────── */}
                {hasResult && (
                    <nav className="tab-bar">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                id={`tab-${tab.id}`}
                                className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => onTabChange(tab.id)}
                            >
                                {tab.label}
                                {tab.id === 'publications' && rankedPubs > 0 && ` (${rankedPubs})`}
                                {tab.id === 'trials' && rankedTrials > 0 && ` (${rankedTrials})`}
                                {tab.id === 'insights' && insights.length > 0 && ` (${insights.length})`}
                                {tab.id === 'sources' && sources.length > 0 && ` (${sources.length})`}
                            </button>
                        ))}
                    </nav>
                )}

                <div className={isExpanded ? 'rp-center-container' : ''}>

                    {/* Loading skeletons */}
                    {isLoading && !hasResult && (
                        <>
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                                {[90, 65, 75].map((w, i) => (
                                    <div key={i} className="skeleton" style={{ width: `${w}px`, height: '24px', borderRadius: '12px' }} />
                                ))}
                            </div>
                            {[1, 2, 3].map(i => (
                                <div key={i} className="skeleton" style={{ height: '96px', borderRadius: '12px' }} />
                            ))}
                        </>
                    )}

                    {/* Empty state */}
                    {!isLoading && !hasResult && (
                        <div className="results-empty">
                            <div className="results-empty-icon">🧬</div>
                            <p>Your research results will appear here once you submit a query.</p>
                        </div>
                    )}

                    {hasResult && (
                        <>
                            {/* ── OVERVIEW TAB ──────────────────────────────── */}
                            {activeTab === 'overview' && (
                                <OverviewTab result={result} onViewMore={openModal} />
                            )}

                            {/* ── DEEP ANALYSIS TAB ─────────────────────── */}
                            {activeTab === 'analysis' && (
                                <AnalysisTab result={result} />
                            )}

                            {/* ── DISEASE GUIDE TAB ──────────────────────── */}
                            {activeTab === 'guide' && (
                                <DiseaseGuideTab result={result} />
                            )}

                            {/* ── INSIGHTS TAB ─────────────────────────────── */}
                            {activeTab === 'insights' && (
                                insights.length === 0
                                    ? <div className="results-empty"><p>No specific insights were extracted.</p></div>
                                    : insights.map((ins, i) => (
                                        <div key={i} className="insight-card">
                                            <p className="insight-finding">{ins.finding}</p>
                                            {ins.evidence && <p className="insight-evidence">"{ins.evidence}"</p>}
                                            {ins.source_ids?.length > 0 && (
                                                <div className="insight-sources">
                                                    {ins.source_ids.map(sid => (
                                                        <span key={sid} className="insight-source-chip">{sid}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))
                            )}

                            {/* ── PUBLICATIONS TAB ──────────────────────────── */}
                            {activeTab === 'publications' && (
                                result.publications?.length === 0
                                    ? <div className="results-empty"><p>No publications found.</p></div>
                                    : result.publications?.map((pub, i) => (
                                        <PublicationCard
                                            key={pub.id || i}
                                            pub={pub} rank={i + 1}
                                            onViewMore={openModal}
                                        />
                                    ))
                            )}

                            {/* ── TRIALS TAB ────────────────────────────────── */}
                            {activeTab === 'trials' && (
                                result.clinical_trials?.length === 0
                                    ? <div className="results-empty"><p>No clinical trials found.</p></div>
                                    : result.clinical_trials?.map((trial, i) => (
                                        <TrialCard
                                            key={trial.nct_id || i}
                                            trial={trial}
                                            onViewMore={openModal}
                                        />
                                    ))
                            )}

                            {/* ── SOURCES TAB ───────────────────────────────── */}
                            {activeTab === 'sources' && (
                                sources.length === 0
                                    ? <div className="results-empty"><p>No sources available.</p></div>
                                    : <>
                                        {meta.sources_summary && (
                                            <p className="sources-summary-text">{meta.sources_summary}</p>
                                        )}
                                        {sources.map((src, i) => (
                                            <div key={src.id || i} className="source-card">
                                                <div className="source-header">
                                                    <span className="source-id">{src.id}</span>
                                                    <span className="source-platform">{src.platform}</span>
                                                    {src.year && <span className="source-year">{src.year}</span>}
                                                </div>
                                                <div className="source-title">{src.title}</div>
                                                {src.authors?.length > 0 && (
                                                    <div className="source-authors">
                                                        {src.authors.slice(0, 3).join(', ')}
                                                        {src.authors.length > 3 ? ' et al.' : ''}
                                                    </div>
                                                )}
                                                {src.snippet && <p className="source-snippet">"{src.snippet}"</p>}
                                                <a href={src.url} target="_blank" rel="noopener noreferrer" className="source-link">
                                                    View Source →
                                                </a>
                                            </div>
                                        ))}
                                    </>
                            )}
                        </>
                    )}
                    {/* ── Quick AI Chat Modal (opened from header) ── */}
                    {result && qcOpen && (
                        <QuickAIChat
                            result={result}
                            activeTab={activeTab}
                            forceOpen={true}
                            onClose={() => setQcOpen(false)}
                        />
                    )}
                </div>
            </div>
        </section>
    );
}
