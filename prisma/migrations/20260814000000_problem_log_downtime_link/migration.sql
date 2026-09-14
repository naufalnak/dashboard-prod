-- Loss Time & Breakdown Mesin (menit) langsung di ProblemLog, supaya
-- kolom "Total Loss Time" di menu Problem Produksi tidak perlu join
-- rapuh ke ProduksiHarian.
ALTER TABLE "ProblemLog" ADD COLUMN "lost_time" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "ProblemLog" ADD COLUMN "breakdown_mesin" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Link opsional ke baris ProduksiHarian sumbernya, dipakai upsert (cari-
-- atau-buat) supaya edit ulang baris ProduksiHarian yang sama tidak
-- membuat baris ProblemLog duplikat.
ALTER TABLE "ProblemLog" ADD COLUMN "produksi_harian_id" INTEGER;
CREATE UNIQUE INDEX "ProblemLog_produksi_harian_id_key" ON "ProblemLog"("produksi_harian_id");
ALTER TABLE "ProblemLog" ADD CONSTRAINT "ProblemLog_produksi_harian_id_fkey"
  FOREIGN KEY ("produksi_harian_id") REFERENCES "ProduksiHarian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Status "in_progress" dihapus dari alur kerja -- baris lama (kalau ada)
-- dipindah ke "open" supaya tidak jadi status tak dikenal di UI.
UPDATE "ProblemLog" SET status = 'open' WHERE status = 'in_progress';
