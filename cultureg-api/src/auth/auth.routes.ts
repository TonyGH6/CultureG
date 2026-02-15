import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import * as authController from "./auth.controller";

export const authRouter = Router();

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Too many authentication attempts, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
});

authRouter.post("/register", authLimiter, asyncHandler(authController.register));
authRouter.post("/login", authLimiter, asyncHandler(authController.login));
authRouter.get("/me", requireAuth, asyncHandler(authController.getMe));
