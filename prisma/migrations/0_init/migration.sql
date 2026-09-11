-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "prod";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "shared";

-- CreateTable
CREATE TABLE "shared"."Machine" (
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

-- CreateTable
CREATE TABLE "shared"."Admin" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'maintenance',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod"."CLUSTER" (
    "id" SERIAL NOT NULL,
    "CLUSTER" TEXT NOT NULL,

    CONSTRAINT "CLUSTER_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod"."MasterGroupHead" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "cluster" TEXT NOT NULL,
    "cluster_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterGroupHead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod"."MasterPartName" (
    "id" SERIAL NOT NULL,
    "part_name" TEXT NOT NULL,
    "cluster" TEXT NOT NULL,
    "cluster_id" INTEGER,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "id_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterPartName_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod"."MasterKriteriaNg" (
    "id" SERIAL NOT NULL,
    "nama" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterKriteriaNg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod"."MasterManPower" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "group_head" TEXT NOT NULL,
    "group_head_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterManPower_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod"."MasterOvertimeTarget" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "target_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterOvertimeTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod"."MasterProses" (
    "id" SERIAL NOT NULL,
    "proses" TEXT NOT NULL,
    "part_name" TEXT NOT NULL,
    "part_name_id" INTEGER,
    "cluster" TEXT NOT NULL DEFAULT '',
    "line_produksi" TEXT NOT NULL,
    "mesin" TEXT NOT NULL,
    "machine_id" INTEGER,
    "man_power" TEXT NOT NULL,
    "cycle_time" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_finish_proses" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterProses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared"."ProduksiHarian" (
    "id" SERIAL NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "waktu" TEXT,
    "shift" TEXT NOT NULL,
    "cluster" TEXT NOT NULL,
    "cluster_id" INTEGER,
    "line_produksi" TEXT NOT NULL,
    "grup_head" TEXT,
    "grup_head_id" INTEGER,
    "no_lot" TEXT,
    "part_name" TEXT NOT NULL,
    "part_name_id" INTEGER,
    "part_number" TEXT,
    "proses" TEXT NOT NULL,
    "proses_id" INTEGER,
    "mesin" TEXT NOT NULL,
    "man_power" TEXT,
    "man_power_id" INTEGER,
    "cycle_time" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "waktu_efektif" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "plan" INTEGER NOT NULL DEFAULT 0,
    "ok1" INTEGER NOT NULL DEFAULT 0,
    "ok2" INTEGER NOT NULL DEFAULT 0,
    "rwk" INTEGER NOT NULL DEFAULT 0,
    "rjct" INTEGER NOT NULL DEFAULT 0,
    "breakdown_mesin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "jenis_problem" TEXT,
    "lost_time" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "keterangan" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProduksiHarian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared"."ProblemLog" (
    "id" SERIAL NOT NULL,
    "tanggal" TIMESTAMP(3),
    "line_produksi" TEXT,
    "mesin" TEXT,
    "part_name" TEXT,
    "part_name_id" INTEGER,
    "problem" TEXT NOT NULL,
    "jenis_problem" TEXT,
    "root_cause" TEXT,
    "temporary_action" TEXT,
    "permanent_action" TEXT,
    "due_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProblemLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod"."Notification" (
    "id" SERIAL NOT NULL,
    "usernames" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "read_by" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod"."MasterShiftHours" (
    "id" SERIAL NOT NULL,
    "shift" TEXT NOT NULL,
    "default_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "MasterShiftHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod"."RejectionEntry" (
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

-- CreateTable
CREATE TABLE "prod"."OvertimeEntry" (
    "id" SERIAL NOT NULL,
    "tanggal" TIMESTAMP(3) NOT NULL,
    "waktu" TEXT,
    "man_power" TEXT,
    "man_power_id" INTEGER,
    "group_head" TEXT,
    "cluster" TEXT,
    "durasi_jam" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "keterangan" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OvertimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prod"."PartReworkEntry" (
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

-- CreateIndex
CREATE UNIQUE INDEX "Machine_machine_key" ON "shared"."Machine"("machine");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "shared"."Admin"("username");

-- CreateIndex
CREATE UNIQUE INDEX "MasterGroupHead_name_key" ON "prod"."MasterGroupHead"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MasterPartName_part_name_key" ON "prod"."MasterPartName"("part_name");

-- CreateIndex
CREATE UNIQUE INDEX "MasterKriteriaNg_nama_key" ON "prod"."MasterKriteriaNg"("nama");

-- CreateIndex
CREATE UNIQUE INDEX "MasterManPower_name_key" ON "prod"."MasterManPower"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MasterOvertimeTarget_year_month_key" ON "prod"."MasterOvertimeTarget"("year", "month");

-- CreateIndex
CREATE INDEX "ProduksiHarian_tanggal_idx" ON "shared"."ProduksiHarian"("tanggal");

-- CreateIndex
CREATE INDEX "ProduksiHarian_cluster_id_idx" ON "shared"."ProduksiHarian"("cluster_id");

-- CreateIndex
CREATE INDEX "ProduksiHarian_grup_head_id_idx" ON "shared"."ProduksiHarian"("grup_head_id");

-- CreateIndex
CREATE INDEX "ProduksiHarian_part_name_id_idx" ON "shared"."ProduksiHarian"("part_name_id");

-- CreateIndex
CREATE INDEX "ProduksiHarian_proses_id_idx" ON "shared"."ProduksiHarian"("proses_id");

-- CreateIndex
CREATE INDEX "ProduksiHarian_man_power_id_idx" ON "shared"."ProduksiHarian"("man_power_id");

-- CreateIndex
CREATE INDEX "ProblemLog_tanggal_idx" ON "shared"."ProblemLog"("tanggal");

-- CreateIndex
CREATE INDEX "ProblemLog_part_name_id_idx" ON "shared"."ProblemLog"("part_name_id");

-- CreateIndex
CREATE UNIQUE INDEX "MasterShiftHours_shift_key" ON "prod"."MasterShiftHours"("shift");

-- CreateIndex
CREATE INDEX "RejectionEntry_tanggal_idx" ON "prod"."RejectionEntry"("tanggal");

-- CreateIndex
CREATE INDEX "RejectionEntry_part_name_id_idx" ON "prod"."RejectionEntry"("part_name_id");

-- CreateIndex
CREATE INDEX "RejectionEntry_kriteria_ng_id_idx" ON "prod"."RejectionEntry"("kriteria_ng_id");

-- CreateIndex
CREATE INDEX "OvertimeEntry_tanggal_idx" ON "prod"."OvertimeEntry"("tanggal");

-- CreateIndex
CREATE INDEX "OvertimeEntry_man_power_id_idx" ON "prod"."OvertimeEntry"("man_power_id");

-- CreateIndex
CREATE INDEX "PartReworkEntry_tanggal_ditemukan_idx" ON "prod"."PartReworkEntry"("tanggal_ditemukan");

-- CreateIndex
CREATE INDEX "PartReworkEntry_tanggal_repair_idx" ON "prod"."PartReworkEntry"("tanggal_repair");

-- CreateIndex
CREATE INDEX "PartReworkEntry_part_name_id_idx" ON "prod"."PartReworkEntry"("part_name_id");

-- CreateIndex
CREATE INDEX "PartReworkEntry_group_head_id_idx" ON "prod"."PartReworkEntry"("group_head_id");

-- CreateIndex
CREATE INDEX "PartReworkEntry_machine_id_idx" ON "prod"."PartReworkEntry"("machine_id");

-- AddForeignKey
ALTER TABLE "prod"."MasterGroupHead" ADD CONSTRAINT "MasterGroupHead_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "prod"."CLUSTER"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod"."MasterPartName" ADD CONSTRAINT "MasterPartName_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "prod"."CLUSTER"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod"."MasterManPower" ADD CONSTRAINT "MasterManPower_group_head_id_fkey" FOREIGN KEY ("group_head_id") REFERENCES "prod"."MasterGroupHead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod"."MasterProses" ADD CONSTRAINT "MasterProses_part_name_id_fkey" FOREIGN KEY ("part_name_id") REFERENCES "prod"."MasterPartName"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod"."MasterProses" ADD CONSTRAINT "MasterProses_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "shared"."Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared"."ProduksiHarian" ADD CONSTRAINT "ProduksiHarian_cluster_id_fkey" FOREIGN KEY ("cluster_id") REFERENCES "prod"."CLUSTER"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared"."ProduksiHarian" ADD CONSTRAINT "ProduksiHarian_grup_head_id_fkey" FOREIGN KEY ("grup_head_id") REFERENCES "prod"."MasterGroupHead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared"."ProduksiHarian" ADD CONSTRAINT "ProduksiHarian_part_name_id_fkey" FOREIGN KEY ("part_name_id") REFERENCES "prod"."MasterPartName"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared"."ProduksiHarian" ADD CONSTRAINT "ProduksiHarian_proses_id_fkey" FOREIGN KEY ("proses_id") REFERENCES "prod"."MasterProses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared"."ProduksiHarian" ADD CONSTRAINT "ProduksiHarian_man_power_id_fkey" FOREIGN KEY ("man_power_id") REFERENCES "prod"."MasterManPower"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared"."ProblemLog" ADD CONSTRAINT "ProblemLog_part_name_id_fkey" FOREIGN KEY ("part_name_id") REFERENCES "prod"."MasterPartName"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod"."RejectionEntry" ADD CONSTRAINT "RejectionEntry_part_name_id_fkey" FOREIGN KEY ("part_name_id") REFERENCES "prod"."MasterPartName"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod"."RejectionEntry" ADD CONSTRAINT "RejectionEntry_kriteria_ng_id_fkey" FOREIGN KEY ("kriteria_ng_id") REFERENCES "prod"."MasterKriteriaNg"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod"."OvertimeEntry" ADD CONSTRAINT "OvertimeEntry_man_power_id_fkey" FOREIGN KEY ("man_power_id") REFERENCES "prod"."MasterManPower"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod"."PartReworkEntry" ADD CONSTRAINT "PartReworkEntry_part_name_id_fkey" FOREIGN KEY ("part_name_id") REFERENCES "prod"."MasterPartName"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod"."PartReworkEntry" ADD CONSTRAINT "PartReworkEntry_group_head_id_fkey" FOREIGN KEY ("group_head_id") REFERENCES "prod"."MasterGroupHead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prod"."PartReworkEntry" ADD CONSTRAINT "PartReworkEntry_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "shared"."Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

