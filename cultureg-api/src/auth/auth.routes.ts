import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { prisma } from "../shared/prisma";
import { env } from "../env";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";

export const authRouter = Router();

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: "Too many authentication attempts, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
});

const registerSchema = z.object({
    email: z.string().email(),
    username: z.string().min(3).max(20),
    password: z.string().min(8).max(72),
});

authRouter.post(
    "/register",
    authLimiter,
    asyncHandler(async (req, res) => {
        const parsed = registerSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
        }

        const { email, username, password } = parsed.data;
        const passwordHash = await bcrypt.hash(password, 10);

        try {
            const user = await prisma.user.create({
                data: { email, username, passwordHash },
                select: { id: true, email: true, username: true, elo: true, createdAt: true },
            });

            const token = jwt.sign({ sub: user.id }, env.JWT_SECRET, { expiresIn: "7d" });
            return res.status(201).json({ token, user });
        } catch {
            return res.status(409).json({ error: "Email or username already used" });
        }
    })
);

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

authRouter.post(
    "/login",
    authLimiter,
    asyncHandler(async (req, res) => {
        const parsed = loginSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
        }

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(401).json({ error: "Invalid credentials" });

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return res.status(401).json({ error: "Invalid credentials" });

        const token = jwt.sign({ sub: user.id }, env.JWT_SECRET, { expiresIn: "7d" });

        return res.json({
            token,
            user: { id: user.id, email: user.email, username: user.username, elo: user.elo, createdAt: user.createdAt },
        });
    })
);

authRouter.get(
    "/me",
    requireAuth,
    asyncHandler(async (req: AuthRequest, res) => {
        const user = await prisma.user.findUnique({
            where: { id: req.userId! },
            select: { id: true, email: true, username: true, elo: true, createdAt: true },
        });
        return res.json({ user });
    })
);
