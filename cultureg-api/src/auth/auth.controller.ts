import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import { registerSchema, loginSchema } from "./auth.validator";
import * as authService from "./auth.service";

export async function register(req: AuthRequest, res: Response) {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const result = await authService.register(parsed.data);
    if (!result.ok) return res.status(result.status).json({ error: result.error });

    return res.status(201).json(result);
}

export async function login(req: AuthRequest, res: Response) {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const result = await authService.login(parsed.data);
    if (!result.ok) return res.status(result.status).json({ error: result.error });

    return res.json(result);
}

export async function getMe(req: AuthRequest, res: Response) {
    const result = await authService.getMe(req.userId!);
    if (!result.ok) return res.status(result.status).json({ error: result.error });

    return res.json(result);
}
