import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, X, ArrowUpRight, Download, Upload } from 'lucide-react';
import ProduksiTable from '../components/ProduksiTable.jsx';
import LineTrendChart from '../components/charts/LineTrendChart.jsx';
import PeriodPicker from '../components/PeriodPicker.jsx';
import Combobox from '../components/Combobox.jsx';
import { CLUSTER_COLORS } from '../components/ClusterBarList.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useUI } from '../contexts/UIContext.jsx';
import { apiFetch, apiSend } from '../api.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useConfirm } from '../contexts/ConfirmContext.jsx';
import { isReadOnlyUser } from '../roles.js';
import { downloadXlsx } from '../exportXlsx.js';
import { readXlsxFile } from '../importXlsx.js';
import { formatDateID } from '../dateFmt.js';

const API = '/api';
const CLUSTERS = ['AD', 'BC', 'EF', 'FI'];
// Sama daftar dengan RMOPublic.jsx (RC Harian Produksi) & ProblemLogPage.jsx
// (Problem Produksi) -- 4M + Setting & Tool ("Environment" sudah dihapus
// dari pilihan, data lama yang masih pakai nilai itu tidak di-backfill).
const JENIS_PROBLEM_OPTS = ['Machine', 'Material', 'Method', 'Man', 'Setting & Tool'];

function todayStr() { return new Date().toISOString().slice(0, 10); }

const inp = {
  background: 'var(--input-bg)', border: '1px solid var(--input-border)',
  borderRadius: 7, padding: '8px 10px', fontSize: 13, width: '100%',
  boxSizing: 'border-box', color: 'var(--text)', fontFamily: 'inherit',
};
// Field yang dikunci (Cluster, Cycle Time, Plan) -- nilainya ikut Master
// Data/kalkulasi otomatis, cuma ditampilkan di sini, tidak bisa diedit.
const lockedInp = { ...inp, opacity: .6, cursor: 'not-allowed' };

function EditField({ label, hint, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
        {label}{hint && <span style={{ textTransform: 'none', fontWeight: 400, letterSpacing: 0 }}> · {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function EditProduksiModal({ row, master, machines, onClose, onSaved }) {
  const { logout } = useAuth();
  const { navigateToMasterData } = useUI();
  const showToast = useToast();
  const [form, setForm] = useState({
    tanggal: row.tanggal, shift: row.shift, noLot: row.noLot || '',
    manPower: row.manPower || '',
    cluster: row.cluster,
    partName: row.partName, proses: row.proses, line: row.line, mesin: row.mesin,
    waktuEfektif: row.waktuEfektif,
    totalOk: row.ok1 + row.ok2, rework: row.rework, reject: row.reject,
    breakdownMesin: row.breakdownMesin, lostTime: row.lostTime, keterangan: row.keterangan || '',
    jenisProblem: row.jenisProblem || '',
  });
  const [busy, setBusy] = useState(false);
  // Mesin tambahan (koreksi baris lama yang seharusnya mencakup beberapa
  // Mesin sekaligus, tapi cuma sempat tercatat 1) -- dicentang dari
  // kandidat Master Data Proses ini SELAIN Mesin yang lagi dipilih di
  // atas. Simpan akan clone baris ini (field produksi sama, downtime
  // tidak ikut) jadi baris baru per Mesin yang dicentang di sini.
  const [additionalMesin, setAdditionalMesin] = useState([]);
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }
  function toggleAdditionalMesin(m) {
    setAdditionalMesin((list) => (list.includes(m) ? list.filter((x) => x !== m) : [...list, m]));
  }
  // Jenis Problem WAJIB begitu ada Breakdown Mesin/Lost Time -- sama
  // aturan dengan RC Harian Produksi (lihat validasi backend di
  // /produksi-harian-update), supaya downtime yang dikoreksi lewat Data
  // Produksi juga selalu punya kategori yang jelas (dipakai Problem
  // Produksi & Dashboard-MTN).
  const jenisProblemRequired = (Number(form.breakdownMesin) || 0) > 0 || (Number(form.lostTime) || 0) > 0;

  // Part Name & Proses sekarang bisa diganti langsung di sini, cascading
  // sama seperti RC Harian Produksi (/rmo): pilih Part Name -> pilihan
  // Proses ikut Part Name itu -> Line/Mesin/Cycle Time otomatis dari
  // Proses yang dipilih (Line tetap bisa diubah manual sesudahnya). Ini
  // supaya baris lama yang Part Name/Proses-nya belum sesuai (lagi)
  // dengan Master Data bisa "disambungkan" ulang ke katalog yang benar
  // tanpa hapus-input ulang.
  //
  // Cluster TIDAK lagi dikunci ke Grup Head baris ini -- dia sekarang
  // ikut Part Name+Proses yang dipilih (lihat pickProses), sama seperti
  // MasterProses.cluster jadi sumber kebenaran. Ini sengaja diubah untuk
  // kasus Man Power pindah Cluster: baris lama yang ternyata salah
  // Cluster (mis. Grup Head/Man Power-nya sudah pindah) bisa dibetulkan
  // cukup dengan memilih ulang Part Name+Proses yang benar, tanpa perlu
  // hapus-input ulang. Part Name & Proses karena itu TIDAK lagi difilter
  // ke Cluster baris ini -- satu Part Name bisa saja punya Proses di
  // lebih dari satu Cluster (lihat catatan yang sama di RMOPublic.jsx).
  const partNameOptions = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const p of master.proses) {
      const key = p.partName.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(p.partName);
    }
    return result.sort((a, b) => a.localeCompare(b));
  }, [master.proses]);

  // Satu Proses boleh punya lebih dari satu baris Master Data (satu per
  // pilihan Mesin) -- dedupe ke satu entri per nama Proses supaya
  // dropdown-nya tidak menampilkan nama yang sama berulang kali.
  const prosesRowsForPartName = useMemo(
    () => master.proses.filter((p) => p.partName === form.partName),
    [master.proses, form.partName],
  );
  const prosesOptions = useMemo(
    () => [...new Set(prosesRowsForPartName.map((p) => p.proses))].sort((a, b) => a.localeCompare(b)),
    [prosesRowsForPartName],
  );
  const prosesRowsForSelected = useMemo(
    () => prosesRowsForPartName.filter((p) => p.proses === form.proses),
    [prosesRowsForPartName, form.proses],
  );
  const prosesMatch = prosesRowsForSelected[0];
  // Cycle Time TIDAK bisa diketik manual -- selalu ikut nilai Master Data
  // untuk Proses yang lagi dipilih (fallback ke nilai lama kalau
  // kombinasi Part Name/Proses-nya belum/tidak match Master Data sama
  // sekali, supaya tidak tiba-tiba jadi 0).
  const cycleTime = prosesMatch ? prosesMatch.cycleTime : row.cycleTime;

  // Mesin WAJIB pilih dari Tabel Machine (katalog "Semua Mesin"), bukan
  // lagi teks bebas dari data lama, sama pola dgn Master Data -> Part
  // Name & Proses. TIDAK difilter per Cluster -- data Cluster di Tabel
  // Machine belum dirapikan (mis. masih "Cell AD" dkk, bukan "AD" polos),
  // jadi filter exact-match pernah bikin pilihan Mesin nyaris kosong.
  // Ketik-utk-cari (Combobox) supaya tetap gampang ditemukan di antara
  // ~168 mesin. Line Produksi TIDAK lagi ikut Mesin -- diisi dari Line
  // tersimpan di Master Data untuk Part Name+Proses ini (lihat
  // pickProses), tetap bisa diubah manual sesudahnya.
  const machinesRich = useMemo(
    () => (machines || []).map((m) => ({ value: m.machine, sub: m.cluster ? `Cluster ${m.cluster}` : null })),
    [machines],
  );
  // Kandidat Mesin (versi rich, buat tampilan dropdown) buat Proses yang
  // lagi dipilih -- kalau > 1, field Mesin di bawah dipersempit ke
  // pilihan ini saja, bukan seluruh katalog Machine.
  const mesinOptionsForProses = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const p of prosesRowsForSelected) {
      const machineMatch = p.mesin ? (machines || []).find((m) => m.machine.toLowerCase() === p.mesin.toLowerCase()) : null;
      if (!machineMatch || seen.has(machineMatch.machine.toLowerCase())) continue;
      seen.add(machineMatch.machine.toLowerCase());
      result.push({ value: machineMatch.machine, sub: machineMatch.cluster ? `Cluster ${machineMatch.cluster}` : null });
    }
    return result.sort((a, b) => a.value.localeCompare(b.value));
  }, [prosesRowsForSelected, machines]);
  // Kandidat lain (di luar Mesin yang lagi jadi Mesin utama) buat "+
  // Tambah Mesin" -- baris lama yang seharusnya mencakup lebih dari satu
  // Mesin sekaligus.
  const otherMesinCandidates = useMemo(
    () => mesinOptionsForProses.filter((m) => m.value !== form.mesin),
    [mesinOptionsForProses, form.mesin],
  );
  // Mesin TIDAK lagi wajib cocok Tabel Machine buat bisa disimpan (lihat
  // /produksi-harian-update) -- tapi tetap ditandai kalau nilainya belum
  // ada di katalog, supaya kelihatan mana yang masih perlu dikoreksi
  // manual ke Machine yang benar (sama semangat dengan MesinMismatchPanel
  // di Master Data, cuma dicek langsung di sini tanpa endpoint terpisah).
  const mesinLinked = useMemo(
    () => !form.mesin.trim() || (machines || []).some((m) => m.machine.toLowerCase() === form.mesin.trim().toLowerCase()),
    [machines, form.mesin],
  );
  // Mesin "Manual" = Proses tidak pakai mesin (dikerjakan tangan) --
  // Breakdown Mesin tidak relevan, dikunci 0. Dicek lagi di backend
  // (produksi.service.js), bukan cuma di sini.
  const isManualMesin = form.mesin.trim().toLowerCase() === 'manual';
  const lineOptions = useMemo(
    () => [...new Set(master.proses.map((p) => p.line).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [master.proses],
  );

  function pickPartName(partName) {
    setForm((f) => ({ ...f, partName, proses: '', line: '', mesin: '' }));
    setAdditionalMesin([]);
  }
  function pickProses(prosesName) {
    const rows = prosesRowsForPartName.filter((p) => p.proses === prosesName);
    const match = rows[0];
    // Kandidat Mesin dari SEMUA baris Master Data Proses ini yang
    // kebetulan sudah cocok Tabel Machine (baris yang belum dikoreksi ke
    // katalog tidak ikut jadi kandidat -- tidak menebak). Satu kandidat
    // langsung terpilih; lebih dari satu dikosongkan dulu supaya admin
    // pilih sendiri lewat dropdown Mesin yang sudah dipersempit (lihat
    // mesinOptionsForProses).
    const mesinCandidates = [...new Set(
      rows.map((r) => r.mesin ? (machines || []).find((m) => m.machine.toLowerCase() === r.mesin.toLowerCase())?.machine : null).filter(Boolean),
    )];
    // Line ikut nilai tersimpan di baris Proses Master Data itu sendiri
    // (bukan dari Machine). Cluster ikut baris Proses ini juga (lihat
    // catatan di partNameOptions).
    setForm((f) => ({ ...f, proses: prosesName, mesin: mesinCandidates.length === 1 ? mesinCandidates[0] : '', line: match?.line || '', cluster: match?.cluster || f.cluster }));
    setAdditionalMesin([]);
  }
  function pickMesin(machineName) {
    setForm((f) => ({ ...f, mesin: machineName }));
    // Mesin utama diganti -- keluarkan dari daftar tambahan kalau
    // kebetulan sempat dicentang di situ (sekarang jadi Mesin utama).
    setAdditionalMesin((list) => list.filter((m) => m !== machineName));
  }

  // Plan otomatis dari Cycle Time (ikut Proses yang dipilih) dan Waktu
  // Efektif (bisa diedit) -- rumus sama seperti RC Harian Produksi
  // (/rmo): 90% Waktu Efektif dibagi Cycle Time, dibulatkan ke puluhan
  // terdekat.
  const plan = useMemo(() => {
    const ct = Number(cycleTime) || 0;
    const we = Number(form.waktuEfektif) || 0;
    if (!ct || !we) return 0;
    return Math.round(((3600 * we * 0.9) / ct) / 10) * 10;
  }, [cycleTime, form.waktuEfektif]);

  // Man Power cuma menampilkan roster milik Grup Head baris ini -- Grup
  // Head sendiri tidak ada field terpisah di form ini (Cluster sekarang
  // ikut Part Name+Proses, lihat catatan di partNameOptions/pickProses).
  const manPowerOptions = useMemo(
    () => master.manPower.filter((m) => m.groupHead === row.grupHead).map((m) => m.name).sort((a, b) => a.localeCompare(b)),
    [master.manPower, row.grupHead],
  );

  async function save() {
    if (!form.partName.trim() || !form.proses.trim() || !form.line.trim() || !form.mesin.trim()) {
      showToast('Part Name, Proses, Line, dan Mesin wajib diisi', 'red');
      return;
    }
    if (jenisProblemRequired && !form.jenisProblem.trim()) {
      showToast('Jenis Problem wajib diisi kalau ada Breakdown Mesin / Lost Time', 'red');
      return;
    }
    setBusy(true);
    try {
      await apiSend('/produksi-harian-update', 'POST', {
        id: row.id,
        tanggal: form.tanggal, shift: form.shift, no_lot: form.noLot,
        cluster: form.cluster,
        part_name: form.partName, proses: form.proses, line: form.line, mesin: form.mesin,
        man_power: form.manPower,
        cycle_time: cycleTime, waktu_efektif: form.waktuEfektif,
        plan, ok1: form.totalOk, ok2: 0, rwk: form.rework, rjct: form.reject,
        breakdown_mesin: form.breakdownMesin, lost_time: form.lostTime, keterangan: form.keterangan,
        jenis_problem: form.jenisProblem,
        additional_mesin: additionalMesin.length > 0 ? additionalMesin : undefined,
      }, logout);
      showToast(
        additionalMesin.length > 0
          ? `Data berhasil diperbarui, ${additionalMesin.length} baris baru dibuat untuk Mesin tambahan`
          : 'Data berhasil diperbarui',
        'green',
      );
      onSaved();
      onClose();
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }

  return (
    <div className="overlay show" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560, borderRadius: 14, margin: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Edit — {row.partName}</div>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 8,
          padding: '8px 12px', marginBottom: 14, fontSize: 12.5,
        }}>
          <div>
            <strong>Cluster</strong>: {form.cluster} <span style={{ color: 'var(--muted)' }}>(ikut Part Name+Proses yang dipilih di bawah)</span>
            <div style={{ color: 'var(--muted)', marginTop: 2 }}>Part Name/Proses belum ada di daftar? Tambahkan dulu lewat Master Data.</div>
          </div>
          <button
            className="btn"
            style={{ display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', flexShrink: 0 }}
            onClick={() => { onClose(); navigateToMasterData('partProses'); }}
          >
            Ke Master Data <ArrowUpRight size={13} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <EditField label="Tanggal"><input type="date" style={inp} value={form.tanggal} onChange={(e) => set('tanggal', e.target.value)} /></EditField>
          <EditField label="Shift">
            <select style={inp} value={form.shift} onChange={(e) => set('shift', e.target.value)}>
              {master.shiftHours.map((s) => <option key={s.shift} value={s.shift}>{s.shift}</option>)}
            </select>
          </EditField>
          <EditField label="Cluster">
            <input style={lockedInp} value={form.cluster} disabled title="Cluster otomatis ikut Part Name+Proses yang dipilih di bawah, pilih ulang kalau perlu dikoreksi" />
          </EditField>
          <EditField label="No Lot"><input style={inp} value={form.noLot} onChange={(e) => set('noLot', e.target.value)} /></EditField>
          <EditField label="Part Name">
            <Combobox style={inp} value={form.partName} options={partNameOptions} onChange={pickPartName} placeholder="Pilih Part Name…" />
          </EditField>
          <EditField label="Proses">
            <Combobox style={inp} value={form.proses} options={prosesOptions} onChange={pickProses} placeholder={form.partName ? 'Pilih Proses…' : 'Pilih Part Name dulu'} />
          </EditField>
          <EditField
            label="Mesin"
            hint={mesinOptionsForProses.length > 1 ? `${mesinOptionsForProses.length} pilihan buat Proses ini` : 'sebisa mungkin dari Tabel Machine, ketik utk cari'}
          >
            <Combobox
              style={inp}
              value={form.mesin}
              options={mesinOptionsForProses.length > 0 ? mesinOptionsForProses : machinesRich}
              onChange={pickMesin}
              placeholder="Ketik atau pilih Mesin…"
            />
            {!mesinLinked && (
              <div style={{ color: 'var(--yellow)', fontSize: 11, marginTop: 4 }}>
                Belum terhubung ke Tabel Machine — Line tidak ikut otomatis, boleh disimpan tetap.
              </div>
            )}
          </EditField>
          {/* Baris ini aslinya cuma tercatat 1 Mesin, tapi Master Data
              Part Name+Proses ini punya Mesin lain juga -- centang di
              sini kalau baris ini SEHARUSNYA mencakup Mesin itu juga
              (mis. salah catat, aslinya beberapa mesin jalan bareng).
              Simpan akan bikin baris BARU per Mesin yang dicentang (data
              produksi sama seperti hasil edit di atas, downtime tidak
              ikut disalin) -- baris ini sendiri tidak berubah jadi
              gabungan, tetap representasi Mesin utamanya sendiri. */}
          {otherMesinCandidates.length > 0 && (
            <div style={{ gridColumn: '1 / -1' }}>
              <EditField label="+ Tambah Mesin" hint="baris baru per Mesin yang dicentang, data sama seperti di atas">
                <div style={{ ...inp, height: 'auto', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 110, overflowY: 'auto', padding: '8px 10px' }}>
                  {otherMesinCandidates.map((m) => (
                    <label key={m.value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                      <input type="checkbox" checked={additionalMesin.includes(m.value)} onChange={() => toggleAdditionalMesin(m.value)} />
                      {m.value}
                    </label>
                  ))}
                </div>
              </EditField>
            </div>
          )}
          <EditField label="Line Produksi">
            <Combobox style={inp} value={form.line} options={lineOptions} onChange={(v) => set('line', v)} placeholder="Ketik atau pilih Line…" />
          </EditField>
          <EditField label="Man Power">
            <Combobox style={inp} value={form.manPower} options={manPowerOptions} onChange={(v) => set('manPower', v)} placeholder="Pilih Man Power…" />
          </EditField>
          <EditField label="Cycle Time">
            <input type="number" style={lockedInp} value={cycleTime} disabled title="Cycle Time otomatis ikut Master Data untuk Proses yang dipilih" />
          </EditField>
          <EditField label="Waktu Efektif"><input type="number" style={inp} value={form.waktuEfektif} onChange={(e) => set('waktuEfektif', e.target.value)} /></EditField>
          <EditField label="Plan">
            <input type="number" style={lockedInp} value={plan} disabled title="Plan otomatis dari Cycle Time × Waktu Efektif, sama seperti RC Harian Produksi" />
          </EditField>
          <EditField label="Total OK"><input type="number" style={inp} value={form.totalOk} onChange={(e) => set('totalOk', e.target.value)} /></EditField>
          <EditField label="Rework"><input type="number" style={inp} value={form.rework} onChange={(e) => set('rework', e.target.value)} /></EditField>
          <EditField label="Reject"><input type="number" style={inp} value={form.reject} onChange={(e) => set('reject', e.target.value)} /></EditField>
          <EditField label="Breakdown Mesin (menit)">
            <input
              type="number"
              style={isManualMesin ? { ...inp, opacity: .6, cursor: 'not-allowed' } : inp}
              value={isManualMesin ? 0 : form.breakdownMesin}
              disabled={isManualMesin}
              onChange={(e) => set('breakdownMesin', e.target.value)}
            />
            {isManualMesin && (
              <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>Mesin "Manual" — Breakdown Mesin tidak berlaku.</div>
            )}
          </EditField>
          <EditField label="Lost Time (menit)"><input type="number" style={inp} value={form.lostTime} onChange={(e) => set('lostTime', e.target.value)} /></EditField>
          <EditField label={`Jenis Problem${jenisProblemRequired ? ' *' : ''}`}>
            <Combobox
              style={jenisProblemRequired && !form.jenisProblem.trim() ? { ...inp, borderColor: 'var(--red)' } : inp}
              value={form.jenisProblem} options={JENIS_PROBLEM_OPTS} onChange={(v) => set('jenisProblem', v)}
              placeholder="Ketik atau pilih Jenis Problem…"
            />
          </EditField>
          <div />
          <div style={{ gridColumn: '1 / -1' }}>
            <EditField label="Keterangan"><textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={form.keterangan} onChange={(e) => set('keterangan', e.target.value)} /></EditField>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
          <button className="btn" onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>
  );
}

// Kolom yang dibaca fitur Import & template contohnya -- header di file
// yang diupload dicocokkan ke label ini (case-insensitive, urutan kolom
// bebas), lihat mapImportRow. LABEL-LABEL INI SENGAJA SAMA PERSIS dengan
// kolom Download Excel (lihat handleExport di bawah) -- supaya file yang
// baru saja di-Download bisa langsung diupload lagi tanpa perlu
// mengedit/mengganti nama header dulu. totalProses/AR/AVB/PERF/YIELD/OEE
// di file Download itu kolom HASIL HITUNGAN (bukan input produksi),
// jadi sengaja TIDAK ada di sini -- kalau ikut terbawa di file yang
// diupload, cukup diabaikan (mapImportRow cuma mengambil kolom yang
// dikenalinya). Satu baris file = satu baris ProduksiHarian baru dengan
// SATU Mesin (sama pola dengan Import Part Name & Proses di Master
// Data) -- kalau satu Part Name+Proses+tanggal perlu beberapa Mesin
// sekaligus, ulang saja baris filenya dengan Mesin yang beda.
const IMPORT_COLUMNS = [
  { key: 'tanggal', label: 'Tanggal' },
  { key: 'cluster', label: 'Cluster' },
  { key: 'shift', label: 'Shift' },
  { key: 'part_name', label: 'Nama Parts' },
  { key: 'no_lot', label: 'No Lot' },
  { key: 'proses', label: 'Proses' },
  { key: 'line', label: 'Line Produksi' },
  { key: 'mesin', label: 'Mesin' },
  { key: 'man_power', label: 'Man Power' },
  { key: 'cycle_time', label: 'Cycle Time' },
  { key: 'waktu_efektif', label: 'Waktu Efektif (Jam)' },
  { key: 'plan', label: 'Plan' },
  { key: 'rework', label: 'Rework' },
  { key: 'reject', label: 'Reject' },
  { key: 'total_ok', label: 'Total OK' },
  { key: 'breakdown_mesin', label: 'Breakdown Mesin' },
  { key: 'jenis_problem', label: 'Jenis Problem' },
  { key: 'lost_time', label: 'Lost Time' },
  { key: 'keterangan', label: 'Keterangan' },
];

// Kolom hasil hitungan di file Download (bukan input) -- kalau file yang
// diupload masih membawa kolom-kolom ini apa adanya (bekas Download,
// tidak diedit), diamkan saja, jangan dianggap header yang tidak
// dikenal/error.
const IMPORT_IGNORED_COMPUTED_LABELS = ['Total Proses', 'AR (%)', 'AVB (%)', 'PERF (%)', 'YIELD (%)', 'OEE (%)'];

function mapImportRow(raw) {
  const normalized = {};
  for (const [k, v] of Object.entries(raw)) normalized[String(k).trim().toLowerCase()] = v;
  const get = (label) => normalized[label.toLowerCase()];
  return {
    tanggal: get('Tanggal'),
    shift: String(get('Shift') ?? '').trim(),
    cluster: String(get('Cluster') ?? '').trim(),
    line: String(get('Line Produksi') ?? '').trim(),
    part_name: String(get('Nama Parts') ?? '').trim(),
    proses: String(get('Proses') ?? '').trim(),
    mesin: String(get('Mesin') ?? '').trim(),
    no_lot: String(get('No Lot') ?? '').trim(),
    man_power: String(get('MP') ?? '').trim(),
    cycle_time: get('CT') ?? '',
    waktu_efektif: get('Waktu Efektif (Jam)') ?? '',
    plan: get('Plan') ?? '',
    total_ok: get('Total OK') ?? '',
    rework: get('Rwk') ?? '',
    reject: get('Rjct') ?? '',
    jenis_problem: String(get('Jenis Problem') ?? '').trim(),
    lost_time: get('Lost Time') ?? '',
    breakdown_mesin: get('Breakdown MC') ?? '',
    keterangan: String(get('Keterangan') ?? '').trim(),
  };
}

// Import massal RC Harian Produksi dari file Excel -- di-parse penuh di
// browser (lihat web/src/importXlsx.js), dikirim sebagai array biasa ke
// /produksi-harian-import. Sama pola dengan ImportProsesModal di
// PartProsesTab.jsx (Master Data).
function ImportProduksiModal({ logout, onClose, onImported }) {
  const showToast = useToast();
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  function downloadTemplate() {
    downloadXlsx('template-import-data-produksi.xlsx', 'Data Produksi', IMPORT_COLUMNS, [
      {
        tanggal: todayStr(), shift: 'Shift 1', cluster: 'AD', line: 'Suzuki', part_name: 'CONTOH PART NAME',
        proses: 'Assy', mesin: 'ROBOT WELDING PANASONIC', no_lot: '', man_power: '', cycle_time: 30,
        waktu_efektif: 7, plan: 800, total_ok: 750, rework: 20, reject: 5, jenis_problem: '', lost_time: 0,
        breakdown_mesin: 0, keterangan: '',
      },
    ]);
  }

  async function handleFile(file) {
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    try {
      const raw = await readXlsxFile(file);
      setRows(raw.map(mapImportRow).filter((r) => r.part_name || r.proses));
    } catch (e) {
      showToast('Gagal membaca file: ' + e.message, 'red');
      setRows([]);
    }
  }

  async function doImport() {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      const r = await apiSend('/produksi-harian-import', 'POST', { rows }, logout);
      setResult(r);
      if (r.imported > 0) {
        showToast(`${r.imported} baris berhasil diimport${r.errors.length ? `, ${r.errors.length} dilewati` : ''}`, r.errors.length ? 'yellow' : 'green');
        onImported();
      } else {
        showToast('Tidak ada baris yang berhasil diimport, cek daftar error di bawah', 'red');
      }
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }

  return createPortal(
    <div className="overlay show" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560, borderRadius: '14px 14px 0 0' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Import Data Produksi</div>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>
          Kolom sama persis dengan file <strong>Download Excel</strong> -- file yang baru di-Download bisa langsung diupload lagi di sini tanpa perlu ganti nama kolom. Kolom yang dibaca: <strong>Tanggal, Cluster, Shift, Nama Parts, Proses, Line Produksi, Mesin</strong> (wajib diisi), plus No Lot/MP/CT/Waktu Efektif (Jam)/Plan/Rwk/Rjct/Total OK/Breakdown MC/Jenis Problem/Lost Time/Keterangan (opsional). Kolom hasil hitungan di file Download ({IMPORT_IGNORED_COMPUTED_LABELS.join(', ')}) boleh ikut terbawa, otomatis diabaikan. Tanggal boleh format <strong>DD/MM/YYYY</strong> (seperti hasil Download), <strong>YYYY-MM-DD</strong>, atau sel bertipe Tanggal di Excel. Satu baris file = satu baris data dengan satu Mesin — kalau satu Part Name+Proses perlu beberapa Mesin, ulang barisnya dengan Mesin berbeda.
        </div>

        <button className="btn" onClick={downloadTemplate} style={{ marginBottom: 12 }}>Download Template</button>

        <input
          type="file" accept=".xlsx,.xls"
          style={{ display: 'block', marginBottom: 12, fontSize: 12.5, color: 'var(--text)' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />

        {rows.length > 0 && !result && (
          <div style={{ fontSize: 12.5, marginBottom: 12 }}>
            <strong>{fileName}</strong> — {rows.length} baris terbaca.
          </div>
        )}

        {result && (
          <div style={{ fontSize: 12, marginBottom: 12, maxHeight: 220, overflowY: 'auto', background: 'var(--s2)', borderRadius: 8, padding: 10 }}>
            <div style={{ color: 'var(--green)', fontWeight: 700 }}>{result.imported} dari {result.total} baris berhasil diimport.</div>
            {result.errors.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ color: 'var(--red)', fontWeight: 700 }}>{result.errors.length} baris dilewati:</div>
                {result.errors.map((e, i) => (
                  <div key={i} style={{ color: 'var(--muted)' }}>Baris {e.row}: {e.reason}</div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="modal-footer">
          <button className="btn primary" disabled={rows.length === 0 || busy} onClick={doImport}>
            {busy ? 'Mengimport…' : `Import${rows.length ? ` (${rows.length} baris)` : ''}`}
          </button>
          <button className="btn" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function DataProduksi() {
  const { logout, username } = useAuth();
  const readOnly = isReadOnlyUser(username);
  const showToast = useToast();
  const confirm = useConfirm();
  const { dataProduksiQuery, setDataProduksiQuery } = useUI();
  const [period, setPeriod]   = useState('today');
  const [refDate, setRefDate] = useState(todayStr());
  const [query, setQuery]     = useState('');
  const [showImport, setShowImport] = useState(false);

  // Datang dari link "Ke Data Produksi" di panel Master Data (Part Name
  // bermasalah) -- isi kotak pencarian & tampilkan semua periode (bukan
  // cuma "today") supaya baris lama yang dicari pasti kelihatan, lalu
  // reset state-nya supaya tidak nempel di pencarian manual berikutnya.
  useEffect(() => {
    if (!dataProduksiQuery) return;
    setQuery(dataProduksiQuery);
    setPeriod('all');
    setDataProduksiQuery('');
  }, [dataProduksiQuery, setDataProduksiQuery]);
  const [shiftFilter, setShiftFilter] = useState('all');
  const [clusterFilter, setClusterFilter] = useState('all');
  const [rows, setRows]       = useState([]);
  const [trends, setTrends]   = useState({});
  const [master, setMaster]   = useState({ manPower: [], proses: [], partNames: [], shiftHours: [] });
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const qs = `period=${period}&date=${refDate}`;
    fetch(`${API}/produksi-harian?${qs}`).then((r) => r.json()).then((data) => {
      setRows(data);
      setLoading(false);
    }).catch(() => setLoading(false));

    const trendQs = `period=${period}&date=${refDate}`;
    Promise.all(CLUSTERS.map((c) => apiFetch(`/ar-trend?${trendQs}&cluster=${c}`, [], logout)))
      .then((results) => {
        const map = {};
        CLUSTERS.forEach((c, i) => { map[c] = results[i]; });
        setTrends(map);
      });
  }, [period, refDate, logout]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    apiFetch('/master', { manPower: [], proses: [], partNames: [], shiftHours: [] }, logout).then(setMaster);
    apiFetch('/machines', [], logout).then(setMachines);
  }, [logout]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (shiftFilter !== 'all' && r.shift !== shiftFilter) return false;
      if (!q) return true;
      return (
        r.partName.toLowerCase().includes(q) ||
        r.mesin.toLowerCase().includes(q) ||
        (r.noLot || '').toLowerCase().includes(q) ||
        (r.proses || '').toLowerCase().includes(q)
      );
    });
  }, [rows, query, shiftFilter]);

  const byCluster = useMemo(() => {
    const map = {};
    CLUSTERS.forEach((c) => { map[c] = filteredRows.filter((r) => r.cluster === c); });
    return map;
  }, [filteredRows]);

  // Download Excel (.xlsx asli lewat library xlsx/SheetJS) -- isinya data
  // yang lagi kefilter di layar (period/shift/pencarian), digabung semua
  // Cluster jadi satu file, buat dibaca/dianalisa lebih leluasa di luar
  // tabel yang tampilannya padat.
  // Label kolom & urutan di sini SENGAJA disamakan persis dengan
  // IMPORT_COLUMNS/mapImportRow di bawah (Upload Excel) -- supaya file
  // hasil Download ini bisa langsung diupload ulang lewat Upload Excel
  // tanpa perlu ganti nama header dulu. totalProses/ar/avb/perf/yield/oee
  // itu kolom HASIL HITUNGAN (bukan input) -- tetap diekspor buat dibaca,
  // tapi diabaikan begitu saja kalau file ini diupload lagi (lihat
  // mapImportRow, cuma mengambil key yang dikenalinya).
  function handleExport() {
    const columns = [
      { key: 'tanggal', label: 'Tanggal' },
      { key: 'cluster', label: 'Cluster' },
      { key: 'shift', label: 'Shift' },
      { key: 'partName', label: 'Nama Parts' },
      { key: 'noLot', label: 'No Lot' },
      { key: 'proses', label: 'Proses' },
      { key: 'line', label: 'Line Produksi' },
      { key: 'mesin', label: 'Mesin' },
      { key: 'manPower', label: 'MP' },
      { key: 'cycleTime', label: 'CT' },
      { key: 'waktuEfektif', label: 'Waktu Efektif (Jam)' },
      { key: 'plan', label: 'Plan' },
      { key: 'rework', label: 'Rwk' },
      { key: 'reject', label: 'Rjct' },
      { key: 'totalOk', label: 'Total OK' },
      { key: 'totalProses', label: 'Total Proses' },
      { key: 'breakdownMesin', label: 'Breakdown MC' },
      { key: 'jenisProblem', label: 'Jenis Problem' },
      { key: 'lostTime', label: 'Lost Time' },
      { key: 'keterangan', label: 'Keterangan' },
      { key: 'ar', label: 'AR (%)' },
      { key: 'avb', label: 'AVB (%)' },
      { key: 'perf', label: 'PERF (%)' },
      { key: 'yield', label: 'YIELD (%)' },
      { key: 'oee', label: 'OEE (%)' },
    ];
    const exportRows = filteredRows.map((r) => ({ ...r, tanggal: formatDateID(r.tanggal) }));
    downloadXlsx(`data-produksi_${refDate}.xlsx`, 'Data Produksi', columns, exportRows);
  }

  // rowOrGroup: satu baris (Aksi biasa) ATAU array baris (dari "Hapus
  // Semua" GroupActionsMenu di ProduksiTable, buat batch multi-Mesin).
  async function handleDelete(row) {
    if (!(await confirm(`Hapus data ${row.partName} (${row.tanggal})?`))) return;
    try {
      await apiSend('/produksi-harian-delete', 'POST', { id: row.id }, logout);
      showToast('Data berhasil dihapus', 'green');
      load();
    } catch (e) { showToast(e.message, 'red'); }
  }

  return (
    <div className="page-view active">
      <div className="page-header">
        <div>
          <div className="page-title">Data Produksi</div>
        </div>
      </div>

      <div className="group-box" style={{ marginBottom: 16 }}>
        <span className="group-box-title">Apply Filters</span>
        <div className="dash-filter-bar" style={{ flexWrap: 'wrap' }}>
          <PeriodPicker pill period={period} setPeriod={setPeriod} refDate={refDate} setRefDate={setRefDate} />
          <select
            value={clusterFilter}
            onChange={(e) => setClusterFilter(e.target.value)}
            className="form-input"
            style={{ maxWidth: 150 }}
          >
            <option value="all">Semua Cluster</option>
            {CLUSTERS.map((c) => <option key={c} value={c}>Cluster {c}</option>)}
          </select>
          <select
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
            className="form-input"
            style={{ maxWidth: 140 }}
          >
            <option value="all">Semua Shift</option>
            {master.shiftHours.map((s) => <option key={s.shift} value={s.shift}>{s.shift}</option>)}
          </select>
          <input
            type="text"
            placeholder="Cari Part / Mesin / No Lot…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="form-input"
            style={{ maxWidth: 260 }}
          />
          <button className="btn-icon" title="Refresh data" onClick={load}>
            <RefreshCw size={14} />
          </button>
          <button className="btn" onClick={handleExport} disabled={filteredRows.length === 0} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} /> Download Excel
          </button>
          {!readOnly && (
            <button className="btn" onClick={() => setShowImport(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Upload size={14} /> Upload Excel
            </button>
          )}
        </div>
      </div>

      {showImport && (
        <ImportProduksiModal logout={logout} onClose={() => setShowImport(false)} onImported={load} />
      )}

      {CLUSTERS.filter((c) => clusterFilter === 'all' || c === clusterFilter).map((cluster) => (
        <div key={cluster} style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: CLUSTER_COLORS[cluster] }}></span>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>Cluster {cluster}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>({byCluster[cluster]?.length || 0} baris)</div>
          </div>

          <div className="row4" style={{ gridTemplateColumns: '1fr', marginBottom: 12 }}>
            <LineTrendChart
              title={`Tren AR — Cluster ${cluster}`}
              data={(trends[cluster] || []).map((d) => ({ ...d, target: 100 }))}
              valueKey="ar"
              targetKey="target"
              color={CLUSTER_COLORS[cluster]}
              unit="%"
              showMovingAvg
              movingAvgColor="var(--blue)"
              targetColor="var(--red)"
            />
          </div>

          <div className="card" style={{ padding: 0 }}>
            <ProduksiTable rows={byCluster[cluster] || []} loading={loading} onEdit={readOnly ? null : setEditRow} onDelete={readOnly ? null : handleDelete} />
          </div>
        </div>
      ))}

      {editRow && (
        <EditProduksiModal row={editRow} master={master} machines={machines} onClose={() => setEditRow(null)} onSaved={load} />
      )}
    </div>
  );
}
