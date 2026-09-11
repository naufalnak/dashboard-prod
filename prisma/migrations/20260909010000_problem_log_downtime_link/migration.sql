-- Additive-only, tidak menyentuh/menghapus data yang sudah ada:
-- Loss Time & Breakdown Mesin (menit) langsung di ProblemLog + link
-- opsional ke baris ProduksiHarian sumbernya (auto-sync, lihat
-- syncLinkedProblemLog di src/services/produksi.service.js). Semua kolom
-- baru nullable atau berdefault 0, tidak ada kolom/tabel yang dihapus,
-- dan status "in_progress" TIDAK ikut dihapus (beda dari versi 8 Sept --
-- sengaja dipertahankan di sini, di luar scope perubahan ini).

ALTER TABLE "shared"."ProblemLog" ADD COLUMN "lost_time" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "shared"."ProblemLog" ADD COLUMN "breakdown_mesin" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "shared"."ProblemLog" ADD COLUMN "produksi_harian_id" INTEGER;

CREATE UNIQUE INDEX "ProblemLog_produksi_harian_id_key" ON "shared"."ProblemLog"("produksi_harian_id");

ALTER TABLE "shared"."ProblemLog" ADD CONSTRAINT "ProblemLog_produksi_harian_id_fkey"
  FOREIGN KEY ("produksi_harian_id") REFERENCES "shared"."ProduksiHarian"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ProblemLog_jenis_problem_idx" ON "shared"."ProblemLog"("jenis_problem");
