import type { Request, Response } from "express";
import { listQuestionsSchema } from "./questions.validator";
import * as questionsService from "./questions.service";

export async function list(req: Request, res: Response) {
    const parsed = listQuestionsSchema.safeParse(req.query);
    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid query params" });
    }

    const result = await questionsService.listQuestions(parsed.data);
    if (!result.ok) return res.status(result.status).json({ error: result.error });

    return res.json(result);
}
