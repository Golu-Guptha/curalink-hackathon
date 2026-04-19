import { queryAIEngine } from '../services/ai.service.js';
import {
    buildConversationContext,
    getOrCreateSession,
    saveUserMessage,
    saveAssistantMessage,
} from '../services/contextService.js';
import Session from '../models/Session.js';
import Message from '../models/Message.js';

/**
 * POST /api/chat/query
 * 
 * Full chat flow:
 * 1. Validate inputs
 * 2. Get/create session (MongoDB)
 * 3. Save user message to DB
 * 4. Load last 10 messages → build conversation context
 * 5. Call Python AI Engine → PipelineResponse
 * 6. Save assistant message to DB
 * 7. Return PipelineResponse to frontend
 */
export const handleChatQuery = async (req, res, next) => {
    try {
        const { query, session_id, disease, location, conversation_history, research_mode } = req.body;
        const userId = req.user.id;

        // Validate required fields
        if (!query?.trim() || !session_id) {
            return res.status(400).json({ error: 'query and session_id are required.' });
        }
        if (!disease?.trim()) {
            return res.status(400).json({ error: 'disease is required. Please specify a medical condition.' });
        }

        console.log(`[Chat] Session: ${session_id} | User: ${userId} | Disease: ${disease} | Mode: ${research_mode || 'thinking'}`);

        // Step 1: Get or create session in MongoDB (title = first user query)
        await getOrCreateSession(userId, session_id, disease, location, query.trim());

        // Step 2: Save user message to DB
        await saveUserMessage(session_id, userId, query.trim());

        // Step 3: Build conversation context from DB (multi-turn memory)
        const conversationContext = await buildConversationContext(session_id);

        // Step 4: Call Python AI Engine
        const aiResponse = await queryAIEngine({
            query: query.trim(),
            session_id,
            disease: disease.trim(),
            location: location?.trim() || null,
            conversation_history: conversationContext,
            research_mode: research_mode || 'thinking',
        });

        // Step 5: Save assistant response to DB
        await saveAssistantMessage(session_id, userId, aiResponse);

        console.log(`[Chat] Response ready. Publications: ${aiResponse.publications?.length}, Trials: ${aiResponse.clinical_trials?.length}`);

        // Step 6: Return to frontend
        res.json(aiResponse);

    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/chat/sessions
 * Returns all sessions for the authenticated user (sorted by most recent).
 */
export const getSessions = async (req, res, next) => {
    try {
        const sessions = await Session.find({ userId: req.user.id })
            .sort({ updatedAt: -1 })
            .limit(50)
            .lean();

        res.json({ sessions });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/chat/sessions/:id
 * Returns a single session with its full message history.
 */
export const getSessionById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const session = await Session.findOne({ _id: id, userId: req.user.id }).lean();
        if (!session) {
            return res.status(404).json({ error: 'Session not found.' });
        }

        const messages = await Message.find({ sessionId: id })
            .sort({ createdAt: 1 })
            .lean();

        res.json({ session, messages });
    } catch (error) {
        next(error);
    }
};

/**
 * DELETE /api/chat/sessions/:id
 * Deletes a session and all its messages.
 */
export const deleteSession = async (req, res, next) => {
    try {
        const { id } = req.params;

        const session = await Session.findOne({ _id: id, userId: req.user.id });
        if (!session) {
            return res.status(404).json({ error: 'Session not found.' });
        }

        await Message.deleteMany({ sessionId: id });
        await Session.deleteOne({ _id: id });

        res.json({ message: 'Session deleted successfully.' });
    } catch (error) {
        next(error);
    }
};
