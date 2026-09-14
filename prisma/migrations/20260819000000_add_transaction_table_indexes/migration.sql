-- Index untuk tabel transaksi utama -- hampir semua endpoint dashboard/
-- detail/laporan filter dengan pola yang sama: rentang tanggal
-- (getPeriodRange) + opsional Cluster, dan beberapa kolom lain (Part
-- Name, Mesin, Line, Grup Head, Status, Jenis Problem) dipakai sebagai
-- filter/grouping sendiri di berbagai endpoint. Belum kelihatan
-- dampaknya sekarang (volume data masih kecil), tapi begitu data
-- historis bertambah, query pencarian/filter jadi jauh lebih cepat
-- dengan index ini dibanding full table scan.

CREATE INDEX "ProduksiHarian_tanggal_cluster_idx" ON "ProduksiHarian"("tanggal", "cluster");
CREATE INDEX "ProduksiHarian_part_name_idx" ON "ProduksiHarian"("part_name");
CREATE INDEX "ProduksiHarian_mesin_idx" ON "ProduksiHarian"("mesin");
CREATE INDEX "ProduksiHarian_line_produksi_idx" ON "ProduksiHarian"("line_produksi");

CREATE INDEX "ProblemLog_tanggal_idx" ON "ProblemLog"("tanggal");
CREATE INDEX "ProblemLog_status_idx" ON "ProblemLog"("status");
CREATE INDEX "ProblemLog_jenis_problem_idx" ON "ProblemLog"("jenis_problem");

CREATE INDEX "RejectionEntry_tanggal_cluster_idx" ON "RejectionEntry"("tanggal", "cluster");
CREATE INDEX "RejectionEntry_part_name_idx" ON "RejectionEntry"("part_name");

CREATE INDEX "OvertimeEntry_tanggal_cluster_idx" ON "OvertimeEntry"("tanggal", "cluster");
CREATE INDEX "OvertimeEntry_group_head_idx" ON "OvertimeEntry"("group_head");

CREATE INDEX "PartReworkEntry_tanggal_repair_cluster_idx" ON "PartReworkEntry"("tanggal_repair", "cluster");
CREATE INDEX "PartReworkEntry_part_name_idx" ON "PartReworkEntry"("part_name");
