-- Jenis Problem (4M + 1E + Setting & Tool) column for ProblemLog, so the
-- Problem & Root Cause Log table can show/filter by problem category too,
-- not just ProduksiHarian.
ALTER TABLE "ProblemLog" ADD COLUMN "jenis_problem" TEXT;
