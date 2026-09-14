-- Kode part dari Surat Perintah Kerja (mis. "D.FG.00126"), pengganti Harga
-- di form Master Data Part Name & Proses. Harga (kolom price) tetap ada
-- di tabel, tidak dihapus -- masih dipakai laporan Material Reject (Rp),
-- cuma tidak diedit lewat form ini lagi.
ALTER TABLE "MasterPartName" ADD COLUMN "id_code" TEXT;
