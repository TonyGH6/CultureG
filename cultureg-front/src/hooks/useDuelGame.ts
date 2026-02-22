import { useState, useCallback } from "react";
import { api, type DuelResp, type DuelQuestion } from "../api";

export function useDuelGame(token: string, onLog: (msg: string) => void) {
    const [duelId, setDuelId] = useState("");
    const [duelStatus, setDuelStatus] = useState("");
    const [durationSec, setDurationSec] = useState<number | null>(null);
    const [playersCount, setPlayersCount] = useState(0);
    const [questionsCount, setQuestionsCount] = useState(0);
    const [duelQuestions, setDuelQuestions] = useState<DuelQuestion[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [submitted, setSubmitted] = useState(false);

    const refreshDuel = useCallback(
        async (id?: string) => {
            const did = id ?? duelId;
            if (!did) return;

            const resp = await api<DuelResp>(`/duels/${did}`, { method: "GET", token });
            setDuelStatus(resp.duel.status);
            setDurationSec(resp.duel.durationSec ?? null);
            setPlayersCount(resp.duel.players.length);
            setQuestionsCount(resp.duel.questions.length);
            setDuelQuestions(resp.duel.questions);
            setCurrentQuestionIndex(0);

            onLog(
                `Duel state: status=${resp.duel.status} players=${resp.duel.players.length} questions=${resp.duel.questions.length}`
            );
        },
        [duelId, token, onLog]
    );

    const selectAnswer = useCallback(
        (questionId: string, optionId: string) => {
            setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
        },
        []
    );

    const submitAnswers = useCallback(async () => {
        if (!duelId || !token) return;

        const answersList = duelQuestions
            .map((q) => ({
                questionId: q.id,
                optionId: answers[q.id] || "",
            }))
            .filter((a) => a.optionId);

        try {
            const resp = await api<any>(`/duels/${duelId}/submit`, {
                method: "POST",
                token,
                body: JSON.stringify({ answers: answersList }),
            });

            setSubmitted(true);
            onLog(`Submitted! Score: ${resp.score}/${resp.total}`);
        } catch (e: any) {
            onLog(`Submit ERROR: ${e?.message ?? String(e)}`);
        }
    }, [duelId, token, duelQuestions, answers, onLog]);

    const setSubmittedFlag = useCallback((val: boolean) => setSubmitted(val), []);

    const resetDuel = useCallback(() => {
        setDuelId("");
        setDuelStatus("");
        setDurationSec(null);
        setPlayersCount(0);
        setQuestionsCount(0);
        setDuelQuestions([]);
        setCurrentQuestionIndex(0);
        setAnswers({});
        setSubmitted(false);
    }, []);

    return {
        duelId,
        setDuelId,
        duelStatus,
        durationSec,
        playersCount,
        questionsCount,
        duelQuestions,
        currentQuestionIndex,
        setCurrentQuestionIndex,
        answers,
        selectAnswer,
        submitted,
        setSubmittedFlag,
        refreshDuel,
        submitAnswers,
        resetDuel,
    };
}
