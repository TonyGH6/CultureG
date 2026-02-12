import { z } from "zod";

export const submitDuelSchema = z.object({
    answers: z.array(
        z.object({
            questionId: z.string().uuid(),
            optionId: z.string().uuid(),
            timeMs: z.number().optional(),
        })
    ),
});
