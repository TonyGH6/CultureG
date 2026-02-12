import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),
    JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
});

export const env = envSchema.parse(process.env);
