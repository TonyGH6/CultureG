-- CreateEnum
CREATE TYPE "DuelStatus" AS ENUM ('CREATED', 'ONGOING', 'FINISHED', 'CANCELED');

-- CreateTable
CREATE TABLE "Duel" (
    "id" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "status" "DuelStatus" NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Duel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuelPlayer" (
    "id" TEXT NOT NULL,
    "duelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuelPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuelQuestion" (
    "id" TEXT NOT NULL,
    "duelId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,

    CONSTRAINT "DuelQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DuelPlayer_duelId_userId_key" ON "DuelPlayer"("duelId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DuelQuestion_duelId_orderIndex_key" ON "DuelQuestion"("duelId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "DuelQuestion_duelId_questionId_key" ON "DuelQuestion"("duelId", "questionId");

-- AddForeignKey
ALTER TABLE "DuelPlayer" ADD CONSTRAINT "DuelPlayer_duelId_fkey" FOREIGN KEY ("duelId") REFERENCES "Duel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuelPlayer" ADD CONSTRAINT "DuelPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuelQuestion" ADD CONSTRAINT "DuelQuestion_duelId_fkey" FOREIGN KEY ("duelId") REFERENCES "Duel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuelQuestion" ADD CONSTRAINT "DuelQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
