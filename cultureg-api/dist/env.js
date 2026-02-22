"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
require("dotenv/config");
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    PORT: zod_1.z.coerce.number().int().positive().default(3000),
    JWT_SECRET: zod_1.z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    NODE_ENV: zod_1.z.enum(["development", "production", "test"]).default("development"),
});
exports.env = envSchema.parse(process.env);
