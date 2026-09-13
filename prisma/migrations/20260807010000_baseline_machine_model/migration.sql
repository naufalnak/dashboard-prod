-- Baseline: tabel "Machine" ini SUDAH ADA sebelumnya (dibuat & dikelola
-- awalnya oleh Dashboard-MTN, sekarang di-share dengan Dashboard-PROD atas
-- keputusan eksplisit -- lihat komentar di model Machine pada schema.prisma).
-- Migration ini di-resolve sebagai "applied" TANPA dijalankan di database
-- yang sudah punya tabel Machine (lihat `prisma migrate resolve --applied`
-- di README/chat setup) -- isinya cuma dokumentasi struktur supaya `prisma
-- migrate reset`/fresh database lain bisa membuat ulang tabel yang sama.
CREATE TABLE "Machine" (
    "id" SERIAL NOT NULL,
    "machine" TEXT NOT NULL,
    "worktime_machine" DOUBLE PRECISION NOT NULL DEFAULT 16,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cluster" TEXT NOT NULL DEFAULT '',
    "line" TEXT NOT NULL DEFAULT '',
    "id_asset_machine" TEXT NOT NULL DEFAULT '',
    "brand_machine" TEXT NOT NULL DEFAULT '',
    "power_machine" TEXT NOT NULL DEFAULT '',
    "shift" TEXT NOT NULL DEFAULT '',
    "type_machine" TEXT NOT NULL DEFAULT '',
    "year_machine" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Machine_machine_key" ON "Machine"("machine");
