import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import { startMatchSchema, submitMatchSchema, historyQuerySchema } from "./matches.validators";
import * as matchService from "./matches.service";

export async function start(req: AuthRequest, res: Response) {
    const parsed = startMatchSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const result = await matchService.startMatch({
        userId: req.userId!,
        theme: parsed.data.theme,
        limit: parsed.data.limit,
    });

    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(201).json(result);
}

export async function submit(req: AuthRequest, res: Response) {
    const matchId = String(req.params.matchId);

    const parsed = submitMatchSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const result = await matchService.submitMatch({
        userId: req.userId!,
        matchId,
        answers: parsed.data.answers,
    });

    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.json(result);
}

export async function history(req: AuthRequest, res: Response) {
    const parsed = historyQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: "Invalid query params" });

    const matches = await matchService.getMatchHistory(req.userId!, parsed.data.limit);
    return res.json({ matches });
}
