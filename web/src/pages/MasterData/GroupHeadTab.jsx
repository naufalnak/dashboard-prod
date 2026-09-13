import { useState, useMemo } from 'react';
import { Plus, Trash2, Pencil, Check, X, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useConfirm } from '../../contexts/ConfirmContext.jsx';
import { apiSend } from '../../api.js';
import { useSort } from '../../useSort.js';
import SortTh from '../../components/SortTh.jsx';
import { CLUSTERS, Field, SearchBox, matches, th, td, iconBtn, editInp } from './shared.jsx';
import { Skeleton } from '../../components/Skeleton.jsx';

/* ── Tab: Grup Head & Man Power (digabung — Man Power tampil & dikelola
   langsung di baris Grup Head-nya masing-masing, supaya ganti anak buah
   pas pindah shift/peran tinggal buka satu baris) ─────────────────── */
export default function GroupHeadTab({ data, manPower, loading, onChanged, logout, readOnly = false }) {
  const showToast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState('');
  const [cluster, setCluster] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCluster, setEditCluster] = useState('');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const filtered = useMemo(() => data.filter((g) => matches(query, g.name, g.cluster)), [data, query]);
  const { sorted: shown, sortKey, sortDir, toggleSort } = useSort(filtered);
  const manPowerByGroupHead = useMemo(() => {
    const map = {};
    manPower.forEach((m) => { (map[m.groupHead] = map[m.groupHead] || []).push(m); });
    return map;
  }, [manPower]);

  async function add() {
    if (!name.trim() || !cluster) return;
    setBusy(true);
    try {
      await apiSend('/master-group-head', 'POST', { name, cluster }, logout);
      setName(''); setCluster('');
      showToast('Grup Head berhasil ditambahkan', 'green');
      onChanged();
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }
  async function remove(id) {
    if (!(await confirm('Hapus Grup Head ini?'))) return;
    try {
      await apiSend('/master-group-head-delete', 'POST', { id }, logout);
      showToast('Grup Head berhasil dihapus', 'green');
      onChanged();
    } catch (e) { showToast(e.message, 'red'); }
  }

  function startEdit(g) {
    setEditingId(g.id);
    setEditName(g.name);
    setEditCluster(g.cluster);
  }
  async function saveEdit(id) {
    if (!editName.trim() || !editCluster) return;
    setBusy(true);
    try {
      await apiSend('/master-group-head-update', 'POST', { id, name: editName, cluster: editCluster }, logout);
      setEditingId(null);
      showToast('Grup Head berhasil diperbarui', 'green');
      onChanged();
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }

  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Grup Head & Man Power</div></div>
      {!readOnly && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end', marginBottom: 18, maxWidth: 620 }}>
          <Field label="Nama Grup Head">
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Cluster">
            <select className="form-input" value={cluster} onChange={(e) => setCluster(e.target.value)}>
              <option value="">Pilih…</option>
              {CLUSTERS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <button className="btn primary" disabled={busy} onClick={add} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Tambah
          </button>
        </div>
      )}

      <SearchBox value={query} onChange={setQuery} placeholder="Cari nama Grup Head / Cluster…" />

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <SortTh sortKeyName="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Nama Grup Head</SortTh>
            <SortTh sortKeyName="cluster" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Cluster</SortTh>
            <th style={th}>Man Power</th>
            <th style={{ ...th, width: 100 }}></th>
          </tr>
        </thead>
        <tbody>
          {loading && data.length === 0 ? (
            <tr><td colSpan={4} style={td}><Skeleton height={12} width="60%" /></td></tr>
          ) : shown.length === 0 ? (
            <tr><td colSpan={4} style={td}>{data.length === 0 ? 'Belum ada data.' : 'Tidak ada yang cocok.'}</td></tr>
          ) : shown.map((g) => {
            const roster = manPowerByGroupHead[g.name] || [];
            const isExpanded = expandedId === g.id;
            return (
              <>
                {editingId === g.id ? (
                  <tr key={g.id}>
                    <td style={td}><input className="form-input" style={editInp} value={editName} onChange={(e) => setEditName(e.target.value)} /></td>
                    <td style={td}>
                      <select className="form-input" style={editInp} value={editCluster} onChange={(e) => setEditCluster(e.target.value)}>
                        {CLUSTERS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={td}>—</td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button disabled={busy} onClick={() => saveEdit(g.id)} style={iconBtn} title="Simpan"><Check size={13} /></button>
                        <button onClick={() => setEditingId(null)} style={iconBtn} title="Batal"><X size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={g.id}>
                    <td style={td}>{g.name}</td>
                    <td style={td}>{g.cluster}</td>
                    <td style={td}>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : g.id)}
                        style={{ ...iconBtn, gap: 6, padding: '5px 10px' }}
                      >
                        <Users size={13} /> {roster.length} orang
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </td>
                    <td style={td}>
                      {!readOnly && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => startEdit(g)} style={iconBtn} title="Edit Grup Head"><Pencil size={13} /></button>
                          <button onClick={() => remove(g.id)} style={{ ...iconBtn, color: 'var(--red)' }} title="Hapus"><Trash2 size={13} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                {isExpanded && (
                  <tr>
                    <td colSpan={4} style={{ ...td, background: 'var(--s2)', padding: '12px 16px' }}>
                      <ManPowerRoster groupHead={g.name} allGroupHeads={data} roster={roster} onChanged={onChanged} logout={logout} readOnly={readOnly} />
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* Roster Man Power satu Grup Head -- tampil pas baris Grup Head di-expand.
   Tambah/edit/hapus di sini langsung ubah field group_head pada baris
   Man Power itu (pindah shift/peran = edit, bukan bikin baris baru). */
function ManPowerRoster({ groupHead, allGroupHeads, roster, onChanged, logout, readOnly = false }) {
  const showToast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editGroupHead, setEditGroupHead] = useState('');

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await apiSend('/master-man-power', 'POST', { name, group_head: groupHead }, logout);
      setName('');
      showToast('Man Power berhasil ditambahkan', 'green');
      onChanged();
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }
  async function remove(id) {
    if (!(await confirm('Hapus Man Power ini?'))) return;
    try {
      await apiSend('/master-man-power-delete', 'POST', { id }, logout);
      showToast('Man Power berhasil dihapus', 'green');
      onChanged();
    } catch (e) { showToast(e.message, 'red'); }
  }
  function startEdit(m) { setEditingId(m.id); setEditName(m.name); setEditGroupHead(m.groupHead); }
  async function saveEdit(id) {
    if (!editName.trim() || !editGroupHead) return;
    setBusy(true);
    try {
      await apiSend('/master-man-power-update', 'POST', { id, name: editName, group_head: editGroupHead }, logout);
      setEditingId(null);
      showToast('Man Power berhasil diperbarui', 'green');
      onChanged();
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
        Man Power — {groupHead}
      </div>
      {roster.length === 0 ? (
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 10 }}>Belum ada anak buah terdaftar.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {roster.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px' }}>
              {editingId === m.id ? (
                <>
                  <input className="form-input" style={{ ...editInp, flex: 1 }} value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                  <select className="form-input" style={{ ...editInp, maxWidth: 180 }} value={editGroupHead} onChange={(e) => setEditGroupHead(e.target.value)} title="Pindahkan ke Grup Head lain">
                    {allGroupHeads.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
                  </select>
                  <button disabled={busy} onClick={() => saveEdit(m.id)} style={iconBtn} title="Simpan"><Check size={13} /></button>
                  <button onClick={() => setEditingId(null)} style={iconBtn} title="Batal"><X size={13} /></button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{m.name}</span>
                  {!readOnly && (
                    <>
                      <button onClick={() => startEdit(m)} style={iconBtn} title="Edit / pindahkan ke Grup Head lain"><Pencil size={13} /></button>
                      <button onClick={() => remove(m.id)} style={{ ...iconBtn, color: 'var(--red)' }} title="Hapus"><Trash2 size={13} /></button>
                    </>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {!readOnly && (
        <div style={{ display: 'flex', gap: 8, maxWidth: 420 }}>
          <input
            className="form-input" placeholder="Nama Man Power baru…"
            value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button className="btn primary" disabled={busy} onClick={add} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <Plus size={14} /> Tambah
          </button>
        </div>
      )}
    </div>
  );
}
