import { z } from "zod";

export const listQuestionsSchema = z.object({
    theme: z.string().optional(),
    limit: z.coerce.number().min(1).max(20).default(10),
});

export type ListQuestionsInput = z.infer<typeof listQuestionsSchema>;
