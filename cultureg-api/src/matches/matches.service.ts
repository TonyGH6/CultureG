import { prisma } from "../shared/prisma";
import { eloDeltaSolo } from "./elo";
import { ok, err, type ServiceResult } from "../shared/result";

type StartMatchInput = {
    userId: string;
    theme: string;
    limit: number;
};

type SubmitMatchInput = {
    userId: string;
    matchId: string;
    answers: { questionId: string; optionId: string; timeMs?: number }[];
};

export async function startMatch({ userId, theme, limit }: StartMatchInput): Promise<ServiceResult<{
    matchId: string;
    theme: string;
    questions: { id: string; slug: string; prompt: string; options: { id: string; label: string; orderIndex: number }[] }[];
}>> {
    const allQuestions = await prisma.question.findMany({
        where: { theme },
        include: {
            options: {
                select: { id: true, label: true, orderIndex: true },
                orderBy: { orderIndex: "asc" },
            },
        },
    });

    if (allQuestions.length < limit) {
        return err(400, "Not enough questions for this theme");
    }

    const shuffled = allQuestions.sort(() => Math.random() - 0.5);
    const questions = shuffled.slice(0, limit);

    const match = await prisma.match.create({
        data: {
            userId,
            theme,
            questions: {
                create: questions.map((q, idx) => ({
                    questionId: q.id,
                    orderIndex: idx,
                })),
            },
        },
        select: { id: true, theme: true },
    });

    return ok({
        matchId: match.id,
        theme: match.theme,
        questions: questions.map((q) => ({
            id: q.id,
            slug: q.slug,
            prompt: q.prompt,
            options: q.options,
        })),
    });
}

export async function submitMatch({ userId, matchId, answers }: SubmitMatchInput): Promise<ServiceResult<{
    matchId: string;
    score: number;
    total: number;
    eloBefore: number;
    eloAfter: number;
    eloDelta: number;
    details: {
        questionId: string;
        prompt: string;
        isCorrect: boolean;
        userAnswerId: string;
        correctAnswerId: string;
        options: { id: string; label: string; isCorrect: boolean }[];
    }[];
}>> {
    const match = await prisma.match.findFirst({
        where: { id: matchId, userId },
        include: { questions: true },
    });

    if (!match) return err(404, "Match not found");
    if (match.status === "FINISHED") return err(400, "Match already finished");

    const allowedQuestionIds = new Set(match.questions.map((mq) => mq.questionId));

    for (const a of answers) {
        if (!allowedQuestionIds.has(a.questionId)) {
            return err(400, "Answer contains a question not in this match");
        }
    }

    // Fetch full question data with options
    const questions = await prisma.question.findMany({
        where: { id: { in: Array.from(allowedQuestionIds) } },
        include: {
            options: {
                select: { id: true, label: true, isCorrect: true, orderIndex: true },
                orderBy: { orderIndex: "asc" },
            },
        },
    });

    const questionMap = new Map(questions.map((q) => [q.id, q]));
    let score = 0;

    const details = answers.map((a) => {
        const question = questionMap.get(a.questionId);
        if (!question) {
            return {
                questionId: a.questionId,
                prompt: "Question not found",
                isCorrect: false,
                userAnswerId: a.optionId,
                correctAnswerId: "",
                options: [],
            };
        }

        const correctOption = question.options.find((opt) => opt.isCorrect);
        const userOption = question.options.find((opt) => opt.id === a.optionId);
        const isCorrect = userOption?.isCorrect === true;

        if (isCorrect) score += 1;

        return {
            questionId: a.questionId,
            prompt: question.prompt,
            isCorrect,
            userAnswerId: a.optionId,
            correctAnswerId: correctOption?.id ?? "",
            options: question.options.map((opt) => ({
                id: opt.id,
                label: opt.label,
                isCorrect: opt.isCorrect,
            })),
        };
    });

    const total = match.questions.length;
    const delta = eloDeltaSolo(score, total);

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { elo: true },
    });

    const eloBefore = user?.elo ?? 1000;
    const eloAfter = Math.max(0, eloBefore + delta);

    await prisma.$transaction([
        prisma.matchAnswer.createMany({
            data: answers.map((a) => ({
                matchId,
                questionId: a.questionId,
                optionId: a.optionId,
                timeMs: a.timeMs ?? null,
            })),
            skipDuplicates: true,
        }),
        prisma.match.update({
            where: { id: matchId },
            data: {
                status: "FINISHED",
                score,
                eloBefore,
                eloAfter,
                finishedAt: new Date(),
            },
        }),
        prisma.user.update({
            where: { id: userId },
            data: { elo: eloAfter },
        }),
    ]);

    return ok({ matchId, score, total, eloBefore, eloAfter, eloDelta: eloAfter - eloBefore, details });
}

export async function getMatchHistory(userId: string, limit: number) {
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
