"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.join = join;
exports.leave = leave;
const result_1 = require("../shared/result");
const queueRepo = __importStar(require("./queue.repository"));
const matchmaking_memory_1 = require("./matchmaking.memory");
const duelService = __importStar(require("../duels/duels.service"));
async function join(input) {
    const { userId, theme, mode } = input;
    // Guard: already in ongoing duel
    const existingOngoing = await queueRepo.findOngoingDuelForUser(userId);
    if (existingOngoing) {
        return (0, result_1.err)(409, "Already in an ongoing duel");
    }
    // Guard: already has a WAITING duel for this theme+mode
    const existingWaiting = await queueRepo.findWaitingDuelForUserAndTheme(userId, theme, mode);
    if (existingWaiting) {
        const elo = await queueRepo.getUserElo(userId);
        (0, matchmaking_memory_1.enqueueWaiting)({
            userId,
            theme,
            mode,
            elo,
            duelId: existingWaiting.id,
        });
        return (0, result_1.ok)({
            queued: true,
            theme,
            mode,
            duelId: existingWaiting.id,
            queueSize: (0, matchmaking_memory_1.getQueueSize)(theme, mode),
        });
    }
    const elo = await queueRepo.getUserElo(userId);
    const result = (0, matchmaking_memory_1.joinQueue)({ userId, theme, mode, elo });
    // No opponent → create WAITING duel + enqueue
    if (!result.found) {
        const durationSec = mode === "FRENZY" ? 60 : undefined;
        const created = await duelService.createWaitingDuel({ userId, theme, mode, durationSec });
        if (!created.ok) {
            return (0, result_1.err)(400, "Could not create duel");
        }
        (0, matchmaking_memory_1.enqueueWaiting)({
            userId,
            theme,
            mode,
            elo,
            duelId: created.duelId,
        });
        return (0, result_1.ok)({
            queued: true,
            theme,
            mode,
            duelId: created.duelId,
            queueSize: (0, matchmaking_memory_1.getQueueSize)(theme, mode),
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
        return (0, result_1.err)(started.status, started.error);
    }
    return (0, result_1.ok)({
        queued: false,
        matched: true,
        theme,
        mode,
        duelId: result.opponentDuelId,
        opponentUserId: result.opponentUserId,
    });
}
async function leave(userId) {
    (0, matchmaking_memory_1.leaveQueue)(userId);
    // Cancel orphaned WAITING duels
    const waitingDuels = await queueRepo.findWaitingDuelsForUser(userId);
    for (const d of waitingDuels) {
        await queueRepo.cancelDuel(d.id);
    }
    return (0, result_1.ok)({ left: true });
}
