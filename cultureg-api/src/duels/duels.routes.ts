import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import type { AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { submitDuelSchema } from "./duels.validators";
import * as duelService from "./duels.service";

export const duelsRouter = Router();

duelsRouter.get(
    "/:duelId",
    requireAuth,
    asyncHandler(async (req: AuthRequest, res) => {
        const duelId = String(req.params.duelId);

        const result = await duelService.getDuel({ userId: req.userId!, duelId });
        if (!result.ok) return res.status(result.status).json({ error: result.error });

        return res.json(result);
    })
);

duelsRouter.post(
    "/:duelId/submit",
    requireAuth,
    asyncHandler(async (req: AuthRequest, res) => {
        const duelId = String(req.params.duelId);

        const parsed = submitDuelSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
        }

        const result = await duelService.submitDuelAnswers({
            userId: req.userId!,
            duelId,
            answers: parsed.data.answers,
        });

        if (!result.ok) return res.status(result.status).json({ error: result.error });
        return res.json(result);
    })
);

duelsRouter.post(
    "/:duelId/leave",
    requireAuth,
    asyncHandler(async (req: AuthRequest, res) => {
        const duelId = String(req.params.duelId);

        const result = await duelService.leaveDuel({ userId: req.userId!, duelId });
        if (!result.ok) return res.status(result.status).json({ error: result.error });

        return res.json({ left: true });
    })
);
