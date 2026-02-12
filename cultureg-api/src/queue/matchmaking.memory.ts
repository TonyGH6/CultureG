// In-memory matchmaking queue (MVP). Resets on server restart.

export type QueueEntry = {
    userId: string;
    theme: string;
    elo: number;
    duelId: string;
    joinedAt: number;
};

export type MatchFound = {
    found: true;
    opponentUserId: string;
    opponentDuelId: string;
};

export type MatchNotFound = {
    found: false;
};

const queues = new Map<string, QueueEntry[]>();
const userToTheme = new Map<string, string>();

function getQueue(theme: string): QueueEntry[] {
    const q = queues.get(theme);
    if (q) return q;
    const fresh: QueueEntry[] = [];
    queues.set(theme, fresh);
    return fresh;
}

export function getQueueSize(theme: string): number {
    return getQueue(theme).length;
}

export function leaveQueue(userId: string): void {
    const theme = userToTheme.get(userId);
    if (!theme) return;

    const q = getQueue(theme);
    const idx = q.findIndex((e) => e.userId === userId);
    if (idx >= 0) q.splice(idx, 1);

    userToTheme.delete(userId);
}

/**
 * Attempt to find an opponent already waiting in the queue for the same theme.
 * If found, removes opponent from queue and returns their userId + duelId.
 */
export function joinQueue(params: {
    userId: string;
    theme: string;
    elo: number;
}): MatchFound | MatchNotFound {
    const { userId, theme, elo } = params;

    leaveQueue(userId);

    const q = getQueue(theme);
    let bestIdx = -1;
    let bestDiff = Number.POSITIVE_INFINITY;

    for (let i = 0; i < q.length; i++) {
        const cand = q[i];
        if (cand.userId === userId) continue;

        const diff = Math.abs(cand.elo - elo);
        if (diff < bestDiff) {
            bestDiff = diff;
            bestIdx = i;
        }
    }

    if (bestIdx >= 0) {
        const opponent = q.splice(bestIdx, 1)[0];
        userToTheme.delete(opponent.userId);

        return {
            found: true,
            opponentUserId: opponent.userId,
            opponentDuelId: opponent.duelId,
        };
    }

    return { found: false };
}

/**
 * Enqueue a user who already has a WAITING duelId.
 */
export function enqueueWaiting(params: {
    userId: string;
    theme: string;
    elo: number;
    duelId: string;
}): void {
    const { userId, theme, elo, duelId } = params;

    leaveQueue(userId);

    const q = getQueue(theme);
    q.push({ userId, theme, elo, duelId, joinedAt: Date.now() });
    userToTheme.set(userId, theme);
}
