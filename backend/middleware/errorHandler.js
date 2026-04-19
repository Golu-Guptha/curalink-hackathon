/**
 * Global Error Handler Middleware
 * Catches all errors passed via next(err) and returns consistent JSON error responses.
 */
export const errorHandler = (err, req, res, next) => {
    console.error(`[Error] ${req.method} ${req.path} →`, err.message);

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    // Mongoose duplicate key (e.g. duplicate email)
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(409).json({
            error: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`
        });
    }

    // Mongoose CastError (invalid ObjectId)
    if (err.name === 'CastError') {
        return res.status(400).json({ error: 'Invalid resource ID format.' });
    }

    // Default: internal server error
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
        error: err.message || 'Internal Server Error',
    });
};
