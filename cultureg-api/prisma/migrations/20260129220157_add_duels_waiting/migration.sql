/*
  Warnings:

  - The values [CREATED] on the enum `DuelStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DuelStatus_new" AS ENUM ('WAITING', 'ONGOING', 'FINISHED', 'CANCELED');
ALTER TABLE "public"."Duel" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Duel" ALTER COLUMN "status" TYPE "DuelStatus_new" USING ("status"::text::"DuelStatus_new");
ALTER TYPE "DuelStatus" RENAME TO "DuelStatus_old";
ALTER TYPE "DuelStatus_new" RENAME TO "DuelStatus";
DROP TYPE "public"."DuelStatus_old";
ALTER TABLE "Duel" ALTER COLUMN "status" SET DEFAULT 'WAITING';
COMMIT;

-- AlterTable
ALTER TABLE "Duel" ALTER COLUMN "status" SET DEFAULT 'WAITING';
