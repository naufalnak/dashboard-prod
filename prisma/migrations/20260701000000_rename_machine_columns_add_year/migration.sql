-- Rename Machine table columns to match the new naming convention.
-- Application-level Prisma field names (name, assetNumber, type, brand,
-- power, shift, plannedHours) are unchanged via @map decorators, so
-- existing API routes and frontend components continue to work as-is.
--
-- Column renames:
--   name         → machine          (Nama Mesin)
--   assetNumber  → id_asset_machine (Nomor Asset)
--   type         → type_machine     (Tipe Mesin)
--   brand        → brand_machine    (Merk)
--   power        → power_machine    (Daya — kept as TEXT, not numeric)
--   plannedHours → worktime_machine (Jam Waktu Kerja)
--
-- Column additions:
--   year_machine (TEXT, nullable)   (Tahun Mesin)
--
-- Columns that stay the same name: cluster, line, shift, status,
-- performancePct, qualityPct, createdAt

-- Rename existing columns
ALTER TABLE "Machine" RENAME COLUMN "name"         TO "machine";
ALTER TABLE "Machine" RENAME COLUMN "assetNumber"  TO "id_asset_machine";
ALTER TABLE "Machine" RENAME COLUMN "type"         TO "type_machine";
ALTER TABLE "Machine" RENAME COLUMN "brand"        TO "brand_machine";
ALTER TABLE "Machine" RENAME COLUMN "power"        TO "power_machine";
ALTER TABLE "Machine" RENAME COLUMN "plannedHours" TO "worktime_machine";

-- Add new column year_machine (TEXT nullable so existing rows are unaffected)
ALTER TABLE "Machine" ADD COLUMN "year_machine" TEXT;

-- Update the unique index from the old column name to the new one
-- (Prisma's unique constraint on 'name' becomes a constraint on 'machine')
DROP INDEX IF EXISTS "Machine_name_key";
CREATE UNIQUE INDEX "Machine_machine_key" ON "Machine"("machine");
