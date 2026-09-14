-- View used both by the website's "Export Log Work Order" CSV download
-- and for direct querying/export from pgAdmin (Query Tool -> right-click
-- result -> Export). Keeping one view means both stay in sync.
CREATE OR REPLACE VIEW "work_order_export" AS
SELECT
  b.id,
  m.name AS mesin,
  m.cluster,
  m.line,
  b.date::date AS tanggal,
  b."startTime" AS waktu_mulai,
  b.category AS jenis_problem,
  b.cause AS problem_identifikasi,
  b."picGh" AS pic_gh,
  b.status,
  b."endDate"::date AS tanggal_selesai,
  b."endTime" AS waktu_selesai,
  b.resolution AS penyelesaian,
  b.action,
  b."picMtn" AS pic_mtn,
  b."durationHrs" AS durasi_jam
FROM "Breakdown" b
JOIN "Machine" m ON m.id = b."machineId"
ORDER BY b.date DESC;
