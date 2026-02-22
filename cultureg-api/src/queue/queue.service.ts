import { ok, err, type ServiceResult } from "../shared/result";
import * as queueRepo from "./queue.repository";
import {
    joinQueue,
    leaveQueue,
    getQueueSize,
    enqueueWaiting,
} from "./matchmaking.memory";
import * as duelService from "../duels/duels.service";

type JoinQueueInput = {
    userId: string;
    theme: string;
    mode: string;
};

type JoinQueueResult =
    | { queued: true; theme: string; mode: string; duelId: string; queueSize: number }
    | { queued: false; matched: true; theme: string; mode: string; duelId: string; opponentUserId: string };

export async function join(input: JoinQueueInput): Promise<ServiceResult<JoinQueueResult>> {
    const { userId, theme, mode } = input;

    // Guard: already in ongoing duel
    const existingOngoing = await queueRepo.findOngoingDuelForUser(userId);
    if (existingOngoing) {
        return err(409, "Already in an ongoing duel");
    }

    // Guard: already has a WAITING duel for this theme+mode
    const existingWaiting = await queueRepo.findWaitingDuelForUserAndTheme(userId, theme, mode);
    if (existingWaiting) {
        const elo = await queueRepo.getUserElo(userId);

        enqueueWaiting({
            userId,
            theme,
            mode,
            elo,
            duelId: existingWaiting.id,
        });

        return ok({
            queued: true as const,
            theme,
            mode,
            duelId: existingWaiting.id,
            queueSize: getQueueSize(theme, mode),
        });
    }

    const elo = await queueRepo.getUserElo(userId);

    const result = joinQueue({ userId, theme, mode, elo });

    // No opponent → create WAITING duel + enqueue
    if (!result.found) {
        const durationSec = mode === "FRENZY" ? 60 : undefined;
        const created = await duelService.createWaitingDuel({ userId, theme, mode, durationSec });

        if (!created.ok) {
            return err(400, "Could not create duel");
        }

        enqueueWaiting({
            userId,
            theme,
            mode,
            elo,
            duelId: created.duelId,
        });

        return ok({
            queued: true as const,
            theme,
            mode,
            duelId: created.duelId,
            queueSize: getQueueSize(theme, mode),
        });
    }

    // Opponent found → join their duel
    const started = await duelService.joinAndStartDuel({
        duelId: result.opponentDuelId,
        joinerUserId: userId,
        theme,
        limit: 10,
    });

    if (!started.ok) {
        return err(started.status, started.error);
    }

    return ok({
        queued: false as const,
        matched: true as const,
        theme,
        mode,
        duelId: result.opponentDuelId,
        opponentUserId: result.opponentUserId,
    });
}

export async function leave(userId: string): Promise<ServiceResult<{ left: true }>> {
    leaveQueue(userId);

    // Cancel orphaned WAITING duels
    const waitingDuels = await queueRepo.findWaitingDuelsForUser(userId);

    for (const d of waitingDuels) {
        await queueRepo.cancelDuel(d.id);
    }

    return ok({ left: true as const });
}
