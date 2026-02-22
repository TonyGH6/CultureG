"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = asyncHandler;
exports.errorHandler = errorHandler;
const logger_1 = require("../shared/logger");
/**
 * Wrap an async route handler so thrown errors are forwarded to Express error middleware.
 * This eliminates the need for try/catch in every controller.
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
/**
 * Global error middleware — must be registered LAST with app.use().
 * Catches anything thrown or passed via next(err).
 */
function errorHandler(err, _req, res, _next) {
    const status = typeof err.status === "number" ? err.status : 500;
    const message = err.message ?? "Internal server error";
    if (status >= 500) {
        logger_1.logger.error({ err }, "Unhandled error");
    }
    else {
        logger_1.logger.warn({ status, message }, "Client error");
    }
    return res.status(status).json({ error: message });
}
