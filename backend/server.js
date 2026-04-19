import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import chatRoutes from './routes/chat.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

// ── Load environment variables ─────────────────────────────────────────────────
dotenv.config();

// ── Connect to MongoDB ─────────────────────────────────────────────────────────
connectDB();

// ── Express App Setup ──────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;

// ── CORS ───────────────────────────────────────────────────────────────────────
app.use(cors({
    origin: (process.env.CLIENT_URL || 'http://localhost:3000').split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body Parser ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// ── Health Check ───────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'CuraLink Node.js Backend',
        phase: '4 — Auth + Context + MongoDB Active',
        timestamp: new Date().toISOString(),
    });
});

// ── 404 Handler ────────────────────────────────────────────────────────────────
app.use('*', (req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found.` });
});

// ── Global Error Handler (must be last) ────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ───────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 CuraLink Backend running on http://localhost:${PORT}`);
    console.log(`   Auth:  POST /api/auth/register | POST /api/auth/login`);
    console.log(`   Chat:  POST /api/chat/query (JWT protected)`);
    console.log(`   Health: GET /health\n`);
});
