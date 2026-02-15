export type DuelQuestionDto = {
    orderIndex: number;
    id: string;
    slug: string;
    prompt: string;
    imageUrl: string | null;
    options: { id: string; label: string; orderIndex: number }[];
};

export type ActiveDuelDto = {
    id: string;
    theme: string;
    status: string;
    createdAt: Date;
    startedAt: Date | null;
    players: { userId: string; joinedAt: Date }[];
    questions: DuelQuestionDto[];
    alreadySubmitted: boolean;
};

export type DuelDetailDto = {
    id: string;
    theme: string;
    status: string;
    createdAt: Date;
    startedAt: Date | null;
    players: { userId: string; joinedAt: Date }[];
    questions: DuelQuestionDto[];
};

export type DuelAnswerDetailDto = {
    questionId: string;
    prompt: string;
    explanation: string | null;
    imageUrl: string | null;
    isCorrect: boolean;
    userAnswerId: string;
    correctAnswerId: string;
    options: { id: string; label: string; isCorrect: boolean }[];
};

type RawDuelQuestion = {
    orderIndex: number;
    question: {
        id: string;
        slug: string;
        prompt: string;
        imageUrl: string | null;
        options: { id: string; label: string; orderIndex: number }[];
    };
};

export function toDuelQuestionsDto(duelQuestions: RawDuelQuestion[]): DuelQuestionDto[] {
    return duelQuestions.map((dq) => ({
        orderIndex: dq.orderIndex,
        ...dq.question,
    }));
}

export function toActiveDuelDto(
    duel: {
        id: string;
        theme: string;
        status: string;
        createdAt: Date;
        startedAt: Date | null;
        players: { userId: string; joinedAt: Date }[];
        questions: RawDuelQuestion[];
    },
    alreadySubmitted: boolean
): ActiveDuelDto {
    return {
        ...duel,
        alreadySubmitted,
        questions: toDuelQuestionsDto(duel.questions),
    };
}

export function toDuelDetailDto(duel: {
    id: string;
    theme: string;
    status: string;
    createdAt: Date;
    startedAt: Date | null;
    players: { userId: string; joinedAt: Date }[];
    questions: RawDuelQuestion[];
}): DuelDetailDto {
    return {
        ...duel,
        questions: toDuelQuestionsDto(duel.questions),
    };
}

export function toDuelAnswerDetailDto(
    question: {
        prompt: string;
        explanation: string | null;
        imageUrl: string | null;
        options: { id: string; label: string; isCorrect: boolean }[];
    },
    answer: { questionId: string; optionId: string }
): DuelAnswerDetailDto {
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
