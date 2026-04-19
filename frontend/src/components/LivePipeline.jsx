import { useState, useEffect, useRef } from 'react';

const buildSteps = (query = '', disease = '', location = '') => {
    const truncQ = query.length > 48 ? query.slice(0, 45) + '…' : query;
    const locStr = location ? ` in ${location}` : '';
    return [
        { pct: 5,  text: 'Expanding query with Llama 3.3…' },
        { pct: 15, text: `Query: "${truncQ || disease}${locStr}"` },
        { pct: 26, text: 'Fetching from PubMed + OpenAlex + ClinicalTrials…' },
        { pct: 48, text: 'Retrieved ~80 papers + ~8 trials' },
        { pct: 60, text: 'Ranking by relevance, recency & citations…' },
        { pct: 72, text: 'Top 7 papers · 5 trials selected' },
        { pct: 82, text: 'Llama 3.3 70B reasoning over evidence…' },
        { pct: 93, text: 'Generating smart follow-up questions…' },
        // NOTE: no "Complete!" step — card disappears when isLoading becomes false
    ];
};

// When each step becomes active (ms)
const STEP_DELAYS = [0, 2000, 5000, 14000, 20000, 28000, 36000, 52000];

export default function LivePipeline({ isLoading, query, disease, location }) {
    const [steps, setSteps]      = useState([]);
    const [activeIdx, setActive] = useState(0);
    const [pct, setPct]          = useState(0);
    const timersRef = useRef([]);

    useEffect(() => {
        if (!isLoading) {
            timersRef.current.forEach(clearTimeout);
            timersRef.current = [];
            setSteps([]);
            setActive(0);
            setPct(0);
            return;
        }

        const builtSteps = buildSteps(query, disease, location);
        setSteps(builtSteps);
        setActive(0);
        setPct(builtSteps[0].pct);

        timersRef.current = STEP_DELAYS.slice(1).map((delay, i) =>
            setTimeout(() => {
                setActive(i + 1);
                setPct(builtSteps[i + 1]?.pct ?? 95);
            }, delay)
        );

        return () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };
    }, [isLoading]);

    if (!isLoading || steps.length === 0) return null;

    const current = steps[activeIdx];

    return (
        <div className="live-pipeline-card">
            <div className="lp-header">
                <div className="lp-title">
                    <span className="lp-dot" />
                    AI Reasoning Pipeline
                </div>
                <span className="lp-pct">{pct}%</span>
            </div>

            <div className="lp-bar-track">
                <div className="lp-bar-fill" style={{ width: `${pct}%` }} />
            </div>

            <div className="lp-step-list">
                {steps.map((step, i) => {
                    const isCompleted = i < activeIdx;
                    const isActive    = i === activeIdx;
                    
                    return (
                        <div key={i} className={`lp-step-item ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}>
                            <div className="lp-step-icon">
                                {isCompleted ? (
                                    <span className="lp-icon-check">✓</span>
                                ) : isActive ? (
                                    <SpinIcon />
                                ) : (
                                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--text-muted)' }} />
                                )}
                            </div>
                            <span className="lp-step-text">{step.text}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function SpinIcon() {
    return (
        <svg className="lp-spinner" width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="7" cy="7" r="6" stroke="rgba(37,99,235,0.2)" strokeWidth="1.5"/>
            <path d="M7 1a6 6 0 0 1 6 6" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
    );
}
