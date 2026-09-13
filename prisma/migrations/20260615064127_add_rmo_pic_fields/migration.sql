-- AlterTable
ALTER TABLE "Breakdown" ADD COLUMN     "action" TEXT,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "picGh" TEXT,
ADD COLUMN     "picMtn" TEXT,
ADD COLUMN     "resolution" TEXT;
