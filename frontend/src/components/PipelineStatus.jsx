import { useState, useEffect, useRef } from 'react';

// Pipeline stages shown in sequence during the ~60s wait
const STAGES = [
    { delay: 0, icon: '', text: 'Expanding query with AI…' },
    { delay: 4000, icon: '📡', text: 'Fetching from PubMed…' },
    { delay: 9000, icon: '🔬', text: 'Fetching from OpenAlex…' },
    { delay: 14000, icon: '🧪', text: 'Querying ClinicalTrials.gov…' },
    { delay: 20000, icon: '📊', text: 'Ranking 200+ candidates…' },
    { delay: 30000, icon: '🤖', text: 'Generating AI insights…' },
    { delay: 50000, icon: '✍️', text: 'Composing your research brief…' },
];

export default function PipelineStatus({ isLoading }) {
    const [stageIndex, setStageIndex] = useState(0);
    const timersRef = useRef([]);

    useEffect(() => {
        if (!isLoading) {
            // Clear all timers when done
            timersRef.current.forEach(clearTimeout);
            timersRef.current = [];
            setStageIndex(0);
            return;
        }

        // Start pipeline stage timers
        setStageIndex(0);
        timersRef.current = STAGES.slice(1).map((stage, i) =>
            setTimeout(() => setStageIndex(i + 1), stage.delay)
        );

        return () => {
            timersRef.current.forEach(clearTimeout);
            timersRef.current = [];
        };
    }, [isLoading]);

    if (!isLoading) return null;

    const current = STAGES[stageIndex];

    return (
        <div className="pipeline-status">
            <div className="pipeline-status-icon">{current.icon}</div>
            <div className="pipeline-status-content">
                <div className="pipeline-status-text">{current.text}</div>
                <div className="pipeline-progress">
                    <div
                        className="pipeline-progress-bar"
                        style={{ width: `${((stageIndex + 1) / STAGES.length) * 100}%` }}
                    />
                </div>
                <div className="pipeline-stages">
                    {STAGES.map((s, i) => (
                        <div
                            key={i}
                            className={`pipeline-stage-dot ${i <= stageIndex ? 'done' : ''} ${i === stageIndex ? 'active' : ''}`}
                            title={s.text}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
