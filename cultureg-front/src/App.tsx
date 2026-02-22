import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "./hooks/useAuth";
import { useSocket } from "./hooks/useSocket";
import { useDuelGame } from "./hooks/useDuelGame";
import { useSoloMatch } from "./hooks/useSoloMatch";
import { api, type QueueJoinResp, type ActiveDuelResp } from "./api";

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

/* ───────────────────── screens ───────────────────── */
type Screen = "login" | "lobby" | "queue" | "duel" | "waiting-results" | "results" | "solo" | "solo-results";

export default function App() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [username, setUsername] = useState("");
    const [isRegistering, setIsRegistering] = useState(false);
    const [theme] = useState("general");
    const [screen, setScreen] = useState<Screen>("login");
    const [error, setError] = useState("");
    const [scoreResult, setScoreResult] = useState<{
        score: number;
        total: number;
        details?: {
            questionId: string;
            prompt: string;
            explanation: string | null;
            imageUrl: string | null;
            isCorrect: boolean;
            userAnswerId: string;
            correctAnswerId: string;
            options: { id: string; label: string; isCorrect: boolean }[];
        }[];
    } | null>(null);
    const [duelResult, setDuelResult] = useState<{ winnerId: string | null; isDraw: boolean; players: { userId: string; score: number | null; eloDelta?: number }[] } | null>(null);
    const duelFinishedRef = useRef(false);
    const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
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
    const solo = useSoloMatch(auth.token);

    // cleanup
    useEffect(() => () => socket.disconnect(), [socket.disconnect]);

    /* ── reconnection: check for active duel after login ── */
    const reconnectCheckedRef = useRef(false);

    useEffect(() => {
        if (!auth.token || reconnectCheckedRef.current) return;
        reconnectCheckedRef.current = true;

        (async () => {
            try {
                const resp = await api<ActiveDuelResp>("/duels/active", { method: "GET", token: auth.token });
                if (!resp.duel) return; // no active duel

                pushLog(`🔄 Active duel found: ${resp.duel.id} (${resp.duel.status})`);
                duel.setDuelId(resp.duel.id);

                // Setup WS listeners & join room
                setupSocketListeners();
                setTimeout(() => socket.joinDuelRoom(resp.duel!.id), 300);

                if (resp.duel.status === "WAITING") {
                    setScreen("queue");
                } else if (resp.duel.status === "ONGOING") {
                    if (resp.duel.alreadySubmitted) {
                        await duel.refreshDuel(resp.duel.id);
                        duel.setSubmittedFlag(true);
                        setScreen("waiting-results");
                    } else {
                        await duel.refreshDuel(resp.duel.id);
                        setScreen("duel");
                    }
                }
            } catch (e: any) {
                pushLog(`Reconnection check failed: ${e?.message}`);
            }
        })();
    }, [auth.token]);

    /* ── login ── */
    async function handleLogin() {
        setError("");
        try {
            await auth.login(email, password);
            setScreen("lobby");
        } catch (err: any) {
            const msg = err.message ?? "Login failed";
            if (msg.includes("fetch") || msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
                setError("⚠️ Impossible de contacter le serveur. Vérifie ta connexion.");
            } else {
                setError(msg);
            }
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
            const msg = err.message ?? "Registration failed";
            if (msg.includes("fetch") || msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
                setError("⚠️ Impossible de contacter le serveur. Vérifie ta connexion.");
            } else {
                setError(msg);
            }
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
            if (msg?.duelId) {
                duelFinishedRef.current = true;
                setDuelResult({
                    winnerId: msg.winnerId ?? null,
                    isDraw: msg.isDraw ?? false,
                    players: msg.players ?? [],
                });
                // Update local Elo with delta from server
                const myPlayer = (msg.players ?? []).find((p: any) => p.userId === auth.userId);
                if (myPlayer?.eloDelta != null) {
                    auth.setElo((prev: number) => Math.max(0, prev + myPlayer.eloDelta));
                }
                void duel.refreshDuel(String(msg.duelId));
                // Navigate to results when duel is finished (handles waiting-results → results)
                setScreen("results");
            }
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

    /* ── solo match ── */
    async function startSoloMatch() {
        setError("");
        try {
            await solo.startMatch(theme, 10);
            setScreen("solo");
        } catch (e: any) {
            setError(e?.message ?? "Failed to start solo match");
        }
    }

    async function submitSoloMatch() {
        try {
            await solo.submitMatch();
            setScreen("solo-results");
        } catch (e: any) {
            setError(e?.message ?? "Submit error");
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
            setScoreResult({ score: resp.score, total: resp.total, details: resp.details ?? [] });
            // If duel:finished WS already arrived (both players done), go straight to results.
            // Otherwise wait for the opponent on the waiting screen.
            setScreen(duelFinishedRef.current ? "results" : "waiting-results");
        } catch (e: any) {
            setError(e?.message ?? "Submit error");
        }
    }

    function playAgain() {
        duel.resetDuel();
        setScoreResult(null);
        setDuelResult(null);
        duelFinishedRef.current = false;
        setExpandedQuestions(new Set());
        setError("");
        setScreen("lobby");
    }

    const currentQ = duel.duelQuestions[duel.currentQuestionIndex];
    const answeredCount = Object.keys(duel.answers).length;
    const totalQ = duel.duelQuestions.length;
    const progress = totalQ > 0 ? (answeredCount / totalQ) * 100 : 0;

    /* ───────────────────── RENDER ───────────────────── */
    return (
        <div className="min-h-screen flex flex-col relative">
            {/* Background images — mobile vs desktop */}
            <div className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat md:hidden" style={{ backgroundImage: "url('/backroundMobile.png')" }} />
            <div className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat hidden md:block" style={{ backgroundImage: "url('/backround.png')" }} />
            {/* HEADER */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-white">
                <div className="flex items-center gap-3">
                    <img src="/logo.png" alt="Owlympiad" className="w-10 h-10 rounded-full" />
                    <h1 className="text-2xl font-bold text-amber-400">
                        Owlympiad
                    </h1>
                </div>

                {auth.isAuthed && (
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-amber-500">
                            <IconTrophy />
                            <span className="font-semibold">{auth.elo}</span>
                        </div>
                        <div className="text-sm text-stone-500">
                            {auth.username}
                        </div>
                        <button
                            onClick={() => { auth.logout(); duel.resetDuel(); reconnectCheckedRef.current = false; setScreen("login"); }}
                            className="text-xs text-stone-400 hover:text-stone-600 transition"
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
                        <div className="bg-white/90 backdrop-blur border border-stone-200 rounded-2xl p-8 shadow-2xl shadow-amber-500/10">
                            <div className="text-center mb-8">
                                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-500/10 mb-4">
                                    <img src="/logo.png" alt="Owlympiad" className="w-16 h-16 rounded-full" />
                                </div>
                                <h2 className="text-2xl font-bold text-stone-800">
                                    {isRegistering ? "Créer un compte" : "Bienvenue sur Owlympiad"}
                                </h2>
                                <p className="text-stone-500 mt-2">
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
                                        <label htmlFor="username" className="block text-sm font-medium text-stone-600 mb-1.5">Pseudo</label>
                                        <input
                                            id="username"
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-stone-300 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
                                            placeholder="Ton pseudo (min. 3 caractères)"
                                        />
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-stone-600 mb-1.5">Email</label>
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full px-4 py-3 bg-white border border-stone-300 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
                                        placeholder="ton@email.com"
                                        onKeyDown={(e) => e.key === "Enter" && (isRegistering ? handleRegister() : handleLogin())}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="password" className="block text-sm font-medium text-stone-600 mb-1.5">Mot de passe</label>
                                    <input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-3 bg-white border border-stone-300 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
                                        placeholder={isRegistering ? "Min. 8 caractères" : "••••••••"}
                                        onKeyDown={(e) => e.key === "Enter" && (isRegistering ? handleRegister() : handleLogin())}
                                    />
                                </div>

                                {isRegistering ? (
                                    <>
                                        <button
                                            onClick={handleRegister}
                                            className="w-full py-3 bg-gradient-to-r from-amber-500 to-sky-500 hover:from-amber-400 hover:to-sky-400 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-200 active:scale-[0.98]"
                                        >
                                            S'inscrire
                                        </button>
                                        <button
                                            onClick={() => { setIsRegistering(false); setError(""); }}
                                            className="w-full py-3 bg-stone-100 hover:bg-stone-200 text-stone-600 font-medium rounded-xl border border-stone-300 hover:border-stone-400 transition-all duration-200 active:scale-[0.98]"
                                        >
                                            ← Retour à la connexion
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={handleLogin}
                                            className="w-full py-3 bg-gradient-to-r from-amber-500 to-sky-500 hover:from-amber-400 hover:to-sky-400 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-200 active:scale-[0.98]"
                                        >
                                            Se connecter
                                        </button>
                                        <button
                                            onClick={() => { setIsRegistering(true); setError(""); }}
                                            className="w-full py-3 bg-stone-100 hover:bg-stone-200 text-stone-600 font-medium rounded-xl border border-stone-300 hover:border-stone-400 transition-all duration-200 active:scale-[0.98]"
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
                        <div className="bg-white/90 backdrop-blur border border-stone-200 rounded-2xl p-8 shadow-2xl text-center">
                            <div className="flex justify-center mb-6">
                                <img src="/logo.png" alt="Owlympiad" className="w-24 h-24 rounded-full" />
                            </div>
                            <h2 className="text-3xl font-bold text-stone-800 mb-2">Prêt pour un duel ?</h2>
                            <p className="text-stone-500 mb-8">
                                Affronte un adversaire sur <span className="text-amber-400 font-semibold">10 questions</span> de culture générale
                            </p>

                            {error && (
                                <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={joinQueue}
                                className="w-full py-4 text-lg bg-gradient-to-r from-amber-500 to-sky-500 hover:from-amber-400 hover:to-sky-400 text-white font-bold rounded-xl shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-3"
                            >
                                <span className="text-xl">⚡</span>
                                Lancer un duel
                            </button>

                            <button
                                onClick={startSoloMatch}
                                className="mt-4 w-full py-4 text-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl border border-stone-300 hover:border-amber-400 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-3"
                            >
                                <IconBrain />
                                Jouer seul
                            </button>

                            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-stone-400">
                                <span className="w-2 h-2 rounded-full bg-yellow-400"></span>
                                Thème : {theme}
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── QUEUE / WAITING ─── */}
                {screen === "queue" && (
                    <div className="w-full max-w-md">
                        <div className="bg-white/90 backdrop-blur border border-amber-400/40 rounded-2xl p-8 shadow-2xl text-center"
                             style={{ animation: "pulse-glow 2s infinite" }}>
                            <div className="mb-6">
                                <div className="w-16 h-16 mx-auto rounded-full border-4 border-amber-500 border-t-transparent animate-spin" />
                            </div>
                            <h2 className="text-2xl font-bold text-stone-800 mb-2">Recherche d'un adversaire…</h2>
                            <p className="text-stone-500 mb-8">
                                Partage le lien avec un ami pour jouer ensemble !
                            </p>
                            <button
                                onClick={cancelQueue}
                                className="px-8 py-3 bg-stone-100 hover:bg-stone-200 text-stone-600 font-medium rounded-xl border border-stone-300 hover:border-stone-400 transition-all duration-200"
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
                                <span className="text-sm font-medium text-stone-600">
                                    Question {duel.currentQuestionIndex + 1} / {totalQ}
                                </span>
                                <span className="text-sm text-stone-400">
                                    {answeredCount} / {totalQ} répondu{answeredCount > 1 ? "es" : "e"}
                                </span>
                            </div>
                            <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-amber-500 to-sky-500 rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>

                        {/* question card */}
                        <div className="bg-white/90 backdrop-blur border border-stone-200 rounded-2xl p-4 sm:p-8 shadow-2xl">
                            <div className="mb-6 sm:mb-8">
                                <span className="inline-block px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-semibold uppercase tracking-wider mb-4">
                                    {theme}
                                </span>
                                <h2 className="text-xl sm:text-2xl font-bold text-stone-800 leading-relaxed">
                                    {currentQ.prompt}
                                </h2>
                            </div>

                            {currentQ.imageUrl && (
                                <div className="mb-6 flex justify-center">
                                    <img
                                        src={currentQ.imageUrl}
                                        alt="Illustration de la question"
                                        className="max-h-64 rounded-xl border border-stone-200 object-contain"
                                    />
                                </div>
                            )}

                            {/* options */}
                            <div className="space-y-3">
                                {currentQ.options.map((option) => {
                                    const isSelected = duel.answers[currentQ.id] === option.id;
                                    return (
                                        <button
                                            key={option.id}
                                            onClick={() => duel.selectAnswer(currentQ.id, option.id)}
                                            className={`w-full text-left px-6 py-4 rounded-xl border-2 transition-all duration-200 ${
                                                isSelected
                                                    ? "bg-amber-500/15 border-amber-500 text-stone-800 shadow-lg shadow-amber-500/20"
                                                    : "bg-stone-50 border-stone-200 text-stone-700 hover:border-amber-400 hover:bg-amber-50/50"
                                            }`}
                                        >
                                            <span className="font-medium">{option.label}</span>
                                        </button>
                                    );
                                })}  
                            </div>                            {/* navigation */}
                            <div className="mt-6 sm:mt-8 space-y-4">
                                {/* question dots — scrollable on mobile */}
                                <div className="flex justify-center overflow-x-auto pb-1">
                                    <div className="flex gap-1.5 flex-shrink-0">
                                        {duel.duelQuestions.map((q, i) => (
                                            <button
                                                key={q.id}
                                                onClick={() => duel.setCurrentQuestionIndex(i)}
                                                className={`w-3 h-3 rounded-full transition-all flex-shrink-0 ${
                                                    i === duel.currentQuestionIndex
                                                        ? "bg-amber-500 scale-125"
                                                        : duel.answers[q.id]
                                                          ? "bg-amber-400/60"
                                                          : "bg-stone-300"
                                                }`}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* prev / next buttons */}
                                <div className="flex items-center justify-between gap-2">
                                    <button
                                        onClick={() => duel.setCurrentQuestionIndex(Math.max(0, duel.currentQuestionIndex - 1))}
                                        disabled={duel.currentQuestionIndex === 0}
                                        className="px-4 sm:px-5 py-2.5 rounded-xl bg-stone-100 text-stone-600 text-sm sm:text-base font-medium border border-stone-300 hover:bg-stone-200 hover:border-stone-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    >
                                        ← Précédent
                                    </button>

                                    {duel.currentQuestionIndex === totalQ - 1 ? (
                                        <button
                                            onClick={handleSubmit}
                                            disabled={answeredCount < totalQ}
                                            className="px-4 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white text-sm sm:text-base font-semibold shadow-lg shadow-green-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                                        >
                                            Valider ✓
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => duel.setCurrentQuestionIndex(duel.currentQuestionIndex + 1)}
                                            className="px-4 sm:px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm sm:text-base font-medium shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]"
                                        >
                                            Suivant →
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="mt-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
                                {error}
                            </div>
                        )}
                    </div>
                )}

                {/* ─── WAITING FOR OPPONENT ─── */}
                {screen === "waiting-results" && scoreResult && (
                    <div className="w-full max-w-md">
                        <div className="bg-white/90 backdrop-blur border border-stone-200 rounded-2xl p-8 shadow-2xl text-center">
                            <div className="text-6xl mb-4 animate-bounce">⏳</div>
                            <h2 className="text-2xl font-bold text-stone-800 mb-3">Réponses envoyées !</h2>
                            <p className="text-stone-500 mb-6">
                                Ton score : <span className="text-amber-500 font-bold">{scoreResult.score} / {scoreResult.total}</span>
                            </p>
                            <p className="text-stone-400 text-sm">En attente de ton adversaire…</p>
                            <div className="mt-6 flex justify-center">
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" style={{ animationDelay: "0s" }} />
                                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }} />
                                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── RESULTS ─── */}
                {screen === "results" && scoreResult && (
                    <div className="w-full max-w-lg">
                        <div className="bg-white/90 backdrop-blur border border-stone-200 rounded-2xl p-8 shadow-2xl text-center">
                            {/* Winner/Loser/Draw display */}
                            {duelResult && (
                                <div className="mb-6">
                                    {duelResult.isDraw ? (
                                        <>
                                            <div className="text-6xl mb-2">🤝</div>
                                            <h2 className="text-3xl font-bold text-yellow-400 mb-2">Égalité !</h2>
                                        </>
                                    ) : duelResult.winnerId === auth.userId ? (
                                        <>
                                            <div className="text-6xl mb-2">🏆</div>
                                            <h2 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent mb-2">
                                                Victoire !
                                            </h2>
                                        </>
                                    ) : (
                                        <>
                                            <div className="text-6xl mb-2">😔</div>
                                            <h2 className="text-3xl font-bold text-red-400 mb-2">Défaite</h2>
                                        </>
                                    )}
                                </div>
                            )}

                            {!duelResult && (
                                <div className="mb-6">
                                    {scoreResult.score >= scoreResult.total * 0.7 ? (
                                        <div className="text-6xl mb-2">🎉</div>
                                    ) : scoreResult.score >= scoreResult.total * 0.4 ? (
                                        <div className="text-6xl mb-2">👏</div>
                                    ) : (
                                        <div className="text-6xl mb-2">💪</div>
                                    )}
                                    <h2 className="text-3xl font-bold text-stone-800 mb-2">Résultats</h2>
                                </div>
                            )}

                            {/* Scores comparison for duel */}
                            {duelResult && duelResult.players.length === 2 && (
                                <div className="mb-6 space-y-3">
                                    {duelResult.players.map((player) => {
                                        const isCurrentUser = player.userId === auth.userId;
                                        const isWinner = player.userId === duelResult.winnerId;
                                        return (
                                            <div
                                                key={player.userId}
                                                className={`px-4 py-3 rounded-lg flex items-center justify-between ${
                                                    isWinner
                                                        ? "bg-yellow-500/10 border border-yellow-500/30"
                                                        : "bg-stone-50 border border-stone-200"
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {isWinner && <span className="text-yellow-400">👑</span>}
                                                    <span className={`font-semibold ${isCurrentUser ? "text-amber-500" : "text-stone-600"}`}>
                                                        {isCurrentUser ? "Toi" : "Adversaire"}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {player.eloDelta != null && (
                                                        <span className={`text-sm font-bold ${player.eloDelta >= 0 ? "text-green-400" : "text-red-400"}`}>
                                                            {player.eloDelta >= 0 ? "+" : ""}{player.eloDelta} Elo
                                                        </span>
                                                    )}
                                                    <span className="text-2xl font-bold text-stone-800">
                                                        {player.score ?? 0} / {scoreResult.total}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Your score */}
                            {!duelResult && (
                                <div className="my-8">
                                    <div className="inline-flex items-baseline gap-1">
                                        <span className="text-6xl font-black bg-gradient-to-r from-amber-400 to-sky-400 bg-clip-text text-transparent">
                                            {scoreResult.score}
                                        </span>
                                        <span className="text-2xl text-stone-400">/ {scoreResult.total}</span>
                                    </div>
                                    <p className="text-stone-500 mt-2">
                                        {scoreResult.score === scoreResult.total
                                            ? "Score parfait ! 🔥"
                                            : scoreResult.score >= scoreResult.total * 0.7
                                              ? "Excellent !"
                                              : scoreResult.score >= scoreResult.total * 0.4
                                                ? "Pas mal, tu peux faire mieux !"
                                                : "Continue à t'entraîner !"}
                                    </p>
                                </div>
                            )}

                            <div className="flex items-center justify-center gap-2 text-amber-500 mb-8">
                                <IconTrophy />
                                <span className="font-semibold">Elo : {auth.elo}</span>
                            </div>

                            {/* Detailed correction */}
                            {scoreResult.details && scoreResult.details.length > 0 && (
                                <div className="mb-6 space-y-2 text-left">
                                    <h3 className="text-sm font-semibold text-stone-500 mb-3">Correction détaillée</h3>
                                    {scoreResult.details.map((detail, idx) => {
                                        const isOpen = expandedQuestions.has(`duel-${idx}`);
                                        return (
                                            <div
                                                key={detail.questionId}
                                                className={`border rounded-xl overflow-hidden ${
                                                    detail.isCorrect
                                                        ? "bg-green-500/5 border-green-500/30"
                                                        : "bg-red-500/5 border-red-500/30"
                                                }`}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedQuestions((prev) => {
                                                        const next = new Set(prev);
                                                        if (next.has(`duel-${idx}`)) next.delete(`duel-${idx}`);
                                                        else next.add(`duel-${idx}`);
                                                        return next;
                                                    })}
                                                    className="w-full flex items-center gap-3 p-4 text-left cursor-pointer hover:bg-stone-50 transition-colors"
                                                >
                                                    <span className={`text-xl ${detail.isCorrect ? "text-green-500" : "text-red-500"}`}>
                                                        {detail.isCorrect ? "✓" : "✗"}
                                                    </span>
                                                    <span className="flex-1 text-sm text-stone-700 font-medium">Question {idx + 1}</span>
                                                    <span className={`text-stone-400 text-xs transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
                                                        ▼
                                                    </span>
                                                </button>

                                                {isOpen && (
                                                    <div className="px-4 pb-4">
                                                        <p className="text-sm text-stone-600 mb-3 leading-relaxed">{detail.prompt}</p>
                                                        {detail.imageUrl && (
                                                            <div className="mb-3 flex justify-center">
                                                                <img
                                                                    src={detail.imageUrl}
                                                                    alt="Illustration"
                                                                    className="max-h-48 rounded-lg border border-stone-200 object-contain"
                                                                />
                                                            </div>
                                                        )}
                                                        <div className="space-y-2">
                                                            {detail.options.map((opt) => {
                                                                const isUserAnswer = opt.id === detail.userAnswerId;
                                                                const isCorrectAnswer = opt.id === detail.correctAnswerId;
                                                                return (
                                                                    <div
                                                                        key={opt.id}
                                                                        className={`text-sm px-3 py-2 rounded-lg ${
                                                                            isCorrectAnswer
                                                                                ? "bg-green-500/15 text-green-700 font-semibold"
                                                                                : isUserAnswer
                                                                                  ? "bg-red-500/15 text-red-600"
                                                                                  : "bg-stone-100 text-stone-500"
                                                                        }`}
                                                                    >
                                                                        {opt.label}
                                                                        {isCorrectAnswer && <span className="ml-2">✓ Bonne réponse</span>}
                                                                        {isUserAnswer && !isCorrectAnswer && <span className="ml-2">✗ Ta réponse</span>}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        {detail.explanation && (
                                                            <p className="mt-3 text-xs text-stone-400 italic leading-relaxed border-t border-stone-200 pt-3">
                                                                💡 {detail.explanation}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <button
                                onClick={playAgain}
                                className="w-full py-4 text-lg bg-gradient-to-r from-amber-500 to-sky-500 hover:from-amber-400 hover:to-sky-400 text-white font-bold rounded-xl shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-200 active:scale-[0.98]"
                            >
                                Rejouer
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── SOLO MATCH GAMEPLAY ─── */}
                {screen === "solo" && solo.questions.length > 0 && (
                    <div className="w-full max-w-2xl">
                        {/* progress bar */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-stone-600">
                                    Question {solo.currentQuestionIndex + 1} / {solo.questions.length}
                                </span>
                                <span className="text-sm text-stone-400">
                                    {Object.keys(solo.answers).length} / {solo.questions.length} répondue(s)
                                </span>
                            </div>
                            <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-amber-500 to-sky-500 rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${((solo.currentQuestionIndex + 1) / solo.questions.length) * 100}%` }}
                                />
                            </div>
                        </div>

                        {/* question card */}
                        <div className="bg-white/90 backdrop-blur border border-stone-200 rounded-2xl p-8 shadow-2xl">
                            <h3 className="text-xl font-semibold text-stone-800 mb-6 leading-relaxed">
                                {solo.questions[solo.currentQuestionIndex].prompt}
                            </h3>

                            {solo.questions[solo.currentQuestionIndex].imageUrl && (
                                <div className="mb-6 flex justify-center">
                                    <img
                                        src={solo.questions[solo.currentQuestionIndex].imageUrl!}
                                        alt="Illustration de la question"
                                        className="max-h-64 rounded-xl border border-stone-200 object-contain"
                                    />
                                </div>
                            )}

                            <div className="space-y-3">
                                {solo.questions[solo.currentQuestionIndex].options.map((opt) => {
                                    const isSelected = solo.answers[solo.questions[solo.currentQuestionIndex].id] === opt.id;
                                    return (
                                        <button
                                            key={opt.id}
                                            onClick={() => solo.selectAnswer(solo.questions[solo.currentQuestionIndex].id, opt.id)}
                                            className={`w-full text-left px-6 py-4 rounded-xl border-2 transition-all duration-200 ${
                                                isSelected
                                                    ? "bg-amber-500/15 border-amber-500 text-stone-800 shadow-lg shadow-amber-500/20"
                                                    : "bg-stone-50 border-stone-200 text-stone-700 hover:border-amber-400 hover:bg-amber-50/50"
                                            }`}
                                        >
                                            <span className="font-medium">{opt.label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* navigation */}
                            <div className="mt-8 flex items-center justify-between gap-4">
                                <button
                                    onClick={() => solo.setCurrentQuestionIndex(Math.max(0, solo.currentQuestionIndex - 1))}
                                    disabled={solo.currentQuestionIndex === 0}
                                    className="px-6 py-3 bg-stone-100 hover:bg-stone-200 disabled:opacity-30 disabled:cursor-not-allowed text-stone-600 font-medium rounded-xl border border-stone-300 transition-all"
                                >
                                    ← Précédent
                                </button>

                                {solo.currentQuestionIndex < solo.questions.length - 1 ? (
                                    <button
                                        onClick={() => solo.setCurrentQuestionIndex(solo.currentQuestionIndex + 1)}
                                        className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-white font-semibold rounded-xl transition-all"
                                    >
                                        Suivant →
                                    </button>
                                ) : (
                                    <button
                                        onClick={submitSoloMatch}
                                        disabled={Object.keys(solo.answers).length < solo.questions.length}
                                        className="px-8 py-3 bg-gradient-to-r from-amber-500 to-sky-500 hover:from-amber-400 hover:to-sky-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg transition-all"
                                    >
                                        Valider mes réponses
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── SOLO RESULTS ─── */}
                {screen === "solo-results" && solo.result && (
                    <div className="w-full max-w-lg">
                        <div className="bg-white/90 backdrop-blur border border-stone-200 rounded-2xl p-8 shadow-2xl">
                            <div className="text-center mb-8">
                                <div className="mb-4">
                                    {solo.result.score >= solo.result.total * 0.7 ? (
                                        <div className="text-6xl">🎉</div>
                                    ) : solo.result.score >= solo.result.total * 0.4 ? (
                                        <div className="text-6xl">👏</div>
                                    ) : (
                                        <div className="text-6xl">💪</div>
                                    )}
                                </div>

                                <h2 className="text-3xl font-bold text-stone-800 mb-2">Résultats</h2>

                                <div className="my-6">
                                    <div className="inline-flex items-baseline gap-1">
                                        <span className="text-6xl font-black bg-gradient-to-r from-amber-400 to-sky-400 bg-clip-text text-transparent">
                                            {solo.result.score}
                                        </span>
                                        <span className="text-2xl text-stone-400">/ {solo.result.total}</span>
                                    </div>
                                    <p className="mt-2 text-sm text-stone-400">Mode entraînement — pas d'impact sur l'Elo</p>
                                </div>

                            </div>

                            {/* detailed answers */}
                            <div className="mb-6 space-y-2">
                                <h3 className="text-sm font-semibold text-stone-500 mb-3">Correction détaillée</h3>
                                {solo.result.details.map((detail, idx) => {
                                    const isOpen = expandedQuestions.has(`solo-${idx}`);
                                    return (
                                        <div
                                            key={detail.questionId}
                                            className={`border rounded-xl overflow-hidden ${
                                                detail.isCorrect
                                                    ? "bg-green-500/5 border-green-500/30"
                                                    : "bg-red-500/5 border-red-500/30"
                                            }`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => setExpandedQuestions((prev) => {
                                                    const next = new Set(prev);
                                                    if (next.has(`solo-${idx}`)) next.delete(`solo-${idx}`);
                                                    else next.add(`solo-${idx}`);
                                                    return next;
                                                })}
                                                className="w-full flex items-center gap-3 p-4 text-left cursor-pointer hover:bg-stone-50 transition-colors"
                                            >
                                                <span className={`text-xl ${detail.isCorrect ? "text-green-500" : "text-red-500"}`}>
                                                    {detail.isCorrect ? "✓" : "✗"}
                                                </span>
                                                <span className="flex-1 text-sm text-stone-700 font-medium">Question {idx + 1}</span>
                                                <span className={`text-stone-400 text-xs transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
                                                    ▼
                                                </span>
                                            </button>

                                            {isOpen && (
                                                <div className="px-4 pb-4">
                                                    <p className="text-sm text-stone-600 mb-3 leading-relaxed">{detail.prompt}</p>
                                                    {detail.imageUrl && (
                                                        <div className="mb-3 flex justify-center">
                                                            <img
                                                                src={detail.imageUrl}
                                                                alt="Illustration"
                                                                className="max-h-48 rounded-lg border border-stone-200 object-contain"
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="space-y-2">
                                                        {detail.options.map((opt) => {
                                                            const isUserAnswer = opt.id === detail.userAnswerId;
                                                            const isCorrectAnswer = opt.id === detail.correctAnswerId;
                                                            return (
                                                                <div
                                                                    key={opt.id}
                                                                    className={`text-sm px-3 py-2 rounded-lg ${
                                                                        isCorrectAnswer
                                                                            ? "bg-green-500/15 text-green-700 font-semibold"
                                                                            : isUserAnswer
                                                                              ? "bg-red-500/15 text-red-600"
                                                                              : "bg-stone-100 text-stone-500"
                                                                    }`}
                                                                >
                                                                    {opt.label}
                                                                    {isCorrectAnswer && <span className="ml-2">✓ Bonne réponse</span>}
                                                                    {isUserAnswer && !isCorrectAnswer && <span className="ml-2">✗ Ta réponse</span>}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    {detail.explanation && (
                                                        <p className="mt-3 text-xs text-stone-400 italic leading-relaxed border-t border-stone-200 pt-3">
                                                            💡 {detail.explanation}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => {
                                    solo.resetMatch();
                                    setExpandedQuestions(new Set());
                                    setScreen("lobby");
                                }}
                                className="w-full py-4 text-lg bg-gradient-to-r from-amber-500 to-sky-500 hover:from-amber-400 hover:to-sky-400 text-white font-bold rounded-xl shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-200 active:scale-[0.98]"
                            >
                                Retour au lobby
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* FOOTER / DEBUG LOGS */}
            <footer className="px-6 py-3 border-t border-stone-200/60">
                <button
                    onClick={() => setShowLogs(!showLogs)}
                    className="text-xs text-stone-400 hover:text-stone-600 transition"
                >
                    {showLogs ? "▼ Masquer les logs" : "▶ Afficher les logs"}
                </button>
                {showLogs && (
                    <div className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-stone-100 border border-stone-200 p-3 font-mono text-[11px] text-stone-400 space-y-0.5">
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
