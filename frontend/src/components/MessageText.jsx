/**
 * Renders a plain-text AI message with proper formatting:
 * - Splits on double newlines → paragraphs
 * - Lines starting with emoji are treated as highlighted bullets
 * - Bold text via **word** syntax
 */
export default function MessageText({ text, role }) {
    if (!text) return null;
    if (role === 'user') return <span>{text}</span>;

    // Split into paragraphs on double newlines
    const paragraphs = text.split(/\n\n+/).filter(Boolean);

    return (
        <div className="ai-message-text">
            {paragraphs.map((para, i) => {
                const trimmed = para.trim();

                // Detect emoji-led highlight lines (e.g. "📋 Found 5 trials…")
                const isHighlight = /^[\u{1F300}-\u{1FAFF}⚠️✅❌🔬💡📋🧪🔗]/u.test(trimmed);

                if (isHighlight) {
                    return (
                        <div key={i} className="ai-highlight-line">
                            {renderInline(trimmed)}
                        </div>
                    );
                }

                return (
                    <p key={i} className="ai-para">
                        {renderInline(trimmed)}
                    </p>
                );
            })}
        </div>
    );
}

/** Render inline bold using **text** syntax */
function renderInline(text) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
    });
}
