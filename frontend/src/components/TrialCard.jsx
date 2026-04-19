import { useState } from 'react';

const STATUS_CONFIG = {
    RECRUITING:             { label: 'Recruiting',    cls: 'tc-status-recruiting' },
    COMPLETED:              { label: 'Completed',     cls: 'tc-status-completed'  },
    ACTIVE_NOT_RECRUITING: { label: 'Active',         cls: 'tc-status-active'     },
    NOT_YET_RECRUITING:    { label: 'Starting Soon',  cls: 'tc-status-soon'       },
};

export default function TrialCard({ trial, onViewMore }) {
    const [contactOpen, setContactOpen] = useState(false);

    const statusCfg = STATUS_CONFIG[trial.status] || { label: trial.status, cls: 'tc-status-active' };

    const locations = (trial.locations || [])
        .filter(l => l.city)
        .slice(0, 3)
        .map(l => [l.city, l.country].filter(Boolean).join(', '));

    const contacts  = (trial.contacts || []).filter(c => c.name);
    const hasContacts = contacts.length > 0;

    return (
        <article className="tc-card">

            {/* ── Status badge (FIRST, prominent) ────────────── */}
            <div className="tc-top-row">
                <span className={`tc-status-badge ${statusCfg.cls}`}>
                    {statusCfg.cls === 'tc-status-recruiting' ? '● ' : ''}{statusCfg.label}
                </span>
                {trial.phase && (
                    <span className="tc-phase-badge">Phase {trial.phase}</span>
                )}
                {trial.nct_id && (
                    <span className="tc-nct-id">{trial.nct_id}</span>
                )}
                {trial.start_date && (
                    <span className="tc-start-date">Started {trial.start_date}</span>
                )}
            </div>

            {/* ── Title ──────────────────────────────────────── */}
            <p className="tc-title">{trial.title}</p>

            {/* ── Location chips ─────────────────────────────── */}
            {locations.length > 0 && (
                <div className="tc-locations-row">
                    <span className="tc-loc-icon">📍</span>
                    <div className="tc-loc-chips">
                        {locations.map((loc, i) => (
                            <span key={i} className="tc-loc-chip">{loc}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Eligibility (1 short line) ──────────────────── */}
            {trial.eligibility_summary && (
                <div className="tc-eligibility">
                    <span className="tc-elig-label">Eligibility</span>
                    <p className="tc-elig-text">
                        {trial.eligibility_summary.slice(0, 140)}
                        {trial.eligibility_summary.length > 140 ? '…' : ''}
                    </p>
                </div>
            )}

            {/* ── Contact expand ──────────────────────────────── */}
            {hasContacts && (
                <div className="tc-contact-wrap">
                    <button
                        className="tc-contact-toggle"
                        onClick={() => setContactOpen(v => !v)}
                    >
                        👤 {contactOpen ? 'Hide' : 'Show'} contact info
                    </button>
                    {contactOpen && (
                        <div className="tc-contact-body">
                            {contacts.slice(0, 2).map((c, i) => (
                                <div key={i} className="tc-contact-item">
                                    <span className="tc-contact-name">{c.name}</span>
                                    {c.email && (
                                        <a className="tc-contact-link" href={`mailto:${c.email}`}>{c.email}</a>
                                    )}
                                    {c.phone && (
                                        <span className="tc-contact-phone">{c.phone}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Actions ────────────────────────────────────── */}
            <div className="card-actions">
                {trial.url && (
                    <a
                        className="tc-primary-link"
                        href={trial.url}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        🔗 ClinicalTrials.gov
                    </a>
                )}
                <button className="card-view-more-btn" onClick={() => onViewMore(trial, 'trial')}>
                    Full details…
                </button>
            </div>
        </article>
    );
}
