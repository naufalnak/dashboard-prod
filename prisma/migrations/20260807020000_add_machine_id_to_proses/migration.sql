-- AlterTable
ALTER TABLE "MasterProses" ADD COLUMN "machine_id" INTEGER;

-- AddForeignKey
ALTER TABLE "MasterProses" ADD CONSTRAINT "MasterProses_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
