-- Part Name yang cuma punya satu baris Proses tidak punya ambiguitas soal
-- mana yang "akhir/finish" -- tandai otomatis (dipakai sebagai Total OK
-- Input Rejection), sama seperti perilaku baru saat create/update/delete
-- Proses lewat Master Data.
UPDATE "MasterProses"
SET "is_finish_proses" = true
WHERE "part_name" IN (
  SELECT "part_name" FROM "MasterProses" GROUP BY "part_name" HAVING COUNT(*) = 1
)
AND "is_finish_proses" = false;
