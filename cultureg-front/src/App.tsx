import { useEffect, useState, useCallback } from "react";
import { useAuth } from "./hooks/useAuth";
import { useSocket } from "./hooks/useSocket";
import { useDuelGame } from "./hooks/useDuelGame";
import { api, type QueueJoinResp } from "./api";

/* ───────────────────── tiny icon components ───────────────────── */
function IconBrain() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a7 7 0 0 1 5 11.9V17a2 2 0 0 1-2 2h-1v2h-4v-2H9a2 2 0 0 1-2-2v-3.1A7 7 0 0 1 12 2Z" />
            <path strokeLinecap="round" d="M9 17h6" />
        </svg>
    );
}

function IconTrophy() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h12M6 4c-1 0-2 1-2 2v1c0 2.5 2 4 4 4M6 4h12m0 0c1 0 2 1 2 2v1c0 2.5-2 4-4 4m-4 0v4m0-4a4 4 0 0 1-4-4m8 4a4 4 0 0 0 4-4M8 19h8m-4-4v4" />
        </svg>
    );
}

function IconSwords() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.5 2 6 6-2 2-6-6 2-2ZM3.5 21.5l4-4m-4 4 4-4m-4 4ZM9.5 2l-6 6 2 2 6-6-2-2ZM20.5 21.5l-4-4m4 4-4-4m4 4Z" />
        </svg>
    );
}

/* ───────────────────── screens ───────────────────── */
type Screen = "login" | "lobby" | "queue" | "duel" | "results";

export default function App() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [username, setUsername] = useState("");
    const [isRegistering, setIsRegistering] = useState(false);
    const [theme] = useState("general");
    const [screen, setScreen] = useState<Screen>("login");
    const [error, setError] = useState("");
    const [scoreResult, setScoreResult] = useState<{ score: number; total: number } | null>(null);
    const [log, setLog] = useState<string[]>([]);
    const [showLogs, setShowLogs] = useState(false);

    const pushLog = useCallback(
        (line: string) =>
            setLog((prev) => [`${new Date().toLocaleTimeString()}  ${line}`, ...prev].slice(0, 200)),
        []
    );

    const auth = useAuth();
    const socket = useSocket(auth.token, pushLog);
    const duel = useDuelGame(auth.token, pushLog);

    // cleanup
    useEffect(() => () => socket.disconnect(), [socket.disconnect]);

    /* ── login ── */
    async function handleLogin() {
        setError("");
        try {
            await auth.login(email, password);
            setScreen("lobby");
        } catch (err: any) {
            setError(err.message ?? "Login failed");
        }
    }

    /* ── register ── */
    async function handleRegister() {
        setError("");
        if (!username || username.length < 3) {
            setError("Le pseudo doit faire au moins 3 caractères");
            return;
        }
        if (!password || password.length < 8) {
            setError("Le mot de passe doit faire au moins 8 caractères");
            return;
        }
        try {
            await api<any>("/auth/register", {
                method: "POST",
                body: JSON.stringify({ email, password, username }),
            });
            // auto-login after register
            await auth.login(email, password);
            setScreen("lobby");
        } catch (err: any) {
            setError(err.message ?? "Registration failed");
        }
    }

    /* ── queue ── */
    function setupSocketListeners() {
        const s = socket.connect();
        if (!s) return;

        s.off("duel:started");
        s.off("duel:finished");
        s.off("duel:expired");

        s.on("duel:started", (msg: any) => {
            pushLog(`WS duel:started ${JSON.stringify(msg)}`);
            if (msg?.duelId) {
                void duel.refreshDuel(String(msg.duelId)).then(() => setScreen("duel"));
            }
        });

        s.on("duel:finished", (msg: any) => {
            pushLog(`WS duel:finished ${JSON.stringify(msg)}`);
            if (msg?.duelId) void duel.refreshDuel(String(msg.duelId));
        });

        s.on("duel:expired", (msg: any) => {
            pushLog(`WS duel:expired ${JSON.stringify(msg)}`);
            duel.resetDuel();
            setScreen("lobby");
        });
    }

    async function joinQueue() {
        setError("");
        try {
            setupSocketListeners();

            const resp = await api<QueueJoinResp>("/queue/join", {
                method: "POST",
                token: auth.token,
                body: JSON.stringify({ theme }),
            });

            duel.setDuelId(resp.duelId);
            setTimeout(() => socket.joinDuelRoom(resp.duelId), 300);

            if ("matched" in resp && resp.matched) {
                await duel.refreshDuel(resp.duelId);
                setScreen("duel");
            } else {
                setScreen("queue");
            }
        } catch (e: any) {
            setError(e?.message ?? "Queue error");
        }
    }

    async function cancelQueue() {
        try {
            await api<any>("/queue/leave", { method: "POST", token: auth.token });
            duel.resetDuel();
            setScreen("lobby");
        } catch (e: any) {
            pushLog(`Leave error: ${e.message}`);
        }
    }

    /* ── submit ── */
    async function handleSubmit() {
        if (!duel.duelId || !auth.token) return;

        const answersList = duel.duelQuestions
            .map((q) => ({ questionId: q.id, optionId: duel.answers[q.id] || "" }))
            .filter((a) => a.optionId);

        try {
            const resp = await api<any>(`/duels/${duel.duelId}/submit`, {
                method: "POST",
                token: auth.token,
                body: JSON.stringify({ answers: answersList }),
            });
            setScoreResult({ score: resp.score, total: resp.total });
            setScreen("results");
        } catch (e: any) {
            setError(e?.message ?? "Submit error");
        }
    }

    function playAgain() {
        duel.resetDuel();
        setScoreResult(null);
        setError("");
        setScreen("lobby");
    }

    const currentQ = duel.duelQuestions[duel.currentQuestionIndex];
    const answeredCount = Object.keys(duel.answers).length;
    const totalQ = duel.duelQuestions.length;
    const progress = totalQ > 0 ? (answeredCount / totalQ) * 100 : 0;

    /* ───────────────────── RENDER ───────────────────── */
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-purple-950 flex flex-col">
            {/* HEADER */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800/60">
                <div className="flex items-center gap-3">
                    <div className="text-purple-400">
                        <IconBrain />
                    </div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        CultureG
                    </h1>
                </div>

                {auth.isAuthed && (
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-yellow-400">
                            <IconTrophy />
                            <span className="font-semibold">{auth.elo}</span>
                        </div>
                        <div className="text-sm text-gray-400">
                            {auth.username}
                        </div>
                        <button
                            onClick={() => { auth.logout(); duel.resetDuel(); setScreen("login"); }}
                            className="text-xs text-gray-500 hover:text-gray-300 transition"
                        >
                            Déconnexion
                        </button>
                    </div>
                )}
            </header>

            {/* MAIN */}
            <main className="flex-1 flex items-center justify-center p-4">

                {/* ─── LOGIN ─── */}
                {screen === "login" && (
                    <div className="w-full max-w-md">
                        <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl p-8 shadow-2xl shadow-purple-500/5">
                            <div className="text-center mb-8">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/10 text-purple-400 mb-4">
                                    <IconBrain />
                                </div>
                                <h2 className="text-2xl font-bold text-white">
                                    {isRegistering ? "Créer un compte" : "Bienvenue sur CultureG"}
                                </h2>
                                <p className="text-gray-400 mt-2">
                                    {isRegistering
                                        ? "Remplis les champs pour t'inscrire"
                                        : "Connecte-toi pour défier tes amis !"}
                                </p>
                            </div>

                            {error && (
                                <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-4">
                                {isRegistering && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-1.5">Pseudo</label>
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="w-full px-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                                            placeholder="Ton pseudo (min. 3 caractères)"
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                                        placeholder="ton@email.com"
                                        onKeyDown={(e) => e.key === "Enter" && (isRegistering ? handleRegister() : handleLogin())}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1.5">Mot de passe</label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                                        placeholder={isRegistering ? "Min. 8 caractères" : "••••••••"}
                                        onKeyDown={(e) => e.key === "Enter" && (isRegistering ? handleRegister() : handleLogin())}
                                    />
                                </div>

                                {isRegistering ? (
                                    <>
                                        <button
                                            onClick={handleRegister}
                                            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-200 active:scale-[0.98]"
                                        >
                                            S'inscrire
                                        </button>
                                        <button
                                            onClick={() => { setIsRegistering(false); setError(""); }}
                                            className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-xl border border-gray-700 hover:border-gray-600 transition-all duration-200 active:scale-[0.98]"
                                        >
                                            ← Retour à la connexion
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={handleLogin}
                                            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-200 active:scale-[0.98]"
                                        >
                                            Se connecter
                                        </button>
                                        <button
                                            onClick={() => { setIsRegistering(true); setError(""); }}
                                            className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-xl border border-gray-700 hover:border-gray-600 transition-all duration-200 active:scale-[0.98]"
                                        >
                                            Créer un compte
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── LOBBY ─── */}
                {screen === "lobby" && (
                    <div className="w-full max-w-lg">
                        <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl p-8 shadow-2xl text-center">
                            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-purple-400 mb-6">
                                <IconSwords />
                            </div>
                            <h2 className="text-3xl font-bold text-white mb-2">Prêt pour un duel ?</h2>
                            <p className="text-gray-400 mb-8">
                                Affronte un adversaire sur <span className="text-purple-400 font-semibold">5 questions</span> de culture générale
                            </p>

                            {error && (
                                <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={joinQueue}
                                className="w-full py-4 text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-3"
                            >
                                <IconSwords />
                                Lancer un duel
                            </button>

                            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
                                <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                                Thème : {theme}
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── QUEUE / WAITING ─── */}
                {screen === "queue" && (
                    <div className="w-full max-w-md">
                        <div className="bg-gray-900/80 backdrop-blur border border-purple-500/30 rounded-2xl p-8 shadow-2xl text-center"
                             style={{ animation: "pulse-glow 2s infinite" }}>
                            <div className="mb-6">
                                <div className="w-16 h-16 mx-auto rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Recherche d'un adversaire…</h2>
                            <p className="text-gray-400 mb-8">
                                Partage le lien avec un ami pour jouer ensemble !
                            </p>
                            <button
                                onClick={cancelQueue}
                                className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-xl border border-gray-700 hover:border-gray-600 transition-all duration-200"
                            >
                                Annuler
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── DUEL GAMEPLAY ─── */}
                {screen === "duel" && currentQ && (
                    <div className="w-full max-w-2xl">
                        {/* progress bar */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-400">
                                    Question {duel.currentQuestionIndex + 1} / {totalQ}
                                </span>
                                <span className="text-sm text-gray-500">
                                    {answeredCount} / {totalQ} répondu{answeredCount > 1 ? "es" : "e"}
                                </span>
                            </div>
                            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>

                        {/* question card */}
                        <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl p-8 shadow-2xl">
                            <div className="mb-8">
                                <span className="inline-block px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-semibold uppercase tracking-wider mb-4">
                                    {theme}
                                </span>
                                <h2 className="text-2xl font-bold text-white leading-relaxed">
                                    {currentQ.prompt}
                                </h2>
                            </div>

                            {/* options */}
                            <div className="space-y-3">
                                {currentQ.options.map((option, idx) => {
                                    const isSelected = duel.answers[currentQ.id] === option.id;
                                    const letters = ["A", "B", "C", "D", "E", "F"];
                                    return (
                                        <button
                                            key={option.id}
                                            onClick={() => duel.selectAnswer(currentQ.id, option.id)}
                                            className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-4 group ${
                                                isSelected
                                                    ? "border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/10"
                                                    : "border-gray-700/50 bg-gray-800/40 hover:border-gray-600 hover:bg-gray-800/80"
                                            }`}
                                        >
                                            <span
                                                className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 transition-all ${
                                                    isSelected
                                                        ? "bg-purple-500 text-white"
                                                        : "bg-gray-700/50 text-gray-400 group-hover:bg-gray-700 group-hover:text-gray-300"
                                                }`}
                                            >
                                                {letters[idx]}
                                            </span>
                                            <span className={`text-lg ${isSelected ? "text-white font-medium" : "text-gray-300"}`}>
                                                {option.label}
                                            </span>
                                            {isSelected && (
                                                <span className="ml-auto text-purple-400">
                                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* navigation */}
                            <div className="mt-8 flex items-center justify-between">
                                <button
                                    onClick={() => duel.setCurrentQuestionIndex(Math.max(0, duel.currentQuestionIndex - 1))}
                                    disabled={duel.currentQuestionIndex === 0}
                                    className="px-5 py-2.5 rounded-xl bg-gray-800 text-gray-300 font-medium border border-gray-700 hover:bg-gray-700 hover:border-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                    ← Précédent
                                </button>

                                {/* question dots */}
                                <div className="flex gap-1.5">
                                    {duel.duelQuestions.map((q, i) => (
                                        <button
                                            key={q.id}
                                            onClick={() => duel.setCurrentQuestionIndex(i)}
                                            className={`w-3 h-3 rounded-full transition-all ${
                                                i === duel.currentQuestionIndex
                                                    ? "bg-purple-500 scale-125"
                                                    : duel.answers[q.id]
                                                      ? "bg-purple-400/50"
                                                      : "bg-gray-700"
                                            }`}
                                        />
                                    ))}
                                </div>

                                {duel.currentQuestionIndex === totalQ - 1 ? (
                                    <button
                                        onClick={handleSubmit}
                                        disabled={answeredCount < totalQ}
                                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold shadow-lg shadow-green-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                                    >
                                        Valider ✓
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => duel.setCurrentQuestionIndex(duel.currentQuestionIndex + 1)}
                                        className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98]"
                                    >
                                        Suivant →
                                    </button>
                                )}
                            </div>
                        </div>

                        {error && (
                            <div className="mt-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
                                {error}
                            </div>
                        )}
                    </div>
                )}

                {/* ─── RESULTS ─── */}
                {screen === "results" && scoreResult && (
                    <div className="w-full max-w-md">
                        <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-2xl p-8 shadow-2xl text-center">
                            <div className="mb-6">
                                {scoreResult.score >= scoreResult.total * 0.7 ? (
                                    <div className="text-6xl mb-2">🎉</div>
                                ) : scoreResult.score >= scoreResult.total * 0.4 ? (
                                    <div className="text-6xl mb-2">👏</div>
                                ) : (
                                    <div className="text-6xl mb-2">💪</div>
                                )}
                            </div>

                            <h2 className="text-3xl font-bold text-white mb-2">Résultats</h2>

                            <div className="my-8">
                                <div className="inline-flex items-baseline gap-1">
                                    <span className="text-6xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                        {scoreResult.score}
                                    </span>
                                    <span className="text-2xl text-gray-500">/ {scoreResult.total}</span>
                                </div>
                                <p className="text-gray-400 mt-2">
                                    {scoreResult.score === scoreResult.total
                                        ? "Score parfait ! 🔥"
                                        : scoreResult.score >= scoreResult.total * 0.7
                                          ? "Excellent !"
                                          : scoreResult.score >= scoreResult.total * 0.4
                                            ? "Pas mal, tu peux faire mieux !"
                                            : "Continue à t'entraîner !"}
                                </p>
                            </div>

                            <div className="flex items-center justify-center gap-2 text-yellow-400 mb-8">
                                <IconTrophy />
                                <span className="font-semibold">Elo : {auth.elo}</span>
                            </div>

                            <button
                                onClick={playAgain}
                                className="w-full py-4 text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-200 active:scale-[0.98]"
                            >
                                Rejouer
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* FOOTER / DEBUG LOGS */}
            <footer className="px-6 py-3 border-t border-gray-800/60">
                <button
                    onClick={() => setShowLogs(!showLogs)}
                    className="text-xs text-gray-600 hover:text-gray-400 transition"
                >
                    {showLogs ? "▼ Masquer les logs" : "▶ Afficher les logs"}
                </button>
                {showLogs && (
                    <div className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-gray-950 border border-gray-800 p-3 font-mono text-[11px] text-gray-500 space-y-0.5">
                        {log.length === 0
                            ? <div>(no logs)</div>
                            : log.map((l, i) => <div key={i}>{l}</div>)
                        }
                    </div>
                )}
            </footer>
        </div>
    );
}
