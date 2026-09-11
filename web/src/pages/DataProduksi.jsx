import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, X, ArrowUpRight, Download } from 'lucide-react';
import ProduksiTable from '../components/dashboard/ProduksiTable.jsx';
import LineTrendChart from '../components/charts/LineTrendChart.jsx';
import PeriodPicker from '../components/maintenance/PeriodPicker.jsx';
import Combobox from '../components/ui/Combobox.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import { CLUSTER_COLORS } from '../components/charts/ClusterBarList.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useUI } from '../contexts/UIContext.jsx';
import { fetchMaster, fetchMachines } from '../services/masterService.js';
import { fetchProduksiHarian, updateProduksiHarian, deleteProduksiHarian, fetchArTrendByCluster } from '../services/produksiService.js';
import { usePaginatedList, PAGE_SIZE } from '../hooks/usePaginatedList.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useConfirm } from '../contexts/ConfirmContext.jsx';
import { isReadOnlyUser } from '../roles.js';
import { downloadXlsx } from '../exportXlsx.js';
import { formatDateID } from '../dateFmt.js';
const CLUSTERS = ['AD', 'BC', 'EF', 'FI'];
const JENIS_PROBLEM_OPTS = ['Machine', 'Material', 'Method', 'Man', 'Environment', 'Setting & Tool'];

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
  const [additionalMesin, setAdditionalMesin] = useState([]);
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

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

  const prosesOptions = useMemo(
    () => master.proses.filter((p) => p.partName === form.partName)
      .map((p) => p.proses).sort((a, b) => a.localeCompare(b)),
    [master.proses, form.partName],
  );

  const prosesMatch = useMemo(
    () => master.proses.find((p) => p.proses === form.proses && p.partName === form.partName),
    [master.proses, form.proses, form.partName],
  );
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
  // Mesin TIDAK lagi wajib cocok Tabel Machine buat bisa disimpan (lihat
  // /produksi-harian-update) -- tapi tetap ditandai kalau nilainya belum
  // ada di katalog, supaya kelihatan mana yang masih perlu dikoreksi
  // manual ke Machine yang benar (sama semangat dengan MesinMismatchPanel
  // di Master Data, cuma dicek langsung di sini tanpa endpoint terpisah).
  const mesinLinked = useMemo(
    () => !form.mesin.trim() || (machines || []).some((m) => m.machine.toLowerCase() === form.mesin.trim().toLowerCase()),
    [machines, form.mesin],
  );
  const lineOptions = useMemo(
    () => [...new Set(master.proses.map((p) => p.line).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [master.proses],
  );
  // Kandidat Mesin buat "+ Tambah Mesin" -- Mesin lain yang tercatat di
  // Master Data buat Part Name+Proses baris ini (selain Mesin baris ini
  // sendiri) -- dipakai kalau baris lama ternyata seharusnya mencakup
  // beberapa Mesin sekaligus, tapi cuma sempat tercatat 1. Baris baru
  // hasil "+ Tambah Mesin" jadi bagian batch yang sama dengan baris ini
  // (lihat additional_mesin di updateProduksiHarian/produksi.service.js).
  const additionalMesinCandidates = useMemo(
    () => [...new Set(master.proses
      .filter((p) => p.partName === form.partName && p.proses === form.proses && p.mesin)
      .map((p) => p.mesin))]
      .filter((m) => m.toLowerCase() !== form.mesin.trim().toLowerCase())
      .sort((a, b) => a.localeCompare(b)),
    [master.proses, form.partName, form.proses, form.mesin],
  );
  function toggleAdditionalMesin(m) {
    setAdditionalMesin((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  }

  function pickPartName(partName) {
    setForm((f) => ({ ...f, partName, proses: '', line: '', mesin: '' }));
  }
  function pickProses(prosesName) {
    const match = master.proses.find((p) => p.proses === prosesName && p.partName === form.partName);
    // Kalau Mesin baris Master Data ini kebetulan sudah cocok Tabel
    // Machine, langsung terpilih; kalau belum (data lama belum
    // dikoreksi), dikosongkan supaya admin pilih manual yang benar --
    // tidak menebak sendiri. Line ikut nilai tersimpan di baris Proses
    // Master Data itu sendiri (bukan dari Machine). Cluster ikut baris
    // Proses ini juga (lihat catatan di partNameOptions).
    const machineMatch = match?.mesin ? (machines || []).find((m) => m.machine.toLowerCase() === match.mesin.toLowerCase()) : null;
    setForm((f) => ({ ...f, proses: prosesName, mesin: machineMatch?.machine || '', line: match?.line || '', cluster: match?.cluster || f.cluster }));
  }
  function pickMesin(machineName) {
    setForm((f) => ({ ...f, mesin: machineName }));
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
    setBusy(true);
    try {
      await updateProduksiHarian({
        id: row.id,
        tanggal: form.tanggal, shift: form.shift, no_lot: form.noLot,
        cluster: form.cluster,
        part_name: form.partName, proses: form.proses, line: form.line, mesin: form.mesin,
        man_power: form.manPower,
        cycle_time: cycleTime, waktu_efektif: form.waktuEfektif,
        plan, ok1: form.totalOk, ok2: 0, rwk: form.rework, rjct: form.reject,
        breakdown_mesin: form.breakdownMesin, jenis_problem: form.jenisProblem, lost_time: form.lostTime, keterangan: form.keterangan,
        additional_mesin: additionalMesin.length > 0 ? additionalMesin : undefined,
      }, logout);
      showToast('Data berhasil diperbarui', 'green');
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
          <EditField label="Mesin" hint="sebisa mungkin dari Tabel Machine, ketik utk cari">
            <Combobox style={inp} value={form.mesin} options={machinesRich} onChange={pickMesin} placeholder="Ketik atau pilih Mesin…" />
            {!mesinLinked && (
              <div style={{ color: 'var(--yellow)', fontSize: 11, marginTop: 4 }}>
                Belum terhubung ke Tabel Machine — Line tidak ikut otomatis, boleh disimpan tetap.
              </div>
            )}
          </EditField>
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
          <EditField label="Breakdown Mesin (menit)"><input type="number" style={inp} value={form.breakdownMesin} onChange={(e) => set('breakdownMesin', e.target.value)} /></EditField>
          <EditField label="Lost Time (menit)"><input type="number" style={inp} value={form.lostTime} onChange={(e) => set('lostTime', e.target.value)} /></EditField>
          <EditField label="Jenis Problem" hint="wajib kalau ada Breakdown Mesin/Lost Time">
            <Combobox style={inp} value={form.jenisProblem} options={JENIS_PROBLEM_OPTS} onChange={(v) => set('jenisProblem', v)} placeholder="Ketik atau pilih…" />
          </EditField>
          <div style={{ gridColumn: '1 / -1' }}>
            <EditField label="Keterangan"><textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={form.keterangan} onChange={(e) => set('keterangan', e.target.value)} /></EditField>
          </div>
          {additionalMesinCandidates.length > 0 && (
            <div style={{ gridColumn: '1 / -1' }}>
              <EditField
                label="+ Tambah Mesin"
                hint="baris baru per Mesin yang dicentang, downtime tidak ikut disalin -- dipakai kalau baris ini seharusnya mencakup beberapa Mesin sekaligus"
              >
                <div style={{ ...inp, height: 'auto', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 130, overflowY: 'auto', padding: '8px 10px' }}>
                  {additionalMesinCandidates.map((m) => (
                    <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                      <input type="checkbox" checked={additionalMesin.includes(m)} onChange={() => toggleAdditionalMesin(m)} />
                      {m}
                    </label>
                  ))}
                </div>
              </EditField>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
          <button className="btn" onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>
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
  const [trends, setTrends]   = useState({});
  const [master, setMaster]   = useState({ manPower: [], proses: [], partNames: [], shiftHours: [] });
  const [machines, setMachines] = useState([]);
  const [editRow, setEditRow] = useState(null);

  const {
    rows, page, setPage, totalPages, total, loading, error, reload: load,
  } = usePaginatedList(
    fetchProduksiHarian,
    (p, pageSize) => `period=${period}&date=${refDate}&page=${p}&pageSize=${pageSize}`,
    [period, refDate],
  );

  useEffect(() => {
    // Satu request buat semua Cluster sekaligus (dulu 4 request paralel
    // /ar-trend, satu per Cluster) -- lihat catatan di endpoint
    // /ar-trend-by-cluster. Tidak bergantung ke `page` (beda dari daftar
    // baris di atas), jadi dipisah ke effect sendiri supaya tidak ikut
    // refetch tiap kali cuma pindah halaman.
    const trendQs = `period=${period}&date=${refDate}`;
    fetchArTrendByCluster(trendQs, {}, logout).then((map) => {
      setTrends(map || {});
    });
  }, [period, refDate, logout]);

  useEffect(() => {
    fetchMaster({ manPower: [], proses: [], partNames: [], shiftHours: [] }, logout).then(setMaster);
    fetchMachines(logout).then(setMachines);
  }, [logout]);

  useEffect(() => { setPage(1); }, [period, refDate]);

  // Catatan: pencarian & filter Cluster/Shift ini semuanya filter lokal,
  // hanya menyaring baris di halaman yang lagi tampil (lihat Pagination
  // di bawah) -- bukan pencarian ke semua data. Ini juga berarti link
  // "Ke Data Produksi" dari Master Data (yang set period='all' + query)
  // cuma menemukan barisnya kalau kebetulan ada di halaman pertama;
  // untuk baris lama yang mungkin ada di halaman berikutnya, user perlu
  // menyempitkan periode dulu atau geser halaman manual.
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

  async function handleDelete(rowOrGroup) {
    // "Hapus Semua" dari GroupActionsMenu (batch >1 Mesin) kirim array
    // baris, bukan satu baris -- lihat ProduksiTable.jsx.
    const group = Array.isArray(rowOrGroup) ? rowOrGroup : [rowOrGroup];
    const label = group.length > 1
      ? `Hapus ${group.length} baris (${group[0].partName}, ${group.map((r) => r.mesin).join(', ')})?`
      : `Hapus data ${group[0].partName} (${group[0].tanggal})?`;
    if (!(await confirm(label))) return;
    try {
      for (const r of group) await deleteProduksiHarian(r.id, logout);
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
        </div>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} disabled={loading} />

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
            <ProduksiTable rows={byCluster[cluster] || []} loading={loading} error={error} onRetry={load} onEdit={readOnly ? null : setEditRow} onDelete={readOnly ? null : handleDelete} />
          </div>
        </div>
      ))}

      {editRow && (
        <EditProduksiModal row={editRow} master={master} machines={machines} onClose={() => setEditRow(null)} onSaved={load} />
      )}
    </div>
  );
}