-- AlterTable
ALTER TABLE "DuelPlayer" ADD COLUMN     "score" INTEGER;

-- CreateTable
CREATE TABLE "DuelAnswer" (
    "id" TEXT NOT NULL,
    "duelId" TEXT NOT NULL,
    "playerUserId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "timeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuelAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DuelAnswer_duelId_playerUserId_questionId_key" ON "DuelAnswer"("duelId", "playerUserId", "questionId");

-- AddForeignKey
ALTER TABLE "DuelAnswer" ADD CONSTRAINT "DuelAnswer_duelId_playerUserId_fkey" FOREIGN KEY ("duelId", "playerUserId") REFERENCES "DuelPlayer"("duelId", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuelAnswer" ADD CONSTRAINT "DuelAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuelAnswer" ADD CONSTRAINT "DuelAnswer_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "QuestionOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
