"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitDuelSchema = void 0;
const zod_1 = require("zod");
exports.submitDuelSchema = zod_1.z.object({
    answers: zod_1.z.array(zod_1.z.object({
        questionId: zod_1.z.string().uuid(),
        optionId: zod_1.z.string().uuid(),
        timeMs: zod_1.z.number().optional(),
    })),
});
