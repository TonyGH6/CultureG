// src/ws/index.ts
import { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { socketAuthMiddleware } from "./auth";
import { isPlayerInDuel } from "../duels/duels.repository";
import { logger } from "../shared/logger";

export let io: SocketIOServer | null = null;

export function initWebsocket(httpServer: HttpServer) {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: true,
            credentials: true,
        },
    });

    io.use(socketAuthMiddleware);

    io.on("connection", (socket) => {
        const userId = socket.data.userId as string;
        logger.info({ socketId: socket.id, userId }, "WS connected");

        socket.join(`user:${userId}`);

        socket.on("duel:join", async (payload: { duelId: string }) => {
            const duelId = String(payload?.duelId ?? "");
            if (!duelId) return;

            const player = await isPlayerInDuel(duelId, userId);

            if (!player) {
                socket.emit("error", { message: "Not a player in this duel" });
                return;
            }

            socket.join(`duel:${duelId}`);
            socket.emit("duel:joined", { duelId });
        });

        socket.on("disconnect", () => {
            // optional: track presence
        });
    });

    return io;
}
