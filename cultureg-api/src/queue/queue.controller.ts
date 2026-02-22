import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import { joinQueueSchema } from "./queue.validators";
import * as queueService from "./queue.service";

export async function join(req: AuthRequest, res: Response) {
    const parsed = joinQueueSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }

    const result = await queueService.join({
        userId: req.userId!,
        theme: parsed.data.theme,
        mode: parsed.data.mode,
    });

    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(200).json(result);
}

export async function leave(req: AuthRequest, res: Response) {
    const result = await queueService.leave(req.userId!);
    if (!result.ok) return res.status(result.status).json({ error: result.error });

    return res.status(200).json(result);
}
