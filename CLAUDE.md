# CLAUDE.md — dashboard-prod-mu.vercel.app

Dashboard produksi & maintenance CNC real-time, backend Express + Prisma, frontend React (Vite).
Goal: Input & monitoring harian AR/OEE/Rejection/Overtime/Problem Log per Cluster & Group Head, dari input operator di lapangan (`/lhp` publik) sampai dashboard analitik admin.

---

## Tech Stack

| Tool | Version / Notes |
|------|-----------------|
| Express | v5 — backend API, satu route file `src/routes/api.js` |
| React | v18.3 (bukan Next.js) |
| Vite | v5 — build tool frontend, bukan Webpack |
| Prisma | v5 — ORM ke PostgreSQL |
| Supabase | PostgreSQL hosting (pooled port 6543 + direct port 5432) |
| JWT (jsonwebtoken) | Auth admin, token 8 jam |
| lucide-react | Icon library |
| Styling | Plain CSS (`index.css`) + inline style objects — TIDAK pakai Tailwind |
| Deploy | Vercel (`api/[...path].js` — Express app terpisah, BUKAN wrapper `serverless-http` dari `src/app.js`, lihat Project Structure) |
| Package manager | npm |

---

## Commands

```bash
npm run dev               # Jalankan backend Express lokal (src/server.js)
cd web && npm run dev     # Jalankan frontend Vite lokal
cd web && npm run build   # Build frontend production -> web/dist
npx prisma studio         # GUI lihat/edit data database
npx prisma migrate deploy # Terapkan migration
npm run create-admin      # Bootstrap akun admin baru (scripts/create-admin.js)
```

---

## Project Structure

```
src/
  routes/api.js        # SEMUA endpoint API ada di sini (satu file besar, ~1900 baris), termasuk assertClusterAccess
  lib/auth.js           # requireAuth middleware, cek read-only/privileged/cluster access
  lib/period.js          # getPeriodRange/daysInRange/calcPlannedHours — dipakai hampir semua endpoint agregat dashboard
  app.js                # Express app setup, dipakai server.js lokal (serve static web/dist juga)
  server.js              # Entry point lokal (bukan dipakai di Vercel)
api/[...path].js        # Entry point Vercel — Express app TERPISAH dari src/app.js (bukan wrapper serverless-http),
                         # beda: body limit 10mb, TIDAK serve web/dist, error handler echo err.message
prisma/schema.prisma     # Schema database
web/src/
  pages/                # Satu file per halaman (DataProduksi.jsx, MasterData.jsx, dst)
  components/           # Komponen reusable (ProduksiTable, RejectionTable, dst) + components/modals/
  *Context.jsx          # Auth/UI/Toast/Confirm/Theme/App/Targets context (React Context, bukan Redux)
  api.js                # API client terpusat: apiFetch/apiSend/apiSendForm/apiDownload, auth header dari localStorage
  roles.js              # Daftar username privileged/read-only + helper cek akses
  index.css             # Design token (CSS variable) + kelas reusable (.btn/.card/.form-input)
```

Tidak ada router library (no react-router) — routing hand-rolled: `UIContext.jsx` simpan state `page` + `navigate(p)`, `App.jsx` lookup lewat object `PAGES = {dashboard: Dashboard, ...}`. Semua panggilan API dari frontend harus lewat `web/src/api.js`, jangan `fetch` langsung.

---

## Konvensi Penting (spesifik project ini)

- **Semua endpoint custom HARUS flat** (`/api/nama-endpoint`), TIDAK BOLEH nested path (`/api/foo/bar`) — keterbatasan routing Vercel dengan `api/[...path].js`.
- **Semua mutasi pakai POST**, TIDAK ADA PUT/DELETE/PATCH di codebase ini sama sekali (konsisten, jangan pecah pola).
- ID dikirim di **body**, bukan di URL path (`/produksi-harian-update` + `{id: 5}`, bukan `/produksi-harian/5`).
- Role: `PRIVILEGED_USERNAMES` (123/pradana/sugeng/djk) akses penuh semua cluster; Grup Head (AGUNG dkk) cuma boleh edit data cluster sendiri (dicek di backend lewat `assertClusterAccess` di `src/routes/api.js`, bukan cuma UI); `READ_ONLY_USERNAMES` (aris/supri/fido) lihat semua tapi tidak bisa ubah apa pun — kecuali `/notifications-read` & `/notifications-read-all` (tandai notif sendiri, tidak dianggap mutasi data).
- `assertClusterAccess` mencocokkan Grup Head lewat `resolveGroupHeadByUsername`, yang membandingkan **kata pertama** nama Group Head (case-insensitive) dengan username login — konvensi yang jalan tapi rapuh kalau kata pertama nama diubah.
- Tabel lebar pakai kolom PERSEN + `minWidth` (bukan px tetap) — supaya pas satu layar di desktop, tetap scrollable di HP.
- `RMOPublic.jsx` (halaman publik `/lhp`, nama file/komponen tetap `RMOPublic.jsx` untuk alasan historis, tanpa login untuk RC Harian) berdiri sendiri — TIDAK punya akses ke AuthContext/ToastContext/UIContext yang dipakai dashboard admin. Fitur apa pun di situ (termasuk sub-login Data Produksi per Grup Head) harus self-contained.

---

## Environment Variables

| Variable | Keterangan |
|----------|------------|
| `DATABASE_URL` | Pooled connection Supabase (port 6543), dipakai runtime |
| `DIRECT_URL` | Direct connection (port 5432), dipakai migration |
| `JWT_SECRET` | Signing key token admin — jangan pernah expose |
| `ALLOWED_IPS` | Opsional, whitelist IP untuk `/api/*` (proteksi kedua — Vercel Firewall jadi primary) |
| `PORT` | Port lokal untuk `src/server.js`, default 3001 |

Kalau password database Supabase di-reset, `DATABASE_URL` & `DIRECT_URL` WAJIB diupdate di Vercel Environment Variables lalu redeploy — situs live akan down sampai ini diperbaiki.

---

## Features (checklist)

### Core Pages
- [x] Login admin (JWT) + role privileged/read-only/Grup Head
- [x] RC Harian Produksi publik (`/lhp`) — input tanpa login
- [x] Data Produksi (dashboard admin) — semua cluster, edit/hapus, export Excel
- [x] Data Produksi login-gated per Grup Head di `/lhp` — filter cluster otomatis, bisa edit data cluster sendiri
- [x] Data Rejection, Data Overtime, Problem & Root Cause Log
- [x] Master Data (Group Head, Part Name & Proses, Kriteria NG, Overtime Target, Shift Hours)
- [x] Detail AR (ranking Line, tren, jenis problem)

### Features
- [x] Role read-only (lihat semua, tidak bisa ubah)
- [x] Sidebar admin: rail ikon default, expand ke label lewat toggle (`AppSidebar.jsx`, gaya Dell Design System)
- [x] Tabel fit-satu-layar di desktop, scrollable di HP
- [x] Download Excel (.xlsx asli via package `xlsx` + `web/src/exportXlsx.js`) di Data Produksi
- [ ] i18n (belum ada — semua teks Bahasa Indonesia hardcode)
- [ ] Command Palette
- [ ] Dynamic OG images
- [ ] Design system baru berbasis Dell Design System (sedang berjalan)

---

## Design System (sedang migrasi ke arah Dell Design System)

- Sumber referensi: https://www.delldesignsystem.com/
- Token warna/tipografi/spacing didefinisikan di `web/src/index.css` (CSS custom properties, bukan Tailwind).
- Migrasi dilakukan bertahap per komponen — JANGAN reskin seluruh app sekaligus tanpa arahan eksplisit di tiap tahap.

---

## ⚠️ Do NOT

- Kalau instruksi ambigu, tanya dulu sebelum coding.
- **Jangan pernah ubah file di folder Dashboard-MTN** — itu project/deployment terpisah, bukan bagian dari Dashboard-PROD.
- Jangan bikin endpoint API dengan nested path — harus flat, lihat catatan routing Vercel di atas.
- Jangan pakai PUT/DELETE/PATCH — semua mutasi lewat POST, ID di body.
- Jangan expose `JWT_SECRET`/password Supabase ke client atau commit ke repo.
- Jangan hardcode Shift/opsi lain yang seharusnya ambil dari Master Data.
- Jangan install dependency baru tanpa tanya dulu.
- Jangan pakai `alert()` browser bawaan untuk error — pakai toast/UI error yang konsisten dengan halaman lain.
- Jangan hardcode warna di komponen (`#fff`, `#1c2b2b`, dst) — pakai CSS variable dari `index.css` supaya ikut tema.
- Git identity: HANYA akun GitHub `sabiqundpa` yang boleh push ke repo ini.

---

## Testing

Tidak ada automated test. Verifikasi manual sebelum menyatakan selesai:
- `node -e "require('./src/routes/api.js')"` — backend tidak error syntax
- `cd web && npm run build` — build sukses tanpa error
- Cek endpoint live setelah deploy (bandingkan hash bundle JS dengan yang di-build lokal)

---

## Build

```bash
cd web && npm run build
```
Expected: `✓ built in ~10-20s`, tidak ada error.

---

## Git Rules

- Commit eksplisit per file (`git add <file>`), JANGAN `git add -A` — ada file kerjaan lain (IP allowlist) yang tidak boleh ikut ke-commit tanpa sengaja.
- Push pakai akun GitHub `sabiqundpa` saja.
- Push ke GitHub memicu auto-deploy Vercel — kalau macet, cek Vercel dashboard, atau push commit kosong buat trigger ulang.
