import { useState, useMemo } from 'react';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useConfirm } from '../../contexts/ConfirmContext.jsx';
import { apiSend } from '../../api.js';
import { useSort } from '../../useSort.js';
import SortTh from '../../components/SortTh.jsx';
import { Field, SearchBox, matches, th, td, iconBtn, editInp } from './shared.jsx';
import { Skeleton } from '../../components/Skeleton.jsx';

/* ── Tab: Kriteria NG (daftar jenis cacat, dipilih saat Input Rejection) */
export default function KriteriaNgTab({ data, loading, onChanged, logout, readOnly = false }) {
  const showToast = useToast();
  const confirm = useConfirm();
  const [nama, setNama] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editNama, setEditNama] = useState('');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => data.filter((k) => matches(query, k.nama)), [data, query]);
  const { sorted: shown, sortKey, sortDir, toggleSort } = useSort(filtered);

  async function add() {
    if (!nama.trim()) return;
    setBusy(true);
    try {
      await apiSend('/master-kriteria-ng', 'POST', { nama }, logout);
      setNama('');
      showToast('Kriteria NG berhasil ditambahkan', 'green');
      onChanged();
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }
  async function remove(id) {
    if (!(await confirm('Hapus Kriteria NG ini?'))) return;
    try {
      await apiSend('/master-kriteria-ng-delete', 'POST', { id }, logout);
      showToast('Kriteria NG berhasil dihapus', 'green');
      onChanged();
    } catch (e) { showToast(e.message, 'red'); }
  }
  function startEdit(k) { setEditingId(k.id); setEditNama(k.nama); }
  async function saveEdit(id) {
    if (!editNama.trim()) return;
    setBusy(true);
    try {
      await apiSend('/master-kriteria-ng-update', 'POST', { id, nama: editNama }, logout);
      setEditingId(null);
      showToast('Kriteria NG berhasil diperbarui', 'green');
      onChanged();
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }

  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Kriteria NG</div></div>
      {!readOnly && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'end', marginBottom: 18, maxWidth: 460 }}>
          <Field label="Nama Kriteria NG">
            <input className="form-input" value={nama} onChange={(e) => setNama(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()} />
          </Field>
          <button className="btn primary" disabled={busy} onClick={add} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <Plus size={14} /> Tambah
          </button>
        </div>
      )}

      <SearchBox value={query} onChange={setQuery} placeholder="Cari Kriteria NG…" />

      <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 520 }}>
        <thead>
          <tr>
            <SortTh sortKeyName="nama" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Nama Kriteria NG</SortTh>
            <th style={{ ...th, width: 90 }}></th>
          </tr>
        </thead>
        <tbody>
          {loading && data.length === 0 ? (
            <tr><td colSpan={2} style={td}><Skeleton height={12} width="60%" /></td></tr>
          ) : shown.length === 0 ? (
            <tr><td colSpan={2} style={td}>{data.length === 0 ? 'Belum ada data.' : 'Tidak ada yang cocok.'}</td></tr>
          ) : shown.map((k) => (
            editingId === k.id ? (
              <tr key={k.id}>
                <td style={td}><input className="form-input" style={editInp} value={editNama} onChange={(e) => setEditNama(e.target.value)} autoFocus /></td>
                <td style={td}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button disabled={busy} onClick={() => saveEdit(k.id)} style={iconBtn} title="Simpan"><Check size={13} /></button>
                    <button onClick={() => setEditingId(null)} style={iconBtn} title="Batal"><X size={13} /></button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={k.id}>
                <td style={td}>{k.nama}</td>
                <td style={td}>
                  {!readOnly && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => startEdit(k)} style={iconBtn} title="Edit"><Pencil size={13} /></button>
                      <button onClick={() => remove(k.id)} style={{ ...iconBtn, color: 'var(--red)' }} title="Hapus"><Trash2 size={13} /></button>
                    </div>
                  )}
                </td>
              </tr>
            )
          ))}
        </tbody>
      </table>
    </div>
  );
}
