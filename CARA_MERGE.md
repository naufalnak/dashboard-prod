# Fitur: Due Date + validasi grup Downtime all-or-nothing

1 file (TIMPA): web/src/pages/RMOPublic.jsx

**Dependency:** butuh patch `fitur-problem-log-autolink.zip` sudah
terpasang (field `due_date` di body `/produksi-harian` sudah didukung
backend dari situ, lewat `syncLinkedProblemLog`). TIDAK ada perubahan
backend/schema tambahan di patch ini -- murni frontend, karena backend
sudah siap menerima `due_date` sejak round Problem-Log-Autolink.

## Cara kerja fitur
Form RC Harian (`/lhp`), panel Downtime & Problem, sekarang:
- Ada field baru **Due Date** (default hari ini).
- Validasi diperketat jadi SATU GRUP all-or-nothing: begitu SALAH SATU
  dari Loss Time/Breakdown Mesin (dianggap satu sinyal, isi salah satu
  cukup)/Jenis Problem/Problem diisi, maka SEMUANYA (termasuk Due Date
  dan teks Problem) jadi wajib diisi. Sebelumnya cuma Jenis Problem yang
  wajib mengikuti Loss Time/Breakdown Mesin (2 arah) -- field Problem
  & Due Date opsional.
- Due Date SENGAJA TIDAK ikut jadi pemicu grup ini (walau selalu
  ada isi karena default hari ini) -- kalau ikut jadi pemicu, form akan
  SELALU minta Jenis Problem/Problem diisi di tiap submit, padahal
  memang sering kali submit RC Harian tidak ada downtime sama sekali.

## Kenapa ini berguna
Sebelumnya operator bisa isi Loss Time/Breakdown Mesin + Jenis Problem
tanpa isi teks Problem sama sekali -- baris Problem Produksi yang
otomatis dibuat (syncLinkedProblemLog) jadinya cuma berisi placeholder
generik ("Downtime" / Jenis Problem-nya sendiri), dan tanpa Due Date,
jadi tidak ada target tindak lanjut yang jelas. Dengan validasi ini,
setiap downtime yang tercatat otomatis punya deskripsi Problem yang
jelas + Due Date, jadi Problem Produksi tidak ada yang "menggantung"
tanpa target selesai.

## Catatan
- Validasi ini CUMA client-side (sama seperti versi 8 Sept) -- backend
  (`assertJenisProblemIfDowntime`) tetap cuma menegakkan aturan 2 arah
  Jenis Problem <-> Loss Time/Breakdown Mesin yang sudah ada dari round
  Problem-Log-Autolink. Jadi kalaupun ada jalur lain yang masih kirim
  tanpa Problem/Due Date (mis. modal Edit di Data Produksi/Data Tabel),
  itu TIDAK akan ditolak backend -- cuma form `/lhp` ini yang sekarang
  lebih ketat.
- `esbuild` bundling lolos, JSX valid.
- Tidak ada perubahan backend/schema/migration di patch ini.
