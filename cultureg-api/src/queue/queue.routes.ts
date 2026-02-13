import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import type { AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { joinQueueSchema } from "./queue.validators";
import { prisma } from "../shared/prisma";
import {
    joinQueue,
    leaveQueue,
    getQueueSize,
    enqueueWaiting,
} from "./matchmaking.memory";
import * as duelService from "../duels/duels.service";

export const queueRouter = Router();

queueRouter.post(
    "/join",
    requireAuth,
    asyncHandler(async (req: AuthRequest, res) => {
        const parsed = joinQueueSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
        }

        // Guard: already in ongoing duel
        const existingOngoing = await prisma.duel.findFirst({
            where: {
                status: "ONGOING",
                players: { some: { userId: req.userId! } },
            },
            select: { id: true, theme: true },
        });

        if (existingOngoing) {
            return res.status(409).json({
                error: "Already in an ongoing duel",
                duelId: existingOngoing.id,
                theme: existingOngoing.theme,
            });
        }

        // Guard: already has a WAITING duel for this theme
        const existingWaiting = await prisma.duel.findFirst({
            where: {
                status: "WAITING",
                theme: parsed.data.theme,
                players: { some: { userId: req.userId! } },
            },
            select: { id: true },
        });

        if (existingWaiting) {
            const userElo = await prisma.user.findUnique({
                where: { id: req.userId! },
                select: { elo: true },
            });
            const elo = userElo?.elo ?? 1000;

            enqueueWaiting({
                userId: req.userId!,
                theme: parsed.data.theme,
                elo,
                duelId: existingWaiting.id,
            });

            return res.status(200).json({
                queued: true,
                theme: parsed.data.theme,
                duelId: existingWaiting.id,
                queueSize: getQueueSize(parsed.data.theme),
            });
        }

        const user = await prisma.user.findUnique({
            where: { id: req.userId! },
            select: { elo: true },
        });
        const elo = user?.elo ?? 1000;

        const result = joinQueue({
            userId: req.userId!,
            theme: parsed.data.theme,
            elo,
        });

        // No opponent → create WAITING duel + enqueue
        if (!result.found) {
            const created = await duelService.createWaitingDuel({
                userId: req.userId!,
                theme: parsed.data.theme,
            });

            if (!created.ok) {
                return res.status(400).json({ error: "Could not create duel" });
            }

            enqueueWaiting({
                userId: req.userId!,
                theme: parsed.data.theme,
                elo,
                duelId: created.duelId,
            });

            return res.status(200).json({
                queued: true,
                theme: parsed.data.theme,
                duelId: created.duelId,
                queueSize: getQueueSize(parsed.data.theme),
            });
        }

        // Opponent found → join their duel
        const started = await duelService.joinAndStartDuel({
            duelId: result.opponentDuelId,
            joinerUserId: req.userId!,
            theme: parsed.data.theme,
            limit: 10,
        });

        if (!started.ok) {
            return res.status(started.status).json({ error: started.error });
        }

        return res.status(200).json({
            queued: false,
            matched: true,
            theme: parsed.data.theme,
            duelId: result.opponentDuelId,
            opponentUserId: result.opponentUserId,
        });
    })
);

queueRouter.post(
    "/leave",
    requireAuth,
    asyncHandler(async (req: AuthRequest, res) => {
        leaveQueue(req.userId!);

        // Cancel orphaned WAITING duels
        const waitingDuels = await prisma.duel.findMany({
            where: {
                status: "WAITING",
                players: { some: { userId: req.userId! } },
            },
            select: { id: true },
        });

        for (const d of waitingDuels) {
            await prisma.duel.update({
                where: { id: d.id },
                data: { status: "CANCELED" },
            });
        }

        return res.status(200).json({ left: true });
    })
);
