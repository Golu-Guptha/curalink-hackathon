import { useEffect, useCallback } from 'react';

export default function DetailModal({ item, type, onClose }) {
    if (!item) return null;

    // Close on Escape key
    const handleKey = useCallback((e) => {
        if (e.key === 'Escape') onClose();
    }, [onClose]);

    useEffect(() => {
        document.addEventListener('keydown', handleKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleKey);
            document.body.style.overflow = '';
        };
    }, [handleKey]);

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-card" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="modal-header">
                    <span className="modal-type-tag">
                        {type === 'publication' ? '📄 Publication' : '🧪 Clinical Trial'}
                    </span>
                    <button className="modal-close" onClick={onClose} title="Close (Esc)">✕</button>
                </div>

                {type === 'publication' && <PublicationDetail pub={item} />}
                {type === 'trial' && <TrialDetail trial={item} />}
            </div>
        </div>
    );
}

/* ── Publication detail ─────────────────────────────────────────── */
function PublicationDetail({ pub }) {
    const authors = pub.authors?.join(', ') || 'Unknown authors';
    const score = pub.relevance_score != null ? (pub.relevance_score * 100).toFixed(0) + '%' : null;

    return (
        <div className="modal-body">
            <h2 className="modal-title">{pub.title}</h2>

            <div className="modal-meta-row">
                <span className="modal-tag modal-tag-source">{pub.source}</span>
                {pub.year && <span className="modal-tag">{pub.year}</span>}
                {score && <span className="modal-tag modal-tag-score">↑{score} relevance</span>}
                {pub.cited_by_count > 0 && (
                    <span className="modal-tag">📊 {pub.cited_by_count} citations</span>
                )}
            </div>

            {authors && (
                <div className="modal-section">
                    <div className="modal-section-label">Authors</div>
                    <p className="modal-section-text">{authors}</p>
                </div>
            )}

            {pub.abstract && (
                <div className="modal-section">
                    <div className="modal-section-label">Abstract</div>
                    <p className="modal-section-text modal-abstract">{pub.abstract}</p>
                </div>
            )}

            {pub.supporting_snippet && (
                <div className="modal-section">
                    <div className="modal-section-label">Key Finding</div>
                    <blockquote className="modal-quote">"{pub.supporting_snippet}"</blockquote>
                </div>
            )}

            {pub.url && (
                <a
                    href={pub.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="modal-primary-btn"
                >
                    🔗 Read Full Paper →
                </a>
            )}
        </div>
    );
}

/* ── Trial detail ───────────────────────────────────────────────── */
function TrialDetail({ trial }) {
    const statusClass =
        trial.status === 'RECRUITING' ? 'recruiting' :
            trial.status === 'COMPLETED' ? 'completed' : 'other';

    const allLocations = trial.locations
        ?.filter(l => l.city || l.facility)
        .map(l => [l.facility, l.city, l.country].filter(Boolean).join(', '))
        || [];

    return (
        <div className="modal-body">
            <div className="modal-trial-header">
                <span className={`trial-status ${statusClass}`} style={{ padding: '4px 12px', fontSize: '11px' }}>
                    {trial.status}
                </span>
                {trial.phase && <span className="modal-tag">Phase {trial.phase}</span>}
            </div>

            <h2 className="modal-title">{trial.title}</h2>

            <div className="modal-meta-row">
                {trial.nct_id && <span className="modal-tag modal-tag-source">{trial.nct_id}</span>}
                {trial.start_date && <span className="modal-tag">📅 Started {trial.start_date}</span>}
            </div>

            {trial.eligibility_summary && (
                <div className="modal-section">
                    <div className="modal-section-label">Eligibility Criteria</div>
                    <p className="modal-section-text">{trial.eligibility_summary}</p>
                </div>
            )}

            {allLocations.length > 0 && (
                <div className="modal-section">
                    <div className="modal-section-label">📍 Locations ({allLocations.length})</div>
                    <div className="modal-locations">
                        {allLocations.map((loc, i) => (
                            <div key={i} className="modal-location-item">• {loc}</div>
                        ))}
                    </div>
                </div>
            )}

            {trial.contacts?.filter(c => c.name).length > 0 && (
                <div className="modal-section">
                    <div className="modal-section-label">Contact</div>
                    {trial.contacts.filter(c => c.name).map((c, i) => (
                        <div key={i} className="modal-contact">
                            <span>{c.name}</span>
                            {c.email && <a href={`mailto:${c.email}`} className="modal-contact-link">{c.email}</a>}
                            {c.phone && <span className="modal-contact-phone">{c.phone}</span>}
                        </div>
                    ))}
                </div>
            )}

            {trial.url && (
                <a
                    href={trial.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="modal-primary-btn"
                >
                    🔗 View on ClinicalTrials.gov →
                </a>
            )}
        </div>
    );
}
