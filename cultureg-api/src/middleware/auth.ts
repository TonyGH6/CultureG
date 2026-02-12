import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env";

export type AuthRequest = Request & { userId?: string };

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing Bearer token" });
    }

    const token = header.slice("Bearer ".length);

    try {
        const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
        req.userId = payload.sub;
        next();
    } catch {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}
