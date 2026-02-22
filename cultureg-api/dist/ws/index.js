"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
exports.initWebsocket = initWebsocket;
const socket_io_1 = require("socket.io");
const auth_1 = require("./auth");
const duels_repository_1 = require("../duels/duels.repository");
const logger_1 = require("../shared/logger");
exports.io = null;
function initWebsocket(httpServer) {
    exports.io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: true,
            credentials: true,
        },
    });
    exports.io.use(auth_1.socketAuthMiddleware);
    exports.io.on("connection", (socket) => {
        const userId = socket.data.userId;
        logger_1.logger.info({ socketId: socket.id, userId }, "WS connected");
        socket.join(`user:${userId}`);
        socket.on("duel:join", async (payload) => {
            const duelId = String(payload?.duelId ?? "");
            if (!duelId)
                return;
            const player = await (0, duels_repository_1.isPlayerInDuel)(duelId, userId);
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
    return exports.io;
}
