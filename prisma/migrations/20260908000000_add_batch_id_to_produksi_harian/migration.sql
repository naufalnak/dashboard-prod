-- Link EKSPLISIT antar baris ProduksiHarian yang berasal dari satu submit
-- multi-Mesin (RC Harian input mode centang-banyak-Mesin, atau
-- "+ Tambah Mesin" di Data Produksi) -- menggantikan pendekatan lama yang
-- menebak "satu batch" dari kecocokan field produksi (tanggal/plan/ok
-- dkk sama persis), yang terbukti salah-kumpul baris yang KEBETULAN
-- nilainya sama padahal tidak terkait sama sekali (lihat riwayat commit
-- b4c857f -> revert fb3c88a). Null untuk baris lama/baris biasa -- tidak
-- di-backfill, cuma dipakai baris BARU yang dibuat lewat mekanisme
-- fan-out setelah migrasi ini.
ALTER TABLE "ProduksiHarian" ADD COLUMN "batch_id" TEXT;
CREATE INDEX "ProduksiHarian_batch_id_idx" ON "ProduksiHarian"("batch_id");
