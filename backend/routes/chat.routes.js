import express from 'express';
import {
    handleChatQuery,
    getSessions,
    getSessionById,
    deleteSession,
    handleQuickChat,
} from '../controllers/chat.controller.js';
import { protect } from '../middleware/auth.js';
import { chatLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// All chat routes are protected by JWT auth
router.use(protect);

// Main AI pipeline endpoint
router.post('/query', chatLimiter, handleChatQuery);

// Session management
router.get('/sessions',     getSessions);
router.get('/sessions/:id', getSessionById);
router.delete('/sessions/:id', deleteSession);

// Quick contextual AI chat
router.post('/quick', handleQuickChat);

export default router;
