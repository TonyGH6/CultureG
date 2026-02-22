"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const env_1 = require("./env");
const app_1 = require("./app");
const ws_1 = require("./ws");
const logger_1 = require("./shared/logger");
const duels_service_1 = require("./duels/duels.service");
const server = http_1.default.createServer(app_1.app);
(0, ws_1.initWebsocket)(server);
server.listen(env_1.env.PORT, () => {
    logger_1.logger.info({ port: env_1.env.PORT }, "API running");
    // Run duel expiry check every 60 seconds
    setInterval(() => {
        (0, duels_service_1.expireStaleduels)().catch((err) => logger_1.logger.error({ err }, "Duel expiry job failed"));
    }, 60000);
    // Also run once at startup to clean leftover stale duels
    (0, duels_service_1.expireStaleduels)().catch((err) => logger_1.logger.error({ err }, "Initial duel expiry failed"));
});
