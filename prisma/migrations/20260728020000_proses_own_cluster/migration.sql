-- MasterProses gets its own "cluster" column instead of always reading it
-- via the shared MasterPartName row. Editing one Proses row's Cluster
-- should never ripple into sibling Proses rows that happen to share the
-- same Part Name -- each row now carries its own value.
ALTER TABLE "MasterProses" ADD COLUMN "cluster" TEXT NOT NULL DEFAULT '';

-- Backfill from the currently-joined Part Name's cluster so existing rows
-- start out correct.
UPDATE "MasterProses" pr SET "cluster" = pn."cluster"
  FROM "MasterPartName" pn
  WHERE lower(trim(pr."part_name")) = lower(trim(pn."part_name"));
