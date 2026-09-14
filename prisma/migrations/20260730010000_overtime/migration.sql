-- Target jam lembur per bulan (diset lewat Master Data).
CREATE TABLE "MasterOvertimeTarget" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "target_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MasterOvertimeTarget_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MasterOvertimeTarget_year_month_key" ON "MasterOvertimeTarget"("year", "month");

-- Input Overtime/Lembur entries.
CREATE TABLE "OvertimeEntry" (
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

ALTER TABLE "OvertimeEntry" ADD CONSTRAINT "OvertimeEntry_man_power_id_fkey"
  FOREIGN KEY ("man_power_id") REFERENCES "MasterManPower"("id") ON DELETE SET NULL ON UPDATE CASCADE;
