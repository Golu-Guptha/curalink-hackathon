import User from '../models/User.js';
import { generateAccessToken } from '../services/authService.js';

/**
 * POST /api/auth/register
 * Body: { name, email, password }
 */
export const register = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });
        }

        // Check duplicate email
        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
        }

        const user = await User.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            passwordHash: password, // pre-save hook hashes it
        });

        const token = generateAccessToken(user._id.toString(), user.email);

        console.log(`[Auth] New user registered: ${user.email}`);
        res.status(201).json({
            user: { id: user._id, name: user.name, email: user.email },
            token,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        // Include passwordHash (excluded by default via select: false)
        const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const token = generateAccessToken(user._id.toString(), user.email);

        console.log(`[Auth] User logged in: ${user.email}`);
        res.json({
            user: { id: user._id, name: user.name, email: user.email },
            token,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * GET /api/auth/me
 * Requires: JWT Bearer token
 */
export const getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json({ user: { id: user._id, name: user.name, email: user.email } });
    } catch (error) {
        next(error);
    }
};
