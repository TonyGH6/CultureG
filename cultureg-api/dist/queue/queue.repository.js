"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findOngoingDuelForUser = findOngoingDuelForUser;
exports.findWaitingDuelForUserAndTheme = findWaitingDuelForUserAndTheme;
exports.findWaitingDuelsForUser = findWaitingDuelsForUser;
exports.cancelDuel = cancelDuel;
exports.getUserElo = getUserElo;
const prisma_1 = require("../shared/prisma");
async function findOngoingDuelForUser(userId) {
    return prisma_1.prisma.duel.findFirst({
        where: {
            status: "ONGOING",
            players: { some: { userId } },
        },
        select: { id: true, theme: true },
    });
}
async function findWaitingDuelForUserAndTheme(userId, theme, mode = "CLASSIC") {
    return prisma_1.prisma.duel.findFirst({
        where: {
            status: "WAITING",
            theme,
            mode: mode,
            players: { some: { userId } },
        },
        select: { id: true },
    });
}
async function findWaitingDuelsForUser(userId) {
    return prisma_1.prisma.duel.findMany({
        where: {
            status: "WAITING",
            players: { some: { userId } },
        },
        select: { id: true },
    });
}
async function cancelDuel(duelId) {
    return prisma_1.prisma.duel.update({
        where: { id: duelId },
        data: { status: "CANCELED" },
    });
}
async function getUserElo(userId) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: { elo: true },
    });
    return user?.elo ?? 1000;
}
