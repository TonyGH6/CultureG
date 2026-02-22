import { prisma } from "../shared/prisma";

export async function findOngoingDuelForUser(userId: string) {
    return prisma.duel.findFirst({
        where: {
            status: "ONGOING",
            players: { some: { userId } },
        },
        select: { id: true, theme: true },
    });
}

export async function findWaitingDuelForUserAndTheme(userId: string, theme: string, mode: string = "CLASSIC") {
    return prisma.duel.findFirst({
        where: {
            status: "WAITING",
            theme,
            mode: mode as any,
            players: { some: { userId } },
        },
        select: { id: true },
    });
}

export async function findWaitingDuelsForUser(userId: string) {
    return prisma.duel.findMany({
        where: {
            status: "WAITING",
            players: { some: { userId } },
        },
        select: { id: true },
    });
}

export async function cancelDuel(duelId: string) {
    return prisma.duel.update({
        where: { id: duelId },
        data: { status: "CANCELED" },
    });
}

export async function getUserElo(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { elo: true },
    });
    return user?.elo ?? 1000;
}
