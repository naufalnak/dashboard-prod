-- CreateTable
CREATE TABLE "PartReworkEntry" (
    "id" SERIAL NOT NULL,
    "tanggal_ditemukan" TIMESTAMP(3) NOT NULL,
    "no_lot_original" TEXT,
    "tanggal_repair" TIMESTAMP(3) NOT NULL,
    "no_lot_rework" TEXT NOT NULL,
    "part_name" TEXT NOT NULL,
    "part_name_id" INTEGER,
    "kriteria_rework" TEXT,
    "metode_rework" TEXT,
    "mesin" TEXT,
    "machine_id" INTEGER,
    "pic_rework" TEXT,
    "group_head" TEXT,
    "group_head_id" INTEGER,
    "cluster" TEXT,
    "total_rework" INTEGER NOT NULL DEFAULT 0,
    "total_ok" INTEGER NOT NULL DEFAULT 0,
    "total_reject" INTEGER NOT NULL DEFAULT 0,
    "metode_check" TEXT,
    "tanggal_check" TIMESTAMP(3),
    "pic_check" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartReworkEntry_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PartReworkEntry" ADD CONSTRAINT "PartReworkEntry_part_name_id_fkey" FOREIGN KEY ("part_name_id") REFERENCES "MasterPartName"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartReworkEntry" ADD CONSTRAINT "PartReworkEntry_group_head_id_fkey" FOREIGN KEY ("group_head_id") REFERENCES "MasterGroupHead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartReworkEntry" ADD CONSTRAINT "PartReworkEntry_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
