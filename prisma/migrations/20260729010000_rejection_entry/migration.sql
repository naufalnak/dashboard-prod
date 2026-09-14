-- Price per Part Name (Rp/pcs), used by the Material Reject report.
ALTER TABLE "MasterPartName" ADD COLUMN "price" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Master list of NG/defect criteria (picked in the Rejection input form).
CREATE TABLE "MasterKriteriaNg" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MasterKriteriaNg_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MasterKriteriaNg_nama_key" ON "MasterKriteriaNg"("nama");

-- Rejection / Material NG entries.
CREATE TABLE "RejectionEntry" (
    "id" SERIAL NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "waktu" TEXT,
    "cluster" TEXT NOT NULL,
    "part_name" TEXT NOT NULL,
    "part_name_id" INTEGER,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_ok" INTEGER NOT NULL DEFAULT 0,
    "total_lmr" INTEGER NOT NULL DEFAULT 0,
    "kriteria_ng" TEXT,
    "kriteria_ng_id" INTEGER,
    "keterangan" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RejectionEntry_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RejectionEntry" ADD CONSTRAINT "RejectionEntry_part_name_id_fkey"
  FOREIGN KEY ("part_name_id") REFERENCES "MasterPartName"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RejectionEntry" ADD CONSTRAINT "RejectionEntry_kriteria_ng_id_fkey"
  FOREIGN KEY ("kriteria_ng_id") REFERENCES "MasterKriteriaNg"("id") ON DELETE SET NULL ON UPDATE CASCADE;
