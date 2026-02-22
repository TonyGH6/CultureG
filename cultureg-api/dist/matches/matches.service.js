"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.startMatch = startMatch;
exports.submitMatch = submitMatch;
exports.getMatchHistory = getMatchHistory;
const result_1 = require("../shared/result");
const matchesRepo = __importStar(require("./matches.repository"));
const questionsRepo = __importStar(require("../questions/questions.repository"));
const authRepo = __importStar(require("../auth/auth.repository"));
const matches_mapper_1 = require("./matches.mapper");
async function startMatch(input) {
    const allQuestions = await questionsRepo.findManyByTheme(input.theme);
    if (allQuestions.length < input.limit) {
        return (0, result_1.err)(400, "Not enough questions for this theme");
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
    return (0, result_1.ok)((0, matches_mapper_1.toMatchStartDto)(match, questions));
}
async function submitMatch(input) {
    const match = await matchesRepo.findByIdAndUser(input.matchId, input.userId);
    if (!match)
        return (0, result_1.err)(404, "Match not found");
    if (match.status === "FINISHED")
        return (0, result_1.err)(400, "Match already finished");
    const allowedQuestionIds = new Set(match.questions.map((mq) => mq.questionId));
    for (const a of input.answers) {
        if (!allowedQuestionIds.has(a.questionId)) {
            return (0, result_1.err)(400, "Answer contains a question not in this match");
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
        const detail = (0, matches_mapper_1.toMatchDetailDto)(question, a);
        if (detail.isCorrect)
            score += 1;
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
    return (0, result_1.ok)({ matchId: input.matchId, score, total, details });
}
async function getMatchHistory(userId, limit) {
    return matchesRepo.findHistoryByUser(userId, limit);
}
