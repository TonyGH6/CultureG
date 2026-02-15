import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import * as matchesController from "./matches.controller";

export const matchesRouter = Router();

matchesRouter.post("/start", requireAuth, asyncHandler(matchesController.start));
matchesRouter.post("/:matchId/submit", requireAuth, asyncHandler(matchesController.submit));
matchesRouter.get("/history", requireAuth, asyncHandler(matchesController.history));
