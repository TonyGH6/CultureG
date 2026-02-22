"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toMatchStartDto = toMatchStartDto;
exports.toMatchDetailDto = toMatchDetailDto;
function toMatchStartDto(match, questions) {
    return {
        matchId: match.id,
        theme: match.theme,
        questions: questions.map((q) => ({
            id: q.id,
            slug: q.slug,
            prompt: q.prompt,
            imageUrl: q.imageUrl,
            options: q.options,
        })),
    };
}
function toMatchDetailDto(question, answer) {
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
