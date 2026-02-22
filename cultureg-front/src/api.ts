export const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

export type LoginResp = {
    token: string;
    user: { id: string; email: string; username: string; elo: number };
};

export type QueueJoinResp =
    | { queued: true; theme: string; duelId: string; queueSize: number }
    | { queued: false; matched: true; theme: string; duelId: string; opponentUserId: string };

export type DuelQuestion = {
    orderIndex: number;
    id: string;
    slug: string;
    prompt: string;
    imageUrl: string | null;
    options: { id: string; label: string; orderIndex: number }[];
};

export type DuelResp = {
    ok: true;
    duel: {
        id: string;
        theme: string;
        mode: "CLASSIC" | "FRENZY";
        durationSec: number | null;
        status: "WAITING" | "ONGOING" | "FINISHED" | "CANCELED";
        players: { userId: string; joinedAt: string }[];
        questions: DuelQuestion[];
    };
};

export type SoloMatchQuestion = {
    id: string;
    slug: string;
    prompt: string;
    imageUrl: string | null;
    options: { id: string; label: string; orderIndex: number }[];
};

export type StartMatchResp = {
    ok: true;
    matchId: string;
    theme: string;
    questions: SoloMatchQuestion[];
};

export type SubmitMatchResp = {
    ok: true;
    matchId: string;
    score: number;
    total: number;
    details: {
        questionId: string;
        prompt: string;
        explanation: string | null;
        imageUrl: string | null;
        isCorrect: boolean;
        userAnswerId: string;
        correctAnswerId: string;
        options: { id: string; label: string; isCorrect: boolean }[];
    }[];
};

export type ActiveDuelResp = {
    ok: true;
    duel: {
        id: string;
        theme: string;
        mode: "CLASSIC" | "FRENZY";
        durationSec: number | null;
        status: "WAITING" | "ONGOING";
        alreadySubmitted: boolean;
        players: { userId: string; joinedAt: string }[];
        questions: DuelQuestion[];
    };
} | { ok: true; duel: null };

export async function api<T>(path: string, opts: RequestInit & { token?: string } = {}): Promise<T> {
    const headers = new Headers(opts.headers);
    headers.set("Accept", "application/json");
    if (opts.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    if (opts.token) headers.set("Authorization", `Bearer ${opts.token}`);

    const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });

    const text = await res.text();
    let json: any = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        // ignore
    }

    if (!res.ok) {
        const msg = json?.error ? String(json.error) : `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return json as T;
}
