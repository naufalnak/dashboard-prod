import { useState } from 'react';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useConfirm } from '../../contexts/ConfirmContext.jsx';
import { apiSend } from '../../api.js';
import { useSort } from '../../useSort.js';
import SortTh from '../../components/SortTh.jsx';
import { Field, MONTH_ID_FULL, th, td, iconBtn, editInp } from './shared.jsx';
import { Skeleton } from '../../components/Skeleton.jsx';

/* ── Tab: Target Overtime (target jam lembur per bulan, beda tiap bulan) */
const thisYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => thisYear - 2 + i);

export default function OvertimeTargetTab({ data, loading, onChanged, logout, readOnly = false }) {
  const showToast = useToast();
  const confirm = useConfirm();
  const [year, setYear] = useState(thisYear);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [targetHours, setTargetHours] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editHours, setEditHours] = useState('');

  const { sorted: shown, sortKey, sortDir, toggleSort } = useSort(data);

  async function add() {
    if (!year || !month) return;
    setBusy(true);
    try {
      await apiSend('/master-overtime-target', 'POST', { year, month, target_hours: targetHours }, logout);
      setTargetHours('');
      showToast('Target Overtime berhasil ditambahkan', 'green');
      onChanged();
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }
  async function remove(id) {
    if (!(await confirm('Hapus target Overtime bulan ini?'))) return;
    try {
      await apiSend('/master-overtime-target-delete', 'POST', { id }, logout);
      showToast('Target Overtime berhasil dihapus', 'green');
      onChanged();
    } catch (e) { showToast(e.message, 'red'); }
  }
  function startEdit(t) { setEditingId(t.id); setEditHours(String(t.targetHours ?? 0)); }
  async function saveEdit(id) {
    setBusy(true);
    try {
      await apiSend('/master-overtime-target-update', 'POST', { id, target_hours: editHours }, logout);
      setEditingId(null);
      showToast('Target Overtime berhasil diperbarui', 'green');
      onChanged();
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }

  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Target Overtime</div></div>
      {!readOnly && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '.6fr 1fr 1fr auto', gap: 12, alignItems: 'end', marginBottom: 18, maxWidth: 560 }}>
            <Field label="Tahun">
              <select className="form-input" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </Field>
            <Field label="Bulan">
              <select className="form-input" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTH_ID_FULL.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </Field>
            <Field label="Target (jam)">
              <input type="number" className="form-input" value={targetHours} onChange={(e) => setTargetHours(e.target.value)} placeholder="mis. 7000" />
            </Field>
            <button className="btn primary" disabled={busy} onClick={add} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              <Plus size={14} /> Simpan
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 14 }}>
            Simpan lagi dengan Tahun/Bulan yang sama untuk mengganti target bulan itu.
          </div>
        </>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 520 }}>
        <thead>
          <tr>
            <SortTh sortKeyName="year" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Tahun</SortTh>
            <SortTh sortKeyName="month" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Bulan</SortTh>
            <SortTh sortKeyName="targetHours" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Target (jam)</SortTh>
            <th style={{ ...th, width: 90 }}></th>
          </tr>
        </thead>
        <tbody>
          {loading && data.length === 0 ? (
            <tr><td colSpan={4} style={td}><Skeleton height={12} width="60%" /></td></tr>
          ) : shown.length === 0 ? (
            <tr><td colSpan={4} style={td}>Belum ada target Overtime.</td></tr>
          ) : shown.map((t) => (
            editingId === t.id ? (
              <tr key={t.id}>
                <td style={td}>{t.year}</td>
                <td style={td}>{MONTH_ID_FULL[t.month - 1]}</td>
                <td style={td}><input type="number" className="form-input" style={editInp} value={editHours} onChange={(e) => setEditHours(e.target.value)} autoFocus /></td>
                <td style={td}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button disabled={busy} onClick={() => saveEdit(t.id)} style={iconBtn} title="Simpan"><Check size={13} /></button>
                    <button onClick={() => setEditingId(null)} style={iconBtn} title="Batal"><X size={13} /></button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={t.id}>
                <td style={td}>{t.year}</td>
                <td style={td}>{MONTH_ID_FULL[t.month - 1]}</td>
                <td style={td}>{Number(t.targetHours || 0).toLocaleString('id-ID')} jam</td>
                <td style={td}>
                  {!readOnly && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => startEdit(t)} style={iconBtn} title="Edit"><Pencil size={13} /></button>
                      <button onClick={() => remove(t.id)} style={{ ...iconBtn, color: 'var(--red)' }} title="Hapus"><Trash2 size={13} /></button>
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
