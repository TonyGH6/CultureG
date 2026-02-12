import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "./auth";
import { logger } from "../shared/logger";

/**
 * Wrap an async route handler so thrown errors are forwarded to Express error middleware.
 * This eliminates the need for try/catch in every controller.
 */
export function asyncHandler(
    fn: (req: AuthRequest, res: Response, next: NextFunction) => Promise<any>
) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req as AuthRequest, res, next)).catch(next);
    };
}

/**
 * Global error middleware — must be registered LAST with app.use().
 * Catches anything thrown or passed via next(err).
 */
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
    const status = typeof err.status === "number" ? err.status : 500;
    const message = err.message ?? "Internal server error";

    if (status >= 500) {
        logger.error({ err }, "Unhandled error");
    } else {
        logger.warn({ status, message }, "Client error");
    }

    return res.status(status).json({ error: message });
}
