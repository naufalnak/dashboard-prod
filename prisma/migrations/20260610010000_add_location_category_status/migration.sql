-- AlterTable
ALTER TABLE "Machine" ADD COLUMN "location" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Breakdown" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'Mechanical';
ALTER TABLE "Breakdown" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'open';

-- Backfill existing rows: treat past breakdowns as resolved
UPDATE "Breakdown" SET "status" = 'resolved' WHERE "endTime" IS NOT NULL;
