/**
 * ReasoningTimeline — shows the AI pipeline steps as completed checkmarks.
 * Derived entirely from result.metadata (no extra API calls needed).
 */
export default function ReasoningTimeline({ result }) {
    if (!result) return null;
    const meta = result.metadata || {};

    const queries = meta.expanded_queries || [];
    const total = meta.total_candidates || 0;
    const pubmed = meta.pubmed_fetched || 0;
    const openalex = meta.openalex_fetched || 0;
    const ranked = meta.publications_ranked || result.publications?.length || 0;
    const trials = meta.trials_fetched || 0;
    const method = meta.ranking_method || 'BM25 + Recency + Citation Count';
    const insights = result.research_insights?.length || 0;
    const model = meta.model || 'Llama 3.3-70B';

    const steps = [
        {
            icon: '',
            label: 'Query Expansion',
            detail: queries.length > 0
                ? `${queries.length} search variations generated`
                : 'Expanded to medical terminology',
        },
        {
            icon: '',
            label: 'Parallel Data Retrieval',
            detail: `${total} papers retrieved — PubMed (${pubmed}) + OpenAlex (${openalex}) + ${trials} trials`,
        },
        {
            icon: '',
            label: 'Hybrid Ranking',
            detail: `Scored using ${method}`,
        },
        {
            icon: '',
            label: 'Evidence Selection',
            detail: `Top ${ranked} publications + ${result.clinical_trials?.length || 0} trials selected`,
        },
        {
            icon: '',
            label: `LLM Reasoning via ${model}`,
            detail: `${insights} structured insights synthesized from evidence`,
        },
    ];

    return (
        <div className="rt-root">
            <div className="rt-header">
                <span className="rt-title">⫘⫘⫘ AI Processing Pipeline</span>
                <span className="rt-complete-badge">✓ Complete</span>
            </div>
            <div className="rt-steps">
                {steps.map((step, i) => (
                    <div key={i} className="rt-step">
                        <div className="rt-step-left">
                            <div className="rt-step-check">✓</div>
                            {i < steps.length - 1 && <div className="rt-step-line" />}
                        </div>
                        <div className="rt-step-body">
                            <span className="rt-step-icon">{step.icon}</span>
                            <div className="rt-step-text">
                                <span className="rt-step-label">{step.label}</span>
                                <span className="rt-step-detail">{step.detail}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
