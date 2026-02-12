import { z } from "zod";

export const joinQueueSchema = z.object({
    theme: z.string().min(1),
});
