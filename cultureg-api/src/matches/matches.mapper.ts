export type MatchStartDto = {
    matchId: string;
    theme: string;
    questions: {
        id: string;
        slug: string;
        prompt: string;
        imageUrl: string | null;
        options: { id: string; label: string; orderIndex: number }[];
    }[];
};

export type MatchDetailDto = {
    questionId: string;
    prompt: string;
    explanation: string | null;
    imageUrl: string | null;
    isCorrect: boolean;
    userAnswerId: string;
    correctAnswerId: string;
    options: { id: string; label: string; isCorrect: boolean }[];
};

export type MatchSubmitDto = {
    matchId: string;
    score: number;
    total: number;
    details: MatchDetailDto[];
};

export type MatchHistoryItemDto = {
    id: string;
    theme: string;
    status: string;
    score: number | null;
    createdAt: Date;
    finishedAt: Date | null;
    eloBefore: number | null;
    eloAfter: number | null;
};

export function toMatchStartDto(
    match: { id: string; theme: string },
    questions: {
        id: string;
        slug: string;
        prompt: string;
        imageUrl: string | null;
        options: { id: string; label: string; orderIndex: number }[];
    }[]
): MatchStartDto {
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

export function toMatchDetailDto(
    question: {
        prompt: string;
        explanation: string | null;
        imageUrl: string | null;
        options: { id: string; label: string; isCorrect: boolean }[];
    },
    answer: { questionId: string; optionId: string }
): MatchDetailDto {
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
