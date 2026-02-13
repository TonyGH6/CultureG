import { useState, useCallback } from "react";
import { api, type StartMatchResp, type SubmitMatchResp, type SoloMatchQuestion } from "../api";

export function useSoloMatch(token: string) {
    const [matchId, setMatchId] = useState("");
    const [theme, setTheme] = useState("");
    const [questions, setQuestions] = useState<SoloMatchQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [submitted, setSubmitted] = useState(false);
    const [result, setResult] = useState<SubmitMatchResp | null>(null);

    const startMatch = useCallback(
        async (selectedTheme: string, limit: number = 10) => {
            const resp = await api<StartMatchResp>("/matches/start", {
                method: "POST",
                token,
                body: JSON.stringify({ theme: selectedTheme, limit }),
            });

            setMatchId(resp.matchId);
            setTheme(resp.theme);
            setQuestions(resp.questions);
            setCurrentQuestionIndex(0);
            setAnswers({});
            setSubmitted(false);
            setResult(null);

            return resp;
        },
        [token]
    );

    const selectAnswer = useCallback((questionId: string, optionId: string) => {
        setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    }, []);

    const submitMatch = useCallback(async () => {
        if (!matchId || !token) return;

        const answersList = questions
            .map((q) => ({
                questionId: q.id,
                optionId: answers[q.id] || "",
            }))
            .filter((a) => a.optionId);

        const resp = await api<SubmitMatchResp>(`/matches/${matchId}/submit`, {
            method: "POST",
            token,
            body: JSON.stringify({ answers: answersList }),
        });

        setSubmitted(true);
        setResult(resp);

        return resp;
    }, [matchId, token, questions, answers]);

    const resetMatch = useCallback(() => {
        setMatchId("");
        setTheme("");
        setQuestions([]);
        setCurrentQuestionIndex(0);
        setAnswers({});
        setSubmitted(false);
        setResult(null);
    }, []);

    return {
        matchId,
        theme,
        questions,
        currentQuestionIndex,
        setCurrentQuestionIndex,
        answers,
        selectAnswer,
        submitted,
        result,
        startMatch,
        submitMatch,
        resetMatch,
    };
}
