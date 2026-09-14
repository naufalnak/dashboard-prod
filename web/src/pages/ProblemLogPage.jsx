import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Plus, Trash2, Pencil, X, MoreVertical } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { apiFetch, apiSend } from '../api.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useConfirm } from '../contexts/ConfirmContext.jsx';
import { isPrivilegedUser } from '../roles.js';
import SortTh from '../components/SortTh.jsx';
import Combobox from '../components/Combobox.jsx';
import PeriodPicker from '../components/PeriodPicker.jsx';
import useHorizontalWheelScroll from '../useHorizontalWheelScroll.js';
import { useSort } from '../useSort.js';
import { formatDateID } from '../dateFmt.js';
import { Skeleton } from '../components/Skeleton.jsx';

const STATUS_LABEL = { open: 'Open', in_progress: 'On Progress', closed: 'Closed' };
const STATUS_COLOR = { open: 'var(--red)', in_progress: '#e0a30c', closed: 'var(--green)' };
const STATUS_OPTS = ['open', 'in_progress', 'closed'];
const JENIS_PROBLEM_OPTS = ['Machine', 'Material', 'Method', 'Man', 'Setting & Tool'];

const EMPTY = { tanggal: '', line: '', partName: '', problem: '', jenisProblem: '', rootCause: '', temporaryAction: '', permanentAction: '', dueDate: '', status: 'open' };

function todayStr() { return new Date().toISOString().slice(0, 10); }

function isOverdue(row) {
  if (!row.dueDate || row.status === 'closed') return false;
  return new Date(row.dueDate) < new Date(new Date().toDateString());
}

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

// Modal edit satu baris Problem & Root Cause secara penuh -- mencakup
// Tanggal, Line, Part Name, Problem, Jenis Problem, Root Cause,
// Temporary/Permanent Action, Due Date, dan Notes sekaligus dalam satu
// tempat (bukan cuma Notes lewat pensil kecil seperti sebelumnya).
function EditProblemModal({ row, onClose, onSaved }) {
  const { logout } = useAuth();
  const showToast = useToast();
  const [form, setForm] = useState({
    tanggal: row.tanggal ? row.tanggal.slice(0, 10) : '',
    line: row.line || '', partName: row.partName || '',
    problem: row.problem || '', jenisProblem: row.jenisProblem || '', rootCause: row.rootCause || '',
    temporaryAction: row.temporaryAction || '', permanentAction: row.permanentAction || '',
    dueDate: row.dueDate ? row.dueDate.slice(0, 10) : '',
    notes: row.notes || '',
    lossTime: row.lostTime ?? 0,
  });
  const [busy, setBusy] = useState(false);
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.problem.trim()) return;
    setBusy(true);
    try {
      await apiSend('/problem-log-update', 'POST', {
        id: row.id,
        tanggal: form.tanggal || null,
        line: form.line, part_name: form.partName,
        problem: form.problem, jenis_problem: form.jenisProblem, root_cause: form.rootCause,
        temporary_action: form.temporaryAction, permanent_action: form.permanentAction,
        due_date: form.dueDate || null,
        notes: form.notes,
        lost_time: form.lossTime,
      }, logout);
      showToast('Problem berhasil diperbarui', 'green');
      onSaved();
      onClose();
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }

  return (
    <div className="overlay show" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560, borderRadius: 14, margin: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Edit Problem</div>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <EditField label="Tanggal"><input type="date" style={inp} value={form.tanggal} onChange={(e) => set('tanggal', e.target.value)} /></EditField>
          <EditField label="Due Date"><input type="date" style={inp} value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} /></EditField>
          <EditField label="Line Produksi"><input style={inp} value={form.line} onChange={(e) => set('line', e.target.value)} /></EditField>
          <EditField label="Part Name"><input style={inp} value={form.partName} onChange={(e) => set('partName', e.target.value)} /></EditField>
          <div style={{ gridColumn: '1 / -1' }}>
            <EditField label="Problem *"><input style={inp} value={form.problem} onChange={(e) => set('problem', e.target.value)} /></EditField>
          </div>
          <EditField label="Jenis Problem"><Combobox style={inp} value={form.jenisProblem} options={JENIS_PROBLEM_OPTS} onChange={(v) => set('jenisProblem', v)} placeholder="Ketik atau pilih…" /></EditField>
          <EditField label="Loss Time (menit)">
            <input type="number" style={inp} value={form.lossTime} onChange={(e) => set('lossTime', e.target.value)} />
          </EditField>
          <div style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--muted)', marginTop: -6 }}>
            Loss Time di sini ikut mengubah baris RC Harian Produksi terkait (kalau baris ini otomatis tersinkron dari sana).
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <EditField label="Root Cause"><input style={inp} value={form.rootCause} onChange={(e) => set('rootCause', e.target.value)} /></EditField>
          </div>
          <EditField label="Temporary Action"><input style={inp} value={form.temporaryAction} onChange={(e) => set('temporaryAction', e.target.value)} /></EditField>
          <EditField label="Permanent Action"><input style={inp} value={form.permanentAction} onChange={(e) => set('permanentAction', e.target.value)} /></EditField>
          <div style={{ gridColumn: '1 / -1' }}>
            <EditField label="Notes"><textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></EditField>
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

function DetailRow({ label, value }) {
  return (
    <div style={{ marginBottom: 14, minWidth: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{value || '—'}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const color = STATUS_COLOR[status] || 'var(--muted)';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 99,
      fontSize: 12, fontWeight: 700, color, background: 'var(--s2)', border: `1px solid ${color}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {STATUS_LABEL[status] || status}
    </span>
  );
}

// Judul kecil pembatas antar kelompok field -- supaya pembaca bisa
// langsung memindai bagian mana yang dia cari (Info Dasar / Downtime /
// Tindak Lanjut), bukan satu blok panjang tanpa struktur.
function DetailSection({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
        {title}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        {children}
      </div>
    </div>
  );
}

// Rangkuman detail satu baris Problem, tampilan penuh tanpa terpotong --
// dibuka dengan klik baris di tabel (yang sekarang cuma menampilkan
// kolom ringkas supaya muat 100% lebar layar tanpa scroll horizontal).
// Dikelompokkan per bagian (Info Dasar/Downtime/Tindak Lanjut) supaya
// lebih mudah dipindai dibanding satu grid panjang tanpa pembatas.
function DetailProblemModal({ row, onClose }) {
  const totalLossTime = row.totalLossTime ?? (row.lostTime || 0) + (row.breakdownMesin || 0);
  return (
    <div className="overlay show" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560, borderRadius: 14, margin: 'auto', maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Detail Problem</div>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <StatusBadge status={row.status} />
          {row.status === 'closed' && row.closedAt && (
            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Ditutup {new Date(row.closedAt).toLocaleString('id-ID')}</span>
          )}
        </div>

        <DetailSection title="Info Dasar">
          <DetailRow label="Tanggal" value={formatDateID(row.tanggal)} />
          <DetailRow label="Line Produksi" value={row.line} />
          <DetailRow label="Part Name" value={row.partName} />
          <DetailRow label="Jenis Problem" value={row.jenisProblem} />
          <div style={{ gridColumn: '1 / -1' }}><DetailRow label="Problem" value={row.problem} /></div>
        </DetailSection>

        <DetailSection title="Downtime & Due Date">
          <DetailRow label="Due Date" value={formatDateID(row.dueDate)} />
          <DetailRow
            label="Total Loss Time"
            value={totalLossTime > 0 ? `${totalLossTime} menit (Loss Time ${row.lostTime || 0} + Breakdown Mesin ${row.breakdownMesin || 0})` : null}
          />
        </DetailSection>

        <DetailSection title="Root Cause & Tindak Lanjut">
          <div style={{ gridColumn: '1 / -1' }}><DetailRow label="Root Cause" value={row.rootCause} /></div>
          <DetailRow label="Temporary Action" value={row.temporaryAction} />
          <DetailRow label="Permanent Action" value={row.permanentAction} />
          <div style={{ gridColumn: '1 / -1' }}><DetailRow label="Notes" value={row.notes} /></div>
        </DetailSection>

        <div className="modal-footer">
          <button className="btn" onClick={onClose} style={{ width: '100%' }}>Tutup</button>
        </div>
      </div>
    </div>
  );
}

// Menu titik-tiga per baris (Edit Problem / Hapus) -- gantikan dua tombol
// ikon terpisah yang sebelumnya makan tempat di kolom Aksi, supaya kolom
// baru (Due Date/Permanent Action/Notes) muat tanpa tabel makin lebar.
function RowActionsMenu({ onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function onDocClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }} onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setOpen((v) => !v)} style={iconBtn} title="Aksi">
        <MoreVertical size={14} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 60,
          background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: '0 12px 32px rgba(0,0,0,.18)', minWidth: 150, overflow: 'hidden',
        }}>
          <button onClick={() => { setOpen(false); onEdit(); }} style={menuItem}>
            <Pencil size={13} /> Edit Problem
          </button>
          <button onClick={() => { setOpen(false); onDelete(); }} style={{ ...menuItem, color: 'var(--red)' }}>
            <Trash2 size={13} /> Hapus
          </button>
        </div>
      )}
    </div>
  );
}

export default function ProblemLogPage() {
  const { logout, username } = useAuth();
  const showToast = useToast();
  const confirm = useConfirm();
  const canEdit = isPrivilegedUser(username);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');
  // Filter tanggal sekarang pakai PeriodPicker yang sama dengan tabel lain
  // (Data Produksi/Downtime Produksi dkk), ganti dua input tanggal "s/d"
  // yang sebelumnya dipakai di sini sendiri.
  const [period, setPeriod] = useState('month');
  const [refDate, setRefDate] = useState(todayStr());
  const [editRow, setEditRow] = useState(null);
  const [detailRow, setDetailRow] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`/problem-log?period=${period}&date=${refDate}`, [], logout).then((d) => { setRows(d); setLoading(false); }).catch(() => setLoading(false));
  }, [logout, period, refDate]);
  useEffect(() => { load(); }, [load]);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit() {
    if (!form.problem.trim()) return;
    setBusy(true);
    try {
      await apiSend('/problem-log', 'POST', {
        tanggal: form.tanggal || null,
        line: form.line,
        part_name: form.partName,
        problem: form.problem,
        jenis_problem: form.jenisProblem,
        root_cause: form.rootCause,
        temporary_action: form.temporaryAction,
        permanent_action: form.permanentAction,
        due_date: form.dueDate || null,
        status: form.status,
      }, logout);
      setForm(EMPTY);
      setShowForm(false);
      showToast('Problem berhasil ditambahkan', 'green');
      load();
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }

  // Status (Open/On Progress/Closed) independen dari Notes -- pilihan
  // langsung dari tabel, tidak perlu buka Edit Problem.
  async function setStatus(r, next) {
    if (next === r.status) return;
    try {
      await apiSend('/problem-log-update', 'POST', { id: r.id, status: next }, logout);
      showToast(`Problem ditandai ${STATUS_LABEL[next]}`, 'green');
      load();
    } catch (e) { showToast(e.message, 'red'); }
  }

  async function remove(id) {
    if (!(await confirm('Hapus catatan problem ini?'))) return;
    try {
      await apiSend('/problem-log-delete', 'POST', { id }, logout);
      showToast('Problem berhasil dihapus', 'green');
      load();
    } catch (e) { showToast(e.message, 'red'); }
  }

  const shown = useMemo(() => {
    const filtered = filter === 'all' ? rows : rows.filter((r) => r.status === filter);
    // Data dengan Tanggal terbaru selalu di atas -- id cuma tiebreaker
    // kalau tanggalnya sama/kosong (rows sudah datang tanggal-desc dari
    // API, urutan ini jaga-jaga kalau ada filter/re-render).
    return [...filtered].sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || '') || b.id - a.id);
  }, [rows, filter]);

  const { sorted: sortedShown, sortKey, sortDir, toggleSort } = useSort(shown);
  const scrollRef = useHorizontalWheelScroll();

  return (
    <div className="page-view active">
      <div className="page-header">
        <div>
          <div className="page-title">Problem Produksi</div>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <PeriodPicker pill period={period} setPeriod={setPeriod} refDate={refDate} setRefDate={setRefDate} />
          <select style={{ ...inp, width: 150 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Semua Status</option>
            {STATUS_OPTS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          {canEdit && (
            <button
              onClick={() => setShowForm((v) => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, borderRadius: 7, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}
            >
              <Plus size={14} /> Tambah Problem
            </button>
          )}
        </div>
      </div>

      {showForm && canEdit && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><div className="card-title">Problem Baru</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <input type="date" placeholder="Tanggal" style={inp} value={form.tanggal} onChange={(e) => set('tanggal', e.target.value)} />
            <input placeholder="Line Produksi" style={inp} value={form.line} onChange={(e) => set('line', e.target.value)} />
            <input placeholder="Part Name" style={inp} value={form.partName} onChange={(e) => set('partName', e.target.value)} />
            <Combobox value={form.jenisProblem} options={JENIS_PROBLEM_OPTS} onChange={(v) => set('jenisProblem', v)} placeholder="Jenis Problem…" style={inp} />
            <div style={{ gridColumn: '1 / -1' }}>
              <input placeholder="Problem *" style={inp} value={form.problem} onChange={(e) => set('problem', e.target.value)} />
            </div>
            <input placeholder="Root Cause" style={inp} value={form.rootCause} onChange={(e) => set('rootCause', e.target.value)} />
            <input placeholder="Temporary Action" style={inp} value={form.temporaryAction} onChange={(e) => set('temporaryAction', e.target.value)} />
            <input placeholder="Permanent Action" style={inp} value={form.permanentAction} onChange={(e) => set('permanentAction', e.target.value)} />
            <input type="date" placeholder="Due Date" style={inp} value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button disabled={busy} onClick={submit} style={{ padding: '8px 18px', fontSize: 13, borderRadius: 7, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
              {busy ? 'Menyimpan…' : 'Simpan'}
            </button>
            <button onClick={() => setShowForm(false)} style={{ padding: '8px 18px', fontSize: 13, borderRadius: 7, background: 'var(--s2)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              Batal
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
          Klik baris untuk lihat rangkuman detail lengkap. Tanggal Due Date berwarna merah berarti sudah lewat jatuh tempo.
        </div>
        <div ref={scrollRef} style={{ overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1250, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: canEdit ? '5%' : '0%' }} />
            </colgroup>
            <thead>
              <tr>
                <SortTh sortKeyName="tanggal" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={thGrid}>Tanggal</SortTh>
                <SortTh sortKeyName="line" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={thGrid}>
                  <span title="Line Produksi">Line</span>
                </SortTh>
                <SortTh sortKeyName="partName" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={thGrid}>Part Name</SortTh>
                <SortTh sortKeyName="problem" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={thGrid}>Problem</SortTh>
                <SortTh sortKeyName="jenisProblem" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={thGrid}>Jenis Problem</SortTh>
                <SortTh sortKeyName="totalLossTime" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={thGrid}>
                  <span title="Total Loss Time (Loss Time + Breakdown Mesin)">Loss Time</span>
                </SortTh>
                <SortTh sortKeyName="dueDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={thGrid}>Due Date</SortTh>
                <SortTh sortKeyName="permanentAction" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={thGrid}>
                  <span title="Permanent Action">Action</span>
                </SortTh>
                <SortTh sortKeyName="notes" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={thGrid}>Notes</SortTh>
                <SortTh sortKeyName="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={thGrid}>Status</SortTh>
                {canEdit && <th style={thGrid}>Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr><td colSpan={11} style={{ padding: '10px 16px' }}><Skeleton height={12} width="60%" /></td></tr>
              ) : sortedShown.length === 0 ? (
                <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Belum ada data.</td></tr>
              ) : sortedShown.map((r) => (
                <tr key={r.id} onClick={() => setDetailRow(r)} style={{ cursor: 'pointer' }}>
                  <td style={{ ...tdEllipsis, color: isOverdue(r) ? 'var(--red)' : 'var(--text)' }}>{formatDateID(r.tanggal)}</td>
                  <td style={tdEllipsis} title={r.line || ''}>{r.line || '—'}</td>
                  <td style={tdEllipsis} title={r.partName || ''}>{r.partName || '—'}</td>
                  <td style={tdEllipsis} title={r.problem || ''}>{r.problem}</td>
                  <td style={tdEllipsis} title={r.jenisProblem || ''}>{r.jenisProblem || '—'}</td>
                  <td style={td}>{r.totalLossTime ? `${r.totalLossTime} menit` : '—'}</td>
                  <td style={{ ...td, color: isOverdue(r) ? 'var(--red)' : 'var(--text)', fontWeight: isOverdue(r) ? 700 : 400 }}>
                    {r.dueDate ? formatDateID(r.dueDate) : '—'}
                  </td>
                  <td style={tdEllipsis} title={r.permanentAction || ''}>{r.permanentAction || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                  <td style={tdEllipsis} title={r.notes || ''}>{r.notes || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                  <td style={{ ...td, padding: '6px 8px' }}>
                    {canEdit ? (
                      <select
                        value={r.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setStatus(r, e.target.value)}
                        className="pp-select"
                        style={{
                          color: STATUS_COLOR[r.status] || 'var(--muted)', borderColor: STATUS_COLOR[r.status] || 'var(--border)', fontWeight: 700,
                          width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', padding: '5px 6px',
                        }}
                      >
                        {STATUS_OPTS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                    ) : (
                      <span style={{ color: STATUS_COLOR[r.status] || 'var(--muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>{STATUS_LABEL[r.status] || r.status}</span>
                    )}
                  </td>
                  {canEdit && (
                    <td style={td}>
                      <RowActionsMenu onEdit={() => setEditRow(r)} onDelete={() => remove(r.id)} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editRow && canEdit && (
        <EditProblemModal row={editRow} onClose={() => setEditRow(null)} onSaved={load} />
      )}
      {detailRow && (
        <DetailProblemModal row={detailRow} onClose={() => setDetailRow(null)} />
      )}
    </div>
  );
}

const td = { padding: '8px 10px', fontSize: 12.5, border: '1px solid var(--border)', color: 'var(--text)', whiteSpace: 'nowrap' };
const tdEllipsis = { ...td, overflow: 'hidden', textOverflow: 'ellipsis' };
// overflow/textOverflow: header (SortTh) sebelumnya nowrap tanpa clip --
// label panjang (mis. "Total Loss Time"/"Permanent Action") jadi
// tumpang tindih visual ke kolom sebelahnya di lebar kolom sempit. Label
// yang lebih panjang dari kolomnya sekarang dipotong "…" (bukan bocor ke
// kolom lain) -- lihat juga pemendekan label di header tabel (mis. "Line
// Produksi" -> "Line", title penuh lewat <span title>).
const thGrid = { padding: '8px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', border: '1px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const iconBtn = { display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 7px', fontSize: 12, cursor: 'pointer', color: 'var(--text)', whiteSpace: 'nowrap', flexShrink: 0 };
const menuItem = { display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 12px', fontSize: 12.5, background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text)', textAlign: 'left', whiteSpace: 'nowrap' };
