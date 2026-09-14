export const API = '/api';
export const SHIFTS = ['Shift 1', 'Shift Malam', 'Shift 2', 'Shift 3'];
export const JENIS_PROBLEM_OPTS = ['Machine', 'Material', 'Method', 'Man', 'Setting & Tool'];

export function todayStr() { return new Date().toISOString().slice(0, 10); }
export function nowTimeStr() { return new Date().toTimeString().slice(0, 5); }
export function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

/* ── Label helper ───────────────────────────────────── */
// `error`: pesan validasi ditaruh DI SAMPING judul/title-nya sendiri
// (bukan baris terpisah di bawah input) -- supaya kolom label tetap satu
// baris tinggi-nya, tidak menggeser sejajar label kolom sebelah (lihat
// .rc-panel-grid-3 > div{justify-content:flex-end} di index.css, yang
// bikin baris-baris pendek "mengambang" turun kalau salah satu kolom
// jadi lebih tinggi gara-gara pesan error di baris sendiri).
export function FL({ children, sub, error }) {
  return (
    <label style={{ fontSize: 11, fontWeight: 700, color: '#5a6b73', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, display: 'block' }}>
      {children}
      {sub && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, opacity: .6, marginLeft: 5, fontSize: 11 }}>{sub}</span>}
      {error && <span style={{ fontWeight: 700, textTransform: 'none', letterSpacing: 0, color: '#d9534f', marginLeft: 8, fontSize: 9.5 }}>{error}</span>}
    </label>
  );
}

/* Classic form-style tinted group box — mimics the "Input RMO" / "Maintenance"
   panels from the reference desktop app: colored border, floating title,
   tinted fill. */
const TINTS = {
  cyan:  { bg: '#e0f7f7', border: '#17a2b8' },
  peach: { bg: '#fde7d6', border: '#e08a3c' },
  gray:  { bg: '#eef1f1', border: '#8a9a9a' },
};
// `stretch`: panel mengisi penuh tinggi area grid-nya (dipakai buat panel
// "Downtime & Problem" supaya tidak nyisa ruang kosong besar di bawah
// begitu field-nya lebih sedikit dari panel "Aktual Produksi" di
// sampingnya, lihat .rc-2col-problem/.rc-panel-stretch di index.css)
// -- child terakhir (biasanya field yang boleh tumbuh, mis. textarea
// Problem) yang mengisi ruang sisa lewat flex:1 pada style-nya sendiri.
export function Panel({ title, tint = 'cyan', gridClassName = 'rc-panel-grid', className = '', stretch = false, children }) {
  const c = TINTS[tint];
  return (
    <div className={className + (stretch ? ' rc-panel-stretch' : '')} style={{ position: 'relative', border: `2px solid ${c.border}`, borderRadius: 6, background: c.bg, padding: '14px 16px 12px', marginBottom: 18 }}>
      <span style={{ position: 'absolute', top: -11, left: 14, background: c.bg, padding: '0 8px', fontSize: 12, fontWeight: 800, color: c.border, textTransform: 'uppercase', letterSpacing: '.05em' }}>
        {title}
      </span>
      <div className={gridClassName + (stretch ? ' rc-panel-grid-fill' : '')} style={{ display: 'grid', gap: '10px 18px' }}>
        {children}
      </div>
    </div>
  );
}

/* Read-only computed field (Total OK / Total Proses) */
export function ComputedField({ label, sub, value }) {
  return (
    <div>
      <FL sub={sub}>{label}</FL>
      <div style={{ background: '#eef7f5', border: '1px solid #a9d2ca', borderRadius: 7, padding: '10px 12px', fontSize: 14, fontWeight: 700, color: '#0e5a52' }}>
        {value}
      </div>
    </div>
  );
}

// Waktu Efektif default buat Shift terpilih (dari Master Data -> tab
// Shift) -- dipakai buat auto-isi field-nya, baik saat Shift benar-benar
// diganti (pickShift) maupun saat form masih di kondisi awal (Shift 1
// sudah terpilih dari awal tanpa perlu klik dropdown-nya).
export function defaultWaktuEfektifFor(shift, shiftHours) {
  const match = (shiftHours || []).find((s) => s.shift === shift);
  return match ? String(match.defaultHours) : '';
}

export const EMPTY_FORM = {
  tanggal: todayStr(), waktu: nowTimeStr(), shift: SHIFTS[0], grupHead: '',
  cluster: '', line: '', partName: '', proses: '', mesin: '', manPower: '', cycleTime: '',
  // mesinList: dipakai kalau Proses yang dipilih punya >1 Mesin tercatat --
  // operator boleh centang lebih dari satu Mesin yang jalan bareng (default
  // semua tercentang), backend fan-out jadi satu baris ProduksiHarian per
  // Mesin (lihat submit()). Kosong = mode Mesin tunggal biasa (pakai
  // `mesin` seperti sebelumnya). problemMesin: Mesin MANA (dari
  // mesinList) yang kena Jenis Problem -- wajib diisi begitu Jenis
  // Problem/Loss Time/Breakdown Mesin diisi DAN mesinList > 1, supaya
  // downtime tetap ter-trace ke satu Mesin spesifik (bukan nempel ke
  // semuanya) -- dipakai juga oleh Dashboard-MTN buat pencocokan per Mesin.
  mesinList: [], problemMesin: '',
  noLot: '', waktuEfektif: '',
  qtyOk: '', rwk: '', rjct: '',
  breakdownMesin: '', jenisProblem: '', lossTime: '', dueDate: todayStr(),
  problem: '',
};

export const EMPTY_MASTER = { clusters: [], groupHeads: [], partNames: [], proses: [], manPower: [], kriteriaNg: [], shiftHours: [] };

export const EMPTY_REJ_FORM = {
  tanggal: todayStr(), waktu: nowTimeStr(),
  partName: '', totalLmr: '', kriteriaNg: '', keterangan: '',
};

export const EMPTY_OT_FORM = {
  tanggal: todayStr(), waktu: nowTimeStr(),
  manPower: '', durasiJam: '', keterangan: '',
};

export const EMPTY_RW_FORM = {
  tanggalDitemukan: todayStr(), noLotOriginal: '', tanggalRepair: todayStr(),
  partName: '', kriteriaRework: '', metodeRework: '', mesin: '', picRework: '',
  grupHead: '', totalRework: '', totalOk: '', totalReject: '',
  metodeCheck: '', tanggalCheck: '', picCheck: '',
};

// Preview client-side dari No Lot Rework yang akan dibuat server (format
// DDMMYYYY + "R" dari Tanggal Repair) -- server yang generate beneran
// saat submit, ini cuma buat operator lihat hasilnya sebelum kirim.
export function previewNoLotRework(tanggalRepair) {
  if (!tanggalRepair) return '—';
  const d = new Date(tanggalRepair);
  if (isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}${mm}${d.getFullYear()}R`;
}

/* ── Panel pencarian/filter untuk tab Data Tabel ────── */
// Kunci localStorage buat sesi mini-login tab "Data Produksi" -- terpisah
// dari sesi dashboard admin utama (halaman ini murni public/tanpa
// AuthContext, lihat main.jsx), tapi akunnya sama persis dengan Admin di
// dashboard (Grup Head memang sudah punya akun masing-masing buat
// notifikasi Problem Log).
export const DP_AUTH_KEY = 'rmo_dp_auth';
export function loadDpAuth() {
  try {
    const raw = localStorage.getItem(DP_AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export const EDIT_INP = {
  background: '#fff', border: '1px solid #c9d4d4',
  borderRadius: 7, padding: '9px 11px', color: '#1c2b2b',
  fontSize: 13.5, outline: 'none', width: '100%', boxSizing: 'border-box',
  fontFamily: 'inherit',
};
export const EDIT_INP_LOCKED = { ...EDIT_INP, opacity: .6, cursor: 'not-allowed' };

/* Styles dipakai di form Input/Rejection/Overtime/Rework */
export const inp = {
  background: '#fff', border: '1px solid #c9d4d4',
  borderRadius: 7, padding: '10px 12px', color: '#1c2b2b',
  fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box',
  fontFamily: 'inherit',
};
export const inpErr = { ...inp, borderColor: '#d9534f' };
// Rework kuning, Reject merah -- penanda visual langsung di kolom
// inputnya (bukan cuma di tabel hasil).
export const inpRework = { ...inp, background: '#fff8e1', borderColor: '#e0b400', color: '#7a5d00' };
export const inpReject = { ...inp, background: '#fdecec', borderColor: '#d9534f', color: '#8a1f1f' };
