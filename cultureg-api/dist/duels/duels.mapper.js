"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toDuelQuestionsDto = toDuelQuestionsDto;
exports.toActiveDuelDto = toActiveDuelDto;
exports.toDuelDetailDto = toDuelDetailDto;
exports.toDuelAnswerDetailDto = toDuelAnswerDetailDto;
function toDuelQuestionsDto(duelQuestions) {
    return duelQuestions.map((dq) => ({
        orderIndex: dq.orderIndex,
        ...dq.question,
    }));
}
function toActiveDuelDto(duel, alreadySubmitted) {
    return {
        ...duel,
        alreadySubmitted,
        questions: toDuelQuestionsDto(duel.questions),
    };
}
function toDuelDetailDto(duel) {
    return {
        ...duel,
        questions: toDuelQuestionsDto(duel.questions),
    };
}
function toDuelAnswerDetailDto(question, answer) {
    const correctOption = question.options.find((opt) => opt.isCorrect);
    const isCorrect = question.options.find((opt) => opt.id === answer.optionId)?.isCorrect === true;
    return {
        questionId: answer.questionId,
        prompt: question.prompt,
        explanation: question.explanation,
        imageUrl: question.imageUrl,
        isCorrect,
        userAnswerId: answer.optionId,
        correctAnswerId: correctOption?.id ?? "",
        options: question.options.map((opt) => ({
            id: opt.id,
            label: opt.label,
            isCorrect: opt.isCorrect,
        })),
    };
}
