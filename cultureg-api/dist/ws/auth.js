"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketAuthMiddleware = socketAuthMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../env");
function socketAuthMiddleware(socket, next) {
    try {
        const token = socket.handshake.auth?.token;
        if (!token || typeof token !== "string") {
            return next(new Error("Missing token"));
        }
        const payload = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
        socket.data.userId = payload.sub;
        return next();
    }
    catch {
        return next(new Error("Invalid token"));
    }
}
