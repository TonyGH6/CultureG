import { Router } from "express";
import { z } from "zod";
import { prisma } from "../shared/prisma";
import { asyncHandler } from "../middleware/errorHandler";

export const questionsRouter = Router();

const querySchema = z.object({
    theme: z.string().optional(),
    limit: z.coerce.number().min(1).max(20).default(5),
});

questionsRouter.get(
    "/",
    asyncHandler(async (req, res) => {
        const parsed = querySchema.safeParse(req.query);
        if (!parsed.success) {
            return res.status(400).json({ error: "Invalid query params" });
        }

        const { theme, limit } = parsed.data;

        const questions = await prisma.question.findMany({
            where: theme ? { theme } : undefined,
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
                options: {
                    select: { id: true, label: true, orderIndex: true },
                    orderBy: { orderIndex: "asc" },
                },
            },
        });

        return res.json({ questions });
    })
);
