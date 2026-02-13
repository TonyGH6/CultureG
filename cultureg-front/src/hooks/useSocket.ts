import { useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { API_BASE } from "../api";

/**
 * Derive the Socket.IO connection URL and path from API_BASE.
 * API_BASE might be "http://host/api" in production (behind nginx)
 * or "http://localhost:3000" in development.
 *
 * Socket.IO needs:
 *  - url  = origin only  (e.g. "http://host")
 *  - path = "/api/socket.io/"  (so nginx routes it correctly)
 */
function getSocketConfig() {
    const url = new URL(API_BASE);
    const base = url.pathname.replace(/\/+$/, ""); // e.g. "/api" or ""
    return {
        url: url.origin,
        path: base ? `${base}/socket.io/` : "/socket.io/",
    };
}

export function useSocket(token: string, onLog: (msg: string) => void) {
    const socketRef = useRef<Socket | null>(null);

    const connect = useCallback(() => {
        if (!token) throw new Error("No token");
        if (socketRef.current?.connected) return socketRef.current;

        const { url, path } = getSocketConfig();
        onLog(`WS connecting to ${url} path=${path}`);

        const s = io(url, {
            auth: { token },
            path,
            transports: ["websocket"],
        });

        socketRef.current = s;

        s.on("connect", () => onLog(`WS connected: ${s.id}`));
        s.on("connect_error", (err) => onLog(`WS connect_error: ${err.message}`));
        s.on("disconnect", (reason) => onLog(`WS disconnected: ${reason}`));

        onLog("WS connecting...");
        return s;
    }, [token, onLog]);

    const disconnect = useCallback(() => {
        socketRef.current?.disconnect();
        socketRef.current = null;
    }, []);

    const joinDuelRoom = useCallback(
        (duelId: string) => {
            const s = socketRef.current;
            if (!s?.connected) {
                onLog("WS not connected (connect first)");
                return;
            }
            s.emit("duel:join", { duelId });
            onLog(`WS emitted duel:join duelId=${duelId}`);
        },
        [onLog]
    );

    const on = useCallback(
        (event: string, handler: (...args: any[]) => void) => {
            socketRef.current?.on(event, handler);
        },
        []
    );

    return { socketRef, connect, disconnect, joinDuelRoom, on };
}
