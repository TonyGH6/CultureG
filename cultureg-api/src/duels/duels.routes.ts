import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import * as duelsController from "./duels.controller";

export const duelsRouter = Router();

duelsRouter.get("/active", requireAuth, asyncHandler(duelsController.getActive));
duelsRouter.get("/:duelId", requireAuth, asyncHandler(duelsController.getById));
duelsRouter.post("/:duelId/submit", requireAuth, asyncHandler(duelsController.submit));
duelsRouter.post("/:duelId/leave", requireAuth, asyncHandler(duelsController.leave));
