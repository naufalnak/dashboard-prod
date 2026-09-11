import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Pencil, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { fetchProblemLog, createProblemLog, updateProblemLog, deleteProblemLog } from '../services/problemLogService.js';
import { usePaginatedList, PAGE_SIZE } from '../hooks/usePaginatedList.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useConfirm } from '../contexts/ConfirmContext.jsx';
import { isPrivilegedUser } from '../roles.js';
import SortTh from '../components/ui/SortTh.jsx';
import Combobox from '../components/ui/Combobox.jsx';
import Pagination from '../components/ui/Pagination.jsx';
import EmptyErrorState from '../components/ui/EmptyErrorState.jsx';
import { TableRowsSkeleton } from '../components/ui/Skeleton.jsx';
import { useSort } from '../hooks/useSort.js';
import { formatDateID } from '../dateFmt.js';

const STATUS_LABEL = { open: 'Open', in_progress: 'In Progress', closed: 'Closed' };
const STATUS_COLOR = { open: 'var(--red)', in_progress: 'var(--yellow)', closed: 'var(--green)' };
const STATUS_OPTS = ['open', 'in_progress', 'closed'];
const JENIS_PROBLEM_OPTS = ['Machine', 'Material', 'Method', 'Man', 'Environment', 'Setting & Tool'];

const EMPTY = { tanggal: '', line: '', partName: '', problem: '', jenisProblem: '', rootCause: '', temporaryAction: '', permanentAction: '', dueDate: '', status: 'open' };

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
  });
  const [busy, setBusy] = useState(false);
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    if (!form.problem.trim()) return;
    setBusy(true);
    try {
      await updateProblemLog({
        id: row.id,
        tanggal: form.tanggal || null,
        line: form.line, part_name: form.partName,
        problem: form.problem, jenis_problem: form.jenisProblem, root_cause: form.rootCause,
        temporary_action: form.temporaryAction, permanent_action: form.permanentAction,
        due_date: form.dueDate || null,
        notes: form.notes,
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
          <div />
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
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{value || '—'}</div>
    </div>
  );
}

// Rangkuman detail satu baris Problem, tampilan penuh tanpa terpotong --
// dibuka dengan klik baris di tabel (yang sekarang cuma menampilkan
// kolom ringkas supaya muat 100% lebar layar tanpa scroll horizontal).
function DetailProblemModal({ row, onClose }) {
  return (
    <div className="overlay show" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560, borderRadius: 14, margin: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Detail Problem</div>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
          <DetailRow label="Tanggal" value={formatDateID(row.tanggal)} />
          <DetailRow label="Due Date" value={formatDateID(row.dueDate)} />
          <DetailRow label="Line Produksi" value={row.line} />
          <DetailRow label="Part Name" value={row.partName} />
          <div style={{ gridColumn: '1 / -1' }}><DetailRow label="Problem" value={row.problem} /></div>
          <DetailRow label="Jenis Problem" value={row.jenisProblem} />
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>Status</div>
            <span style={{ color: STATUS_COLOR[row.status] || 'var(--muted)', fontWeight: 700, fontSize: 13.5 }}>{STATUS_LABEL[row.status] || row.status}</span>
          </div>
          <div style={{ gridColumn: '1 / -1' }}><DetailRow label="Root Cause" value={row.rootCause} /></div>
          <DetailRow label="Temporary Action" value={row.temporaryAction} />
          <DetailRow label="Permanent Action" value={row.permanentAction} />
          <div style={{ gridColumn: '1 / -1' }}><DetailRow label="Notes" value={row.notes} /></div>
          <DetailRow label="Ditutup" value={row.status === 'closed' && row.closedAt ? new Date(row.closedAt).toLocaleString('id-ID') : null} />
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose} style={{ width: '100%' }}>Tutup</button>
        </div>
      </div>
    </div>
  );
}

export default function ProblemLogPage() {
  const { logout, username } = useAuth();
  const showToast = useToast();
  const confirm = useConfirm();
  const canEdit = isPrivilegedUser(username);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');
  const [editRow, setEditRow] = useState(null);
  const [detailRow, setDetailRow] = useState(null);

  const {
    rows, page, setPage, totalPages, total, loading, error, reload: load,
  } = usePaginatedList(
    fetchProblemLog,
    (p, pageSize) => `page=${p}&pageSize=${pageSize}`,
    [],
  );

  // Ganti filter status -> balik ke halaman 1. Filter status di sini cuma
  // menyaring baris yang sudah dimuat di halaman saat ini (lihat catatan
  // di `shown` di bawah), jadi baris status lain mungkin ada di halaman
  // lain -- balik ke hal. 1 supaya user tidak nyangkut di tengah.
  useEffect(() => { setPage(1); }, [filter]);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit() {
    if (!form.problem.trim()) return;
    setBusy(true);
    try {
      await createProblemLog({
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

  // Status Open/Closed adalah toggle sendiri -- tidak bergantung dan tidak
  // mempengaruhi isi Notes.
  async function toggleStatus(r) {
    const next = r.status === 'closed' ? 'open' : 'closed';
    try {
      await updateProblemLog({ id: r.id, status: next }, logout);
      showToast(next === 'closed' ? 'Problem ditandai Closed' : 'Problem ditandai Open', 'green');
      load();
    } catch (e) { showToast(e.message, 'red'); }
  }

  async function remove(id) {
    if (!(await confirm('Hapus catatan problem ini?'))) return;
    try {
      await deleteProblemLog(id, logout);
      showToast('Problem berhasil dihapus', 'green');
      load();
    } catch (e) { showToast(e.message, 'red'); }
  }

  // Catatan: `filter` status di sini cuma menyaring baris di halaman yang
  // lagi dimuat (lihat Pagination di bawah tabel), bukan lintas semua
  // data -- makanya ganti filter juga balik ke halaman 1 di atas.
  const shown = useMemo(() => {
    const filtered = filter === 'all' ? rows : rows.filter((r) => r.status === filter);
    // Data dengan Tanggal terbaru selalu di atas -- id cuma tiebreaker
    // kalau tanggalnya sama/kosong (rows sudah datang tanggal-desc dari
    // API, urutan ini jaga-jaga kalau ada filter/re-render).
    return [...filtered].sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || '') || b.id - a.id);
  }, [rows, filter]);

  const { sorted: sortedShown, sortKey, sortDir, toggleSort } = useSort(shown);

  return (
    <div className="page-view active">
      <div className="page-header">
        <div>
          <div className="page-title">Problem Produksi</div>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: 8 }}>
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
            <Combobox value={form.jenisProblem} options={JENIS_PROBLEM_OPTS} onChange={(v) => set('jenisProblem', v)} placeholder="Jenis Problem (4M+1E)…" style={inp} />
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
          Klik baris untuk lihat rangkuman detail lengkap.
        </div>
        <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '10%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '27%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: canEdit ? '12%' : '0%' }} />
          </colgroup>
          <thead>
            <tr>
              <SortTh sortKeyName="tanggal" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={thGrid}>Tanggal</SortTh>
              <SortTh sortKeyName="line" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={thGrid}>Line Produksi</SortTh>
              <SortTh sortKeyName="partName" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={thGrid}>Part Name</SortTh>
              <SortTh sortKeyName="problem" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={thGrid}>Problem</SortTh>
              <SortTh sortKeyName="jenisProblem" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={thGrid}>Jenis Problem</SortTh>
              <SortTh sortKeyName="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={thGrid}>Status</SortTh>
              {canEdit && <th style={thGrid}>Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <TableRowsSkeleton rows={6} colSpan={7} />
            ) : sortedShown.length === 0 ? (
              <EmptyErrorState as="row" colSpan={7} status={error ? 'error' : 'empty'} onRetry={load} emptyText={rows.length === 0 ? 'Belum ada data.' : 'Tidak ada yang cocok dengan filter status ini.'} />
            ) : sortedShown.map((r) => (
              <tr key={r.id} onClick={() => setDetailRow(r)} style={{ cursor: 'pointer' }}>
                <td style={tdEllipsis}>{formatDateID(r.tanggal)}</td>
                <td style={tdEllipsis} title={r.line || ''}>{r.line || '—'}</td>
                <td style={tdEllipsis} title={r.partName || ''}>{r.partName || '—'}</td>
                <td style={tdEllipsis} title={r.problem || ''}>{r.problem}</td>
                <td style={tdEllipsis} title={r.jenisProblem || ''}>{r.jenisProblem || '—'}</td>
                <td style={td}>
                  {canEdit ? (
                    <button onClick={(e) => { e.stopPropagation(); toggleStatus(r); }} style={{ ...statusBtn, color: STATUS_COLOR[r.status] || 'var(--muted)', borderColor: STATUS_COLOR[r.status] || 'var(--border)' }} title="Ganti status">
                      {STATUS_LABEL[r.status] || r.status}
                    </button>
                  ) : (
                    <span style={{ color: STATUS_COLOR[r.status] || 'var(--muted)', fontWeight: 700 }}>{STATUS_LABEL[r.status] || r.status}</span>
                  )}
                </td>
                {canEdit && (
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setEditRow(r)} style={iconBtn} title="Edit Problem"><Pencil size={13} /></button>
                      <button onClick={() => remove(r.id)} style={{ ...iconBtn, color: 'var(--red)' }} title="Hapus">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        <Pagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} disabled={loading} />
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
const thGrid = { padding: '8px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', border: '1px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap' };
const iconBtn = { display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 7px', fontSize: 12, cursor: 'pointer', color: 'var(--text)', whiteSpace: 'nowrap', flexShrink: 0 };
const statusBtn = { background: 'none', border: '1px solid', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' };