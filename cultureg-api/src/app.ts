import express from "express";
import cors from "cors";
import { authRouter } from "./auth/auth.routes";
import { questionsRouter } from "./questions/questions.routes";
import { matchesRouter } from "./matches/matches.routes";
import { queueRouter } from "./queue/queue.routes";
import { duelsRouter } from "./duels/duels.routes";
import { errorHandler } from "./middleware/errorHandler";
import { env } from "./env";

export const app = express();

// Trust proxy (behind Nginx) — required for express-rate-limit behind a reverse proxy
app.set("trust proxy", 1);

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
    res.json({
        ok: true,
        service: "cultureg-api",
        time: new Date().toISOString(),
    });
});

app.use("/auth", authRouter);
app.use("/questions", questionsRouter);
app.use("/matches", matchesRouter);
app.use("/queue", queueRouter);
app.use("/duels", duelsRouter);

// Global error handler — must be last
app.use(errorHandler);
