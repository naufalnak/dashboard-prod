-- Klasifikasi 4M+1E (Machine, Material, Method, Man, Environment) untuk
-- downtime/problem di baris Resume Control Harian Produksi. Daftar
-- kategorinya tetap (standar 4M+1E), jadi cukup kolom teks -- tidak perlu
-- tabel master terpisah yang bisa diubah-ubah user.
ALTER TABLE "ProduksiHarian" ADD COLUMN "jenis_problem" TEXT;
