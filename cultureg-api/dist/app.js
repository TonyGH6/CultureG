"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_routes_1 = require("./auth/auth.routes");
const questions_routes_1 = require("./questions/questions.routes");
const matches_routes_1 = require("./matches/matches.routes");
const queue_routes_1 = require("./queue/queue.routes");
const duels_routes_1 = require("./duels/duels.routes");
const errorHandler_1 = require("./middleware/errorHandler");
exports.app = (0, express_1.default)();
// Trust proxy (behind Nginx) — required for express-rate-limit behind a reverse proxy
exports.app.set("trust proxy", 1);
exports.app.use((0, cors_1.default)());
exports.app.use(express_1.default.json());
exports.app.get("/health", (_req, res) => {
    res.json({
        ok: true,
        service: "cultureg-api",
        time: new Date().toISOString(),
    });
});
exports.app.use("/auth", auth_routes_1.authRouter);
exports.app.use("/questions", questions_routes_1.questionsRouter);
exports.app.use("/matches", matches_routes_1.matchesRouter);
exports.app.use("/queue", queue_routes_1.queueRouter);
exports.app.use("/duels", duels_routes_1.duelsRouter);
// Global error handler — must be last
exports.app.use(errorHandler_1.errorHandler);
