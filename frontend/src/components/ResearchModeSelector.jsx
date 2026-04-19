/**
 * ResearchModeSelector
 * Three mode pills shown in the chat input toolbar.
 * All modes run the full pipeline — only the LLM response style changes.
 */

export const RESEARCH_MODES = [
    {
        id: 'fast',
        label: 'Fast',
        icon: '⚡',
        description: 'Quick, direct answer',
    },
    {
        id: 'thinking',
        label: 'Thinking',
        icon: '🧠',
        description: 'Balanced analysis (default)',
    },
    {
        id: 'deep',
        label: 'Deep Research',
        icon: '🔬',
        description: 'Comprehensive, cited reasoning',
    },
];

export default function ResearchModeSelector({ mode, onChange, disabled }) {
    return (
        <div className="mode-selector">
            {RESEARCH_MODES.map(m => (
                <button
                    key={m.id}
                    id={`mode-${m.id}`}
                    className={`mode-pill ${mode === m.id ? 'active' : ''}`}
                    onClick={() => !disabled && onChange(m.id)}
                    title={m.description}
                    disabled={disabled}
                    type="button"
                >
                    <span className="mode-pill-icon">{m.icon}</span>
                    <span className="mode-pill-label">{m.label}</span>
                    {mode === m.id && <span className="mode-pill-dot" />}
                </button>
            ))}
        </div>
    );
}
