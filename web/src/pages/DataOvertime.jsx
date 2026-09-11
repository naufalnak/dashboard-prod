import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, X, Pencil, Trash2 } from 'lucide-react';
import Combobox from '../components/ui/Combobox.jsx';
import SortTh from '../components/ui/SortTh.jsx';
import ZoomCell from '../components/ui/ZoomCell.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import EmptyErrorState from '../components/ui/EmptyErrorState.jsx';
import { TableRowsSkeleton } from '../components/ui/Skeleton.jsx';
import PeriodPicker from '../components/maintenance/PeriodPicker.jsx';
import { useSort } from '../hooks/useSort.js';
import { useColumnWidths, weightsToPercent } from '../hooks/useColumnWidths.js';
import useHorizontalWheelScroll from '../hooks/useHorizontalWheelScroll.js';
import { formatDateID } from '../dateFmt.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { fetchMaster } from '../services/masterService.js';
import { fetchOvertimeEntries, updateOvertimeEntry, deleteOvertimeEntry } from '../services/overtimeService.js';
import { usePaginatedList, PAGE_SIZE } from '../hooks/usePaginatedList.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useConfirm } from '../contexts/ConfirmContext.jsx';
import { isReadOnlyUser } from '../roles.js';

function todayStr() { return new Date().toISOString().slice(0, 10); }

const inp = {
  background: 'var(--input-bg)', border: '1px solid var(--input-border)',
  borderRadius: 7, padding: '8px 10px', fontSize: 13, width: '100%',
  boxSizing: 'border-box', color: 'var(--text)', fontFamily: 'inherit',
};
const th = { textAlign: 'left', padding: '5px 6px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', border: '1px solid var(--border)', whiteSpace: 'nowrap' };
const td = { padding: '4px 6px', fontSize: 10.5, border: '1px solid var(--border)', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const iconBtn = { background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', color: 'var(--text)', padding: 4, display: 'inline-flex' };

const COLUMNS = [
  { key: 'tanggal', label: 'Tanggal', weight: 90 },
  { key: 'waktu', label: 'Waktu', weight: 70 },
  { key: 'cluster', label: 'Cluster', weight: 70 },
  { key: 'manPower', label: 'Man Power', weight: 150 },
  { key: 'groupHead', label: 'Grup Head', weight: 150 },
  { key: 'durasiJam', label: 'Durasi (jam)', weight: 100 },
  { key: 'keterangan', label: 'Keterangan', weight: 220 },
];
const AKSI_PCT = 6;
const DEFAULT_WIDTHS = weightsToPercent(COLUMNS, AKSI_PCT);

function EditField({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

function EditOvertimeModal({ row, master, onClose, onSaved }) {
  const { logout } = useAuth();
  const showToast = useToast();
  const [form, setForm] = useState({
    tanggal: row.tanggal, waktu: row.waktu || '', manPower: row.manPower || '',
    durasiJam: row.durasiJam, keterangan: row.keterangan || '',
  });
  const [busy, setBusy] = useState(false);
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  const manPowerOptionsRich = useMemo(
    () => (master.manPower || []).map((m) => ({ value: m.name, sub: m.groupHead ? `Grup Head ${m.groupHead}` : null })),
    [master.manPower],
  );

  async function save() {
    setBusy(true);
    try {
      await updateOvertimeEntry({
        id: row.id,
        tanggal: form.tanggal, waktu: form.waktu, man_power: form.manPower,
        durasi_jam: form.durasiJam, keterangan: form.keterangan,
      }, logout);
      showToast('Data berhasil diperbarui', 'green');
      onSaved();
      onClose();
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }

  return (
    <div className="overlay show" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480, borderRadius: 14, margin: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Edit Overtime — {row.manPower}</div>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <EditField label="Tanggal"><input type="date" style={inp} value={form.tanggal} onChange={(e) => set('tanggal', e.target.value)} /></EditField>
          <EditField label="Waktu"><input type="time" style={inp} value={form.waktu} onChange={(e) => set('waktu', e.target.value)} /></EditField>
          <div style={{ gridColumn: '1 / -1' }}>
            <EditField label="Man Power">
              <Combobox style={inp} value={form.manPower} options={manPowerOptionsRich} onChange={(v) => set('manPower', v)} placeholder="Ketik atau pilih Man Power…" />
            </EditField>
          </div>
          <EditField label="Durasi Lembur (jam)"><input type="number" style={inp} value={form.durasiJam} onChange={(e) => set('durasiJam', e.target.value)} /></EditField>
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

export default function DataOvertime() {
  const { logout, username } = useAuth();
  const readOnly = isReadOnlyUser(username);
  const showToast = useToast();
  const confirm = useConfirm();
  const [period, setPeriod]   = useState('today');
  const [refDate, setRefDate] = useState(todayStr());
  const [query, setQuery]     = useState('');
  const [master, setMaster]   = useState({ manPower: [] });
  const [editRow, setEditRow] = useState(null);

  const {
    rows, page, setPage, totalPages, total, loading, error, reload: load,
  } = usePaginatedList(
    fetchOvertimeEntries,
    (p, pageSize) => `period=${period}&date=${refDate}&page=${p}&pageSize=${pageSize}`,
    [period, refDate],
  );

  useEffect(() => {
    fetchMaster({ manPower: [] }, logout).then(setMaster);
  }, [logout]);

  useEffect(() => { setPage(1); }, [period, refDate]);

  // Catatan: pencarian ini filter lokal, hanya menyaring baris di halaman
  // yang lagi tampil (lihat Pagination di bawah tabel) -- bukan pencarian
  // ke semua data.
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      (r.manPower || '').toLowerCase().includes(q) ||
      (r.groupHead || '').toLowerCase().includes(q) ||
      (r.cluster || '').toLowerCase().includes(q),
    );
  }, [rows, query]);

  const defaultSorted = useMemo(
    () => [...filteredRows].sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || '')),
    [filteredRows],
  );
  const { sorted: shown, sortKey, sortDir, toggleSort } = useSort(defaultSorted);
  const scrollRef = useHorizontalWheelScroll();
  const { widths, startResize } = useColumnWidths(DEFAULT_WIDTHS, scrollRef);

  async function handleDelete(row) {
    if (!(await confirm(`Hapus data Overtime ${row.manPower} (${row.tanggal})?`))) return;
    try {
      await deleteOvertimeEntry(row.id, logout);
      showToast('Data berhasil dihapus', 'green');
      load();
    } catch (e) { showToast(e.message, 'red'); }
  }

  return (
    <div className="page-view active">
      <div className="page-header">
        <div>
          <div className="page-title">Data Overtime</div>
        </div>
      </div>

      <div className="group-box" style={{ marginBottom: 16 }}>
        <span className="group-box-title">Apply Filters</span>
        <div className="dash-filter-bar" style={{ flexWrap: 'wrap' }}>
          <PeriodPicker pill period={period} setPeriod={setPeriod} refDate={refDate} setRefDate={setRefDate} />
          <input
            type="text"
            placeholder="Cari Man Power / Grup Head / Cluster…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="form-input"
            style={{ maxWidth: 300 }}
          />
          <button className="btn-icon" title="Refresh data" onClick={load}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div ref={scrollRef} style={{ overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 800, tableLayout: 'fixed', background: 'var(--s1)' }}>
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
                <TableRowsSkeleton rows={6} colSpan={8} />
              ) : shown.length === 0 ? (
                <EmptyErrorState as="row" colSpan={8} status={error ? 'error' : 'empty'} onRetry={load} emptyText={rows.length === 0 ? 'Belum ada data.' : 'Tidak ada yang cocok.'} />
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
                  <td style={td}>{formatDateID(r.tanggal)}</td>
                  <td style={td}>{r.waktu || '—'}</td>
                  <td style={td}>{r.cluster || '—'}</td>
                  <td style={td}><ZoomCell label="Man Power">{r.manPower || '—'}</ZoomCell></td>
                  <td style={td}><ZoomCell label="Grup Head">{r.groupHead || '—'}</ZoomCell></td>
                  <td style={td}>{r.durasiJam}</td>
                  <td style={td}><ZoomCell label="Keterangan">{r.keterangan || ''}</ZoomCell></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} disabled={loading} />
      </div>

      {editRow && (
        <EditOvertimeModal row={editRow} master={master} onClose={() => setEditRow(null)} onSaved={load} />
      )}
    </div>
  );
}