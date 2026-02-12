-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('CREATED', 'FINISHED');

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'CREATED',
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchQuestion" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,

    CONSTRAINT "MatchQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchAnswer" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "timeMs" INTEGER,

    CONSTRAINT "MatchAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchQuestion_matchId_orderIndex_key" ON "MatchQuestion"("matchId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "MatchQuestion_matchId_questionId_key" ON "MatchQuestion"("matchId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchAnswer_matchId_questionId_key" ON "MatchAnswer"("matchId", "questionId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchQuestion" ADD CONSTRAINT "MatchQuestion_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchQuestion" ADD CONSTRAINT "MatchQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchAnswer" ADD CONSTRAINT "MatchAnswer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchAnswer" ADD CONSTRAINT "MatchAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchAnswer" ADD CONSTRAINT "MatchAnswer_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "QuestionOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
