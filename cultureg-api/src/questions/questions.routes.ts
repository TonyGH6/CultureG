import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import * as questionsController from "./questions.controller";

export const questionsRouter = Router();

questionsRouter.get("/", asyncHandler(questionsController.list));
