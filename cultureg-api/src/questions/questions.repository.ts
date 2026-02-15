import { prisma } from "../shared/prisma";

export async function findMany(params: { theme?: string; limit: number }) {
    const { theme, limit } = params;

    return prisma.question.findMany({
        where: theme ? { theme } : undefined,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
            options: {
                select: { id: true, label: true, orderIndex: true },
                orderBy: { orderIndex: "asc" },
            },
        },
    });
}

export async function findManyByTheme(theme: string) {
    return prisma.question.findMany({
        where: { theme },
        include: {
            options: {
                select: { id: true, label: true, orderIndex: true },
                orderBy: { orderIndex: "asc" },
            },
        },
    });
}

export async function findManyByIds(ids: string[]) {
    return prisma.question.findMany({
        where: { id: { in: ids } },
        include: {
            options: {
                select: { id: true, label: true, isCorrect: true, orderIndex: true },
                orderBy: { orderIndex: "asc" },
            },
        },
    });
}

export async function findIdsByTheme(theme: string) {
    return prisma.question.findMany({
        where: { theme },
        select: { id: true },
    });
}
