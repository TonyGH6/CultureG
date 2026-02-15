import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import * as queueController from "./queue.controller";

export const queueRouter = Router();

queueRouter.post("/join", requireAuth, asyncHandler(queueController.join));
queueRouter.post("/leave", requireAuth, asyncHandler(queueController.leave));
