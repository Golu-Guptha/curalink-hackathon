/**
 * FollowUpChips — suggested follow-up questions after AI response
 * Shows 3 context-aware chips the user can click to ask the next question
 */

// Generate follow-up suggestions based on the query + disease
const generateFollowUps = (query = '', disease = '') => {
    const q = query.toLowerCase();
    const dis = disease || 'this condition';

    if (q.includes('trial') || q.includes('clinical')) {
        return [
            `What are the eligibility criteria for these ${dis} trials?`,
            `Which trials are recruiting near me?`,
            `What treatments are being tested in these trials?`,
        ];
    }
    if (q.includes('treatment') || q.includes('therapy') || q.includes('drug') || q.includes('medication')) {
        return [
            `What are the side effects of these treatments?`,
            `Are there clinical trials for ${dis} I can join?`,
            `How effective are these treatments compared to each other?`,
        ];
    }
    if (q.includes('side effect') || q.includes('adverse') || q.includes('risk') || q.includes('safe')) {
        return [
            `What treatments are available for ${dis}?`,
            `What does the latest research say about ${dis}?`,
            `How can these side effects be managed?`,
        ];
    }
    if (q.includes('cause') || q.includes('why') || q.includes('pathogen') || q.includes('genetic')) {
        return [
            `What treatments exist for ${dis}?`,
            `What are the symptoms of ${dis}?`,
            `Are there clinical trials studying ${dis} causes?`,
        ];
    }
    // Default general follow-ups
    return [
        `What clinical trials are available for ${dis}?`,
        `What are the latest treatment options for ${dis}?`,
        `What does the research say about ${dis} prognosis?`,
    ];
};

export default function FollowUpChips({ query, disease, onselect, followUps: apiFollowUps }) {
    // Use API-provided follow-ups if available, else generate locally
    const suggestions = (apiFollowUps && apiFollowUps.length > 0)
        ? apiFollowUps.slice(0, 3)
        : generateFollowUps(query, disease);

    return (
        <div className="followup-container">
            <div className="followup-label">Suggested follow-ups</div>
            <div className="followup-chips">
                {suggestions.map((s, i) => (
                    <button
                        key={i}
                        className="followup-chip"
                        onClick={() => onselect(s)}
                        title={s}
                    >
                        <span className="followup-chip-icon">→</span>
                        {s}
                    </button>
                ))}
            </div>
        </div>
    );
}
