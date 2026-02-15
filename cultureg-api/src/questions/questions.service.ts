import { ok, type ServiceResult } from "../shared/result";
import * as questionsRepo from "./questions.repository";
import { toQuestionListDto, type QuestionDto } from "./questions.mapper";
import type { ListQuestionsInput } from "./questions.validator";

export async function listQuestions(
    input: ListQuestionsInput
): Promise<ServiceResult<{ questions: QuestionDto[] }>> {
    const questions = await questionsRepo.findMany({
        theme: input.theme,
        limit: input.limit,
    });

    return ok({ questions: toQuestionListDto(questions) });
}
