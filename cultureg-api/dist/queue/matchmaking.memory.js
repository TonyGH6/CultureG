"use strict";
// In-memory matchmaking queue (MVP). Resets on server restart.
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQueueSize = getQueueSize;
exports.leaveQueue = leaveQueue;
exports.joinQueue = joinQueue;
exports.enqueueWaiting = enqueueWaiting;
const queues = new Map();
const userToKey = new Map();
function queueKey(theme, mode) {
    return `${theme}:${mode}`;
}
function getQueue(key) {
    const q = queues.get(key);
    if (q)
        return q;
    const fresh = [];
    queues.set(key, fresh);
    return fresh;
}
function getQueueSize(theme, mode = "CLASSIC") {
    return getQueue(queueKey(theme, mode)).length;
}
function leaveQueue(userId) {
    const key = userToKey.get(userId);
    if (!key)
        return;
    const q = getQueue(key);
    const idx = q.findIndex((e) => e.userId === userId);
    if (idx >= 0)
        q.splice(idx, 1);
    userToKey.delete(userId);
}
/**
 * Attempt to find an opponent already waiting in the queue for the same theme.
 * If found, removes opponent from queue and returns their userId + duelId.
 */
function joinQueue(params) {
    const { userId, theme, mode, elo } = params;
    leaveQueue(userId);
    const key = queueKey(theme, mode);
    const q = getQueue(key);
    let bestIdx = -1;
    let bestDiff = Number.POSITIVE_INFINITY;
    for (let i = 0; i < q.length; i++) {
        const cand = q[i];
        if (cand.userId === userId)
            continue;
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
function enqueueWaiting(params) {
    const { userId, theme, mode, elo, duelId } = params;
    leaveQueue(userId);
    const key = queueKey(theme, mode);
    const q = getQueue(key);
    q.push({ userId, theme, mode, elo, duelId, joinedAt: Date.now() });
    userToKey.set(userId, key);
}
