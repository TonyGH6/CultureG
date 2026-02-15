import { ok, err, type ServiceResult } from "../shared/result";
import * as matchesRepo from "./matches.repository";
import * as questionsRepo from "../questions/questions.repository";
import * as authRepo from "../auth/auth.repository";
import { toMatchStartDto, toMatchDetailDto, type MatchStartDto, type MatchSubmitDto } from "./matches.mapper";

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

export async function startMatch(input: StartMatchInput): Promise<ServiceResult<MatchStartDto>> {
    const allQuestions = await questionsRepo.findManyByTheme(input.theme);

    if (allQuestions.length < input.limit) {
        return err(400, "Not enough questions for this theme");
    }

    const shuffled = allQuestions.sort(() => Math.random() - 0.5);
    const questions = shuffled.slice(0, input.limit);

    const match = await matchesRepo.createMatch({
        userId: input.userId,
        theme: input.theme,
        questions: questions.map((q, idx) => ({
            questionId: q.id,
            orderIndex: idx,
        })),
    });

    return ok(toMatchStartDto(match, questions));
}

export async function submitMatch(input: SubmitMatchInput): Promise<ServiceResult<MatchSubmitDto>> {
    const match = await matchesRepo.findByIdAndUser(input.matchId, input.userId);

    if (!match) return err(404, "Match not found");
    if (match.status === "FINISHED") return err(400, "Match already finished");

    const allowedQuestionIds = new Set(match.questions.map((mq) => mq.questionId));

    for (const a of input.answers) {
        if (!allowedQuestionIds.has(a.questionId)) {
            return err(400, "Answer contains a question not in this match");
        }
    }

    const questions = await questionsRepo.findManyByIds(Array.from(allowedQuestionIds));
    const questionMap = new Map(questions.map((q) => [q.id, q]));
    let score = 0;

    const details = input.answers.map((a) => {
        const question = questionMap.get(a.questionId);
        if (!question) {
            return {
                questionId: a.questionId,
                prompt: "Question not found",
                explanation: null,
                imageUrl: null,
                isCorrect: false,
                userAnswerId: a.optionId,
                correctAnswerId: "",
                options: [],
            };
        }

        const detail = toMatchDetailDto(question, a);
        if (detail.isCorrect) score += 1;
        return detail;
    });

    const total = match.questions.length;

    const user = await authRepo.findById(input.userId);
    const currentElo = user?.elo ?? 1000;

    await matchesRepo.createAnswersAndFinish({
        matchId: input.matchId,
        answers: input.answers.map((a) => ({
            matchId: input.matchId,
            questionId: a.questionId,
            optionId: a.optionId,
            timeMs: a.timeMs ?? null,
        })),
        score,
        eloBefore: currentElo,
        eloAfter: currentElo,
    });

    return ok({ matchId: input.matchId, score, total, details });
}

export async function getMatchHistory(userId: string, limit: number) {
    return matchesRepo.findHistoryByUser(userId, limit);
}
