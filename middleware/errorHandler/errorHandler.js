// middleware/errorHandler/errorHandler.js
const errorHandler = (err, req, res, next) => {
    // Default values
    const statusCode = err.statusCode || 500;
    const message = err.message || 'An unexpected error occurred';

    // Log the error with stack trace for debugging
    console.error('Error:', {
        message: err.message,
        stack: err.stack,
        method: req.method,
        path: req.path,
    });

    // Send JSON response
    res.status(statusCode).json({
        status: 'error',
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }), // Include stack trace in dev
    });
};

module.exports = errorHandler;