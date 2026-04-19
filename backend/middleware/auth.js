import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * JWT Auth Middleware
 * Validates Bearer token from Authorization header.
 * Attaches req.user = { id, name, email } on success.
 */
export const protect = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentication required. Please log in.' });
        }

        const token = authHeader.split(' ')[1];

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Session expired. Please log in again.' });
            }
            return res.status(401).json({ error: 'Invalid token. Please log in.' });
        }

        const user = await User.findById(decoded.id).select('-passwordHash');
        if (!user) {
            return res.status(401).json({ error: 'User no longer exists.' });
        }

        req.user = { id: user._id.toString(), name: user.name, email: user.email };
        next();
    } catch (error) {
        console.error('[Auth Middleware] Error:', error.message);
        res.status(500).json({ error: 'Authentication failed. Please try again.' });
    }
};
