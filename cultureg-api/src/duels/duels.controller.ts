import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import { submitDuelSchema } from "./duels.validators";
import * as duelService from "./duels.service";
import { enqueueWaiting } from "../queue/matchmaking.memory";
import { getUserElo } from "../queue/queue.repository";

export async function getActive(req: AuthRequest, res: Response) {
    const result = await duelService.getActiveDuel({ userId: req.userId! });
    if (!result.ok) return res.status(result.status).json({ error: result.error });

    // If the duel is WAITING, re-enqueue in memory so opponents can still find us
    const duel = (result as any).duel;
    if (duel?.status === "WAITING") {
        const elo = await getUserElo(req.userId!);
        enqueueWaiting({
            userId: req.userId!,
            theme: duel.theme,
            elo,
            duelId: duel.id,
        });
    }

    return res.json(result);
}

export async function getById(req: AuthRequest, res: Response) {
    const duelId = String(req.params.duelId);

    const result = await duelService.getDuel({ userId: req.userId!, duelId });
    if (!result.ok) return res.status(result.status).json({ error: result.error });

    return res.json(result);
}

export async function submit(req: AuthRequest, res: Response) {
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
}

export async function leave(req: AuthRequest, res: Response) {
    const duelId = String(req.params.duelId);

    const result = await duelService.leaveDuel({ userId: req.userId!, duelId });
    if (!result.ok) return res.status(result.status).json({ error: result.error });

    return res.json({ left: true });
}
