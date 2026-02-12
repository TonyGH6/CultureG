// src/ws/auth.ts
import type { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../env";

export type SocketAuthData = {
    userId: string;
};

export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
    try {
        const token = socket.handshake.auth?.token;
        if (!token || typeof token !== "string") {
            return next(new Error("Missing token"));
        }

        const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
        (socket.data as SocketAuthData).userId = payload.sub;
        return next();
    } catch {
        return next(new Error("Invalid token"));
    }
}
