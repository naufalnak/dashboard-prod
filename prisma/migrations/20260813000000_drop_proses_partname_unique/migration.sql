-- Lepas constraint unique (Proses, Part Name) -- satu Part Name+Proses
-- sekarang boleh punya lebih dari satu baris (mis. beberapa pilihan
-- Mesin), tidak lagi otomatis "dihitung 1" (merge) seperti sebelumnya.
DROP INDEX "MasterProses_proses_part_name_key";
