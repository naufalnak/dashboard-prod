import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { CheckCircle2, AlertTriangle, Maximize2, Minimize2, Table2, PencilLine, Menu, X, Clock, RefreshCw, LogOut, Wrench } from 'lucide-react';
import ProduksiTable from "../components/dashboard/ProduksiTable";
import Combobox from "../components/ui/Combobox";
import PeriodPicker from "../components/maintenance/PeriodPicker";
import LineTrendChart from '../components/charts/LineTrendChart.jsx';
import { formatDateTimeIDParts } from '../dateFmt.js';

const API = '/api';
const SHIFTS = ['Shift 1', 'Shift Malam', 'Shift 2', 'Shift 3'];

function todayStr() { return new Date().toISOString().slice(0, 10); }
function num(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

/* ── Layar sukses setelah submit ────────────────────── */
function SuccessView({ data, metrics, onReset }) {
  const tiles = [
    ['AR', metrics.ar], ['AVB', metrics.avb], ['PERF', metrics.perf],
    ['YIELD', metrics.yield], ['OEE', metrics.oee],
  ];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', overflow: 'auto' }}>
      <CheckCircle2 size={56} style={{ color: '#00a884', marginBottom: 14 }} />
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.4px', marginBottom: 8 }}>
        Data Berhasil Dikirim!
      </div>
      <div style={{ color: '#5a6b73', fontSize: 14, lineHeight: 1.7, marginBottom: 20, maxWidth: 460 }}>
        {data.partName} — {data.proses} ({data.mesin}) untuk <strong>{data.line}</strong> telah tercatat.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))', gap: 10, width: '100%', maxWidth: 560, marginBottom: 20 }}>
        {tiles.map(([label, val]) => (
          <div key={label} style={{ background: '#0e5a52', color: '#fff', borderRadius: 8, padding: '12px 6px' }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{val}%</div>
            <div style={{ fontSize: 10, opacity: .85, marginTop: 2, letterSpacing: '.04em' }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ width: '100%', maxWidth: 480, background: '#f4f7f7', border: '1px solid #d7e0e0', borderRadius: 10, padding: '14px 18px', marginBottom: 22, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          ['Tanggal / Shift', `${data.tanggal} · ${data.shift}`],
          ['Cluster / Line', `${data.cluster} / ${data.line}`],
          ['Total OK / Total Proses', `${metrics.totalOk} / ${metrics.totalProses}`],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
            <span style={{ color: '#5a6b73', flexShrink: 0 }}>{k}</span>
            <span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span>
          </div>
        ))}
      </div>
      <button className="btn primary" style={{ width: '100%', maxWidth: 480, padding: '14px', fontSize: 16, color: '#fff', background: '#0e5a52', border: 'none', borderRadius: 8, cursor: 'pointer' }} onClick={onReset}>
        Buat Laporan Baru
      </button>
    </div>
  );
}

/* ── Popup konfirmasi batal ─────────────────────────── */
function CancelModal({ onConfirm, onDismiss }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onDismiss}>
      <div style={{ background: '#fff', border: '1px solid #d7e0e0', borderRadius: 12, padding: '32px 28px', maxWidth: 380, width: '88%', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
        <AlertTriangle size={40} style={{ color: '#d9534f', marginBottom: 14 }} />
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Batalkan Input?</div>
        <div style={{ fontSize: 13, color: '#5a6b73', lineHeight: 1.6, marginBottom: 24 }}>Semua data yang sudah diisi akan dihapus dan tidak tersimpan.</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ flex: 1, padding: '11px', fontSize: 14, background: '#eef2f2', border: '1px solid #d7e0e0', borderRadius: 7, cursor: 'pointer', fontWeight: 600 }} onClick={onDismiss}>Tidak</button>
          <button style={{ flex: 1, padding: '11px', fontSize: 14, background: '#d9534f', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 600 }} onClick={onConfirm}>Ya, Batalkan</button>
        </div>
      </div>
    </div>
  );
}

/* ── Label helper ───────────────────────────────────── */
function FL({ children, sub }) {
  return (
    <label style={{ fontSize: 11, fontWeight: 700, color: '#5a6b73', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, display: 'block' }}>
      {children}
      {sub && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, opacity: .6, marginLeft: 5, fontSize: 11 }}>{sub}</span>}
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
function Panel({ title, tint = 'cyan', gridClassName = 'rc-panel-grid', className = '', children }) {
  const c = TINTS[tint];
  return (
    <div className={className} style={{ position: 'relative', border: `2px solid ${c.border}`, borderRadius: 6, background: c.bg, padding: '14px 16px 12px', marginBottom: 18 }}>
      <span style={{ position: 'absolute', top: -11, left: 14, background: c.bg, padding: '0 8px', fontSize: 12, fontWeight: 800, color: c.border, textTransform: 'uppercase', letterSpacing: '.05em' }}>
        {title}
      </span>
      <div className={gridClassName} style={{ display: 'grid', gap: '10px 18px' }}>
        {children}
      </div>
    </div>
  );
}

/* Read-only computed field (Total OK / Total Proses) */
function ComputedField({ label, sub, value }) {
  return (
    <div>
      <FL sub={sub}>{label}</FL>
      <div style={{ background: '#eef7f5', border: '1px solid #a9d2ca', borderRadius: 7, padding: '10px 12px', fontSize: 14, fontWeight: 700, color: '#0e5a52' }}>
        {value}
      </div>
    </div>
  );
}

function nowTimeStr() { return new Date().toTimeString().slice(0, 5); }

const JENIS_PROBLEM_OPTS = ['Machine', 'Material', 'Method', 'Man', 'Environment', 'Setting & Tool'];

// Waktu Efektif default buat Shift terpilih (dari Master Data -> tab
// Shift) -- dipakai buat auto-isi field-nya, baik saat Shift benar-benar
// diganti (pickShift) maupun saat form masih di kondisi awal (Shift 1
// sudah terpilih dari awal tanpa perlu klik dropdown-nya).
function defaultWaktuEfektifFor(shift, shiftHours) {
  const match = (shiftHours || []).find((s) => s.shift === shift);
  return match ? String(match.defaultHours) : '';
}

const EMPTY_FORM = {
  tanggal: todayStr(), waktu: nowTimeStr(), shift: SHIFTS[0], grupHead: '',
  cluster: '', line: '', partName: '', proses: '', mesin: '', mesinList: [], problemMesin: '', manPower: '', cycleTime: '',
  noLot: '', waktuEfektif: '',
  qtyOk: '', rwk: '', rjct: '',
  breakdownMesin: '', jenisProblem: '', lossTime: '', keteranganLossTime: '',
  problem: '', dueDate: todayStr(),
};

const EMPTY_MASTER = { clusters: [], groupHeads: [], partNames: [], proses: [], manPower: [], kriteriaNg: [], shiftHours: [] };

const EMPTY_REJ_FORM = {
  tanggal: todayStr(), waktu: nowTimeStr(),
  partName: '', totalLmr: '', kriteriaNg: '', keterangan: '',
};

/* ── Layar sukses setelah submit Input Rejection ────── */
function RejSuccessView({ data, onReset }) {
  const totalProses = num(data.totalOk) + num(data.totalLmr);
  const ratio = num(data.totalOk) > 0 ? ((num(data.totalLmr) / num(data.totalOk)) * 100).toFixed(1) : '0.0';
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', overflow: 'auto' }}>
      <CheckCircle2 size={56} style={{ color: '#00a884', marginBottom: 14 }} />
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.4px', marginBottom: 8 }}>
        Data Rejection Berhasil Dikirim!
      </div>
      <div style={{ color: '#5a6b73', fontSize: 14, lineHeight: 1.7, marginBottom: 20, maxWidth: 460 }}>
        {data.partName} ({data.cluster}) telah tercatat.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10, width: '100%', maxWidth: 460, marginBottom: 20 }}>
        {[['Total Proses', totalProses.toLocaleString()], ['Total LMR', num(data.totalLmr).toLocaleString()], ['Reject Ratio', `${ratio}%`]].map(([label, val]) => (
          <div key={label} style={{ background: '#0e5a52', color: '#fff', borderRadius: 8, padding: '12px 6px' }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{val}</div>
            <div style={{ fontSize: 10, opacity: .85, marginTop: 2, letterSpacing: '.04em' }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ width: '100%', maxWidth: 480, background: '#f4f7f7', border: '1px solid #d7e0e0', borderRadius: 10, padding: '14px 18px', marginBottom: 22, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          ['Tanggal / Waktu', `${data.tanggal} · ${data.waktu}`],
          ['Total OK', num(data.totalOk).toLocaleString()],
          ['Kriteria NG', data.kriteriaNg || '—'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
            <span style={{ color: '#5a6b73', flexShrink: 0 }}>{k}</span>
            <span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span>
          </div>
        ))}
      </div>
      <button className="btn primary" style={{ width: '100%', maxWidth: 480, padding: '14px', fontSize: 16, color: '#fff', background: '#0e5a52', border: 'none', borderRadius: 8, cursor: 'pointer' }} onClick={onReset}>
        Input Rejection Baru
      </button>
    </div>
  );
}

const EMPTY_OT_FORM = {
  tanggal: todayStr(), waktu: nowTimeStr(),
  manPower: '', durasiJam: '', keterangan: '',
};

const EMPTY_RW_FORM = {
  tanggalDitemukan: todayStr(), noLotOriginal: '', tanggalRepair: todayStr(),
  partName: '', kriteriaRework: '', metodeRework: '', mesin: '', picRework: '',
  grupHead: '', totalRework: '', totalOk: '', totalReject: '',
  metodeCheck: '', tanggalCheck: '', picCheck: '',
};

// Preview client-side dari No Lot Rework yang akan dibuat server (format
// DDMMYYYY + "R" dari Tanggal Repair) -- server yang generate beneran
// saat submit, ini cuma buat operator lihat hasilnya sebelum kirim.
function previewNoLotRework(tanggalRepair) {
  if (!tanggalRepair) return '—';
  const d = new Date(tanggalRepair);
  if (isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}${mm}${d.getFullYear()}R`;
}

/* ── Layar sukses setelah submit Data Pengerjaan Rework ─────── */
function RwSuccessView({ data, onReset }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', overflow: 'auto' }}>
      <CheckCircle2 size={56} style={{ color: '#00a884', marginBottom: 14 }} />
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.4px', marginBottom: 8 }}>
        Data Pengerjaan Rework Berhasil Dikirim!
      </div>
      <div style={{ color: '#5a6b73', fontSize: 14, lineHeight: 1.7, marginBottom: 20, maxWidth: 460 }}>
        {data.partName} — No Lot Rework <strong>{previewNoLotRework(data.tanggalRepair)}</strong>
      </div>
      <button className="btn primary" style={{ width: '100%', maxWidth: 480, padding: '14px', fontSize: 16, color: '#fff', background: '#0e5a52', border: 'none', borderRadius: 8, cursor: 'pointer' }} onClick={onReset}>
        Input Rework Baru
      </button>
    </div>
  );
}

/* ── Layar sukses setelah submit Input Overtime ─────── */
function OtSuccessView({ data, onReset }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', overflow: 'auto' }}>
      <CheckCircle2 size={56} style={{ color: '#00a884', marginBottom: 14 }} />
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.4px', marginBottom: 8 }}>
        Data Overtime Berhasil Dikirim!
      </div>
      <div style={{ color: '#5a6b73', fontSize: 14, lineHeight: 1.7, marginBottom: 20, maxWidth: 460 }}>
        {data.manPower} telah tercatat lembur {num(data.durasiJam)} jam.
      </div>

      <div style={{ width: '100%', maxWidth: 480, background: '#f4f7f7', border: '1px solid #d7e0e0', borderRadius: 10, padding: '14px 18px', marginBottom: 22, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          ['Tanggal / Waktu', `${data.tanggal} · ${data.waktu}`],
          ['Man Power', data.manPower || '—'],
          ['Durasi Lembur', `${num(data.durasiJam)} jam`],
          ['Keterangan', data.keterangan || '—'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
            <span style={{ color: '#5a6b73', flexShrink: 0 }}>{k}</span>
            <span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span>
          </div>
        ))}
      </div>
      <button className="btn primary" style={{ width: '100%', maxWidth: 480, padding: '14px', fontSize: 16, color: '#fff', background: '#0e5a52', border: 'none', borderRadius: 8, cursor: 'pointer' }} onClick={onReset}>
        Input Overtime Baru
      </button>
    </div>
  );
}

/* ── Panel pencarian/filter untuk tab Data Tabel ────── */
// Kunci localStorage buat sesi mini-login tab "Data Produksi" -- terpisah
// dari sesi dashboard admin utama (halaman ini murni public/tanpa
// AuthContext, lihat main.jsx), tapi akunnya sama persis dengan Admin di
// dashboard (Grup Head memang sudah punya akun masing-masing buat
// notifikasi Problem Log).
const DP_AUTH_KEY = 'rmo_dp_auth';
function loadDpAuth() {
  try {
    const raw = localStorage.getItem(DP_AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/* ── Login per-Grup-Head buat tab "Data Produksi" -- beda dari sesi
   dashboard admin, tapi akunnya sama. Cluster-nya otomatis mengikuti
   Grup Head yang login (lihat GET /produksi-harian-my-cluster), jadi
   tidak perlu pilih Cluster manual. ────────────────────────────── */
function DataProduksiLogin({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inp = {
    background: '#fff', border: '1px solid #c9d4d4',
    borderRadius: 7, padding: '10px 12px', color: '#1c2b2b',
    fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  async function submit(e) {
    e.preventDefault();
    if (!username.trim() || !password || busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await fetch(`${API}/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Login gagal');
      onSuccess({ token: data.token, username: data.username || username.trim() });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'auto' }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 360, background: '#fff', border: '1px solid #d7e0e0', borderRadius: 12, padding: '32px 28px', boxSizing: 'border-box' }}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4, textAlign: 'center', color: '#0e5a52' }}>Login Data Produksi</div>
        <div style={{ fontSize: 12.5, color: '#5a6b73', textAlign: 'center', marginBottom: 22, lineHeight: 1.5 }}>
          Masuk pakai akun Grup Head masing-masing untuk melihat Data Produksi Cluster sendiri.
        </div>
        <div style={{ marginBottom: 14 }}>
          <FL>Username</FL>
          <input style={inp} value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoCapitalize="off" />
        </div>
        <div style={{ marginBottom: 14 }}>
          <FL>Password</FL>
          <input type="password" style={inp} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <div style={{ color: '#d9534f', fontSize: 12.5, marginBottom: 14 }}>{error}</div>}
        <button type="submit" disabled={busy}
          style={{ width: '100%', padding: '11px', fontSize: 14, background: '#0e5a52', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 700 }}>
          {busy ? 'Masuk…' : 'Masuk'}
        </button>
      </form>
    </div>
  );
}

const EDIT_INP = {
  background: '#fff', border: '1px solid #c9d4d4',
  borderRadius: 7, padding: '9px 11px', color: '#1c2b2b',
  fontSize: 13.5, outline: 'none', width: '100%', boxSizing: 'border-box',
  fontFamily: 'inherit',
};
const EDIT_INP_LOCKED = { ...EDIT_INP, opacity: .6, cursor: 'not-allowed' };

/* ── Edit baris Data Produksi langsung dari /rmo -- Grup Head yang login
   cuma boleh mengedit baris cluster-nya sendiri (dipaksa juga di backend,
   lihat assertClusterAccess di src/routes/api.js). Field & rumus (Plan,
   Cycle Time ikut Master Data) sama seperti EditProduksiModal di menu
   Data Produksi dashboard utama, tapi berdiri sendiri (fetch pakai token
   Bearer manual) karena RMOPublic tidak punya AuthContext/ToastContext. */
function EditProduksiModal({ row, master, token, onClose, onSaved }) {
  const [form, setForm] = useState({
    tanggal: row.tanggal, shift: row.shift, noLot: row.noLot || '',
    manPower: row.manPower || '',
    partName: row.partName, proses: row.proses, line: row.line, mesin: row.mesin,
    waktuEfektif: row.waktuEfektif,
    totalOk: row.ok1 + row.ok2, rework: row.rework, reject: row.reject,
    breakdownMesin: row.breakdownMesin, lostTime: row.lostTime, keterangan: row.keterangan || '',
    jenisProblem: row.jenisProblem || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  const partNameOptions = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const p of master.proses) {
      if (p.cluster !== row.cluster) continue;
      const key = p.partName.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(p.partName);
    }
    return result.sort((a, b) => a.localeCompare(b));
  }, [master.proses, row.cluster]);

  const prosesOptions = useMemo(
    () => master.proses.filter((p) => p.partName === form.partName && p.cluster === row.cluster)
      .map((p) => p.proses).sort((a, b) => a.localeCompare(b)),
    [master.proses, form.partName, row.cluster],
  );
  const prosesMatch = useMemo(
    () => master.proses.find((p) => p.proses === form.proses && p.partName === form.partName && p.cluster === row.cluster),
    [master.proses, form.proses, form.partName, row.cluster],
  );
  const cycleTime = prosesMatch ? prosesMatch.cycleTime : row.cycleTime;

  function pickPartName(partName) { setForm((f) => ({ ...f, partName, proses: '', line: '', mesin: '' })); }
  function pickProses(prosesName) {
    const match = master.proses.find((p) => p.proses === prosesName && p.partName === form.partName && p.cluster === row.cluster);
    setForm((f) => ({ ...f, proses: prosesName, line: match?.line || f.line, mesin: match?.mesin || f.mesin }));
  }

  const lineOptions = useMemo(
    () => [...new Set(master.proses.map((p) => p.line).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [master.proses],
  );
  const mesinOptions = useMemo(
    () => [...new Set(master.proses.map((p) => p.mesin).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [master.proses],
  );

  const plan = useMemo(() => {
    const ct = Number(cycleTime) || 0;
    const we = Number(form.waktuEfektif) || 0;
    if (!ct || !we) return 0;
    return Math.round(((3600 * we * 0.9) / ct) / 10) * 10;
  }, [cycleTime, form.waktuEfektif]);

  const manPowerOptions = useMemo(
    () => master.manPower.filter((m) => m.groupHead === row.grupHead).map((m) => m.name).sort((a, b) => a.localeCompare(b)),
    [master.manPower, row.grupHead],
  );

  async function save() {
    if (!form.partName.trim() || !form.proses.trim() || !form.line.trim() || !form.mesin.trim()) {
      setError('Part Name, Proses, Line, dan Mesin wajib diisi');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await fetch(`${API}/produksi-harian-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: row.id,
          tanggal: form.tanggal, shift: form.shift, no_lot: form.noLot,
          part_name: form.partName, proses: form.proses, line: form.line, mesin: form.mesin,
          man_power: form.manPower,
          cycle_time: cycleTime, waktu_efektif: form.waktuEfektif,
          plan, ok1: form.totalOk, ok2: 0, rwk: form.rework, rjct: form.reject,
          breakdown_mesin: form.breakdownMesin, jenis_problem: form.jenisProblem, lost_time: form.lostTime, keterangan: form.keterangan,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Gagal menyimpan');
      onSaved();
      onClose();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: '#fff', border: '1px solid #d7e0e0', borderRadius: 12, padding: '24px 22px', maxWidth: 560, width: '100%', maxHeight: '90vh', overflow: 'auto', boxSizing: 'border-box' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#1c2b2b' }}>Edit — {row.partName}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5a6b73', display: 'flex' }}><X size={20} /></button>
        </div>
        <div style={{ fontSize: 12, color: '#5a6b73', marginBottom: 16 }}>
          Cluster <strong>{row.cluster}</strong> — Part Name/Proses belum ada di daftar? Hubungi admin untuk ditambahkan lewat Master Data.
        </div>

        {error && <div style={{ color: '#d9534f', fontSize: 12.5, marginBottom: 14 }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <FL>Tanggal</FL>
            <input type="date" style={EDIT_INP} value={form.tanggal} onChange={(e) => set('tanggal', e.target.value)} />
          </div>
          <div>
            <FL>Shift</FL>
            <select style={EDIT_INP} value={form.shift} onChange={(e) => set('shift', e.target.value)}>
              {master.shiftHours.map((s) => <option key={s.shift} value={s.shift}>{s.shift}</option>)}
            </select>
          </div>
          <div>
            <FL>No Lot</FL>
            <input style={EDIT_INP} value={form.noLot} onChange={(e) => set('noLot', e.target.value)} />
          </div>
          <div>
            <FL>Man Power</FL>
            <Combobox style={EDIT_INP} value={form.manPower} options={manPowerOptions} onChange={(v) => set('manPower', v)} placeholder="Pilih Man Power…" />
          </div>
          <div>
            <FL>Part Name</FL>
            <Combobox style={EDIT_INP} value={form.partName} options={partNameOptions} onChange={pickPartName} placeholder="Pilih Part Name…" />
          </div>
          <div>
            <FL>Proses</FL>
            <Combobox style={EDIT_INP} value={form.proses} options={prosesOptions} onChange={pickProses} placeholder={form.partName ? 'Pilih Proses…' : 'Pilih Part Name dulu'} />
          </div>
          <div>
            <FL>Line Produksi</FL>
            <Combobox style={EDIT_INP} value={form.line} options={lineOptions} onChange={(v) => set('line', v)} placeholder="Ketik atau pilih Line…" />
          </div>
          <div>
            <FL>Mesin</FL>
            <Combobox style={EDIT_INP} value={form.mesin} options={mesinOptions} onChange={(v) => set('mesin', v)} placeholder="Ketik atau pilih Mesin…" />
          </div>
          <div>
            <FL>Cycle Time</FL>
            <input type="number" style={EDIT_INP_LOCKED} value={cycleTime} disabled title="Cycle Time otomatis ikut Master Data untuk Proses yang dipilih" />
          </div>
          <div>
            <FL>Waktu Efektif</FL>
            <input type="number" style={EDIT_INP} value={form.waktuEfektif} onChange={(e) => set('waktuEfektif', e.target.value)} />
          </div>
          <div>
            <FL>Plan</FL>
            <input type="number" style={EDIT_INP_LOCKED} value={plan} disabled title="Plan otomatis dari Cycle Time × Waktu Efektif" />
          </div>
          <div>
            <FL>Total OK</FL>
            <input type="number" style={EDIT_INP} value={form.totalOk} onChange={(e) => set('totalOk', e.target.value)} />
          </div>
          <div>
            <FL>Rework</FL>
            <input type="number" style={EDIT_INP} value={form.rework} onChange={(e) => set('rework', e.target.value)} />
          </div>
          <div>
            <FL>Reject</FL>
            <input type="number" style={EDIT_INP} value={form.reject} onChange={(e) => set('reject', e.target.value)} />
          </div>
          <div>
            <FL>Breakdown Mesin (menit)</FL>
            <input type="number" style={EDIT_INP} value={form.breakdownMesin} onChange={(e) => set('breakdownMesin', e.target.value)} />
          </div>
          <div>
            <FL>Lost Time (menit)</FL>
            <input type="number" style={EDIT_INP} value={form.lostTime} onChange={(e) => set('lostTime', e.target.value)} />
          </div>
          <div>
            <FL>Jenis Problem</FL>
            <Combobox style={EDIT_INP} value={form.jenisProblem} options={JENIS_PROBLEM_OPTS} onChange={(v) => set('jenisProblem', v)} placeholder="Ketik atau pilih…" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <FL>Keterangan</FL>
            <textarea style={{ ...EDIT_INP, minHeight: 60, resize: 'vertical' }} value={form.keterangan} onChange={(e) => set('keterangan', e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button disabled={busy} onClick={save} style={{ flex: 1, padding: '11px', fontSize: 14, background: '#0e5a52', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 600 }}>
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', fontSize: 14, background: '#eef2f2', border: '1px solid #c9d4d4', borderRadius: 7, cursor: 'pointer', fontWeight: 600 }}>
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Data Produksi ter-filter ke Cluster Grup Head yang login, dengan
   filter Tanggal/Shift/Cari sendiri (period+date memicu fetch ulang ke
   server, Shift+Cari cuma menyaring baris yang sudah ada di layar --
   sama seperti pola menu Data Produksi di dashboard admin). ───────── */
function DataProduksiView({ auth, onLogout, shiftOptions, master }) {
  const [period, setPeriod] = useState('today');
  const [refDate, setRefDate] = useState(todayStr());
  const [shiftFilter, setShiftFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [cluster, setCluster] = useState('');
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [editRow, setEditRow] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
    const qs = `period=${period}&date=${refDate}`;
    fetch(`${API}/produksi-harian-my-cluster?${qs}`, { headers: { Authorization: `Bearer ${auth.token}` } })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Gagal memuat data');
        setCluster(data.cluster);
        setRows(data.rows);
        setLoading(false);
        fetch(`${API}/ar-trend?${qs}&cluster=${data.cluster}`, { headers: { Authorization: `Bearer ${auth.token}` } })
          .then((tr) => tr.json()).then(setTrend).catch(() => setTrend([]));
      })
      .catch((err) => {
        setLoading(false);
        setLoadError(err.message);
        if (String(err.message).toLowerCase().includes('session') || String(err.message).toLowerCase().includes('login')) onLogout();
      });
  }, [period, refDate, auth.token, onLogout]);

  useEffect(() => { load(); }, [load]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (shiftFilter !== 'all' && r.shift !== shiftFilter) return false;
      if (!q) return true;
      return r.partName.toLowerCase().includes(q) || r.mesin.toLowerCase().includes(q)
        || (r.noLot || '').toLowerCase().includes(q) || (r.proses || '').toLowerCase().includes(q);
    });
  }, [rows, shiftFilter, query]);

  const trendWithTarget = useMemo(() => trend.map((d) => ({ ...d, target: 100 })), [trend]);

  return (
    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div className="group-box" style={{ margin: '16px 24px 0', background: '#fff' }}>
        <span className="group-box-title">Apply Filters</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <PeriodPicker pill period={period} setPeriod={setPeriod} refDate={refDate} setRefDate={setRefDate} />
          <select className="pp-select" value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)} style={{ height: 34 }}>
            <option value="all">Semua Shift</option>
            {shiftOptions.map((s) => <option key={s.shift} value={s.shift}>{s.shift}</option>)}
          </select>
          <div style={{ flex: 1, minWidth: 160, maxWidth: 260 }}>
            <input type="text" style={{ background: '#fff', border: '1px solid #c9d4d4', borderRadius: 7, padding: '9px 12px', fontSize: 13, width: '100%', boxSizing: 'border-box' }}
              value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari Part/Mesin/No Lot…" />
          </div>
          <button onClick={load} title="Refresh data" style={{ padding: '9px 12px', fontSize: 13, borderRadius: 7, background: '#0e5a52', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex' }}>
            <RefreshCw size={14} />
          </button>
          <button onClick={onLogout} title="Keluar" style={{ marginLeft: 'auto', padding: '9px 12px', fontSize: 12.5, borderRadius: 7, background: '#eef2f2', border: '1px solid #c9d4d4', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <LogOut size={13} /> {auth.username}
          </button>
        </div>
      </div>

      <div style={{ padding: '16px 24px' }}>
        {loadError && <div style={{ color: '#d9534f', fontSize: 13, marginBottom: 12 }}>{loadError}</div>}
        {cluster && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#0e5a52', marginBottom: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0e5a52', display: 'inline-block' }} />
            Cluster {cluster} ({filteredRows.length} baris)
          </div>
        )}
        <div style={{ marginBottom: 16, background: '#fff', border: '1px solid #d7e0e0', borderRadius: 10, padding: 14 }}>
          <LineTrendChart
            title={`Tren AR — Cluster ${cluster || '…'}`}
            data={trendWithTarget}
            valueKey="ar"
            targetKey="target"
            color="#0e5a52"
            unit="%"
            showMovingAvg
            movingAvgColor="#2563eb"
            targetColor="#d9534f"
          />
        </div>
        <div style={{ position: 'relative', border: '2px solid #17a2b8', borderRadius: 6, background: '#fff', padding: '18px 12px 12px' }}>
          <span style={{ position: 'absolute', top: -11, left: 14, background: '#fff', padding: '0 8px', fontSize: 12, fontWeight: 800, color: '#17a2b8', textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Data Produksi
          </span>
          <ProduksiTable rows={filteredRows} loading={loading} onEdit={setEditRow} />
        </div>
      </div>

      {editRow && (
        <EditProduksiModal row={editRow} master={master} token={auth.token} onClose={() => setEditRow(null)} onSaved={load} />
      )}
    </div>
  );
}

/* ── Halaman utama ──────────────────────────────────── */
export default function RMOPublic() {
  const [tab, setTab]                   = useState('input'); // input | table
  const [master, setMaster]             = useState(EMPTY_MASTER);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [busy, setBusy]                 = useState(false);
  const [errors, setErrors]             = useState({});
  const [done, setDone]                 = useState(null);
  const [doneMetrics, setDoneMetrics]   = useState(null);
  const [cancelWarn, setCancelWarn]     = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dpAuth, setDpAuth]             = useState(() => loadDpAuth());
  const [rejForm, setRejForm]           = useState(EMPTY_REJ_FORM);
  const [rejErrors, setRejErrors]       = useState({});
  const [rejBusy, setRejBusy]           = useState(false);
  const [rejDone, setRejDone]           = useState(null);
  const [otForm, setOtForm]             = useState(EMPTY_OT_FORM);
  const [otErrors, setOtErrors]         = useState({});
  const [otBusy, setOtBusy]             = useState(false);
  const [otDone, setOtDone]             = useState(null);
  const [rwForm, setRwForm]             = useState(EMPTY_RW_FORM);
  const [rwErrors, setRwErrors]         = useState({});
  const [rwBusy, setRwBusy]             = useState(false);
  const [rwDone, setRwDone]             = useState(null);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [clock, setClock]               = useState(() => formatDateTimeIDParts(new Date()));
  const formRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setClock(formatDateTimeIDParts(new Date())), 1000);
    return () => clearInterval(t);
  }, []);

  // Enter pindah ke input berikutnya (urutan tab index di DOM) supaya
  // pengisian cepat bisa full keyboard, tidak wajib klik kursor ke tiap
  // kolom satu-satu -- meniru kebiasaan form entri cepat/scanner barcode.
  function handleFormKeyDown(e) {
    if (e.key !== 'Enter') return;
    if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    e.preventDefault();
    const root = formRef.current;
    if (!root) return;
    const focusables = Array.from(root.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled])'));
    const idx = focusables.indexOf(e.target);
    const next = focusables[idx + 1];
    if (next) { next.focus(); if (next.select) next.select(); }
  }

  /* Tab title + force light theme */
  useEffect(() => {
    document.title = 'INPUT LHP PROD';
    const prev = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', 'light');
    return () => {
      document.title = 'PROD-DPA Monitoring';
      if (prev) document.documentElement.setAttribute('data-theme', prev);
      else document.documentElement.removeAttribute('data-theme');
    };
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }, []);

  const loadMaster = useCallback(() => {
    fetch(`${API}/master`).then((r) => r.json()).then(setMaster).catch(() => {});
  }, []);
  useEffect(() => { loadMaster(); }, [loadMaster]);

  // Begitu daftar default Waktu Efektif per Shift datang dari server,
  // langsung isi field-nya untuk Shift yang sudah terpilih dari awal
  // (Shift 1) -- tidak perlu user klik ulang dropdown Shift dulu supaya
  // Waktu Efektif-nya muncul. Cuma jalan kalau form masih di kondisi
  // awal (belum diisi/diubah) supaya tidak menimpa input user.
  useEffect(() => {
    if (master.shiftHours.length === 0) return;
    setForm((f) => (f.shift === SHIFTS[0] && f.waktuEfektif === ''
      ? { ...f, waktuEfektif: defaultWaktuEfektifFor(f.shift, master.shiftHours) }
      : f));
  }, [master.shiftHours]);

  // Sesi login tab "Data Produksi" (per Grup Head) disimpan di
  // localStorage supaya tetap login walau di-refresh, tapi dicek ulang
  // tiap kali dipakai (DataProduksiView akan logout otomatis kalau
  // token-nya sudah kedaluwarsa/ditolak server).
  function handleDpLogin(auth) {
    localStorage.setItem(DP_AUTH_KEY, JSON.stringify(auth));
    setDpAuth(auth);
  }
  function handleDpLogout() {
    localStorage.removeItem(DP_AUTH_KEY);
    setDpAuth(null);
  }

  function set(key, value) { setForm((f) => ({ ...f, [key]: value })); }

  /* Live-computed Total OK / Total Proses */
  const totalOk = useMemo(() => num(form.qtyOk), [form.qtyOk]);
  const totalProses = useMemo(() => totalOk + num(form.rwk) + num(form.rjct), [totalOk, form.rwk, form.rjct]);

  // Plan = ROUND((3600 x Waktu Efektif x 0.9) / Cycle Time; -1) -- kapasitas
  // teoretis dalam jam efektif terpilih pada efisiensi 90%, dibulatkan ke
  // puluhan terdekat (sama seperti ROUND(...; -1) di Excel). Tidak lagi
  // diisi manual -- otomatis dari Cycle Time & Waktu Efektif.
  const plan = useMemo(() => {
    const ct = num(form.cycleTime);
    const we = num(form.waktuEfektif);
    if (!ct || !we) return 0;
    return Math.round(((3600 * we * 0.9) / ct) / 10) * 10;
  }, [form.cycleTime, form.waktuEfektif]);

/* Cascading: Grup Head -> Cluster -> Part Name -> Proses (+Cycle Time,
     Line Produksi, Mesin, Man Power) -- semuanya isian kombinasi pilih-atau-
     ketik (datalist), auto-terisi dari cascading tapi tetap bisa dikoreksi
     manual. Cycle Time ikut Proses, bukan Part Name -- satu Part Name bisa
     punya beberapa Proses beda Cycle Time. */
  // Opsi Part Name untuk Cluster terpilih diturunkan dari baris Proses
  // (bukan dari field MasterPartName.cluster) -- satu Part Name bisa
  // punya Proses di lebih dari satu Cluster (mis. "BOSS DRIVEN FACE..."
  // ada di Cluster AD dan FI sekaligus), sedangkan MasterPartName.cluster
  // cuma nyimpan satu nilai per Part Name (nilai terakhir yang tersimpan).
  // Kalau difilter dari MasterPartName.cluster, Part Name yang valid buat
  // Cluster ini jadi hilang dari pilihan padahal datanya ada. Part Name
  // tanpa Proses sama sekali juga otomatis tidak ikut muncul karena
  // sumbernya memang dari Proses.
  // Part Name TIDAK lagi difilter per Cluster -- satu Part Name bisa punya
  // Proses di lebih dari satu Cluster, dan sekarang semua nama Part Name
  // sengaja dimunculkan apa adanya (bukan cuma yang match Cluster Grup
  // Head yang login) supaya lebih gampang dicari.
  const partNameOptions = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const p of master.proses) {
      const key = p.partName.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ partName: p.partName, cluster: p.cluster });
    }
    // Semua opsi pilihan (Part Name, Proses, Line, Mesin, Man Power) selalu
    // ditampilkan berurutan abjad, bukan urutan insert/sumber data -- lebih
    // gampang dicari pas daftarnya panjang.
    result.sort((a, b) => a.partName.localeCompare(b.partName));
    return result;
  }, [master.proses]);
  // Proses ikut Part Name yang dipilih saja (bukan lagi ikut Cluster juga)
  // -- konsisten dengan Part Name yang sekarang lintas-Cluster.
  const prosesOptions = useMemo(
    () => master.proses.filter((p) => p.partName === form.partName)
      .sort((a, b) => a.proses.localeCompare(b.proses)),
    [master.proses, form.partName],
  );
  const lineOptions = useMemo(
    () => [...new Set(master.proses.map((p) => p.line).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [master.proses],
  );
  const mesinOptions = useMemo(
    () => [...new Set(master.proses.map((p) => p.mesin).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [master.proses],
  );
  // Kandidat Mesin buat Proses yang lagi dipilih -- kalau > 1, field Mesin
  // di bawah jadi checklist centang-banyak (bukan Combobox pilih-satu)
  // supaya operator bisa langsung catat submit ini jalan di beberapa
  // Mesin sekaligus (lihat mesin_list di createProduksiHarian/
  // produksi.service.js).
  const mesinOptionsForProses = useMemo(() => {
    const rows = master.proses.filter((p) => p.proses === form.proses && p.partName === form.partName);
    return [...new Set(rows.map((p) => p.mesin).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [master.proses, form.proses, form.partName]);
  // Man Power sekarang murni mengikuti roster Grup Head (menu Master Data
  // "Grup Head & Man Power") -- tidak lagi jatuh balik ke nama Man Power
  // lama yang tersimpan di Proses, dan tidak lagi ikut auto-terisi saat
  // memilih Part Name/Proses (dua hal itu sudah tidak berkaitan).
  const manPowerOptions = useMemo(
    () => master.manPower.filter((m) => m.groupHead === form.grupHead).map((m) => m.name).sort((a, b) => a.localeCompare(b)),
    [master.manPower, form.grupHead],
  );

  // Versi "kaya" (dengan sub-teks) dari opsi di atas, buat ditampilkan di
  // Combobox -- supaya tiap baris pilihan kelihatan konteksnya (cluster/
  // line/mesin) sekilas, bukan cuma nama polos.
  const grupHeadOptionsRich = useMemo(
    () => master.groupHeads.map((g) => ({ value: g.name, sub: `Cluster ${g.cluster}` })).sort((a, b) => a.value.localeCompare(b.value)),
    [master.groupHeads],
  );
  const partNameOptionsRich = useMemo(
    () => partNameOptions.map((p) => ({ value: p.partName, sub: `Cluster ${p.cluster}` })),
    [partNameOptions],
  );
  const prosesOptionsRich = useMemo(
    () => prosesOptions.map((p) => ({ value: p.proses, sub: [p.line && `Line ${p.line}`, p.mesin && `Mesin ${p.mesin}`].filter(Boolean).join(' · ') || null })),
    [prosesOptions],
  );
  // Mesin difilter per Cluster (Cluster Grup Head yang login) -- beda
  // dari Master Data/Data Produksi yang sumbernya Tabel Machine (Cluster
  // di sana masih kotor, mis. "Cell AD"), di sini sumbernya MasterProses
  // yang Cluster-nya sudah bersih (AD/BC/EF/FI polos), jadi exact-match
  // aman dipakai.
  const mesinOptionsRich = useMemo(() => {
    const byMesin = {};
    master.proses.forEach((p) => {
      if (!p.mesin || p.cluster !== form.cluster) return;
      if (!byMesin[p.mesin]) byMesin[p.mesin] = new Set();
      if (p.line) byMesin[p.mesin].add(p.line);
    });
    return Object.entries(byMesin)
      .map(([mesin, lines]) => ({ value: mesin, sub: lines.size ? `Line ${[...lines].join(', ')}` : null }))
      .sort((a, b) => a.value.localeCompare(b.value));
  }, [master.proses, form.cluster]);

  // Pilih Shift -> Waktu Efektif otomatis terisi dari default Shift itu
  // (diatur di Master Data), tapi field-nya tetap input biasa yang bisa
  // diketik ulang manual -- nilai akhir yang tersimpan adalah apa pun
  // yang ada di field saat disimpan, bukan dipaksa balik ke default.
  function pickShift(shift) {
    const match = master.shiftHours.find((s) => s.shift === shift);
    setForm((f) => ({ ...f, shift, waktuEfektif: match ? String(match.defaultHours) : f.waktuEfektif }));
  }

  function pickGroupHead(name) {
    const match = master.groupHeads.find((g) => g.name === name);
    setForm((f) => ({
      ...f, grupHead: name, cluster: match?.cluster || '',
      partName: '', cycleTime: '', proses: '', line: '', mesin: '', manPower: '',
    }));
  }
  function pickPartName(partName) {
    setForm((f) => ({
      ...f, partName, cycleTime: '',
      proses: '', line: '', mesin: '', mesinList: [], problemMesin: '',
    }));
  }
  function pickProses(prosesName) {
    // Man Power sengaja tidak diikutkan di sini -- sekarang murni dipilih
    // dari roster Grup Head, tidak lagi auto-terisi dari data Proses.
    const rows = master.proses.filter((p) => p.proses === prosesName && p.partName === form.partName);
    const match = rows[0];
    // Mesin candidates yang tercatat di Proses ini -- 1 pilihan langsung
    // terisi otomatis (sama seperti sebelumnya). Lebih dari 1: semua
    // tercentang otomatis di mesinList (operator boleh uncheck yang
    // tidak jalan), field Mesin tunggal dikosongkan/tidak dipakai.
    const mesinCandidates = [...new Set(rows.map((r) => r.mesin).filter(Boolean))];
    setForm((f) => ({
      ...f, proses: prosesName, cycleTime: match?.cycleTime ?? '',
      line: match?.line || '',
      mesin: mesinCandidates.length === 1 ? mesinCandidates[0] : '',
      mesinList: mesinCandidates.length > 1 ? mesinCandidates : [],
      problemMesin: '',
    }));
  }
  function toggleMesinInList(mesinName) {
    setForm((f) => ({
      ...f,
      mesinList: f.mesinList.includes(mesinName) ? f.mesinList.filter((m) => m !== mesinName) : [...f.mesinList, mesinName],
      // Mesin Bermasalah ikut hilang kalau Mesin itu di-uncheck dari daftar.
      problemMesin: f.problemMesin === mesinName && f.mesinList.includes(mesinName) ? '' : f.problemMesin,
    }));
  }

  // Array.isArray check khusus buat mesinList -- [] truthy di JS meski
  // kosong, jadi tanpa ini hasInput selalu true walau belum ada Mesin
  // dicentang sama sekali.
  const hasInput = Object.entries(form).some(([k, v]) => !['tanggal', 'waktu', 'shift'].includes(k) && (Array.isArray(v) ? v.length > 0 : !!v));

  function handleCancel() { if (hasInput) setCancelWarn(true); else reset(); }
  function reset() {
    setForm({ ...EMPTY_FORM, waktuEfektif: defaultWaktuEfektifFor(EMPTY_FORM.shift, master.shiftHours) });
    setErrors({});
    setDone(null);
    setDoneMetrics(null);
    setCancelWarn(false);
  }

  async function submit() {
    const nextErrors = {};
    if (!form.grupHead.trim()) nextErrors.grupHead = 'Wajib diisi';
    if (!form.cluster) nextErrors.cluster = 'Wajib dipilih';
    if (!form.line.trim()) nextErrors.line = 'Wajib diisi';
    if (!form.partName) nextErrors.partName = 'Wajib dipilih';
    if (!form.proses) nextErrors.proses = 'Wajib dipilih';
    // Mode multi-Mesin (mesinList terisi) atau mode Mesin tunggal (field
    // `mesin`) -- salah satu wajib ada isinya, tidak keduanya.
    const usingMesinList = form.mesinList.length > 0;
    if (!usingMesinList && !form.mesin) nextErrors.mesin = 'Wajib dipilih';
    // Downtime & Problem (opsional) sekarang satu grup all-or-nothing:
    // begitu SALAH SATU dari Loss Time/Breakdown Mesin (dianggap satu
    // sinyal, isi salah satu tidak apa-apa)/Jenis Problem/Problem diisi,
    // SEMUANYA (termasuk Due Date) jadi wajib -- supaya begitu operator
    // mulai mencatat downtime, catatannya selalu lengkap (Jenis Problem
    // buat kategori, Problem buat deskripsi, Due Date buat tindak lanjut
    // di Problem Produksi). Due Date SENGAJA tidak ikut jadi "pemicu"
    // (cuma jadi salah satu yang WAJIB kalau grup ini kepicu) -- Due Date
    // sudah default ke hari ini (lihat EMPTY_FORM), jadi kalau ikut jadi
    // pemicu juga, grup ini akan SELALU terpicu dari awal (Due Date tidak
    // pernah kosong), memaksa Jenis Problem/Loss Time/Problem wajib diisi
    // di SETIAP submit walau memang tidak ada downtime sama sekali --
    // merusak sifat "opsional" panel ini.
    const hasDowntimeInput = (Number(form.lossTime) || 0) > 0 || (Number(form.breakdownMesin) || 0) > 0;
    const hasJenisProblem = !!form.jenisProblem.trim();
    const hasProblemText = !!form.problem.trim();
    const downtimeGroupTriggered = hasDowntimeInput || hasJenisProblem || hasProblemText;
    if (downtimeGroupTriggered) {
      // "Isi salah satu" (bukan "Wajib diisi" di kedua field) -- Loss
      // Time & Breakdown Mesin cukup salah satu, bukan wajib dua-duanya.
      if (!hasDowntimeInput) {
        nextErrors.lossTime = 'Isi salah satu';
        nextErrors.breakdownMesin = 'Isi salah satu';
      }
      if (!hasJenisProblem) nextErrors.jenisProblem = 'Wajib diisi';
      if (!hasProblemText) nextErrors.problem = 'Wajib diisi';
      if (!form.dueDate) nextErrors.dueDate = 'Wajib diisi';
    }
    // Baris ini mencakup >1 Mesin (mesinList) -- downtime cuma boleh
    // nempel ke SATU Mesin spesifik (bukan ke semuanya sekaligus), supaya
    // tetap ter-trace per Mesin (termasuk oleh Dashboard-MTN).
    if (usingMesinList && form.mesinList.length > 1 && downtimeGroupTriggered && !form.problemMesin) {
      nextErrors.problemMesin = 'Wajib dipilih';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    try {
      const r = await fetch(`${API}/produksi-harian`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tanggal: form.tanggal, waktu: form.waktu, shift: form.shift, grup_head: form.grupHead,
          cluster: form.cluster, line: form.line,
          no_lot: form.noLot, part_name: form.partName, proses: form.proses,
          mesin: form.mesin, mesin_list: usingMesinList ? form.mesinList : undefined,
          problem_mesin: usingMesinList ? form.problemMesin : undefined,
          man_power: form.manPower, cycle_time: form.cycleTime,
          waktu_efektif: form.waktuEfektif, plan,
          ok1: form.qtyOk, ok2: 0, rwk: form.rwk, rjct: form.rjct,
          breakdown_mesin: form.breakdownMesin, jenis_problem: form.jenisProblem, lost_time: form.lossTime,
          keterangan: form.keteranganLossTime,
          problem: form.problem.trim() || undefined, due_date: downtimeGroupTriggered ? (form.dueDate || null) : null,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Gagal mengirim');

      setDoneMetrics(data);
      setDone({ ...form });
    } catch (e) { alert(e.message); }
    setBusy(false);
  }

  /* ── Input Rejection ─────────────────────────────── */
  function setRej(key, value) { setRejForm((f) => ({ ...f, [key]: value })); }
  const rejPartNameOptionsRich = useMemo(
    () => master.partNames.map((p) => ({ value: p.partName, sub: `Cluster ${p.cluster}` })).sort((a, b) => a.value.localeCompare(b.value)),
    [master.partNames],
  );
  const rejPartMatch = useMemo(
    () => master.partNames.find((p) => p.partName === rejForm.partName),
    [master.partNames, rejForm.partName],
  );
  const rejCluster = rejPartMatch?.cluster || '';
  // Total OK bukan lagi diketik manual -- diambil otomatis dari RC Harian
  // Produksi (ProduksiHarian) pada Proses Akhir/Finish Part Name ini
  // (ditandai lewat Master Data), untuk tanggal yang sama. Di-fetch ulang
  // tiap kali Part Name/Tanggal berubah.
  const [rejAutoOk, setRejAutoOk] = useState({ totalOk: 0, hasFinishProses: false });
  useEffect(() => {
    if (!rejForm.partName || !rejForm.tanggal) { setRejAutoOk({ totalOk: 0, hasFinishProses: false }); return; }
    let cancelled = false;
    fetch(`${API}/produksi-ok-for-part?part_name=${encodeURIComponent(rejForm.partName)}&tanggal=${rejForm.tanggal}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setRejAutoOk(d); })
      .catch(() => { if (!cancelled) setRejAutoOk({ totalOk: 0, hasFinishProses: false }); });
    return () => { cancelled = true; };
  }, [rejForm.partName, rejForm.tanggal]);
  const rejTotalOk = rejAutoOk.totalOk;
  const rejTotalLmr = useMemo(() => num(rejForm.totalLmr), [rejForm.totalLmr]);
  const rejTotalProses = useMemo(() => rejTotalOk + rejTotalLmr, [rejTotalOk, rejTotalLmr]);
  const rejRatio = useMemo(() => rejTotalOk > 0 ? ((rejTotalLmr / rejTotalOk) * 100).toFixed(1) : '0.0', [rejTotalOk, rejTotalLmr]);

  function pickRejPartName(partName) { setRejForm((f) => ({ ...f, partName })); }

  const hasRejInput = Object.entries(rejForm).some(([k, v]) => !['tanggal', 'waktu'].includes(k) && !!v);
  function handleRejCancel() { if (hasRejInput) setCancelWarn(true); else resetRej(); }
  function resetRej() {
    setRejForm(EMPTY_REJ_FORM);
    setRejErrors({});
    setRejDone(null);
    setCancelWarn(false);
  }

  async function submitRej() {
    const nextErrors = {};
    if (!rejForm.partName) nextErrors.partName = 'Wajib dipilih';
    setRejErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setRejBusy(true);
    try {
      const r = await fetch(`${API}/rejection-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tanggal: rejForm.tanggal, waktu: rejForm.waktu, part_name: rejForm.partName,
          total_lmr: rejForm.totalLmr,
          kriteria_ng: rejForm.kriteriaNg, keterangan: rejForm.keterangan,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Gagal mengirim');
      setRejDone({ ...rejForm, cluster: rejCluster, totalOk: rejTotalOk });
    } catch (e) { alert(e.message); }
    setRejBusy(false);
  }

  /* ── Input Overtime ─────────────────────────────── */
  function setOt(key, value) { setOtForm((f) => ({ ...f, [key]: value })); }
  const otManPowerOptionsRich = useMemo(
    () => master.manPower.map((m) => ({ value: m.name, sub: m.groupHead ? `Grup Head ${m.groupHead}` : null })).sort((a, b) => a.value.localeCompare(b.value)),
    [master.manPower],
  );

  function pickOtManPower(name) { setOtForm((f) => ({ ...f, manPower: name })); }

  const hasOtInput = Object.entries(otForm).some(([k, v]) => !['tanggal', 'waktu'].includes(k) && !!v);
  function handleOtCancel() { if (hasOtInput) setCancelWarn(true); else resetOt(); }
  function resetOt() {
    setOtForm(EMPTY_OT_FORM);
    setOtErrors({});
    setOtDone(null);
    setCancelWarn(false);
  }

  async function submitOt() {
    const nextErrors = {};
    if (!otForm.manPower) nextErrors.manPower = 'Wajib dipilih';
    setOtErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setOtBusy(true);
    try {
      const r = await fetch(`${API}/overtime-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tanggal: otForm.tanggal, waktu: otForm.waktu, man_power: otForm.manPower,
          durasi_jam: otForm.durasiJam, keterangan: otForm.keterangan,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Gagal mengirim');
      setOtDone({ ...otForm });
    } catch (e) { alert(e.message); }
    setOtBusy(false);
  }

  /* ── Data Pengerjaan Part Rework ────────────────────── */
  function setRw(key, value) { setRwForm((f) => ({ ...f, [key]: value })); }
  const rwPartNameOptionsRich = useMemo(
    () => master.partNames.map((p) => ({ value: p.partName, sub: `Cluster ${p.cluster}` })).sort((a, b) => a.value.localeCompare(b.value)),
    [master.partNames],
  );
  function pickRwPartName(partName) { setRwForm((f) => ({ ...f, partName })); }

  const rwGroupHeadOptionsRich = useMemo(
    () => master.groupHeads.map((g) => ({ value: g.name, sub: `Cluster ${g.cluster}` })).sort((a, b) => a.value.localeCompare(b.value)),
    [master.groupHeads],
  );
  function pickRwGroupHead(name) { setRwForm((f) => ({ ...f, grupHead: name })); }
  const rwCluster = useMemo(
    () => master.groupHeads.find((g) => g.name === rwForm.grupHead)?.cluster || '',
    [master.groupHeads, rwForm.grupHead],
  );

  const hasRwInput = Object.entries(rwForm).some(([k, v]) => !['tanggalDitemukan', 'tanggalRepair'].includes(k) && !!v);
  function handleRwCancel() { if (hasRwInput) setCancelWarn(true); else resetRw(); }
  function resetRw() {
    setRwForm(EMPTY_RW_FORM);
    setRwErrors({});
    setRwDone(null);
    setCancelWarn(false);
  }

  async function submitRw() {
    const nextErrors = {};
    if (!rwForm.partName) nextErrors.partName = 'Wajib dipilih';
    if (!rwForm.grupHead) nextErrors.grupHead = 'Wajib dipilih';
    setRwErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setRwBusy(true);
    try {
      const r = await fetch(`${API}/part-rework`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tanggal_ditemukan: rwForm.tanggalDitemukan, no_lot_original: rwForm.noLotOriginal,
          tanggal_repair: rwForm.tanggalRepair, part_name: rwForm.partName,
          kriteria_rework: rwForm.kriteriaRework, metode_rework: rwForm.metodeRework,
          mesin: rwForm.mesin, pic_rework: rwForm.picRework, grup_head: rwForm.grupHead,
          total_rework: rwForm.totalRework, total_ok: rwForm.totalOk, total_reject: rwForm.totalReject,
          metode_check: rwForm.metodeCheck, tanggal_check: rwForm.tanggalCheck || null, pic_check: rwForm.picCheck,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Gagal mengirim');
      setRwDone({ ...rwForm });
    } catch (e) { alert(e.message); }
    setRwBusy(false);
  }

  /* Styles */
  const inp = {
    background: '#fff', border: '1px solid #c9d4d4',
    borderRadius: 7, padding: '10px 12px', color: '#1c2b2b',
    fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box',
    fontFamily: 'inherit',
  };
  const inpErr = { ...inp, borderColor: '#d9534f' };
  // Rework kuning, Reject merah -- penanda visual langsung di kolom
  // inputnya (bukan cuma di tabel hasil).
  const inpRework = { ...inp, background: '#fff8e1', borderColor: '#e0b400', color: '#7a5d00' };
  const inpReject = { ...inp, background: '#fdecec', borderColor: '#d9534f', color: '#8a1f1f' };

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#eef3f3', color: '#1c2b2b', overflow: 'hidden' }}>

      {/* ── Header teal ───────────────────────────────── */}
      <div className="rc-header" style={{ background: 'linear-gradient(135deg, #0e5a52, #14746a)', padding: '16px 32px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div className="rc-header-side" style={{ width: 170, flexShrink: 0, display: 'flex' }}>
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ width: 36, height: 36, flexShrink: 0, background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.4)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
            title="Menu"
          >
            <Menu size={18} />
          </button>
        </div>
        <div className="rc-header-title" style={{ flex: 1, minWidth: 0, fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '.01em', textAlign: 'center', whiteSpace: 'nowrap' }}>
          Resume Control Harian Produksi
        </div>
        <div className="rc-header-side" style={{ width: 170, flexShrink: 0, textAlign: 'right', paddingRight: 6, boxSizing: 'border-box', color: 'rgba(255,255,255,.9)', fontFamily: 'var(--mono, monospace)' }}>
          <div className="rc-header-clock">
            <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{clock.dateLine}</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{clock.timeLine}</div>
          </div>
        </div>
      </div>

      {sidebarOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 998, background: 'rgba(0,0,0,.4)' }} onClick={() => setSidebarOpen(false)}>
          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 260, background: '#fff', boxShadow: '4px 0 24px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column', padding: '18px 14px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#0e5a52' }}>Menu</span>
              <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5a6b73', display: 'flex' }}><X size={20} /></button>
            </div>
            {[
              { key: 'input', label: 'Input', icon: PencilLine },
              { key: 'table', label: 'Data Produksi', icon: Table2 },
              { key: 'rejection', label: 'Input Rejection', icon: AlertTriangle },
              { key: 'overtime', label: 'Overtime', icon: Clock },
              { key: 'rework', label: 'Rework', icon: Wrench },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => { setTab(key); setSidebarOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', marginBottom: 4,
                  borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 700, textAlign: 'left',
                  background: tab === key ? '#e0f2f0' : 'transparent', color: tab === key ? '#0e5a52' : '#3d4b4b',
                }}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Konten ────────────────────────────────────── */}
      {tab === 'table' ? (
        dpAuth ? (
          <DataProduksiView auth={dpAuth} onLogout={handleDpLogout} shiftOptions={master.shiftHours} master={master} />
        ) : (
          <DataProduksiLogin onSuccess={handleDpLogin} />
        )
      ) : tab === 'rejection' ? (
        rejDone ? (
          <RejSuccessView data={rejDone} onReset={resetRej} />
        ) : (
          <div className="rc-form-wrap" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', padding: '20px 40px 16px', maxWidth: 800, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
            <div style={{ flex: 1 }}>
              <div style={{ textAlign: 'center', fontSize: 17, fontWeight: 800, color: '#0e5a52', marginBottom: 16, letterSpacing: '.01em' }}>
                LAPORAN LMR
              </div>
              <Panel title="Input Rejection" tint="peach">
                <div>
                  <FL>Tanggal *</FL>
                  <input type="date" style={inp} value={rejForm.tanggal} onChange={(e) => setRej('tanggal', e.target.value)} />
                </div>
                <div>
                  <FL>Waktu *</FL>
                  <input type="time" style={inp} value={rejForm.waktu} onChange={(e) => setRej('waktu', e.target.value)} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <FL>Part Name *</FL>
                  <Combobox
                    style={rejErrors.partName ? inpErr : inp}
                    value={rejForm.partName}
                    options={rejPartNameOptionsRich}
                    onChange={pickRejPartName}
                    placeholder="Ketik atau pilih Part Name…"
                  />
                  {rejErrors.partName && <div style={{ color: '#d9534f', fontSize: 12, marginTop: 5 }}>{rejErrors.partName}</div>}
                </div>

                <ComputedField label="Cluster" value={rejCluster || '—'} />
                <div>
                  <ComputedField label="Total OK (pcs)" value={rejTotalOk.toLocaleString()} />
                  {rejForm.partName && !rejAutoOk.hasFinishProses && (
                    <div style={{ color: '#c07c00', fontSize: 11, marginTop: 5 }}>
                      Part Name ini belum punya Proses Akhir di Master Data — Total OK akan 0.
                    </div>
                  )}
                </div>
                <div />
                <div />

                <div>
                  <FL>Total LMR (pcs)</FL>
                  <input type="number" style={inpReject} value={rejForm.totalLmr} onChange={(e) => setRej('totalLmr', e.target.value)} />
                </div>
                <ComputedField label="Total Proses" value={rejTotalProses.toLocaleString()} />
                <ComputedField label="Reject Ratio" value={`${rejRatio}%`} />
                <div />

                <div>
                  <FL>Kriteria NG</FL>
                  <Combobox style={inp} value={rejForm.kriteriaNg} options={master.kriteriaNg.map((k) => k.nama)} onChange={(v) => setRej('kriteriaNg', v)} placeholder="Ketik atau pilih Kriteria NG…" />
                </div>
                <div style={{ gridColumn: 'span 3' }}>
                  <FL>Keterangan</FL>
                  <input type="text" style={inp} value={rejForm.keterangan} onChange={(e) => setRej('keterangan', e.target.value)} placeholder="Catatan tambahan (opsional)" />
                </div>
              </Panel>
            </div>

            <div style={{ flexShrink: 0, paddingTop: 16, borderTop: '1px solid #c9d4d4', marginTop: 16, display: 'flex', gap: 12 }}>
              <button
                style={{ flex: '0 0 auto', padding: '13px 28px', fontSize: 15, borderRadius: 8, background: '#eef2f2', border: '1px solid #c9d4d4', cursor: 'pointer', fontWeight: 600 }}
                onClick={handleRejCancel}>
                Batal
              </button>
              <button
                style={{ flex: 1, padding: '13px', fontSize: 15, borderRadius: 8, color: '#fff', background: '#0e5a52', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                disabled={rejBusy} onClick={submitRej}>
                {rejBusy ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        )
      ) : tab === 'overtime' ? (
        otDone ? (
          <OtSuccessView data={otDone} onReset={resetOt} />
        ) : (
          <div className="rc-form-wrap" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', padding: '20px 40px 16px', maxWidth: 800, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
            <div style={{ flex: 1 }}>
              <div style={{ textAlign: 'center', fontSize: 17, fontWeight: 800, color: '#0e5a52', marginBottom: 16, letterSpacing: '.01em' }}>
                LAPORAN OVERTIME PRODUKSI
              </div>
              <Panel title="Input Overtime" tint="cyan">
                <div>
                  <FL>Tanggal *</FL>
                  <input type="date" style={inp} value={otForm.tanggal} onChange={(e) => setOt('tanggal', e.target.value)} />
                </div>
                <div>
                  <FL>Waktu *</FL>
                  <input type="time" style={inp} value={otForm.waktu} onChange={(e) => setOt('waktu', e.target.value)} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <FL>Man Power *</FL>
                  <Combobox
                    style={otErrors.manPower ? inpErr : inp}
                    value={otForm.manPower}
                    options={otManPowerOptionsRich}
                    onChange={pickOtManPower}
                    placeholder="Ketik atau pilih Man Power…"
                  />
                  {otErrors.manPower && <div style={{ color: '#d9534f', fontSize: 12, marginTop: 5 }}>{otErrors.manPower}</div>}
                </div>

                <div>
                  <FL>Durasi Lembur (jam) *</FL>
                  <input type="number" style={inp} value={otForm.durasiJam} onChange={(e) => setOt('durasiJam', e.target.value)} />
                </div>
                <div style={{ gridColumn: 'span 3' }}>
                  <FL>Keterangan</FL>
                  <input type="text" style={inp} value={otForm.keterangan} onChange={(e) => setOt('keterangan', e.target.value)} placeholder="Catatan tambahan (opsional)" />
                </div>
              </Panel>
            </div>

            <div style={{ flexShrink: 0, paddingTop: 16, borderTop: '1px solid #c9d4d4', marginTop: 16, display: 'flex', gap: 12 }}>
              <button
                style={{ flex: '0 0 auto', padding: '13px 28px', fontSize: 15, borderRadius: 8, background: '#eef2f2', border: '1px solid #c9d4d4', cursor: 'pointer', fontWeight: 600 }}
                onClick={handleOtCancel}>
                Batal
              </button>
              <button
                style={{ flex: 1, padding: '13px', fontSize: 15, borderRadius: 8, color: '#fff', background: '#0e5a52', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                disabled={otBusy} onClick={submitOt}>
                {otBusy ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        )
      ) : tab === 'rework' ? (
        rwDone ? (
          <RwSuccessView data={rwDone} onReset={resetRw} />
        ) : (
          <div className="rc-form-wrap" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', padding: '20px 40px 16px', maxWidth: 800, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
            <div style={{ flex: 1 }}>
              <div style={{ textAlign: 'center', fontSize: 17, fontWeight: 800, color: '#0e5a52', marginBottom: 16, letterSpacing: '.01em' }}>
                DATA PENGERJAAN PART REWORK
              </div>
              <Panel title="Pengerjaan Rework" tint="peach">
                <div>
                  <FL>Tanggal Ditemukan *</FL>
                  <input type="date" style={inp} value={rwForm.tanggalDitemukan} onChange={(e) => setRw('tanggalDitemukan', e.target.value)} />
                </div>
                <div>
                  <FL>No Lot Original</FL>
                  <input type="text" style={inp} value={rwForm.noLotOriginal} onChange={(e) => setRw('noLotOriginal', e.target.value)} />
                </div>
                <div>
                  <FL>Tanggal Repair *</FL>
                  <input type="date" style={inp} value={rwForm.tanggalRepair} onChange={(e) => setRw('tanggalRepair', e.target.value)} />
                </div>
                <ComputedField label="No Lot Rework" value={previewNoLotRework(rwForm.tanggalRepair)} />

                <div style={{ gridColumn: 'span 2' }}>
                  <FL>Nama Part *</FL>
                  <Combobox
                    style={rwErrors.partName ? inpErr : inp}
                    value={rwForm.partName}
                    options={rwPartNameOptionsRich}
                    onChange={pickRwPartName}
                    placeholder="Ketik atau pilih Part Name…"
                  />
                  {rwErrors.partName && <div style={{ color: '#d9534f', fontSize: 12, marginTop: 5 }}>{rwErrors.partName}</div>}
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <FL>Grup Head *</FL>
                  <Combobox
                    style={rwErrors.grupHead ? inpErr : inp}
                    value={rwForm.grupHead}
                    options={rwGroupHeadOptionsRich}
                    onChange={pickRwGroupHead}
                    placeholder="Ketik atau pilih Grup Head…"
                  />
                  {rwErrors.grupHead && <div style={{ color: '#d9534f', fontSize: 12, marginTop: 5 }}>{rwErrors.grupHead}</div>}
                </div>
                <ComputedField label="Cluster" value={rwCluster || '—'} />
                <div />

                <div>
                  <FL>Kriteria Rework</FL>
                  <input type="text" style={inp} value={rwForm.kriteriaRework} onChange={(e) => setRw('kriteriaRework', e.target.value)} />
                </div>
                <div>
                  <FL>Metode Rework</FL>
                  <input type="text" style={inp} value={rwForm.metodeRework} onChange={(e) => setRw('metodeRework', e.target.value)} />
                </div>
                <div>
                  <FL>Mesin</FL>
                  <Combobox style={inp} value={rwForm.mesin} options={mesinOptionsRich} onChange={(v) => setRw('mesin', v)} placeholder="Ketik atau pilih Mesin…" />
                </div>
                <div>
                  <FL>PIC Rework</FL>
                  <input type="text" style={inp} value={rwForm.picRework} onChange={(e) => setRw('picRework', e.target.value)} />
                </div>

                <div>
                  <FL>Total Rework (pcs)</FL>
                  <input type="number" style={inpRework} value={rwForm.totalRework} onChange={(e) => setRw('totalRework', e.target.value)} />
                </div>
                <div>
                  <FL>Total OK (pcs)</FL>
                  <input type="number" style={inp} value={rwForm.totalOk} onChange={(e) => setRw('totalOk', e.target.value)} />
                </div>
                <div>
                  <FL>Total Reject (pcs)</FL>
                  <input type="number" style={inpReject} value={rwForm.totalReject} onChange={(e) => setRw('totalReject', e.target.value)} />
                </div>
                <div />
              </Panel>

              <Panel title="Hasil Pemeriksaan" tint="gray">
                <div>
                  <FL>Metode Check</FL>
                  <input type="text" style={inp} value={rwForm.metodeCheck} onChange={(e) => setRw('metodeCheck', e.target.value)} />
                </div>
                <div>
                  <FL>Tanggal Check</FL>
                  <input type="date" style={inp} value={rwForm.tanggalCheck} onChange={(e) => setRw('tanggalCheck', e.target.value)} />
                </div>
                <div>
                  <FL>PIC Check</FL>
                  <input type="text" style={inp} value={rwForm.picCheck} onChange={(e) => setRw('picCheck', e.target.value)} />
                </div>
              </Panel>
            </div>

            <div style={{ flexShrink: 0, paddingTop: 16, borderTop: '1px solid #c9d4d4', marginTop: 16, display: 'flex', gap: 12 }}>
              <button
                style={{ flex: '0 0 auto', padding: '13px 28px', fontSize: 15, borderRadius: 8, background: '#eef2f2', border: '1px solid #c9d4d4', cursor: 'pointer', fontWeight: 600 }}
                onClick={handleRwCancel}>
                Batal
              </button>
              <button
                style={{ flex: 1, padding: '13px', fontSize: 15, borderRadius: 8, color: '#fff', background: '#0e5a52', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                disabled={rwBusy} onClick={submitRw}>
                {rwBusy ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        )
      ) : done ? (
        <SuccessView data={done} metrics={doneMetrics} onReset={reset} />
      ) : (
        <div className="rc-form-wrap" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', padding: '14px 24px 12px', maxWidth: 1400, width: '100%', margin: '0 auto', boxSizing: 'border-box' }} onKeyDown={handleFormKeyDown}>

          <div style={{ flex: 1 }} ref={formRef}>

            <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 800, color: '#0e5a52', marginBottom: 10, letterSpacing: '.01em' }}>
              LAPORAN HARIAN PRODUKSI
            </div>

            <div className="rc-2col">
              {/* ── Grup Head + Input Produksi (tanggal/waktu/shift) -- kiri-atas desktop, urutan pertama di HP ── */}
              <div className="rc-2col-grouphead group-box" style={{ marginTop: 0 }}>
                <span className="group-box-title">Grup Head &amp; Input Produksi</span>
                <div className="rc-grouphead-grid" style={{ display: 'grid', gap: '10px 20px' }}>
                  <div>
                    <FL>Nama Grup Head *</FL>
                    <Combobox
                      style={errors.grupHead ? inpErr : inp}
                      value={form.grupHead}
                      options={grupHeadOptionsRich}
                      onChange={pickGroupHead}
                      placeholder="Ketik atau pilih Grup Head…"
                    />
                    {errors.grupHead && <div style={{ color: '#d9534f', fontSize: 12, marginTop: 5 }}>{errors.grupHead}</div>}
                  </div>
                  <ComputedField label="Cluster" value={form.cluster || '—'} />
                  <div style={{ gridColumn: 'span 2' }}>
                    <FL>Tanggal *</FL>
                    <input type="date" style={inp} value={form.tanggal} onChange={(e) => set('tanggal', e.target.value)} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <FL>Waktu *</FL>
                    <input type="time" style={inp} value={form.waktu} onChange={(e) => set('waktu', e.target.value)} />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <FL>Shift *</FL>
                    <select style={inp} value={form.shift} onChange={(e) => pickShift(e.target.value)}>
                      {master.shiftHours.map((s) => <option key={s.shift} value={s.shift}>{s.shift}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Aktual Produksi (Part Name..Total Proses) -- kanan desktop (span 2 baris), urutan kedua di HP ── */}
              <Panel title="Aktual Produksi" tint="peach" gridClassName="rc-panel-grid-2" className="rc-2col-aktual">
                <div style={{ gridColumn: 'span 2' }}>
                  <FL>No Lot</FL>
                  <input type="text" style={inp} value={form.noLot} onChange={(e) => set('noLot', e.target.value)} />
                </div>

                <div>
                  <FL>Part Name *</FL>
                  <Combobox
                    style={errors.partName ? inpErr : inp}
                    value={form.partName}
                    disabled={!form.cluster}
                    options={partNameOptionsRich}
                    onChange={pickPartName}
                    placeholder={form.cluster ? 'Ketik atau pilih Part Name…' : 'Pilih Grup Head dulu'}
                  />
                </div>
                <div>
                  <FL>Proses *</FL>
                  <Combobox
                    style={errors.proses ? inpErr : inp}
                    value={form.proses}
                    disabled={!form.partName}
                    options={prosesOptionsRich}
                    onChange={pickProses}
                    placeholder="Ketik atau pilih Proses…"
                  />
                </div>
                <div>
                  <FL>Line Produksi *</FL>
                  <Combobox style={errors.line ? inpErr : inp} value={form.line} options={lineOptions} onChange={(v) => set('line', v)} placeholder="Ketik atau pilih Line…" />
                </div>
                <div>
                  <FL>Mesin * {mesinOptionsForProses.length > 1 && <span style={{ fontWeight: 400, color: '#6b7a7a' }}>({mesinOptionsForProses.length} Mesin tercatat — centang yang jalan)</span>}</FL>
                  {mesinOptionsForProses.length > 1 ? (
                    // Proses ini punya lebih dari 1 Mesin tercatat di Master
                    // Data -- semua tercentang otomatis (default: semua jalan
                    // bareng), operator tinggal uncheck yang tidak jalan.
                    // Submit akan fan-out jadi satu baris ProduksiHarian per
                    // Mesin tercentang (lihat submit() di bawah).
                    <div style={{ ...inp, height: 'auto', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 130, overflowY: 'auto', padding: '8px 10px' }}>
                      {mesinOptionsForProses.map((m) => (
                        <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                          <input type="checkbox" checked={form.mesinList.includes(m)} onChange={() => toggleMesinInList(m)} />
                          {m}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <Combobox style={errors.mesin ? inpErr : inp} value={form.mesin} options={mesinOptionsRich} onChange={(v) => set('mesin', v)} placeholder="Ketik atau pilih Mesin…" />
                  )}
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <FL>Man Power</FL>
                  <Combobox style={inp} value={form.manPower} options={manPowerOptions} onChange={(v) => set('manPower', v)} placeholder="Ketik atau pilih Man Power…" />
                </div>
                <div>
                  <FL>Cycle Time</FL>
                  <input type="number" style={inp} value={form.cycleTime} onChange={(e) => set('cycleTime', e.target.value)} />
                </div>
                <div>
                  <FL>Waktu Efektif</FL>
                  <input type="number" style={inp} value={form.waktuEfektif} onChange={(e) => set('waktuEfektif', e.target.value)} />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <ComputedField label="Plan" value={plan.toLocaleString()} />
                </div>
                <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 20px' }}>
                  <div>
                    <FL>QTY Produksi OK</FL>
                    <input type="number" style={inp} value={form.qtyOk} onChange={(e) => set('qtyOk', e.target.value)} />
                  </div>
                  <div>
                    <FL>Rework</FL>
                    <input type="number" style={inpRework} value={form.rwk} onChange={(e) => set('rwk', e.target.value)} />
                  </div>
                  <div>
                    <FL>Reject</FL>
                    <input type="number" style={inpReject} value={form.rjct} onChange={(e) => set('rjct', e.target.value)} />
                  </div>
                </div>

                <ComputedField label="Total OK" value={totalOk.toLocaleString()} />
                <ComputedField label="Total Proses" value={totalProses.toLocaleString()} />
              </Panel>

              {/* ── Downtime & Problem/Root Cause -- kiri-bawah desktop, urutan ketiga (terakhir) di HP ── */}
              <Panel title="Downtime & Problem/Root Cause (opsional)" tint="gray" gridClassName="rc-panel-grid-3" className="rc-2col-problem">
                {form.mesinList.length > 1 && (
                  <div style={{ gridColumn: 'span 3' }}>
                    <FL error={errors.problemMesin}>Mesin Bermasalah</FL>
                    <Combobox
                      style={errors.problemMesin ? inpErr : inp}
                      value={form.problemMesin}
                      options={form.mesinList}
                      onChange={(v) => set('problemMesin', v)}
                      placeholder="Pilih Mesin yang mengalami problem…"
                    />
                    {errors.problemMesin && <div style={{ color: '#d9534f', fontSize: 12, marginTop: 5 }}>{errors.problemMesin}</div>}
                  </div>
                )}
                <div>
                  <FL>Jenis Problem</FL>
                  <Combobox style={errors.jenisProblem ? inpErr : inp} value={form.jenisProblem} options={JENIS_PROBLEM_OPTS} onChange={(v) => set('jenisProblem', v)} placeholder="Ketik atau pilih Jenis Problem…" />
                  {errors.jenisProblem && <div style={{ color: '#d9534f', fontSize: 12, marginTop: 5 }}>{errors.jenisProblem}</div>}
                </div>
                <div>
                  <FL>Loss Time (menit)</FL>
                  <input type="number" style={inp} value={form.lossTime} onChange={(e) => set('lossTime', e.target.value)} />
                </div>
                <div>
                  <FL>Breakdown Mesin (menit)</FL>
                  <input type="number" style={inp} value={form.breakdownMesin} onChange={(e) => set('breakdownMesin', e.target.value)} />
                </div>
                <div>
                  <FL error={errors.dueDate}>Due Date</FL>
                  <input type="date" style={errors.dueDate ? inpErr : inp} value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
                  {errors.dueDate && <div style={{ color: '#d9534f', fontSize: 12, marginTop: 5 }}>{errors.dueDate}</div>}
                </div>
                <div>
                  <FL>Keterangan Loss Time</FL>
                  <input type="text" style={inp} value={form.keteranganLossTime} onChange={(e) => set('keteranganLossTime', e.target.value)} />
                </div>
                <div>
                  <FL error={errors.problem}>Problem</FL>
                  <input type="text" style={errors.problem ? inpErr : inp} value={form.problem} onChange={(e) => set('problem', e.target.value)} placeholder="Isi jika ada masalah" />
                  {errors.problem && <div style={{ color: '#d9534f', fontSize: 12, marginTop: 5 }}>{errors.problem}</div>}
                </div>
              </Panel>
            </div>

          </div>

          {/* ── Footer ──────────────────────────────────── */}
          <div style={{ flexShrink: 0, paddingTop: 16, borderTop: '1px solid #c9d4d4', marginTop: 16, display: 'flex', gap: 12 }}>
            <button
              style={{ flex: '0 0 auto', padding: '13px 28px', fontSize: 15, borderRadius: 8, background: '#eef2f2', border: '1px solid #c9d4d4', cursor: 'pointer', fontWeight: 600 }}
              onClick={handleCancel}>
              Batal
            </button>
            <button
              style={{ flex: 1, padding: '13px', fontSize: 15, borderRadius: 8, color: '#fff', background: '#0e5a52', border: 'none', cursor: 'pointer', fontWeight: 700 }}
              disabled={busy} onClick={() => submit()}>
              {busy ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>

        </div>
      )}

      {/* ── Tombol fullscreen ─────────────────────────── */}
      <button onClick={toggleFullscreen}
        title={isFullscreen ? 'Keluar layar penuh' : 'Layar penuh'}
        style={{ position: 'fixed', bottom: 14, right: 14, width: 34, height: 34, borderRadius: 8, background: '#fff', border: '1px solid #c9d4d4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0e5a52' }}>
        {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
      </button>

      {cancelWarn && <CancelModal onConfirm={tab === 'rejection' ? resetRej : tab === 'overtime' ? resetOt : tab === 'rework' ? resetRw : reset} onDismiss={() => setCancelWarn(false)} />}

    </div>
  );
}
