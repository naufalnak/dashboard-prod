# Jalankan di folder Dashboard-PROD-main (tempat ada folder prisma/)
# Menandai 25 migrasi (21-45) sebagai "applied" TANPA menjalankan ulang SQL-nya,
# karena struktur yang mau dibuat masing-masing migrasi ini sudah terbukti ada
# di database (sudah dicek satu-satu terhadap backup_db_prod_mtn_13_sept.sql).
#
# Kalau salah satu command di bawah ini gagal / errornya beda dari yang lain,
# STOP dan jangan lanjut ke command berikutnya - kirim errornya dulu.

npx prisma migrate resolve --applied "20260723030000_relational_master_data"
npx prisma migrate resolve --applied "20260724000000_add_problem_log_line_part"
npx prisma migrate resolve --applied "20260724010000_problem_log_notes_rename"
npx prisma migrate resolve --applied "20260724020000_drop_unused_maintenance_tables"
npx prisma migrate resolve --applied "20260724030000_cycle_time_to_proses"
npx prisma migrate resolve --applied "20260724040000_master_man_power"
npx prisma migrate resolve --applied "20260724050000_jenis_problem"
npx prisma migrate resolve --applied "20260728010000_add_master_data_relations"
npx prisma migrate resolve --applied "20260728020000_proses_own_cluster"
npx prisma migrate resolve --applied "20260728030000_problem_log_jenis_problem"
npx prisma migrate resolve --applied "20260729010000_rejection_entry"
npx prisma migrate resolve --applied "20260730010000_overtime"
npx prisma migrate resolve --applied "20260730020000_proses_finish_flag"
npx prisma migrate resolve --applied "20260730030000_notification"
npx prisma migrate resolve --applied "20260730040000_shift_hours"
npx prisma migrate resolve --applied "20260730050000_backfill_sole_finish_proses"
npx prisma migrate resolve --applied "20260807000000_add_mesin_to_problem_log"
npx prisma migrate resolve --applied "20260807010000_baseline_machine_model"
npx prisma migrate resolve --applied "20260807020000_add_machine_id_to_proses"
npx prisma migrate resolve --applied "20260808000000_add_part_rework_entry"
npx prisma migrate resolve --applied "20260812000000_add_id_code_to_partname"
npx prisma migrate resolve --applied "20260813000000_drop_proses_partname_unique"
npx prisma migrate resolve --applied "20260814000000_problem_log_downtime_link"
npx prisma migrate resolve --applied "20260819000000_add_transaction_table_indexes"
npx prisma migrate resolve --applied "20260908000000_add_batch_id_to_produksi_harian"

# Setelah semua sukses, jalankan ini - seharusnya keluar "No pending migrations"
npx prisma migrate deploy
