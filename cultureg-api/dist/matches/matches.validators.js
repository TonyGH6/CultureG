"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.historyQuerySchema = exports.submitMatchSchema = exports.startMatchSchema = void 0;
const zod_1 = require("zod");
exports.startMatchSchema = zod_1.z.object({
    theme: zod_1.z.string().min(1),
    limit: zod_1.z.coerce.number().int().min(1).max(20).default(10),
});
exports.submitMatchSchema = zod_1.z.object({
    answers: zod_1.z
        .array(zod_1.z.object({
        questionId: zod_1.z.string().uuid(),
        optionId: zod_1.z.string().uuid(),
        timeMs: zod_1.z.number().int().min(0).optional(),
    }))
        .min(1)
        .max(20),
});
exports.historyQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().min(1).max(50).default(10),
});
