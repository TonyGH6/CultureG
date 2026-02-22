"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findMany = findMany;
exports.findManyByTheme = findManyByTheme;
exports.findManyByIds = findManyByIds;
exports.findIdsByTheme = findIdsByTheme;
const prisma_1 = require("../shared/prisma");
async function findMany(params) {
    const { theme, limit } = params;
    return prisma_1.prisma.question.findMany({
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
async function findManyByTheme(theme) {
    return prisma_1.prisma.question.findMany({
        where: { theme },
        include: {
            options: {
                select: { id: true, label: true, orderIndex: true },
                orderBy: { orderIndex: "asc" },
            },
        },
    });
}
async function findManyByIds(ids) {
    return prisma_1.prisma.question.findMany({
        where: { id: { in: ids } },
        include: {
            options: {
                select: { id: true, label: true, isCorrect: true, orderIndex: true },
                orderBy: { orderIndex: "asc" },
            },
        },
    });
}
async function findIdsByTheme(theme) {
    return prisma_1.prisma.question.findMany({
        where: { theme },
        select: { id: true },
    });
}
