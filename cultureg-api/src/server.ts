import http from "http";
import { env } from "./env";
import { app } from "./app";
import { initWebsocket } from "./ws";
import { logger } from "./shared/logger";
import { expireStaleduels } from "./duels/duels.service";

const server = http.createServer(app);
initWebsocket(server);

server.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "API running");

    // Run duel expiry check every 60 seconds
    setInterval(() => {
        expireStaleduels().catch((err) =>
            logger.error({ err }, "Duel expiry job failed")
        );
    }, 60_000);

    // Also run once at startup to clean leftover stale duels
    expireStaleduels().catch((err) =>
        logger.error({ err }, "Initial duel expiry failed")
    );
});
