import { z } from "zod";

export const startMatchSchema = z.object({
    theme: z.string().min(1),
    limit: z.coerce.number().int().min(1).max(20).default(10),
});

export const submitMatchSchema = z.object({
    answers: z
        .array(
            z.object({
                questionId: z.string().uuid(),
                optionId: z.string().uuid(),
                timeMs: z.number().int().min(0).optional(),
            })
        )
        .min(1)
        .max(20),
});

export const historyQuerySchema = z.object({
    limit: z.coerce.number().min(1).max(50).default(10),
});
