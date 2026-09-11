-- ================================================================
-- RLS POLICY untuk tabel "Machine" di Supabase
-- ================================================================
-- CATATAN PENTING:
-- 1. Akses via SQL Editor Supabase / pgAdmin menggunakan role "postgres"
--    (superuser) yang SELALU bypass RLS, jadi policy ini tidak
--    mempengaruhi akses dari SQL Editor/pgAdmin.
-- 2. Project ini menggunakan Prisma dengan DATABASE_URL (pooled connection)
--    yang menggunakan role "postgres" / service_role -- juga bypass RLS.
-- 3. RLS ini bermanfaat jika di masa depan ingin membatasi akses dari
--    role "anon" atau "authenticated" (misal via Supabase JS client).
--
-- CARA MENJALANKAN: Paste SQL ini di Supabase SQL Editor
-- ================================================================

-- Aktifkan RLS pada tabel Machine
ALTER TABLE "Machine" ENABLE ROW LEVEL SECURITY;

-- Policy 1: Izinkan SELECT untuk service_role (digunakan oleh Prisma/API)
-- (service_role sebenarnya bypass RLS, tapi policy ini sebagai dokumentasi)
CREATE POLICY "machine_service_role_all"
ON "Machine"
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy 2: Izinkan SELECT untuk postgres (SQL Editor / pgAdmin)
-- (postgres superuser bypass RLS, tapi policy ini sebagai dokumentasi)
CREATE POLICY "machine_postgres_all"
ON "Machine"
FOR ALL
TO postgres
USING (true)
WITH CHECK (true);

-- ================================================================
-- CATATAN: Jika Anda ingin tabel [Mesin] yang dibuat manual sebelumnya
-- dihapus (karena sudah duplikat dengan Machine yang di-rename),
-- jalankan SQL berikut di SQL Editor:
--
--   DROP TABLE IF EXISTS "Mesin";
--
-- Pastikan tidak ada data penting di tabel Mesin tersebut sebelum dihapus.
-- ================================================================
