"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findActiveDuelForUser = findActiveDuelForUser;
exports.hasUserSubmitted = hasUserSubmitted;
exports.findByIdForUser = findByIdForUser;
exports.findForSubmission = findForSubmission;
exports.findByIdForPlayer = findByIdForPlayer;
exports.findById = findById;
exports.createWaiting = createWaiting;
exports.joinAndStart = joinAndStart;
exports.findPlayersByDuelId = findPlayersByDuelId;
exports.saveAnswersAndScore = saveAnswersAndScore;
exports.finishDuelAndUpdateElo = finishDuelAndUpdateElo;
exports.removePlayer = removePlayer;
exports.countPlayers = countPlayers;
exports.deleteDuel = deleteDuel;
exports.expireOngoingDuels = expireOngoingDuels;
exports.cancelWaitingDuels = cancelWaitingDuels;
exports.findRecentlyExpiredDuels = findRecentlyExpiredDuels;
exports.getUsersElo = getUsersElo;
exports.isPlayerInDuel = isPlayerInDuel;
const prisma_1 = require("../shared/prisma");
/** Find active (WAITING or ONGOING) duel for a user */
async function findActiveDuelForUser(userId) {
    return prisma_1.prisma.duel.findFirst({
        where: {
            status: { in: ["WAITING", "ONGOING"] },
            players: { some: { userId } },
        },
        select: {
            id: true,
            theme: true,
            mode: true,
            durationSec: true,
            status: true,
            createdAt: true,
            startedAt: true,
            players: { select: { userId: true, joinedAt: true } },
            questions: {
                orderBy: { orderIndex: "asc" },
                select: {
                    orderIndex: true,
                    question: {
                        select: {
                            id: true,
                            slug: true,
                            prompt: true,
                            imageUrl: true,
                            options: {
                                select: { id: true, label: true, orderIndex: true },
                                orderBy: { orderIndex: "asc" },
                            },
                        },
                    },
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });
}
/** Check if user already submitted answers for a duel */
async function hasUserSubmitted(duelId, userId) {
    return prisma_1.prisma.duelAnswer.findFirst({
        where: { duelId, playerUserId: userId },
    });
}
/** Find duel by ID with full details for a player */
async function findByIdForUser(duelId, userId) {
    return prisma_1.prisma.duel.findFirst({
        where: {
            id: duelId,
            players: { some: { userId } },
        },
        select: {
            id: true,
            theme: true,
            mode: true,
            durationSec: true,
            status: true,
            createdAt: true,
            startedAt: true,
            players: { select: { userId: true, joinedAt: true } },
            questions: {
                orderBy: { orderIndex: "asc" },
                select: {
                    orderIndex: true,
                    question: {
                        select: {
                            id: true,
                            slug: true,
                            prompt: true,
                            imageUrl: true,
                            options: {
                                select: { id: true, label: true, orderIndex: true },
                                orderBy: { orderIndex: "asc" },
                            },
                        },
                    },
                },
            },
        },
    });
}
/** Find duel with questions and players for submission */
async function findForSubmission(duelId, userId) {
    return prisma_1.prisma.duel.findFirst({
        where: {
            id: duelId,
            players: { some: { userId } },
        },
        include: {
            questions: true,
            players: true,
        },
    });
}
/** Find duel by ID (status check) */
async function findByIdForPlayer(duelId, userId) {
    return prisma_1.prisma.duel.findFirst({
        where: {
            id: duelId,
            players: { some: { userId } },
        },
        select: { id: true, status: true },
    });
}
/** Find duel by ID with basic info */
async function findById(duelId) {
    return prisma_1.prisma.duel.findUnique({
        where: { id: duelId },
        select: {
            id: true,
            status: true,
            theme: true,
            mode: true,
            durationSec: true,
            players: { select: { userId: true } },
            questions: { select: { id: true } },
        },
    });
}
/** Create a WAITING duel */
async function createWaiting(userId, theme, mode = "CLASSIC", durationSec) {
    return prisma_1.prisma.duel.create({
        data: {
            theme,
            mode: mode,
            durationSec: durationSec ?? null,
            status: "WAITING",
            players: { create: [{ userId }] },
        },
        select: { id: true, theme: true, status: true, mode: true, durationSec: true },
    });
}
/** Add player, questions and start duel — transaction */
async function joinAndStart(params) {
    const { duelId, joinerUserId, questionIds } = params;
    return prisma_1.prisma.$transaction([
        prisma_1.prisma.duelPlayer.create({
            data: { duelId, userId: joinerUserId },
        }),
        prisma_1.prisma.duelQuestion.createMany({
            data: questionIds.map((qId, idx) => ({
                duelId,
                questionId: qId,
                orderIndex: idx,
            })),
            skipDuplicates: true,
        }),
        prisma_1.prisma.duel.update({
            where: { id: duelId },
            data: { status: "ONGOING", startedAt: new Date() },
        }),
    ]);
}
/** Get all players for a duel */
async function findPlayersByDuelId(duelId) {
    return prisma_1.prisma.duelPlayer.findMany({
        where: { duelId },
        select: { userId: true, score: true },
    });
}
/** Save duel answers and update player score — transaction */
async function saveAnswersAndScore(params) {
    return prisma_1.prisma.$transaction([
        prisma_1.prisma.duelAnswer.createMany({
            data: params.answers,
            skipDuplicates: true,
        }),
        prisma_1.prisma.duelPlayer.update({
            where: { duelId_userId: { duelId: params.duelId, userId: params.userId } },
            data: { score: params.score },
        }),
    ]);
}
/** Finish duel and update Elo for both players — transaction */
async function finishDuelAndUpdateElo(params) {
    return prisma_1.prisma.$transaction([
        prisma_1.prisma.duel.update({
            where: { id: params.duelId },
            data: { status: "FINISHED", finishedAt: new Date() },
        }),
        prisma_1.prisma.user.update({
            where: { id: params.player1.userId },
            data: { elo: params.player1.newElo },
        }),
        prisma_1.prisma.user.update({
            where: { id: params.player2.userId },
            data: { elo: params.player2.newElo },
        }),
    ]);
}
/** Remove player from duel */
async function removePlayer(duelId, userId) {
    return prisma_1.prisma.duelPlayer.delete({
        where: { duelId_userId: { duelId, userId } },
    });
}
/** Count remaining players */
async function countPlayers(duelId) {
    return prisma_1.prisma.duelPlayer.count({ where: { duelId } });
}
/** Delete duel */
async function deleteDuel(duelId) {
    return prisma_1.prisma.duel.delete({ where: { id: duelId } });
}
/** Expire stale ONGOING duels */
async function expireOngoingDuels(cutoff) {
    return prisma_1.prisma.duel.updateMany({
        where: {
            status: "ONGOING",
            startedAt: { lt: cutoff },
        },
        data: { status: "FINISHED", finishedAt: new Date() },
    });
}
/** Cancel stale WAITING duels */
async function cancelWaitingDuels(cutoff) {
    return prisma_1.prisma.duel.updateMany({
        where: {
            status: "WAITING",
            createdAt: { lt: cutoff },
        },
        data: { status: "CANCELED" },
    });
}
/** Find recently expired duels for notification */
async function findRecentlyExpiredDuels(cutoff) {
    return prisma_1.prisma.duel.findMany({
        where: {
            status: "FINISHED",
            finishedAt: { gte: new Date(Date.now() - 5000) },
            startedAt: { lt: cutoff },
        },
        select: { id: true },
    });
}
/** Get users Elo by IDs */
async function getUsersElo(userIds) {
    return prisma_1.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, elo: true },
    });
}
/** Check if a user is a player in a duel */
async function isPlayerInDuel(duelId, userId) {
    return prisma_1.prisma.duelPlayer.findUnique({
        where: { duelId_userId: { duelId, userId } },
    });
}
