import jwt from 'jsonwebtoken';

/**
 * Auth Service — JWT token generation and verification utilities.
 */

/**
 * Generate a signed JWT access token.
 * @param {string} userId - MongoDB ObjectId as string
 * @param {string} email
 * @returns {string} signed JWT
 */
export const generateAccessToken = (userId, email) => {
    return jwt.sign(
        { id: userId, email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

/**
 * Verify a JWT access token.
 * @param {string} token
 * @returns {object} decoded payload
 * @throws if invalid or expired
 */
export const verifyToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET);
};
