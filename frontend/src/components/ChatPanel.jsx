import { useState, useRef, useEffect, useCallback } from 'react';
import LivePipeline from './LivePipeline.jsx';
import FollowUpChips from './FollowUpChips.jsx';
import MessageText from './MessageText.jsx';
import DeepResearchModal from './DeepResearchModal.jsx';

const MODES = [
    { id: 'fast', icon: '⚡', label: 'Fast' },
    { id: 'thinking', icon: '🧠', label: 'Thinking' },
    { id: 'deep', icon: '🔬', label: 'Deep Research' },
];

const QUICK_CHIPS = [
    { icon: '', text: 'Latest treatments', query: 'What are the latest treatment options?', disease: '' },
    { icon: '🧪', text: 'Clinical trials', query: 'What clinical trials are currently recruiting?', disease: '' },
    { icon: '💊', text: 'Drug interactions', query: 'What are the known drug interactions?', disease: '' },
    { icon: '⚠️', text: 'Side effects', query: 'What are the safety concerns and side effects?', disease: '' },
    { icon: '🧠', text: "Alzheimer's", query: "What are the latest treatments for Alzheimer's?", disease: "Alzheimer Disease" },
    { icon: '🫀', text: 'Heart Disease', query: 'What are current treatments for heart disease?', disease: 'Heart Disease' },
    { icon: '🦀', text: 'Cancer Research', query: 'What immunotherapy advances exist in oncology?', disease: 'Cancer' },
    { icon: '🧬', text: 'Rare Diseases', query: 'What gene therapy advances exist for rare genetic disorders?', disease: 'Rare Genetic Disorders' },
];

export default function ChatPanel({
    messages, isLoading, onQuery, error,
    lockedDisease, currentQuery, followUps,
}) {
    const [query, setQuery] = useState('');
    const [disease, setDisease] = useState('');
    const [location, setLocation] = useState('');
    const [mode, setMode] = useState('thinking');
    const [deepModalQuery, setDeepModalQuery] = useState(null);
    const [showContext, setShowContext] = useState(false);
    const [modeOpen, setModeOpen] = useState(false);

    const bottomRef = useRef(null);
    const textareaRef = useRef(null);
    const contextRef = useRef(null);
    const modeRef = useRef(null);

    const isEmpty = messages.length === 0 && !isLoading;
    const isLocked = !!lockedDisease;
    const lastMsg = messages[messages.length - 1];
    const showFollowUps = !isLoading && lastMsg?.role === 'ai' && (followUps?.length > 0);
    const currentMode = MODES.find(m => m.id === mode) || MODES[1];

    useEffect(() => { if (lockedDisease) setDisease(lockedDisease); }, [lockedDisease]);
    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);

    // Close popups on outside click
    useEffect(() => {
        const handler = (e) => {
            if (contextRef.current && !contextRef.current.contains(e.target)) setShowContext(false);
            if (modeRef.current && !modeRef.current.contains(e.target)) setModeOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const MAX_H = 160;
    const handleQueryChange = (e) => {
        setQuery(e.target.value);
        const el = e.target;
        el.style.height = 'auto';
        if (el.scrollHeight <= MAX_H) {
            el.style.height = el.scrollHeight + 'px';
            el.style.overflowY = 'hidden';
        } else {
            el.style.height = MAX_H + 'px';
            el.style.overflowY = 'auto';
        }
    };

    const handleSend = useCallback((overrideQuery) => {
        const q = overrideQuery || query;
        const effectiveDisease = lockedDisease || disease || q; // fallback to query text
        if (!q.trim() || isLoading) return;

        if (mode === 'deep' && !overrideQuery) {
            setDeepModalQuery(q.trim());
            return;
        }

        onQuery({ query: q.trim(), disease: effectiveDisease, location: location.trim(), research_mode: mode });
        setQuery('');
        setShowContext(false);
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }, [query, lockedDisease, disease, location, mode, isLoading, onQuery]);

    const handleDeepSubmit = useCallback(({ query: q, patient_profile }) => {
        const effectiveDisease = lockedDisease || disease || patient_profile?.current_disease || q;
        setDeepModalQuery(null);
        onQuery({ query: q, disease: effectiveDisease, location: patient_profile?.location || location.trim(), research_mode: 'deep', patient_profile });
        setQuery('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }, [lockedDisease, disease, location, onQuery]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    const handleChip = (chip) => {
        if (chip.disease) setDisease(chip.disease);
        setQuery(chip.query);
        setTimeout(() => textareaRef.current?.focus(), 50);
    };

    /* ── Shared input card JSX ────────────────────────────────────── */
    const renderInputCard = (className = '') => (
        <div className={`cp-input-card ${className}`}>
            {/* + Context button */}
            <div className="cp-plus-wrap" ref={contextRef}>
                <button
                    className="cp-plus-btn"
                    onClick={() => setShowContext(v => !v)}
                    title="Set disease & location"
                >+</button>
                {showContext && (
                    <div className="cp-context-pop">
                        <label className="cp-ctx-label">Disease / Condition</label>
                        <input className="cp-ctx-input"
                            placeholder="e.g. Parkinson Disease"
                            value={disease}
                            onChange={e => setDisease(e.target.value)}
                            disabled={isLocked}
                        />
                        <label className="cp-ctx-label" style={{ marginTop: 8 }}>Location (optional)</label>
                        <input className="cp-ctx-input"
                            placeholder="City, Country"
                            value={location}
                            onChange={e => setLocation(e.target.value)}
                        />
                    </div>
                )}
            </div>

            {/* Textarea */}
            <textarea
                ref={textareaRef}
                id="chat-query-input"
                className="cp-textarea"
                placeholder={isLocked
                    ? `Ask about ${lockedDisease}…`
                    : 'Message CuraLink…'}
                value={query}
                onChange={handleQueryChange}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={isLoading}
            />

            {/* Right actions: mode + send */}
            <div className="cp-right-actions">
                {/* Mode dropdown */}
                <div className="cp-mode-wrap" ref={modeRef}>
                    <button
                        className="cp-mode-btn"
                        onClick={() => setModeOpen(v => !v)}
                        title="Research mode"
                    >
                        {currentMode.icon} {currentMode.label} ▾
                    </button>
                    {modeOpen && (
                        <div className="cp-mode-drop">
                            {MODES.map(m => (
                                <button
                                    key={m.id}
                                    className={`cp-mode-opt ${mode === m.id ? 'active' : ''}`}
                                    onClick={() => { setMode(m.id); setModeOpen(false); }}
                                >{m.icon} {m.label}</button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Send button */}
                <button
                    id="send-btn"
                    className="cp-send-btn"
                    onClick={() => handleSend()}
                    disabled={isLoading || !query.trim()}
                >
                    {isLoading ? (
                        <svg className="send-spinner" width="16" height="16" viewBox="0 0 16 16">
                            <circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" fill="none" />
                            <path d="M8 2a6 6 0 0 1 6 6" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
                        </svg>
                    ) : (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M8 13V3M3 8l5-5 5 5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    )}
                </button>
            </div>
        </div>
    );

    return (
        <section className={`chat-panel ${isEmpty ? 'cp-home-mode' : ''}`}>
            {deepModalQuery && (
                <DeepResearchModal
                    query={deepModalQuery}
                    onSubmit={handleDeepSubmit}
                    onCancel={() => setDeepModalQuery(null)}
                />
            )}

            {/* ══════════════ HOME MODE ══════════════ */}
            {isEmpty && (
                <div className="cp-home-wrap">

                    {/* Hero */}
                    <div className="cp-hero">
                        <div className="cp-hero-badge">
                            <span className="cp-hero-badge-dot" />
                            AI Medical Research
                        </div>
                        <h1 className="cp-hero-title">CuraLink</h1>
                        <p className="cp-hero-desc">
                            Search peer-reviewed publications, find recruiting<br />
                            clinical trials, and get AI-synthesized insights.
                        </p>
                    </div>

                    {/* Pill input */}
                    {renderInputCard('cp-home-input')}

                    {/* Suggestion chips */}
                    <div className="cp-chips-section">
                        <span className="cp-chips-label">Try asking</span>
                        <div className="cp-chips-grid">
                            {QUICK_CHIPS.map((c, i) => (
                                <button
                                    key={i}
                                    className="cp-chip"
                                    onClick={() => handleChip(c)}
                                >
                                    <span className="cp-chip-icon">{c.icon}</span>
                                    {c.text}
                                </button>
                            ))}
                        </div>
                    </div>

                    <p className="cp-disclaimer">
                        CuraLink AI can make mistakes. For research purposes only. Always consult a healthcare professional.
                    </p>
                </div>
            )}


            {/* ══════════════ CHAT MODE ══════════════ */}
            {!isEmpty && (
                <>
                    {/* Messages scroll area */}
                    <div className="chat-messages">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`msg msg-${msg.role}`}>
                                {msg.role === 'ai' && <div className="msg-ai-avatar">C</div>}
                                <div className="msg-col">
                                    {msg.role === 'ai' && msg.mode && (
                                        <div className={`msg-mode-badge mode-badge-${msg.mode}`}>
                                            {msg.mode === 'fast' && '⚡ Fast'}
                                            {msg.mode === 'thinking' && '🧠 Thinking'}
                                            {msg.mode === 'deep' && '🔬 Deep Research'}
                                        </div>
                                    )}
                                    <div className="msg-bubble">
                                        <MessageText text={msg.text} role={msg.role} />
                                    </div>
                                    <span className="msg-meta">{msg.time}</span>
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <LivePipeline isLoading={isLoading} query={currentQuery}
                                disease={lockedDisease || disease} location={location} />
                        )}
                        {showFollowUps && (
                            <FollowUpChips query={lastMsg?.text}
                                disease={lockedDisease || disease}
                                followUps={followUps}
                                onselect={(t) => handleSend(t)} />
                        )}
                        {error && <div className="error-banner">⚠️ {error}</div>}
                        <div ref={bottomRef} />
                    </div>

                    {/* Bottom input bar */}
                    <div className="cp-bottom-bar">
                        {/* Context reuse indicator — shows when in a follow-up conversation */}
                        {isLocked && messages.length > 0 && (
                            <div className="cp-context-reuse-bar">
                                <span className="cp-reuse-icon">🔁</span>
                                <span>Using research context:{' '}
                                    <strong>{lockedDisease}</strong>
                                </span>
                                <span className="cp-reuse-hint">AI will reference your previous results</span>
                            </div>
                        )}
                        {isLocked && (
                            <div className="cp-locked-tag">
                                <span></span>
                                <span>{lockedDisease}</span>
                            </div>
                        )}
                        {renderInputCard()}
                        <p className="cp-disclaimer-sm">
                            For research only. Not medical advice. Consult a doctor.
                        </p>
                    </div>
                </>
            )}
        </section>
    );
}
