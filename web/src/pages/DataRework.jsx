import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, X, Pencil, Trash2 } from 'lucide-react';
import Combobox from '../components/Combobox.jsx';
import SortTh from '../components/SortTh.jsx';
import ZoomCell from '../components/ZoomCell.jsx';
import PeriodPicker from '../components/PeriodPicker.jsx';
import { useSort } from '../useSort.js';
import { useColumnWidths, weightsToPercent } from '../useColumnWidths.js';
import useHorizontalWheelScroll from '../useHorizontalWheelScroll.js';
import { formatDateID } from '../dateFmt.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { apiFetch, apiSend } from '../api.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useConfirm } from '../contexts/ConfirmContext.jsx';
import { isReadOnlyUser } from '../roles.js';
import { Skeleton } from '../components/Skeleton.jsx';

const CLUSTERS = ['AD', 'BC', 'EF', 'FI'];

function todayStr() { return new Date().toISOString().slice(0, 10); }

// Preview client-side dari No Lot Rework (server yang generate beneran,
// lihat generateNoLotRework di src/routes/api.js) -- format DDMMYYYY + "R"
// dari Tanggal Repair.
function previewNoLotRework(tanggalRepair) {
  if (!tanggalRepair) return '—';
  const d = new Date(tanggalRepair);
  if (isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}${mm}${d.getFullYear()}R`;
}

const inp = {
  background: 'var(--input-bg)', border: '1px solid var(--input-border)',
  borderRadius: 7, padding: '8px 10px', fontSize: 13, width: '100%',
  boxSizing: 'border-box', color: 'var(--text)', fontFamily: 'inherit',
};
const th = { textAlign: 'left', padding: '5px 6px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', border: '1px solid var(--border)', whiteSpace: 'nowrap' };
const td = { padding: '4px 6px', fontSize: 10.5, border: '1px solid var(--border)', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const iconBtn = { background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', color: 'var(--text)', padding: 4, display: 'inline-flex' };

const COLUMNS = [
  { key: 'tanggalDitemukan', label: 'Tgl Ditemukan', weight: 90 },
  { key: 'noLotOriginal', label: 'No Lot Original', weight: 110 },
  { key: 'tanggalRepair', label: 'Tgl Repair', weight: 90 },
  { key: 'noLotRework', label: 'No Lot Rework', weight: 110 },
  { key: 'partName', label: 'Nama Part', weight: 160 },
  { key: 'cluster', label: 'Cluster', weight: 70 },
  { key: 'grupHead', label: 'Grup Head', weight: 120 },
  { key: 'kriteriaRework', label: 'Kriteria Rework', weight: 130 },
  { key: 'metodeRework', label: 'Metode Rework', weight: 130 },
  { key: 'mesin', label: 'Mesin', weight: 100 },
  { key: 'picRework', label: 'PIC Rework', weight: 100 },
  { key: 'totalRework', label: 'Total Rework', weight: 90 },
  { key: 'totalOk', label: 'Total OK', weight: 80 },
  { key: 'totalReject', label: 'Total Reject', weight: 90 },
  { key: 'metodeCheck', label: 'Metode Check', weight: 120 },
  { key: 'tanggalCheck', label: 'Tgl Check', weight: 90 },
  { key: 'picCheck', label: 'PIC Check', weight: 100 },
];
const AKSI_PCT = 5;
const DEFAULT_WIDTHS = weightsToPercent(COLUMNS, AKSI_PCT);

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

function EditReworkModal({ row, master, onClose, onSaved }) {
  const { logout } = useAuth();
  const showToast = useToast();
  const [form, setForm] = useState({
    tanggalDitemukan: row.tanggalDitemukan, noLotOriginal: row.noLotOriginal || '',
    tanggalRepair: row.tanggalRepair, partName: row.partName,
    kriteriaRework: row.kriteriaRework || '', metodeRework: row.metodeRework || '',
    mesin: row.mesin || '', picRework: row.picRework || '', grupHead: row.grupHead || '',
    totalRework: row.totalRework, totalOk: row.totalOk, totalReject: row.totalReject,
    metodeCheck: row.metodeCheck || '', tanggalCheck: row.tanggalCheck || '', picCheck: row.picCheck || '',
  });
  const [busy, setBusy] = useState(false);
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  const partNameOptionsRich = useMemo(
    () => (master.partNames || []).map((p) => ({ value: p.partName, sub: `Cluster ${p.cluster}` })),
    [master.partNames],
  );
  const groupHeadOptionsRich = useMemo(
    () => (master.groupHeads || []).map((g) => ({ value: g.name, sub: `Cluster ${g.cluster}` })),
    [master.groupHeads],
  );
  const mesinOptionsRich = useMemo(() => {
    const byMesin = {};
    (master.proses || []).forEach((p) => {
      if (!p.mesin) return;
      if (!byMesin[p.mesin]) byMesin[p.mesin] = new Set();
      if (p.line) byMesin[p.mesin].add(p.line);
    });
    return Object.entries(byMesin).map(([mesin, lines]) => ({ value: mesin, sub: lines.size ? `Line ${[...lines].join(', ')}` : null }));
  }, [master.proses]);

  async function save() {
    setBusy(true);
    try {
      await apiSend('/part-rework-update', 'POST', {
        id: row.id,
        tanggal_ditemukan: form.tanggalDitemukan, no_lot_original: form.noLotOriginal,
        tanggal_repair: form.tanggalRepair, part_name: form.partName,
        kriteria_rework: form.kriteriaRework, metode_rework: form.metodeRework,
        mesin: form.mesin, pic_rework: form.picRework, grup_head: form.grupHead,
        total_rework: form.totalRework, total_ok: form.totalOk, total_reject: form.totalReject,
        metode_check: form.metodeCheck, tanggal_check: form.tanggalCheck || null, pic_check: form.picCheck,
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
          <div className="modal-title">Edit Rework — {row.partName}</div>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <EditField label="Tanggal Ditemukan"><input type="date" style={inp} value={form.tanggalDitemukan} onChange={(e) => set('tanggalDitemukan', e.target.value)} /></EditField>
          <EditField label="No Lot Original"><input type="text" style={inp} value={form.noLotOriginal} onChange={(e) => set('noLotOriginal', e.target.value)} /></EditField>
          <EditField label="Tanggal Repair"><input type="date" style={inp} value={form.tanggalRepair} onChange={(e) => set('tanggalRepair', e.target.value)} /></EditField>
          <EditField label="No Lot Rework" hint="otomatis"><input type="text" style={{ ...inp, opacity: .7 }} value={previewNoLotRework(form.tanggalRepair)} disabled /></EditField>

          <div style={{ gridColumn: '1 / -1' }}>
            <EditField label="Nama Part">
              <Combobox style={inp} value={form.partName} options={partNameOptionsRich} onChange={(v) => set('partName', v)} placeholder="Ketik atau pilih Part Name…" />
            </EditField>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <EditField label="Grup Head">
              <Combobox style={inp} value={form.grupHead} options={groupHeadOptionsRich} onChange={(v) => set('grupHead', v)} placeholder="Ketik atau pilih Grup Head…" />
            </EditField>
          </div>

          <EditField label="Kriteria Rework"><input type="text" style={inp} value={form.kriteriaRework} onChange={(e) => set('kriteriaRework', e.target.value)} /></EditField>
          <EditField label="Metode Rework"><input type="text" style={inp} value={form.metodeRework} onChange={(e) => set('metodeRework', e.target.value)} /></EditField>
          <EditField label="Mesin">
            <Combobox style={inp} value={form.mesin} options={mesinOptionsRich} onChange={(v) => set('mesin', v)} placeholder="Ketik atau pilih Mesin…" />
          </EditField>
          <EditField label="PIC Rework"><input type="text" style={inp} value={form.picRework} onChange={(e) => set('picRework', e.target.value)} /></EditField>

          <EditField label="Total Rework"><input type="number" style={inp} value={form.totalRework} onChange={(e) => set('totalRework', e.target.value)} /></EditField>
          <EditField label="Total OK"><input type="number" style={inp} value={form.totalOk} onChange={(e) => set('totalOk', e.target.value)} /></EditField>
          <EditField label="Total Reject"><input type="number" style={inp} value={form.totalReject} onChange={(e) => set('totalReject', e.target.value)} /></EditField>
          <div />

          <EditField label="Metode Check"><input type="text" style={inp} value={form.metodeCheck} onChange={(e) => set('metodeCheck', e.target.value)} /></EditField>
          <EditField label="Tanggal Check"><input type="date" style={inp} value={form.tanggalCheck} onChange={(e) => set('tanggalCheck', e.target.value)} /></EditField>
          <EditField label="PIC Check"><input type="text" style={inp} value={form.picCheck} onChange={(e) => set('picCheck', e.target.value)} /></EditField>
        </div>
        <div className="modal-footer">
          <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
          <button className="btn" onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>
  );
}

export default function DataRework() {
  const { logout, username } = useAuth();
  const readOnly = isReadOnlyUser(username);
  const showToast = useToast();
  const confirm = useConfirm();
  // Default "month" (bukan "today") -- Tanggal Ditemukan dan Tanggal
  // Repair pada satu baris Rework biasanya beda beberapa hari, jadi
  // filter "Harian" sering bikin baris yang baru saja diproses jadi
  // kelihatan "hilang" padahal cuma beda tanggal filter.
  const [period, setPeriod]   = useState('month');
  const [refDate, setRefDate] = useState(todayStr());
  const [clusterFilter, setClusterFilter] = useState('all');
  const [query, setQuery]     = useState('');
  const [rows, setRows]       = useState([]);
  const [master, setMaster]   = useState({ partNames: [], groupHeads: [], proses: [] });
  const [loading, setLoading] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`/part-rework-entries?period=${period}&date=${refDate}`, [], logout).then((data) => {
      setRows(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [period, refDate, logout]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiFetch('/master', { partNames: [], groupHeads: [], proses: [] }, logout).then(setMaster);
  }, [logout]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (clusterFilter !== 'all' && r.cluster !== clusterFilter) return false;
      if (!q) return true;
      return (r.partName || '').toLowerCase().includes(q) ||
        (r.grupHead || '').toLowerCase().includes(q) ||
        (r.cluster || '').toLowerCase().includes(q) ||
        (r.noLotRework || '').toLowerCase().includes(q) ||
        (r.noLotOriginal || '').toLowerCase().includes(q);
    });
  }, [rows, query, clusterFilter]);

  const defaultSorted = useMemo(
    () => [...filteredRows].sort((a, b) => (b.tanggalRepair || '').localeCompare(a.tanggalRepair || '')),
    [filteredRows],
  );
  const { sorted: shown, sortKey, sortDir, toggleSort } = useSort(defaultSorted);
  const scrollRef = useHorizontalWheelScroll();
  const { widths, startResize } = useColumnWidths(DEFAULT_WIDTHS, scrollRef);

  async function handleDelete(row) {
    if (!(await confirm(`Hapus data Rework ${row.partName} (${row.noLotRework})?`))) return;
    try {
      await apiSend('/part-rework-delete', 'POST', { id: row.id }, logout);
      showToast('Data berhasil dihapus', 'green');
      load();
    } catch (e) { showToast(e.message, 'red'); }
  }

  return (
    <div className="page-view active">
      <div className="page-header">
        <div>
          <div className="page-title">Data Rework</div>
        </div>
      </div>

      <div className="group-box" style={{ marginBottom: 16 }}>
        <span className="group-box-title">Apply Filters</span>
        <div className="dash-filter-bar" style={{ flexWrap: 'wrap' }}>
          <PeriodPicker pill period={period} setPeriod={setPeriod} refDate={refDate} setRefDate={setRefDate} />
          <select
            value={clusterFilter}
            onChange={(e) => setClusterFilter(e.target.value)}
            className="pp-select"
            style={{ height: 34 }}
          >
            <option value="all">Semua Cluster</option>
            {CLUSTERS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="text"
            placeholder="Cari Part Name / Grup Head / Cluster / No Lot…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="form-input"
            style={{ maxWidth: 320 }}
          />
          <button className="btn-icon" title="Refresh data" onClick={load}>
            <RefreshCw size={14} />
          </button>
          <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>
            {shown.length.toLocaleString()} baris
          </span>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div ref={scrollRef} style={{ overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1600, tableLayout: 'fixed', background: 'var(--s1)' }}>
            <colgroup>
              <col style={{ width: `${AKSI_PCT}%` }} />
              {COLUMNS.map((c) => <col key={c.key} style={{ width: `${widths[c.key]}%` }} />)}
            </colgroup>
            <thead>
              <tr>
                <th style={{ ...th, position: 'sticky', left: 0, zIndex: 1 }}>Aksi</th>
                {COLUMNS.map((c) => (
                  <SortTh key={c.key} sortKeyName={c.key} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th} onResizeStart={startResize(c.key)}>{c.label}</SortTh>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={18} style={td}><Skeleton height={12} width="60%" /></td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={18} style={td}>{rows.length === 0 ? 'Belum ada data.' : 'Tidak ada yang cocok.'}</td></tr>
              ) : shown.map((r) => (
                <tr key={r.id}>
                  <td style={{ ...td, position: 'sticky', left: 0, background: 'var(--s1)' }}>
                    {!readOnly && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => setEditRow(r)} title="Edit" style={iconBtn}><Pencil size={12} /></button>
                        <button onClick={() => handleDelete(r)} title="Hapus" style={{ ...iconBtn, color: 'var(--red)' }}><Trash2 size={12} /></button>
                      </div>
                    )}
                  </td>
                  <td style={td}>{formatDateID(r.tanggalDitemukan)}</td>
                  <td style={td}>{r.noLotOriginal || '—'}</td>
                  <td style={td}>{formatDateID(r.tanggalRepair)}</td>
                  <td style={td}>{r.noLotRework}</td>
                  <td style={td}><ZoomCell label="Nama Part">{r.partName}</ZoomCell></td>
                  <td style={td}>{r.cluster || '—'}</td>
                  <td style={td}><ZoomCell label="Grup Head">{r.grupHead || '—'}</ZoomCell></td>
                  <td style={td}>{r.kriteriaRework || '—'}</td>
                  <td style={td}><ZoomCell label="Metode Rework">{r.metodeRework || '—'}</ZoomCell></td>
                  <td style={td}>{r.mesin || '—'}</td>
                  <td style={td}>{r.picRework || '—'}</td>
                  <td style={td}>{r.totalRework}</td>
                  <td style={td}>{r.totalOk}</td>
                  <td style={td}>{r.totalReject}</td>
                  <td style={td}>{r.metodeCheck || '—'}</td>
                  <td style={td}>{r.tanggalCheck ? formatDateID(r.tanggalCheck) : '—'}</td>
                  <td style={td}>{r.picCheck || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editRow && (
        <EditReworkModal row={editRow} master={master} onClose={() => setEditRow(null)} onSaved={load} />
      )}
    </div>
  );
}
