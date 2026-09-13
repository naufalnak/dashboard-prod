-- Tandai Proses yang jadi acuan "Total OK" Rejection (Proses Akhir/Finish).
ALTER TABLE "MasterProses" ADD COLUMN "is_finish_proses" BOOLEAN NOT NULL DEFAULT false;
