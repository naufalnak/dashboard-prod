import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, X } from 'lucide-react';
import RejectionTable from '../components/dashboard/RejectionTable.jsx';
import Combobox from '../components/ui/Combobox.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import PeriodPicker from '../components/maintenance/PeriodPicker.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { fetchMaster } from '../services/masterService.js';
import { fetchRejectionEntries, updateRejectionEntry, deleteRejectionEntry } from '../services/rejectionService.js';
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
      await updateRejectionEntry({
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
  const [query, setQuery]     = useState('');
  const [master, setMaster]   = useState({ partNames: [], kriteriaNg: [] });
  const [editRow, setEditRow] = useState(null);

  const {
    rows, page, setPage, totalPages, total, loading, error, reload: load,
  } = usePaginatedList(
    fetchRejectionEntries,
    (p, pageSize) => `period=${period}&date=${refDate}&page=${p}&pageSize=${pageSize}`,
    [period, refDate],
  );

  useEffect(() => {
    fetchMaster({ partNames: [], kriteriaNg: [] }, logout).then(setMaster);
  }, [logout]);

  // Filter/periode ganti -> balik ke halaman 1, biar tidak nyangkut di
  // halaman yang mungkin sudah tidak ada isinya untuk filter yang baru.
  useEffect(() => { setPage(1); }, [period, refDate]);

  // Catatan: pencarian ini filter lokal, jadi hanya menyaring baris di
  // halaman yang lagi tampil (lihat Pagination di bawah tabel) -- bukan
  // pencarian ke semua data. Kalau butuh cari lintas halaman, ganti
  // periode/tanggal supaya rentang datanya lebih sempit dulu.
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.partName.toLowerCase().includes(q) ||
      (r.cluster || '').toLowerCase().includes(q) ||
      (r.kriteriaNg || '').toLowerCase().includes(q),
    );
  }, [rows, query]);

  async function handleDelete(row) {
    if (!(await confirm(`Hapus data Rejection ${row.partName} (${row.tanggal})?`))) return;
    try {
      await deleteRejectionEntry(row.id, logout);
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
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <RejectionTable rows={filteredRows} loading={loading} error={error} onRetry={load} onEdit={readOnly ? null : setEditRow} onDelete={readOnly ? null : handleDelete} />
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} disabled={loading} />

      {editRow && (
        <EditRejectionModal row={editRow} master={master} onClose={() => setEditRow(null)} onSaved={load} />
      )}
    </div>
  );
}