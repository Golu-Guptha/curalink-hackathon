import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { quickChatAPI } from '../services/api.js';

/* ── Section context serializers ─────────────────── */
function serializeOverview(result) {
    return [
        `Condition Overview: ${result.condition_overview || ''}`,
        `Key Insight: ${result.key_insight || ''}`,
        `Recommendation: ${result.recommendation || ''}`,
        `Publications: ${result.publications?.length || 0}`,
        `Trials: ${result.clinical_trials?.length || 0}`,
        `Insights: ${(result.research_insights || []).map(i => i.finding).join('; ')}`,
    ].join('\n');
}
function serializeAnalysis(result) {
    const supporting = (result.research_insights || [])
        .filter(i => i.confidence_level?.toLowerCase() !== 'low')
        .map(i => i.finding);
    return [
        `Supporting Evidence: ${supporting.join('; ') || 'None'}`,
        `Challenging Evidence: ${(result.contradictions || []).join('; ') || 'None'}`,
        `Recommendation: ${result.recommendation || ''}`,
        `Agreement Score: ${result.agreement_score || 'N/A'}`,
    ].join('\n');
}
function serializeGuide(result) {
    const guide = result.disease_guide;
    if (!guide?.stages) return 'No disease guide available.';
    return guide.stages.map(s => {
        const eat   = (s.diet?.eat    || []).map(e => `${e.item}: ${e.reason}`).join('; ');
        const avoid = (s.diet?.avoid  || []).map(e => `${e.item}: ${e.reason}`).join('; ');
        const exRec = (s.exercise?.recommended || []).map(e => `${e.activity}: ${e.reason}`).join('; ');
        const exAvd = (s.exercise?.avoid || []).map(e => `${e.activity}: ${e.reason}`).join('; ');
        const dos   = (s.lifestyle?.dos   || []).map(e => `${e.action}: ${e.reason}`).join('; ');
        const donts = (s.lifestyle?.donts || []).map(e => `${e.action}: ${e.reason}`).join('; ');
        return [`--- ${s.name} (${s.timeline || ''}) ---`,
            `Description: ${s.description || ''}`,
            `Symptoms: ${(s.symptoms || []).join(', ')}`,
            eat && `Eat: ${eat}`, avoid && `Avoid: ${avoid}`,
            exRec && `Exercise: ${exRec}`, exAvd && `Avoid exercise: ${exAvd}`,
            dos && `Do's: ${dos}`, donts && `Don'ts: ${donts}`,
        ].filter(Boolean).join('\n');
    }).join('\n\n');
}
function serializeInsights(result) {
    return (result.research_insights || []).map((ins, i) =>
        `[${i + 1}] ${ins.finding}\nEvidence: ${ins.evidence}\nStudy: ${ins.study_type} | Confidence: ${ins.confidence_level}`
    ).join('\n\n') || 'No insights available.';
}
function serializePublications(result) {
    return (result.publications || []).slice(0, 6).map((p, i) =>
        `[${i + 1}] ${p.title} (${p.year}) — ${p.authors?.slice(0, 2).join(', ')}. Citations: ${p.cited_by_count}`
    ).join('\n') || 'No publications.';
}
function serializeTrials(result) {
    return (result.clinical_trials || []).map((t, i) =>
        `[${i + 1}] ${t.title} — Status: ${t.status}, Phase: ${t.phase || 'N/A'}`
    ).join('\n') || 'No trials.';
}

const SECTION_MAP = {
    overview:     { label: '🧬 Overview',       serialize: serializeOverview },
    analysis:     { label: '⚖️ Deep Analysis',   serialize: serializeAnalysis },
    guide:        { label: '📖 Disease Guide',   serialize: serializeGuide },
    insights:     { label: '💡 Insights',        serialize: serializeInsights },
    publications: { label: '📄 Publications',    serialize: serializePublications },
    trials:       { label: '🧪 Trials',          serialize: serializeTrials },
};

/* ── Modal Portal ────────────────────────────────── */
function QuickChatModal({ result, defaultSection, onClose }) {
    const [section, setSection]   = useState(defaultSection || 'overview');
    const [messages, setMessages] = useState([]);
    const [input, setInput]       = useState('');
    const [loading, setLoading]   = useState(false);
    const scrollRef = useRef(null);
    const inputRef  = useRef(null);

    // auto-scroll
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, loading]);

    // focus input on open
    useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

    // close on Escape
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const send = async () => {
        const q = input.trim();
        if (!q || loading || !result) return;
        const info = SECTION_MAP[section] || SECTION_MAP.overview;
        setMessages(prev => [...prev, { role: 'user', text: q }]);
        setInput('');
        setLoading(true);
        try {
            const res = await quickChatAPI({ question: q, context: info.serialize(result), section_name: info.label });
            setMessages(prev => [...prev, { role: 'assistant', text: res.answer || 'No response.', badge: info.label }]);
        } catch {
            setMessages(prev => [...prev, { role: 'assistant', text: 'Could not fetch a response. Please try again.', error: true }]);
        } finally {
            setLoading(false);
            inputRef.current?.focus();
        }
    };

    const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

    return createPortal(
        <div className="qc-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="qc-modal">

                {/* Header */}
                <div className="qc-modal-header">
                    <div className="qc-modal-title-row">
                        <span className="qc-modal-icon">⚡</span>
                        <div>
                            <div className="qc-modal-title">Quick AI Chat</div>
                            <div className="qc-modal-sub">Ask anything about your research results</div>
                        </div>
                    </div>
                    <button className="qc-close" onClick={onClose}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                        </svg>
                    </button>
                </div>

                {/* Section pills */}
                <div className="qc-modal-sections">
                    <span className="qc-section-label">Context:</span>
                    <div className="qc-section-chips">
                        {Object.entries(SECTION_MAP).map(([key, val]) => (
                            <button
                                key={key}
                                className={`qc-chip ${section === key ? 'qc-chip-active' : ''}`}
                                onClick={() => setSection(key)}
                            >{val.label}</button>
                        ))}
                    </div>
                </div>

                {/* Messages */}
                <div className="qc-messages" ref={scrollRef}>
                    {messages.length === 0 && (
                        <div className="qc-placeholder">
                            <span className="qc-placeholder-icon">💬</span>
                            <p>Ask anything about <strong>{SECTION_MAP[section]?.label}</strong></p>
                            <p className="qc-placeholder-hint">
                                e.g. "What does the evidence say?" · "Explain the main finding" · "What foods help and why?"
                            </p>
                        </div>
                    )}
                    {messages.map((msg, i) => (
                        <div key={i} className={`qc-msg qc-msg-${msg.role} ${msg.error ? 'qc-msg-error' : ''}`}>
                            {msg.role === 'assistant' && msg.badge && (
                                <span className="qc-msg-badge">{msg.badge}</span>
                            )}
                            <p>{msg.text}</p>
                        </div>
                    ))}
                    {loading && (
                        <div className="qc-msg qc-msg-assistant">
                            <div className="qc-typing"><span /><span /><span /></div>
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="qc-input-bar">
                    <input
                        ref={inputRef}
                        type="text"
                        className="qc-input"
                        placeholder={`Ask about ${SECTION_MAP[section]?.label || 'this section'}…`}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={onKey}
                        disabled={loading || !result}
                    />
                    <button className="qc-send" onClick={send} disabled={loading || !input.trim() || !result}>
                        {loading
                            ? <div className="qc-send-spinner" />
                            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                <path d="M22 2L15 22l-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                        }
                    </button>
                </div>

                <div className="qc-modal-footer">
                    ⚕️ Research assistant only — not medical advice. Always consult a healthcare professional.
                </div>
            </div>
        </div>,
        document.body
    );
}

/* ── Main export ─────────────────────────────────── */
export default function QuickAIChat({ result, activeTab, forceOpen, onClose }) {
    // If forceOpen is true (opened from header button), show modal directly
    if (forceOpen && result) {
        return (
            <QuickChatModal
                result={result}
                defaultSection={activeTab || 'overview'}
                onClose={onClose || (() => {})}
            />
        );
    }
    return null;
}
