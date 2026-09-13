import { useState } from 'react';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useConfirm } from '../../contexts/ConfirmContext.jsx';
import { apiSend } from '../../api.js';
import { Field, th, td, iconBtn, editInp } from './shared.jsx';
import { Skeleton } from '../../components/Skeleton.jsx';

/* ── Tab: Shift (default Waktu Efektif per Shift, auto-isi di RC Harian) */
export default function ShiftHoursTab({ data, loading, onChanged, logout, readOnly = false }) {
  const showToast = useToast();
  const confirm = useConfirm();
  const [shift, setShift] = useState('');
  const [hours, setHours] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editHours, setEditHours] = useState('');

  async function add() {
    if (!shift.trim()) return;
    setBusy(true);
    try {
      await apiSend('/master-shift-hours', 'POST', { shift, default_hours: hours }, logout);
      setShift(''); setHours('');
      showToast('Shift berhasil ditambahkan', 'green');
      onChanged();
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }
  async function remove(id) {
    if (!(await confirm('Hapus Shift ini?'))) return;
    try {
      await apiSend('/master-shift-hours-delete', 'POST', { id }, logout);
      showToast('Shift berhasil dihapus', 'green');
      onChanged();
    } catch (e) { showToast(e.message, 'red'); }
  }
  function startEdit(s) { setEditingId(s.id); setEditHours(String(s.defaultHours ?? 0)); }
  async function saveEdit(id) {
    setBusy(true);
    try {
      await apiSend('/master-shift-hours-update', 'POST', { id, default_hours: editHours }, logout);
      setEditingId(null);
      showToast('Shift berhasil diperbarui', 'green');
      onChanged();
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }

  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Shift</div></div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 14 }}>
        Default Waktu Efektif (jam) per Shift -- otomatis mengisi field Waktu Efektif di RC Harian Produksi saat Shift dipilih, tapi tetap bisa diketik ulang manual di form.
      </div>
      {!readOnly && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end', marginBottom: 18, maxWidth: 460 }}>
          <Field label="Nama Shift">
            <input className="form-input" value={shift} onChange={(e) => setShift(e.target.value)} placeholder="mis. Shift Malam" />
          </Field>
          <Field label="Default Waktu Efektif (jam)">
            <input type="number" step="0.5" className="form-input" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="mis. 7.5" />
          </Field>
          <button className="btn primary" disabled={busy} onClick={add} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <Plus size={14} /> Simpan
          </button>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 460 }}>
        <thead>
          <tr>
            <th style={th}>Shift</th>
            <th style={th}>Default Waktu Efektif</th>
            <th style={{ ...th, width: 90 }}></th>
          </tr>
        </thead>
        <tbody>
          {loading && data.length === 0 ? (
            <tr><td colSpan={3} style={td}><Skeleton height={12} width="60%" /></td></tr>
          ) : data.length === 0 ? (
            <tr><td colSpan={3} style={td}>Belum ada data Shift.</td></tr>
          ) : data.map((s) => (
            editingId === s.id ? (
              <tr key={s.id}>
                <td style={td}>{s.shift}</td>
                <td style={td}><input type="number" step="0.5" className="form-input" style={editInp} value={editHours} onChange={(e) => setEditHours(e.target.value)} autoFocus /></td>
                <td style={td}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button disabled={busy} onClick={() => saveEdit(s.id)} style={iconBtn} title="Simpan"><Check size={13} /></button>
                    <button onClick={() => setEditingId(null)} style={iconBtn} title="Batal"><X size={13} /></button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={s.id}>
                <td style={td}>{s.shift}</td>
                <td style={td}>{s.defaultHours} jam</td>
                <td style={td}>
                  {!readOnly && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => startEdit(s)} style={iconBtn} title="Edit"><Pencil size={13} /></button>
                      <button onClick={() => remove(s.id)} style={{ ...iconBtn, color: 'var(--red)' }} title="Hapus"><Trash2 size={13} /></button>
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
