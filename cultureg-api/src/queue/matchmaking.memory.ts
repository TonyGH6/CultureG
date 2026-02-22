// In-memory matchmaking queue (MVP). Resets on server restart.

export type QueueEntry = {
    userId: string;
    theme: string;
    mode: string;
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
const userToKey = new Map<string, string>();

function queueKey(theme: string, mode: string): string {
    return `${theme}:${mode}`;
}

function getQueue(key: string): QueueEntry[] {
    const q = queues.get(key);
    if (q) return q;
    const fresh: QueueEntry[] = [];
    queues.set(key, fresh);
    return fresh;
}

export function getQueueSize(theme: string, mode: string = "CLASSIC"): number {
    return getQueue(queueKey(theme, mode)).length;
}

export function leaveQueue(userId: string): void {
    const key = userToKey.get(userId);
    if (!key) return;

    const q = getQueue(key);
    const idx = q.findIndex((e) => e.userId === userId);
    if (idx >= 0) q.splice(idx, 1);

    userToKey.delete(userId);
}

/**
 * Attempt to find an opponent already waiting in the queue for the same theme.
 * If found, removes opponent from queue and returns their userId + duelId.
 */
export function joinQueue(params: {
    userId: string;
    theme: string;
    mode: string;
    elo: number;
}): MatchFound | MatchNotFound {
    const { userId, theme, mode, elo } = params;

    leaveQueue(userId);

    const key = queueKey(theme, mode);
    const q = getQueue(key);
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
        userToKey.delete(opponent.userId);

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
    mode: string;
    elo: number;
    duelId: string;
}): void {
    const { userId, theme, mode, elo, duelId } = params;

    leaveQueue(userId);

    const key = queueKey(theme, mode);
    const q = getQueue(key);
    q.push({ userId, theme, mode, elo, duelId, joinedAt: Date.now() });
    userToKey.set(userId, key);
}
