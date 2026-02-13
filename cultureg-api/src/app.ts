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

// Force HTTPS in production
if (env.NODE_ENV === "production") {
    app.use((req, res, next) => {
        if (req.header("x-forwarded-proto") !== "https") {
            return res.redirect(`https://${req.header("host")}${req.url}`);
        }
        next();
    });
}

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
