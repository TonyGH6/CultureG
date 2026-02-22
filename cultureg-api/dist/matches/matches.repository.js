"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMatch = createMatch;
exports.findByIdAndUser = findByIdAndUser;
exports.createAnswersAndFinish = createAnswersAndFinish;
exports.findHistoryByUser = findHistoryByUser;
const prisma_1 = require("../shared/prisma");
async function createMatch(data) {
    return prisma_1.prisma.match.create({
        data: {
            userId: data.userId,
            theme: data.theme,
            questions: {
                create: data.questions.map((q) => ({
                    questionId: q.questionId,
                    orderIndex: q.orderIndex,
                })),
            },
        },
        select: { id: true, theme: true },
    });
}
async function findByIdAndUser(matchId, userId) {
    return prisma_1.prisma.match.findFirst({
        where: { id: matchId, userId },
        include: { questions: true },
    });
}
async function createAnswersAndFinish(params) {
    return prisma_1.prisma.$transaction([
        prisma_1.prisma.matchAnswer.createMany({
            data: params.answers,
            skipDuplicates: true,
        }),
        prisma_1.prisma.match.update({
            where: { id: params.matchId },
            data: {
                status: "FINISHED",
                score: params.score,
                eloBefore: params.eloBefore,
                eloAfter: params.eloAfter,
                finishedAt: new Date(),
            },
        }),
    ]);
}
async function findHistoryByUser(userId, limit) {
    return prisma_1.prisma.match.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
            id: true,
            theme: true,
            status: true,
            score: true,
            createdAt: true,
            finishedAt: true,
            eloBefore: true,
            eloAfter: true,
        },
    });
}
