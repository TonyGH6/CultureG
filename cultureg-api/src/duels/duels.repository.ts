import { prisma } from "../shared/prisma";

/** Find active (WAITING or ONGOING) duel for a user */
export async function findActiveDuelForUser(userId: string) {
    return prisma.duel.findFirst({
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
export async function hasUserSubmitted(duelId: string, userId: string) {
    return prisma.duelAnswer.findFirst({
        where: { duelId, playerUserId: userId },
    });
}

/** Find duel by ID with full details for a player */
export async function findByIdForUser(duelId: string, userId: string) {
    return prisma.duel.findFirst({
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
export async function findForSubmission(duelId: string, userId: string) {
    return prisma.duel.findFirst({
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
export async function findByIdForPlayer(duelId: string, userId: string) {
    return prisma.duel.findFirst({
        where: {
            id: duelId,
            players: { some: { userId } },
        },
        select: { id: true, status: true },
    });
}

/** Find duel by ID with basic info */
export async function findById(duelId: string) {
    return prisma.duel.findUnique({
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
export async function createWaiting(userId: string, theme: string, mode: string = "CLASSIC", durationSec?: number) {
    return prisma.duel.create({
        data: {
            theme,
            mode: mode as any,
            durationSec: durationSec ?? null,
            status: "WAITING",
            players: { create: [{ userId }] },
        },
        select: { id: true, theme: true, status: true, mode: true, durationSec: true },
    });
}

/** Add player, questions and start duel — transaction */
export async function joinAndStart(params: {
    duelId: string;
    joinerUserId: string;
    questionIds: string[];
}) {
    const { duelId, joinerUserId, questionIds } = params;

    return prisma.$transaction([
        prisma.duelPlayer.create({
            data: { duelId, userId: joinerUserId },
        }),
        prisma.duelQuestion.createMany({
            data: questionIds.map((qId, idx) => ({
                duelId,
                questionId: qId,
                orderIndex: idx,
            })),
            skipDuplicates: true,
        }),
        prisma.duel.update({
            where: { id: duelId },
            data: { status: "ONGOING", startedAt: new Date() },
        }),
    ]);
}

/** Get all players for a duel */
export async function findPlayersByDuelId(duelId: string) {
    return prisma.duelPlayer.findMany({
        where: { duelId },
        select: { userId: true, score: true },
    });
}

/** Save duel answers and update player score — transaction */
export async function saveAnswersAndScore(params: {
    duelId: string;
    userId: string;
    answers: { duelId: string; playerUserId: string; questionId: string; optionId: string; timeMs?: number }[];
    score: number;
}) {
    return prisma.$transaction([
        prisma.duelAnswer.createMany({
            data: params.answers,
            skipDuplicates: true,
        }),
        prisma.duelPlayer.update({
            where: { duelId_userId: { duelId: params.duelId, userId: params.userId } },
            data: { score: params.score },
        }),
    ]);
}

/** Finish duel and update Elo for both players — transaction */
export async function finishDuelAndUpdateElo(params: {
    duelId: string;
    player1: { userId: string; newElo: number };
    player2: { userId: string; newElo: number };
}) {
    return prisma.$transaction([
        prisma.duel.update({
            where: { id: params.duelId },
            data: { status: "FINISHED", finishedAt: new Date() },
        }),
        prisma.user.update({
            where: { id: params.player1.userId },
            data: { elo: params.player1.newElo },
        }),
        prisma.user.update({
            where: { id: params.player2.userId },
            data: { elo: params.player2.newElo },
        }),
    ]);
}

/** Remove player from duel */
export async function removePlayer(duelId: string, userId: string) {
    return prisma.duelPlayer.delete({
        where: { duelId_userId: { duelId, userId } },
    });
}

/** Count remaining players */
export async function countPlayers(duelId: string) {
    return prisma.duelPlayer.count({ where: { duelId } });
}

/** Delete duel */
export async function deleteDuel(duelId: string) {
    return prisma.duel.delete({ where: { id: duelId } });
}

/** Expire stale ONGOING duels */
export async function expireOngoingDuels(cutoff: Date) {
    return prisma.duel.updateMany({
        where: {
            status: "ONGOING",
            startedAt: { lt: cutoff },
        },
        data: { status: "FINISHED", finishedAt: new Date() },
    });
}

/** Cancel stale WAITING duels */
export async function cancelWaitingDuels(cutoff: Date) {
    return prisma.duel.updateMany({
        where: {
            status: "WAITING",
            createdAt: { lt: cutoff },
        },
        data: { status: "CANCELED" },
    });
}

/** Find recently expired duels for notification */
export async function findRecentlyExpiredDuels(cutoff: Date) {
    return prisma.duel.findMany({
        where: {
            status: "FINISHED",
            finishedAt: { gte: new Date(Date.now() - 5000) },
            startedAt: { lt: cutoff },
        },
        select: { id: true },
    });
}

/** Get users Elo by IDs */
export async function getUsersElo(userIds: string[]) {
    return prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, elo: true },
    });
}

/** Check if a user is a player in a duel */
export async function isPlayerInDuel(duelId: string, userId: string) {
    return prisma.duelPlayer.findUnique({
        where: { duelId_userId: { duelId, userId } },
    });
}
