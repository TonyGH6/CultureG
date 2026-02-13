import { prisma } from "../shared/prisma";
import { io } from "../ws";
import { logger } from "../shared/logger";
import { ok, err, type ServiceResult } from "../shared/result";
import { eloDeltaDuel } from "./elo";

/** Duels older than this (ms) are auto-expired */
const DUEL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Expire all ONGOING duels that started more than DUEL_TIMEOUT_MS ago,
 * and cancel all WAITING duels older than the same threshold.
 * Called periodically by the server.
 */
export async function expireStaleduels(): Promise<number> {
    const cutoff = new Date(Date.now() - DUEL_TIMEOUT_MS);

    // Expire ONGOING duels past timeout
    const expired = await prisma.duel.updateMany({
        where: {
            status: "ONGOING",
            startedAt: { lt: cutoff },
        },
        data: { status: "FINISHED", finishedAt: new Date() },
    });

    // Cancel WAITING duels past timeout
    const canceled = await prisma.duel.updateMany({
        where: {
            status: "WAITING",
            createdAt: { lt: cutoff },
        },
        data: { status: "CANCELED" },
    });

    const total = expired.count + canceled.count;

    if (total > 0) {
        logger.info(
            { expiredOngoing: expired.count, canceledWaiting: canceled.count },
            "Expired stale duels"
        );

        // Notify connected players that their duel expired
        if (expired.count > 0) {
            const expiredDuels = await prisma.duel.findMany({
                where: {
                    status: "FINISHED",
                    finishedAt: { gte: new Date(Date.now() - 5000) }, // just finished
                    startedAt: { lt: cutoff },
                },
                select: { id: true },
            });

            for (const d of expiredDuels) {
                io?.to(`duel:${d.id}`).emit("duel:expired", { duelId: d.id, reason: "timeout" });
            }
        }
    }

    return total;
}

/**
 * Find a user's active duel (WAITING or ONGOING).
 * Used for reconnection after page refresh / disconnect.
 */
export async function getActiveDuel(params: {
    userId: string;
}): Promise<ServiceResult<{ duel: any } | null>> {
    const { userId } = params;

    const duel = await prisma.duel.findFirst({
        where: {
            status: { in: ["WAITING", "ONGOING"] },
            players: { some: { userId } },
        },
        select: {
            id: true,
            theme: true,
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

    if (!duel) return ok(null);

    // Check if this user already submitted answers
    const alreadySubmitted = await prisma.duelAnswer.findFirst({
        where: { duelId: duel.id, playerUserId: userId },
    });

    return ok({
        duel: {
            ...duel,
            alreadySubmitted: !!alreadySubmitted,
            questions: duel.questions.map((dq) => ({
                orderIndex: dq.orderIndex,
                ...dq.question,
            })),
        },
    });
}

export async function createWaitingDuel(params: {
    userId: string;
    theme: string;
}): Promise<ServiceResult<{ duelId: string; theme: string; status: string }>> {
    const { userId, theme } = params;

    const duel = await prisma.duel.create({
        data: {
            theme,
            status: "WAITING",
            players: { create: [{ userId }] },
        },
        select: { id: true, theme: true, status: true },
    });

    return ok({ duelId: duel.id, theme: duel.theme, status: duel.status });
}

export async function joinAndStartDuel(params: {
    duelId: string;
    joinerUserId: string;
    theme: string;
    limit: number;
}): Promise<ServiceResult<{ duelId: string }>> {
    const { duelId, joinerUserId, theme, limit } = params;

    const duel = await prisma.duel.findUnique({
        where: { id: duelId },
        select: {
            id: true,
            status: true,
            theme: true,
            players: { select: { userId: true } },
            questions: { select: { id: true } },
        },
    });

    if (!duel) return err(404, "Duel not found");
    if (duel.theme !== theme) return err(400, "Theme mismatch");
    if (duel.status !== "WAITING") return err(400, "Duel is not joinable");

    const alreadyIn = duel.players.some((p) => p.userId === joinerUserId);
    if (alreadyIn) return err(400, "Already joined");

    // Pick random questions
    const allQuestions = await prisma.question.findMany({
        where: { theme },
        select: { id: true },
    });

    if (allQuestions.length < limit) {
        return err(400, "Not enough questions for this theme");
    }

    const shuffled = allQuestions.sort(() => Math.random() - 0.5);
    const questions = shuffled.slice(0, limit);

    logger.info({ duelId, count: questions.length, theme }, "Duel: locking questions");

    // Transaction FIRST, then notify
    await prisma.$transaction([
        prisma.duelPlayer.create({
            data: { duelId, userId: joinerUserId },
        }),
        prisma.duelQuestion.createMany({
            data: questions.map((q, idx) => ({
                duelId,
                questionId: q.id,
                orderIndex: idx,
            })),
            skipDuplicates: true,
        }),
        prisma.duel.update({
            where: { id: duelId },
            data: { status: "ONGOING", startedAt: new Date() },
        }),
    ]);

    // Notify AFTER commit — emit to the room AND directly to each player's
    // personal sockets (in case player-1 hasn't joined the room yet due to timing).
    const startPayload = { duelId, theme };
    io?.to(`duel:${duelId}`).emit("duel:started", startPayload);

    // Also emit to user-specific rooms so no one misses it
    const allPlayers = await prisma.duelPlayer.findMany({
        where: { duelId },
        select: { userId: true },
    });
    for (const p of allPlayers) {
        io?.to(`user:${p.userId}`).emit("duel:started", startPayload);
    }

    return ok({ duelId });
}

export async function getDuel(params: {
    userId: string;
    duelId: string;
}): Promise<ServiceResult<{ duel: any }>> {
    const { userId, duelId } = params;

    const duel = await prisma.duel.findFirst({
        where: {
            id: duelId,
            players: { some: { userId } },
        },
        select: {
            id: true,
            theme: true,
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

    if (!duel) return err(404, "Duel not found");

    return ok({
        duel: {
            ...duel,
            questions: duel.questions.map((dq) => ({
                orderIndex: dq.orderIndex,
                ...dq.question,
            })),
        },
    });
}

export async function submitDuelAnswers(params: {
    userId: string;
    duelId: string;
    answers: { questionId: string; optionId: string; timeMs?: number }[];
}): Promise<ServiceResult<{
    duelId: string;
    score: number;
    total: number;
    details: {
        questionId: string;
        prompt: string;
        explanation: string | null;
        imageUrl: string | null;
        isCorrect: boolean;
        userAnswerId: string;
        correctAnswerId: string;
        options: { id: string; label: string; isCorrect: boolean }[];
    }[];
}>> {
    const { userId, duelId, answers } = params;

    const duel = await prisma.duel.findFirst({
        where: {
            id: duelId,
            players: { some: { userId } },
        },
        include: {
            questions: true,
            players: true,
        },
    });

    if (!duel) return err(404, "Duel not found");
    if (duel.status !== "ONGOING") return err(400, "Duel is not ongoing");

    // Guard: already submitted
    const existingAnswers = await prisma.duelAnswer.findFirst({
        where: { duelId, playerUserId: userId },
    });
    if (existingAnswers) return err(400, "Already submitted answers for this duel");

    const allowedQuestionIds = new Set(duel.questions.map((dq) => dq.questionId));

    for (const a of answers) {
        if (!allowedQuestionIds.has(a.questionId)) {
            return err(400, "Answer contains a question not in this duel");
        }
    }

    // Fetch full question data with options for detailed feedback
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
        const correctOption = question?.options.find((opt) => opt.isCorrect);
        const isCorrect = question?.options.find((opt) => opt.id === a.optionId)?.isCorrect === true;
        if (isCorrect) score += 1;

        return {
            questionId: a.questionId,
            prompt: question?.prompt ?? "Question not found",
            explanation: question?.explanation ?? null,
            imageUrl: question?.imageUrl ?? null,
            isCorrect,
            userAnswerId: a.optionId,
            correctAnswerId: correctOption?.id ?? "",
            options: question?.options.map((opt) => ({
                id: opt.id,
                label: opt.label,
                isCorrect: opt.isCorrect,
            })) ?? [],
        };
    });

    await prisma.$transaction([
        prisma.duelAnswer.createMany({
            data: answers.map((a) => ({
                duelId,
                playerUserId: userId,
                questionId: a.questionId,
                optionId: a.optionId,
                timeMs: a.timeMs,
            })),
            skipDuplicates: true,
        }),
        prisma.duelPlayer.update({
            where: { duelId_userId: { duelId, userId } },
            data: { score },
        }),
    ]);

    // Check if both players submitted
    const playersWithScores = await prisma.duelPlayer.findMany({
        where: { duelId },
        select: { userId: true, score: true },
    });

    const allSubmitted = playersWithScores.every((p) => p.score !== null);

    if (allSubmitted) {
        // Determine winner
        const sortedByScore = [...playersWithScores].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
        const topScore = sortedByScore[0].score ?? 0;
        const winnersCount = sortedByScore.filter((p) => p.score === topScore).length;
        const isDraw = winnersCount > 1;
        const winnerId = isDraw ? null : sortedByScore[0].userId;

        // Compute Elo deltas
        const users = await prisma.user.findMany({
            where: { id: { in: playersWithScores.map((p) => p.userId) } },
            select: { id: true, elo: true },
        });
        const eloMap = new Map(users.map((u) => [u.id, u.elo]));

        const [p1, p2] = playersWithScores;
        const p1Elo = eloMap.get(p1.userId) ?? 1000;
        const p2Elo = eloMap.get(p2.userId) ?? 1000;

        const p1Result = isDraw ? "draw" as const : p1.userId === winnerId ? "win" as const : "loss" as const;
        const p2Result = isDraw ? "draw" as const : p2.userId === winnerId ? "win" as const : "loss" as const;

        const p1Delta = eloDeltaDuel(p1Elo, p2Elo, p1Result);
        const p2Delta = eloDeltaDuel(p2Elo, p1Elo, p2Result);

        await prisma.$transaction([
            prisma.duel.update({
                where: { id: duelId },
                data: { status: "FINISHED", finishedAt: new Date() },
            }),
            prisma.user.update({
                where: { id: p1.userId },
                data: { elo: Math.max(0, p1Elo + p1Delta) },
            }),
            prisma.user.update({
                where: { id: p2.userId },
                data: { elo: Math.max(0, p2Elo + p2Delta) },
            }),
        ]);

        io?.to(`duel:${duelId}`).emit("duel:finished", {
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

    return ok({
        duelId,
        score,
        total: duel.questions.length,
        details,
    });
}

export async function leaveDuel(params: {
    userId: string;
    duelId: string;
}): Promise<ServiceResult<{}>> {
    const { userId, duelId } = params;

    const duel = await prisma.duel.findFirst({
        where: {
            id: duelId,
            players: { some: { userId } },
        },
        select: { id: true, status: true },
    });

    if (!duel) return err(404, "Duel not found");
    if (duel.status !== "FINISHED") return err(400, "Can only leave a finished duel");

    await prisma.duelPlayer.delete({
        where: { duelId_userId: { duelId, userId } },
    });

    const remainingPlayers = await prisma.duelPlayer.count({ where: { duelId } });

    if (remainingPlayers === 0) {
        await prisma.duel.delete({ where: { id: duelId } });
    }

    return ok({});
}
