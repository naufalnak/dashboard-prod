-- Tambah kolom foreign key (nullable) di samping kolom teks yang sudah
-- ada, supaya tabel-tabel yang selama ini cuma terhubung lewat
-- pencocokan nama (mis. ProduksiHarian.part_name = MasterPartName.part_name)
-- sekarang juga punya relasi FK asli yang kelihatan di Supabase schema
-- view. Kolom teks lama TETAP ADA dan tetap dipakai aplikasi -- migrasi
-- ini murni tambahan (additive), tidak mengubah baca/tulis yang sudah ada.
--
-- Backfill dicocokkan case-insensitive (lower/trim) supaya lebih banyak
-- baris ke-link; baris yang datanya tidak cocok sama sekali (nama beda/
-- typo di data lama) akan punya *_id NULL -- aman, tidak error, tidak
-- kehilangan data.

-- MasterGroupHead.cluster -> CLUSTER.id
ALTER TABLE "MasterGroupHead" ADD COLUMN "cluster_id" INTEGER;
UPDATE "MasterGroupHead" g SET "cluster_id" = c.id
  FROM "CLUSTER" c WHERE lower(trim(g."cluster")) = lower(trim(c."CLUSTER"));
ALTER TABLE "MasterGroupHead" ADD CONSTRAINT "MasterGroupHead_cluster_id_fkey"
  FOREIGN KEY ("cluster_id") REFERENCES "CLUSTER"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- MasterPartName.cluster -> CLUSTER.id
ALTER TABLE "MasterPartName" ADD COLUMN "cluster_id" INTEGER;
UPDATE "MasterPartName" p SET "cluster_id" = c.id
  FROM "CLUSTER" c WHERE lower(trim(p."cluster")) = lower(trim(c."CLUSTER"));
ALTER TABLE "MasterPartName" ADD CONSTRAINT "MasterPartName_cluster_id_fkey"
  FOREIGN KEY ("cluster_id") REFERENCES "CLUSTER"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- MasterProses.part_name -> MasterPartName.id
ALTER TABLE "MasterProses" ADD COLUMN "part_name_id" INTEGER;
UPDATE "MasterProses" pr SET "part_name_id" = pn.id
  FROM "MasterPartName" pn WHERE lower(trim(pr."part_name")) = lower(trim(pn."part_name"));
ALTER TABLE "MasterProses" ADD CONSTRAINT "MasterProses_part_name_id_fkey"
  FOREIGN KEY ("part_name_id") REFERENCES "MasterPartName"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- MasterManPower.group_head -> MasterGroupHead.id
ALTER TABLE "MasterManPower" ADD COLUMN "group_head_id" INTEGER;
UPDATE "MasterManPower" m SET "group_head_id" = g.id
  FROM "MasterGroupHead" g WHERE lower(trim(m."group_head")) = lower(trim(g."name"));
ALTER TABLE "MasterManPower" ADD CONSTRAINT "MasterManPower_group_head_id_fkey"
  FOREIGN KEY ("group_head_id") REFERENCES "MasterGroupHead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ProduksiHarian.cluster -> CLUSTER.id
ALTER TABLE "ProduksiHarian" ADD COLUMN "cluster_id" INTEGER;
UPDATE "ProduksiHarian" r SET "cluster_id" = c.id
  FROM "CLUSTER" c WHERE lower(trim(r."cluster")) = lower(trim(c."CLUSTER"));
ALTER TABLE "ProduksiHarian" ADD CONSTRAINT "ProduksiHarian_cluster_id_fkey"
  FOREIGN KEY ("cluster_id") REFERENCES "CLUSTER"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ProduksiHarian.grup_head -> MasterGroupHead.id
ALTER TABLE "ProduksiHarian" ADD COLUMN "grup_head_id" INTEGER;
UPDATE "ProduksiHarian" r SET "grup_head_id" = g.id
  FROM "MasterGroupHead" g
  WHERE r."grup_head" IS NOT NULL AND lower(trim(r."grup_head")) = lower(trim(g."name"));
ALTER TABLE "ProduksiHarian" ADD CONSTRAINT "ProduksiHarian_grup_head_id_fkey"
  FOREIGN KEY ("grup_head_id") REFERENCES "MasterGroupHead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ProduksiHarian.part_name -> MasterPartName.id
ALTER TABLE "ProduksiHarian" ADD COLUMN "part_name_id" INTEGER;
UPDATE "ProduksiHarian" r SET "part_name_id" = pn.id
  FROM "MasterPartName" pn WHERE lower(trim(r."part_name")) = lower(trim(pn."part_name"));
ALTER TABLE "ProduksiHarian" ADD CONSTRAINT "ProduksiHarian_part_name_id_fkey"
  FOREIGN KEY ("part_name_id") REFERENCES "MasterPartName"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ProduksiHarian.(proses, part_name) -> MasterProses.id
ALTER TABLE "ProduksiHarian" ADD COLUMN "proses_id" INTEGER;
UPDATE "ProduksiHarian" r SET "proses_id" = pr.id
  FROM "MasterProses" pr
  WHERE lower(trim(r."proses")) = lower(trim(pr."proses"))
    AND lower(trim(r."part_name")) = lower(trim(pr."part_name"));
ALTER TABLE "ProduksiHarian" ADD CONSTRAINT "ProduksiHarian_proses_id_fkey"
  FOREIGN KEY ("proses_id") REFERENCES "MasterProses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ProduksiHarian.man_power -> MasterManPower.id
ALTER TABLE "ProduksiHarian" ADD COLUMN "man_power_id" INTEGER;
UPDATE "ProduksiHarian" r SET "man_power_id" = m.id
  FROM "MasterManPower" m
  WHERE r."man_power" IS NOT NULL AND lower(trim(r."man_power")) = lower(trim(m."name"));
ALTER TABLE "ProduksiHarian" ADD CONSTRAINT "ProduksiHarian_man_power_id_fkey"
  FOREIGN KEY ("man_power_id") REFERENCES "MasterManPower"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ProblemLog.part_name -> MasterPartName.id
ALTER TABLE "ProblemLog" ADD COLUMN "part_name_id" INTEGER;
UPDATE "ProblemLog" pl SET "part_name_id" = pn.id
  FROM "MasterPartName" pn
  WHERE pl."part_name" IS NOT NULL AND lower(trim(pl."part_name")) = lower(trim(pn."part_name"));
ALTER TABLE "ProblemLog" ADD CONSTRAINT "ProblemLog_part_name_id_fkey"
  FOREIGN KEY ("part_name_id") REFERENCES "MasterPartName"("id") ON DELETE SET NULL ON UPDATE CASCADE;
