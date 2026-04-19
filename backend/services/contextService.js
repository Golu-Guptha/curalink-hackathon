import Message from '../models/Message.js';
import Session from '../models/Session.js';

/**
 * Context Service
 * Builds the conversation history passed to the Python AI Engine.
 * This is the critical component that enables multi-turn memory.
 * 
 * The AI Engine receives the last N messages so that follow-up questions 
 * like "Can I take Vitamin D?" retain the lung cancer context from previous turns.
 */

const CONTEXT_WINDOW = 10; // Last 10 messages for context

/**
 * Build conversation history array for AI Engine.
 * Returns [{role: 'user'|'assistant', content: string}, ...]
 * 
 * @param {string} sessionId
 * @returns {Array} conversation history
 */
export const buildConversationContext = async (sessionId) => {
    const messages = await Message.find({ sessionId })
        .sort({ createdAt: -1 })
        .limit(CONTEXT_WINDOW)
        .lean();

    // Reverse to chronological order (oldest first)
    return messages.reverse().map(msg => ({
        role: msg.role,
        content: msg.content,
        metadata: msg.metadata || {},
    }));
};

/**
 * Get or create a session for this user.
 * If sessionId doesn't exist, creates a new session.
 * Updates disease/location if provided.
 * 
 * @param {string} userId
 * @param {string} sessionId - client-generated session ID
 * @param {string} disease
 * @param {string} location
 * @param {string} query
 * @returns {Session} mongoose session document
 */
export const getOrCreateSession = async (userId, sessionId, disease, location, query) => {
    let session = await Session.findOne({ _id: sessionId }).catch(() => null);

    if (!session) {
        // Build a meaningful title from the first query
        const title = query
            ? query.length > 50
                ? query.slice(0, 47) + '…'
                : query
            : disease
                ? `${disease} Research`
                : 'Medical Research Session';

        session = await Session.create({
            _id: sessionId,
            userId,
            title,
            disease: disease || '',
            location: location || '',
        });
    } else {
        // Update disease/location if newly provided
        const updates = {};
        if (disease && !session.disease) updates.disease = disease;
        if (location && !session.location) updates.location = location;
        if (Object.keys(updates).length > 0) {
            Object.assign(session, updates);
            await session.save();
        }
    }

    return session;
};

/**
 * Save a user message to the database.
 */
export const saveUserMessage = async (sessionId, userId, content) => {
    return Message.create({
        sessionId,
        userId,
        role: 'user',
        content,
    });
};

/**
 * Save an AI assistant message with full structured response.
 */
export const saveAssistantMessage = async (sessionId, userId, aiResponse) => {
    const content = aiResponse.condition_overview
        ? `${aiResponse.condition_overview}\n\n${aiResponse.recommendation || ''}`
        : 'Research complete. See panel for results.';

    const meta = aiResponse.metadata || {};

    await Message.create({
        sessionId,
        userId,
        role: 'assistant',
        content,
        structuredResponse: aiResponse,
        metadata: {
            disease: meta.expanded_disease || '',
            intent: meta.expanded_intent || '',
            location: meta.location || '',
            total_candidates: meta.total_candidates || 0,
            publications_ranked: meta.publications_ranked || 0,
            trials_ranked: meta.trials_ranked || 0,
            model: meta.model || '',
            fallback: meta.fallback || false,
        },
    });

    // Update session message count and updatedAt
    await Session.findOneAndUpdate(
        { _id: sessionId },
        { $inc: { messageCount: 2 } }  // timestamps:true auto-updates updatedAt
    );
};
