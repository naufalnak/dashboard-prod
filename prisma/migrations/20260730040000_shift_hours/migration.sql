-- Default Waktu Efektif (jam) per Shift.
CREATE TABLE "MasterShiftHours" (
    "id" SERIAL NOT NULL,
    "shift" TEXT NOT NULL,
    "default_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    CONSTRAINT "MasterShiftHours_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MasterShiftHours_shift_key" ON "MasterShiftHours"("shift");

INSERT INTO "MasterShiftHours" ("shift", "default_hours") VALUES
  ('Shift 1', 8),
  ('Shift Malam', 7.5),
  ('Shift 2', 7),
  ('Shift 3', 7);
