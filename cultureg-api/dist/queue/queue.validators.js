"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinQueueSchema = void 0;
const zod_1 = require("zod");
exports.joinQueueSchema = zod_1.z.object({
    theme: zod_1.z.string().min(1),
    mode: zod_1.z.enum(["CLASSIC", "FRENZY"]).default("CLASSIC"),
});
