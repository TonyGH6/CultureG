-- CreateEnum
CREATE TYPE "DuelMode" AS ENUM ('CLASSIC', 'FRENZY');

-- AlterTable
ALTER TABLE "Duel" ADD COLUMN     "durationSec" INTEGER,
ADD COLUMN     "mode" "DuelMode" NOT NULL DEFAULT 'CLASSIC';
