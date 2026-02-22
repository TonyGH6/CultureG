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
exports.start = start;
exports.submit = submit;
exports.history = history;
const matches_validators_1 = require("./matches.validators");
const matchService = __importStar(require("./matches.service"));
async function start(req, res) {
    const parsed = matches_validators_1.startMatchSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const result = await matchService.startMatch({
        userId: req.userId,
        theme: parsed.data.theme,
        limit: parsed.data.limit,
    });
    if (!result.ok)
        return res.status(result.status).json({ error: result.error });
    return res.status(201).json(result);
}
async function submit(req, res) {
    const matchId = String(req.params.matchId);
    const parsed = matches_validators_1.submitMatchSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const result = await matchService.submitMatch({
        userId: req.userId,
        matchId,
        answers: parsed.data.answers,
    });
    if (!result.ok)
        return res.status(result.status).json({ error: result.error });
    return res.json(result);
}
async function history(req, res) {
    const parsed = matches_validators_1.historyQuerySchema.safeParse(req.query);
    if (!parsed.success)
        return res.status(400).json({ error: "Invalid query params" });
    const matches = await matchService.getMatchHistory(req.userId, parsed.data.limit);
    return res.json({ matches });
}
