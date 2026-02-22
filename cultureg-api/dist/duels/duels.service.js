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
exports.expireStaleduels = expireStaleduels;
exports.getActiveDuel = getActiveDuel;
exports.createWaitingDuel = createWaitingDuel;
exports.joinAndStartDuel = joinAndStartDuel;
exports.getDuel = getDuel;
exports.submitDuelAnswers = submitDuelAnswers;
exports.leaveDuel = leaveDuel;
const ws_1 = require("../ws");
const logger_1 = require("../shared/logger");
const result_1 = require("../shared/result");
const elo_1 = require("./elo");
const duelsRepo = __importStar(require("./duels.repository"));
const questionsRepo = __importStar(require("../questions/questions.repository"));
const duels_mapper_1 = require("./duels.mapper");
/** Duels older than this (ms) are auto-expired */
const DUEL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
/**
 * Expire all ONGOING duels that started more than DUEL_TIMEOUT_MS ago,
 * and cancel all WAITING duels older than the same threshold.
 */
async function expireStaleduels() {
    const cutoff = new Date(Date.now() - DUEL_TIMEOUT_MS);
    const expired = await duelsRepo.expireOngoingDuels(cutoff);
    const canceled = await duelsRepo.cancelWaitingDuels(cutoff);
    const total = expired.count + canceled.count;
    if (total > 0) {
        logger_1.logger.info({ expiredOngoing: expired.count, canceledWaiting: canceled.count }, "Expired stale duels");
        if (expired.count > 0) {
            const expiredDuels = await duelsRepo.findRecentlyExpiredDuels(cutoff);
            for (const d of expiredDuels) {
                ws_1.io?.to(`duel:${d.id}`).emit("duel:expired", { duelId: d.id, reason: "timeout" });
            }
        }
    }
    return total;
}
/**
 * Find a user's active duel (WAITING or ONGOING).
 * Used for reconnection after page refresh / disconnect.
 */
async function getActiveDuel(params) {
    const { userId } = params;
    const duel = await duelsRepo.findActiveDuelForUser(userId);
    if (!duel)
        return (0, result_1.ok)(null);
    const alreadySubmitted = await duelsRepo.hasUserSubmitted(duel.id, userId);
    return (0, result_1.ok)({
        duel: (0, duels_mapper_1.toActiveDuelDto)(duel, !!alreadySubmitted),
    });
}
async function createWaitingDuel(params) {
    const mode = params.mode ?? "CLASSIC";
    const durationSec = params.durationSec ?? (mode === "FRENZY" ? 60 : undefined);
    const duel = await duelsRepo.createWaiting(params.userId, params.theme, mode, durationSec);
    return (0, result_1.ok)({ duelId: duel.id, theme: duel.theme, status: duel.status, mode: duel.mode });
}
async function joinAndStartDuel(params) {
    const { duelId, joinerUserId, theme } = params;
    const duel = await duelsRepo.findById(duelId);
    if (!duel)
        return (0, result_1.err)(404, "Duel not found");
    if (duel.theme !== theme)
        return (0, result_1.err)(400, "Theme mismatch");
    if (duel.status !== "WAITING")
        return (0, result_1.err)(400, "Duel is not joinable");
    // FRENZY gets 30 questions, CLASSIC gets 10
    const limit = duel.mode === "FRENZY" ? 30 : params.limit;
    const alreadyIn = duel.players.some((p) => p.userId === joinerUserId);
    if (alreadyIn)
        return (0, result_1.err)(400, "Already joined");
    // Pick random questions
    const allQuestions = await questionsRepo.findIdsByTheme(theme);
    if (allQuestions.length < limit) {
        return (0, result_1.err)(400, "Not enough questions for this theme");
    }
    const shuffled = allQuestions.sort(() => Math.random() - 0.5);
    const questionIds = shuffled.slice(0, limit).map((q) => q.id);
    logger_1.logger.info({ duelId, count: questionIds.length, theme }, "Duel: locking questions");
    // Transaction FIRST, then notify
    await duelsRepo.joinAndStart({ duelId, joinerUserId, questionIds });
    // Notify AFTER commit
    const startPayload = { duelId, theme, durationSec: duel.durationSec ?? null };
    ws_1.io?.to(`duel:${duelId}`).emit("duel:started", startPayload);
    // Also emit to user-specific rooms so no one misses it
    const allPlayers = await duelsRepo.findPlayersByDuelId(duelId);
    for (const p of allPlayers) {
        ws_1.io?.to(`user:${p.userId}`).emit("duel:started", startPayload);
    }
    // If FRENZY: schedule server-side timeout to force-submit players who haven't answered
    if (duel.durationSec) {
        const timeoutMs = duel.durationSec * 1000;
        setTimeout(async () => {
            try {
                const current = await duelsRepo.findById(duelId);
                if (!current || current.status !== "ONGOING")
                    return;
                // Notify all players that time is up
                ws_1.io?.to(`duel:${duelId}`).emit("duel:timeout", { duelId });
                for (const p of allPlayers) {
                    ws_1.io?.to(`user:${p.userId}`).emit("duel:timeout", { duelId });
                }
                // Auto-submit empty answers for players who haven't submitted yet
                const players = await duelsRepo.findPlayersByDuelId(duelId);
                for (const player of players) {
                    const alreadySubmitted = await duelsRepo.hasUserSubmitted(duelId, player.userId);
                    if (!alreadySubmitted) {
                        logger_1.logger.info({ duelId, userId: player.userId }, "FRENZY timeout: auto-submitting for player");
                        await submitDuelAnswers({ userId: player.userId, duelId, answers: [] });
                    }
                }
            }
            catch (e) {
                logger_1.logger.error({ err: e, duelId }, "FRENZY timeout handler failed");
            }
        }, timeoutMs);
        logger_1.logger.info({ duelId, durationSec: duel.durationSec }, "FRENZY timer started server-side");
    }
    return (0, result_1.ok)({ duelId });
}
async function getDuel(params) {
    const duel = await duelsRepo.findByIdForUser(params.duelId, params.userId);
    if (!duel)
        return (0, result_1.err)(404, "Duel not found");
    return (0, result_1.ok)({ duel: (0, duels_mapper_1.toDuelDetailDto)(duel) });
}
async function submitDuelAnswers(params) {
    const { userId, duelId, answers } = params;
    const duel = await duelsRepo.findForSubmission(duelId, userId);
    if (!duel)
        return (0, result_1.err)(404, "Duel not found");
    if (duel.status !== "ONGOING")
        return (0, result_1.err)(400, "Duel is not ongoing");
    // Guard: already submitted
    const existingAnswers = await duelsRepo.hasUserSubmitted(duelId, userId);
    if (existingAnswers)
        return (0, result_1.err)(400, "Already submitted answers for this duel");
    const allowedQuestionIds = new Set(duel.questions.map((dq) => dq.questionId));
    for (const a of answers) {
        if (!allowedQuestionIds.has(a.questionId)) {
            return (0, result_1.err)(400, "Answer contains a question not in this duel");
        }
    }
    // Fetch full question data with options for detailed feedback
    const questions = await questionsRepo.findManyByIds(Array.from(allowedQuestionIds));
    const questionMap = new Map(questions.map((q) => [q.id, q]));
    let score = 0;
    const details = answers.map((a) => {
        const question = questionMap.get(a.questionId);
        if (!question) {
            return {
                questionId: a.questionId,
                prompt: "Question not found",
                explanation: null,
                imageUrl: null,
                isCorrect: false,
                userAnswerId: a.optionId,
                correctAnswerId: "",
                options: [],
            };
        }
        const detail = (0, duels_mapper_1.toDuelAnswerDetailDto)(question, a);
        if (detail.isCorrect)
            score += 1;
        return detail;
    });
    await duelsRepo.saveAnswersAndScore({
        duelId,
        userId,
        answers: answers.map((a) => ({
            duelId,
            playerUserId: userId,
            questionId: a.questionId,
            optionId: a.optionId,
            timeMs: a.timeMs,
        })),
        score,
    });
    // Check if both players submitted
    const playersWithScores = await duelsRepo.findPlayersByDuelId(duelId);
    const allSubmitted = playersWithScores.every((p) => p.score !== null);
    if (allSubmitted) {
        // Determine winner
        const sortedByScore = [...playersWithScores].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        const topScore = sortedByScore[0].score ?? 0;
        const winnersCount = sortedByScore.filter((p) => p.score === topScore).length;
        const isDraw = winnersCount > 1;
        const winnerId = isDraw ? null : sortedByScore[0].userId;
        // Compute Elo deltas
        const users = await duelsRepo.getUsersElo(playersWithScores.map((p) => p.userId));
        const eloMap = new Map(users.map((u) => [u.id, u.elo]));
        const [p1, p2] = playersWithScores;
        const p1Elo = eloMap.get(p1.userId) ?? 1000;
        const p2Elo = eloMap.get(p2.userId) ?? 1000;
        const p1Result = isDraw ? "draw" : p1.userId === winnerId ? "win" : "loss";
        const p2Result = isDraw ? "draw" : p2.userId === winnerId ? "win" : "loss";
        const p1Delta = (0, elo_1.eloDeltaDuel)(p1Elo, p2Elo, p1Result);
        const p2Delta = (0, elo_1.eloDeltaDuel)(p2Elo, p1Elo, p2Result);
        await duelsRepo.finishDuelAndUpdateElo({
            duelId,
            player1: { userId: p1.userId, newElo: Math.max(0, p1Elo + p1Delta) },
            player2: { userId: p2.userId, newElo: Math.max(0, p2Elo + p2Delta) },
        });
        ws_1.io?.to(`duel:${duelId}`).emit("duel:finished", {
            duelId,
            players: playersWithScores.map((p) => ({
                userId: p.userId,
                score: p.score,
                eloDelta: p.userId === p1.userId ? p1Delta : p2Delta,
            })),
            winnerId,
            isDraw,
        });
    }
    return (0, result_1.ok)({
        duelId,
        score,
        total: duel.questions.length,
        details,
    });
}
async function leaveDuel(params) {
    const { userId, duelId } = params;
    const duel = await duelsRepo.findByIdForPlayer(duelId, userId);
    if (!duel)
        return (0, result_1.err)(404, "Duel not found");
    if (duel.status !== "FINISHED")
        return (0, result_1.err)(400, "Can only leave a finished duel");
    await duelsRepo.removePlayer(duelId, userId);
    const remainingPlayers = await duelsRepo.countPlayers(duelId);
    if (remainingPlayers === 0) {
        await duelsRepo.deleteDuel(duelId);
    }
    return (0, result_1.ok)({});
}
