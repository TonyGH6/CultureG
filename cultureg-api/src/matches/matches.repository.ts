import { prisma } from "../shared/prisma";

export async function createMatch(data: {
    userId: string;
    theme: string;
    questions: { questionId: string; orderIndex: number }[];
}) {
    return prisma.match.create({
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

export async function findByIdAndUser(matchId: string, userId: string) {
    return prisma.match.findFirst({
        where: { id: matchId, userId },
        include: { questions: true },
    });
}

export async function createAnswersAndFinish(params: {
    matchId: string;
    answers: { matchId: string; questionId: string; optionId: string; timeMs: number | null }[];
    score: number;
    eloBefore: number;
    eloAfter: number;
}) {
    return prisma.$transaction([
        prisma.matchAnswer.createMany({
            data: params.answers,
            skipDuplicates: true,
        }),
        prisma.match.update({
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

export async function findHistoryByUser(userId: string, limit: number) {
    return prisma.match.findMany({
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
