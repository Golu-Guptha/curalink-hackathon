import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://127.0.0.1:8000';

// Axios instance with generous timeout (RAG pipeline: 3-source fetch + LLM)
const aiClient = axios.create({
    baseURL: AI_ENGINE_URL,
    timeout: 180_000, // 3-minute timeout
    headers: { 'Content-Type': 'application/json' },
});

/**
 * Call the Python AI Engine /pipeline/query endpoint.
 * 
 * @param {object} payload - { query, session_id, disease, location, conversation_history }
 * @returns {object} PipelineResponse
 * @throws if AI Engine is unreachable or returns an error
 */
export const queryAIEngine = async (payload) => {
    try {
        const response = await aiClient.post('/pipeline/query', payload);
        return response.data;
    } catch (error) {
        console.error('[AIProxy] Failed to communicate with AI Engine:', error.message);

        if (error.response) {
            // AI Engine returned a structured error
            const detail = error.response.data?.detail || JSON.stringify(error.response.data);
            const err = new Error(`AI Engine Error: ${detail}`);
            err.status = error.response.status;
            throw err;
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ECONNABORTED') {
            throw new Error(
                'AI Engine is offline or not responding. Please ensure the Python FastAPI server is running on port 8000.'
            );
        } else if (error.code === 'ETIMEDOUT') {
            throw new Error('AI Engine timed out. The pipeline may be under heavy load — please try again.');
        }

        throw error;
    }
};
