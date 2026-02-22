"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActive = getActive;
exports.getById = getById;
exports.submit = submit;
exports.leave = leave;
const duels_validators_1 = require("./duels.validators");
const duelService = __importStar(require("./duels.service"));
const matchmaking_memory_1 = require("../queue/matchmaking.memory");
const queue_repository_1 = require("../queue/queue.repository");
async function getActive(req, res) {
    const result = await duelService.getActiveDuel({ userId: req.userId });
    if (!result.ok)
        return res.status(result.status).json({ error: result.error });
    // If the duel is WAITING, re-enqueue in memory so opponents can still find us
    const duel = result.duel;
    if (duel?.status === "WAITING") {
        const elo = await (0, queue_repository_1.getUserElo)(req.userId);
        (0, matchmaking_memory_1.enqueueWaiting)({
            userId: req.userId,
            theme: duel.theme,
            mode: duel.mode ?? "CLASSIC",
            elo,
            duelId: duel.id,
        });
    }
    return res.json(result);
}
async function getById(req, res) {
    const duelId = String(req.params.duelId);
    const result = await duelService.getDuel({ userId: req.userId, duelId });
    if (!result.ok)
        return res.status(result.status).json({ error: result.error });
    return res.json(result);
}
async function submit(req, res) {
    const duelId = String(req.params.duelId);
    const parsed = duels_validators_1.submitDuelSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const result = await duelService.submitDuelAnswers({
        userId: req.userId,
        duelId,
        answers: parsed.data.answers,
    });
    if (!result.ok)
        return res.status(result.status).json({ error: result.error });
    return res.json(result);
}
async function leave(req, res) {
    const duelId = String(req.params.duelId);
    const result = await duelService.leaveDuel({ userId: req.userId, duelId });
    if (!result.ok)
        return res.status(result.status).json({ error: result.error });
    return res.json({ left: true });
}
