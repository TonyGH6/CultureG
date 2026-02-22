"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listQuestionsSchema = void 0;
const zod_1 = require("zod");
exports.listQuestionsSchema = zod_1.z.object({
    theme: zod_1.z.string().optional(),
    limit: zod_1.z.coerce.number().min(1).max(20).default(10),
});
