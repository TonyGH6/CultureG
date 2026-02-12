-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('QCM');

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionOption" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "orderIndex" INTEGER NOT NULL,
    "questionId" TEXT NOT NULL,

    CONSTRAINT "QuestionOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuestionOption_questionId_orderIndex_key" ON "QuestionOption"("questionId", "orderIndex");

-- AddForeignKey
ALTER TABLE "QuestionOption" ADD CONSTRAINT "QuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
