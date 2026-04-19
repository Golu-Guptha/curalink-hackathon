import { useState } from 'react';

export default function PublicationCard({ pub, rank, onViewMore }) {
    const [whyOpen, setWhyOpen] = useState(false);

    const authors  = (pub.authors || []).slice(0, 3).join(', ') + ((pub.authors?.length > 3) ? ' et al.' : '');
    const score    = pub.relevance_score != null ? Math.round(pub.relevance_score * 100) : null;
    const year     = pub.year || '';
    const isRecent = year >= 2020;

    const scoreColor =
        score >= 80 ? '#4ade80' :
        score >= 55 ? '#60a5fa' : '#94a3b8';
    const scorePct = score != null ? `${score}%` : '—';

    return (
        <article className={`pub-card ${whyOpen ? 'pub-card-expanded' : ''}`}>

            {/* ── Header ─────────────────────────────────────── */}
            <div className="pub-card-header">
                <div className="pub-rank">{rank}</div>
                <p className="pub-title">{pub.title}</p>
                {score != null && (
                    <span className="pub-score-badge" style={{ color: scoreColor, borderColor: scoreColor }}>
                        ↑{scorePct}
                    </span>
                )}
            </div>

            {/* ── Visual score bar ────────────────────────────── */}
            {score != null && (
                <div className="pub-score-bar-row">
                    <div className="pub-score-bar-track">
                        <div
                            className="pub-score-bar-fill"
                            style={{ width: `${score}%`, background: scoreColor }}
                        />
                    </div>
                    <span className="pub-score-bar-label" style={{ color: scoreColor }}>
                        {score >= 80 ? 'High match' : score >= 55 ? 'Good match' : 'Partial match'}
                    </span>
                </div>
            )}

            {/* ── Meta row ────────────────────────────────────── */}
            <div className="pub-meta">
                <span className="pub-source-tag">{pub.source}</span>
                {year    && <span className="pub-year">{year}</span>}
                {isRecent && <span className="pub-recent-badge">✓ Recent</span>}
                {authors  && <span className="pub-authors">{authors}</span>}
                {pub.cited_by_count > 0 && (
                    <span className="pub-citations">📊 {pub.cited_by_count} citations</span>
                )}
            </div>

            {/* ── Always-visible "Matched because" preview ──── */}
            <div className="pub-match-preview">
                <span className="pub-match-label">Matched because:</span>
                <div className="pub-match-chips">
                    {pub.source === 'PubMed' && (
                        <span className="pub-match-chip pub-chip-source">PubMed</span>
                    )}
                    {pub.source === 'OpenAlex' && (
                        <span className="pub-match-chip pub-chip-source">OpenAlex</span>
                    )}
                    {isRecent && <span className="pub-match-chip pub-chip-recent">Recent ({year})</span>}
                    {pub.cited_by_count > 50 && (
                        <span className="pub-match-chip pub-chip-cited">{pub.cited_by_count} citations</span>
                    )}
                    {score >= 80 && <span className="pub-match-chip pub-chip-high">High relevance</span>}
                </div>
            </div>

            {/* ── "Why relevant?" inline expand ───────────────── */}
            {whyOpen && (
                <div className="pub-why-panel">
                    <div className="pub-why-title">Why this paper was selected</div>
                    {pub.supporting_snippet && (
                        <blockquote className="pub-why-quote">"{pub.supporting_snippet}"</blockquote>
                    )}
                    {!pub.supporting_snippet && pub.abstract && (
                        <p className="pub-abstract">{pub.abstract.slice(0, 240)}…</p>
                    )}
                    <div className="pub-why-grid">
                        {score != null && (
                            <div className="pub-why-item">
                                <span className="pub-why-key">Match score</span>
                                <span className="pub-why-val" style={{ color: scoreColor }}>{score}%</span>
                            </div>
                        )}
                        {pub.cited_by_count > 0 && (
                            <div className="pub-why-item">
                                <span className="pub-why-key">Citations</span>
                                <span className="pub-why-val">{pub.cited_by_count}</span>
                            </div>
                        )}
                        {year && (
                            <div className="pub-why-item">
                                <span className="pub-why-key">Published</span>
                                <span className="pub-why-val" style={{ color: isRecent ? '#4ade80' : undefined }}>
                                    {year}{isRecent ? ' ✓' : ''}
                                </span>
                            </div>
                        )}
                        <div className="pub-why-item">
                            <span className="pub-why-key">Source</span>
                            <span className="pub-why-val">{pub.source}</span>
                        </div>
                    </div>
                    <div className="pub-why-method">
                        ⚖️ Ranked by BM25 keyword match + semantic similarity + recency + citation boost
                    </div>
                </div>
            )}

            {/* ── Action row ──────────────────────────────────── */}
            <div className="card-actions">
                {pub.url && (
                    <a className="card-link-btn" href={pub.url} target="_blank" rel="noopener noreferrer">
                        🔗 Read full paper
                    </a>
                )}
                <button
                    className={`pub-why-btn ${whyOpen ? 'active' : ''}`}
                    onClick={() => setWhyOpen(v => !v)}
                >
                    {whyOpen ? '✕ Hide' : '💡 Why relevant?'}
                </button>
                <button className="card-view-more-btn" onClick={() => onViewMore(pub, 'publication')}>
                    View more…
                </button>
            </div>
        </article>
    );
}
