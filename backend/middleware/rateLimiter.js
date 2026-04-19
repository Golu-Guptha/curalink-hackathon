import rateLimit from 'express-rate-limit';

/**
 * Auth Rate Limiter
 * Prevents brute-force attacks on login/register endpoints.
 * 20 attempts per 15 minutes per IP.
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: { error: 'Too many requests. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * Chat Rate Limiter
 * Prevents API abuse on the AI pipeline endpoint.
 * 60 requests per minute per IP.
 */
export const chatLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60,
    message: { error: 'Too many requests. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
});
