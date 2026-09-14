import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, X, Download } from 'lucide-react';
import RejectionTable from '../components/RejectionTable.jsx';
import Combobox from '../components/Combobox.jsx';
import PeriodPicker from '../components/PeriodPicker.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { apiFetch, apiSend } from '../api.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useConfirm } from '../contexts/ConfirmContext.jsx';
import { isReadOnlyUser } from '../roles.js';
import { downloadXlsx } from '../exportXlsx.js';
import { formatDateID } from '../dateFmt.js';

const CLUSTERS = ['AD', 'BC', 'EF', 'FI'];

function todayStr() { return new Date().toISOString().slice(0, 10); }

const inp = {
  background: 'var(--input-bg)', border: '1px solid var(--input-border)',
  borderRadius: 7, padding: '8px 10px', fontSize: 13, width: '100%',
  boxSizing: 'border-box', color: 'var(--text)', fontFamily: 'inherit',
};

function EditField({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

function EditRejectionModal({ row, master, onClose, onSaved }) {
  const { logout } = useAuth();
  const showToast = useToast();
  const [form, setForm] = useState({
    tanggal: row.tanggal, waktu: row.waktu || '', partName: row.partName,
    totalOk: row.totalOk, totalLmr: row.totalLmr,
    kriteriaNg: row.kriteriaNg || '', keterangan: row.keterangan || '',
  });
  const [busy, setBusy] = useState(false);
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  const partNameOptionsRich = useMemo(
    () => (master.partNames || []).map((p) => ({ value: p.partName, sub: `Cluster ${p.cluster}` })),
    [master.partNames],
  );
  const kriteriaNgOptions = useMemo(() => (master.kriteriaNg || []).map((k) => k.nama), [master.kriteriaNg]);

  async function save() {
    setBusy(true);
    try {
      await apiSend('/rejection-entry-update', 'POST', {
        id: row.id,
        tanggal: form.tanggal, waktu: form.waktu, part_name: form.partName,
        total_lmr: form.totalLmr,
        kriteria_ng: form.kriteriaNg, keterangan: form.keterangan,
      }, logout);
      showToast('Data berhasil diperbarui', 'green');
      onSaved();
      onClose();
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }

  return (
    <div className="overlay show" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520, borderRadius: 14, margin: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Edit Rejection — {row.partName}</div>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <EditField label="Tanggal"><input type="date" style={inp} value={form.tanggal} onChange={(e) => set('tanggal', e.target.value)} /></EditField>
          <EditField label="Waktu"><input type="time" style={inp} value={form.waktu} onChange={(e) => set('waktu', e.target.value)} /></EditField>
          <div style={{ gridColumn: '1 / -1' }}>
            <EditField label="Part Name">
              <Combobox style={inp} value={form.partName} options={partNameOptionsRich} onChange={(v) => set('partName', v)} placeholder="Ketik atau pilih Part Name…" />
            </EditField>
          </div>
          <div>
            <EditField label="Total OK (pcs)">
              <div style={{ ...inp, background: 'var(--s2)', color: 'var(--muted)' }}>{form.totalOk.toLocaleString()}</div>
            </EditField>
            <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 4 }}>Otomatis dari RC Harian Produksi (Proses Akhir), ikut Tanggal & Part Name.</div>
          </div>
          <EditField label="Total LMR (pcs)"><input type="number" style={inp} value={form.totalLmr} onChange={(e) => set('totalLmr', e.target.value)} /></EditField>
          <div style={{ gridColumn: '1 / -1' }}>
            <EditField label="Kriteria NG">
              <Combobox style={inp} value={form.kriteriaNg} options={kriteriaNgOptions} onChange={(v) => set('kriteriaNg', v)} placeholder="Ketik atau pilih Kriteria NG…" />
            </EditField>
          </div>
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

export default function DataRejection() {
  const { logout, username } = useAuth();
  const readOnly = isReadOnlyUser(username);
  const showToast = useToast();
  const confirm = useConfirm();
  const [period, setPeriod]   = useState('today');
  const [refDate, setRefDate] = useState(todayStr());
  const [clusterFilter, setClusterFilter] = useState('all');
  const [query, setQuery]     = useState('');
  const [rows, setRows]       = useState([]);
  const [master, setMaster]   = useState({ partNames: [], kriteriaNg: [] });
  const [loading, setLoading] = useState(false);
  const [editRow, setEditRow] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`/rejection-entries?period=${period}&date=${refDate}`, [], logout).then((data) => {
      setRows(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [period, refDate, logout]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiFetch('/master', { partNames: [], kriteriaNg: [] }, logout).then(setMaster);
  }, [logout]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (clusterFilter !== 'all' && r.cluster !== clusterFilter) return false;
      if (!q) return true;
      return r.partName.toLowerCase().includes(q) ||
        (r.cluster || '').toLowerCase().includes(q) ||
        (r.kriteriaNg || '').toLowerCase().includes(q);
    });
  }, [rows, query, clusterFilter]);

  // Download Excel (.xlsx asli lewat library xlsx/SheetJS) -- isinya data
  // yang lagi kefilter di layar (Periode/Cluster/pencarian), sama pola
  // dengan tombol Download Excel di Data Produksi.
  function handleExport() {
    const columns = [
      { key: 'tanggal', label: 'Tanggal' },
      { key: 'waktu', label: 'Waktu' },
      { key: 'cluster', label: 'Cluster' },
      { key: 'partName', label: 'Part Name' },
      { key: 'totalOk', label: 'Total OK' },
      { key: 'totalLmr', label: 'Total LMR' },
      { key: 'totalProses', label: 'Total Proses' },
      { key: 'rejectRatio', label: 'Reject Ratio (%)' },
      { key: 'kriteriaNg', label: 'Kriteria NG' },
      { key: 'keterangan', label: 'Keterangan' },
    ];
    const exportRows = filteredRows.map((r) => ({ ...r, tanggal: formatDateID(r.tanggal) }));
    downloadXlsx(`data-rejection_${refDate}.xlsx`, 'Data Rejection', columns, exportRows);
  }

  async function handleDelete(row) {
    if (!(await confirm(`Hapus data Rejection ${row.partName} (${row.tanggal})?`))) return;
    try {
      await apiSend('/rejection-entry-delete', 'POST', { id: row.id }, logout);
      showToast('Data berhasil dihapus', 'green');
      load();
    } catch (e) { showToast(e.message, 'red'); }
  }

  return (
    <div className="page-view active">
      <div className="page-header">
        <div>
          <div className="page-title">Data Rejection</div>
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
            placeholder="Cari Part Name / Cluster / Kriteria NG…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="form-input"
            style={{ maxWidth: 300 }}
          />
          <button className="btn-icon" title="Refresh data" onClick={load}>
            <RefreshCw size={14} />
          </button>
          <button className="btn" onClick={handleExport} disabled={filteredRows.length === 0} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} /> Download Excel
          </button>
          <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>
            {filteredRows.length.toLocaleString()} baris
          </span>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <RejectionTable rows={filteredRows} loading={loading} onEdit={readOnly ? null : setEditRow} onDelete={readOnly ? null : handleDelete} />
      </div>

      {editRow && (
        <EditRejectionModal row={editRow} master={master} onClose={() => setEditRow(null)} onSaved={load} />
      )}
    </div>
  );
}
