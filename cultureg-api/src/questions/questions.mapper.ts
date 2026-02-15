export type QuestionOptionDto = {
    id: string;
    label: string;
    orderIndex: number;
};

export type QuestionDto = {
    id: string;
    slug: string;
    prompt: string;
    imageUrl: string | null;
    options: QuestionOptionDto[];
};

export type QuestionWithCorrectDto = {
    id: string;
    prompt: string;
    explanation: string | null;
    imageUrl: string | null;
    options: { id: string; label: string; isCorrect: boolean }[];
};

export function toQuestionDto(question: {
    id: string;
    slug: string;
    prompt: string;
    imageUrl: string | null;
    options: { id: string; label: string; orderIndex: number }[];
}): QuestionDto {
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

export function toQuestionListDto(
    questions: {
        id: string;
        slug: string;
        prompt: string;
        imageUrl: string | null;
        options: { id: string; label: string; orderIndex: number }[];
    }[]
): QuestionDto[] {
    return questions.map(toQuestionDto);
}
