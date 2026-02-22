"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toQuestionDto = toQuestionDto;
exports.toQuestionListDto = toQuestionListDto;
function toQuestionDto(question) {
    return {
        id: question.id,
        slug: question.slug,
        prompt: question.prompt,
        imageUrl: question.imageUrl,
        options: question.options.map((o) => ({
            id: o.id,
            label: o.label,
            orderIndex: o.orderIndex,
        })),
    };
}
function toQuestionListDto(questions) {
    return questions.map(toQuestionDto);
}
