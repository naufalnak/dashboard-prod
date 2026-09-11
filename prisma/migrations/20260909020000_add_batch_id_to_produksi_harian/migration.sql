-- Additive-only: 1 kolom nullable baru + 1 index, tidak ada data yang
-- diubah/dihapus. Link EKSPLISIT antar baris satu submit multi-Mesin
-- (RC Harian centang-banyak-Mesin, atau "+ Tambah Mesin" di Data
-- Produksi) -- lihat catatan lengkap di schema.prisma & di
-- createProduksiHarian/updateProduksiHarian (produksi.service.js).

ALTER TABLE "shared"."ProduksiHarian" ADD COLUMN "batch_id" TEXT;

CREATE INDEX "ProduksiHarian_batch_id_idx" ON "shared"."ProduksiHarian"("batch_id");
