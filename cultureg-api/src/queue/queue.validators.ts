import { z } from "zod";

export const joinQueueSchema = z.object({
    theme: z.string().min(1),
    mode: z.enum(["CLASSIC", "FRENZY"]).default("CLASSIC"),
});
