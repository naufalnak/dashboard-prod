import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Upload, Pencil, Check, X, Search, Users, ChevronDown, ChevronUp, ArrowRightLeft, ArrowUpRight, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useUI } from '../contexts/UIContext.jsx';
import { isReadOnlyUser } from '../roles.js';
import {
  fetchMaster, fetchLegacyLookups, fetchMachines, fetchPartnameCounts,
  fetchOrphanPartnames, fetchPartnameMissingFinish, fetchPartnameUnused,
  fetchProsesMesinMismatch, importMasterFile, importMasterProses,
  createGroupHead, updateGroupHead, deleteGroupHead,
  createManPower, updateManPower, deleteManPower,
  renamePartname, createPartName, updatePartName, mergePartName, deletePartName,
  createProses, updateProses, deleteProses, setProsesFinish, mergeProses,
  createKriteriaNg, updateKriteriaNg, deleteKriteriaNg,
  createOvertimeTarget, updateOvertimeTarget, deleteOvertimeTarget,
  createShiftHours, updateShiftHours, deleteShiftHours,
} from '../services/masterService.js';
import { useToast } from '../contexts/ToastContext.jsx';
import { useConfirm } from '../contexts/ConfirmContext.jsx';
import useHorizontalWheelScroll from '../hooks/useHorizontalWheelScroll.js';
import { useDebounce } from '../hooks/useDebounce.js';
import SortTh from '../components/ui/SortTh.jsx';
import ZoomCell from '../components/ui/ZoomCell.jsx';
import { TableRowsSkeleton } from '../components/ui/Skeleton.jsx';
import Combobox from '../components/ui/Combobox.jsx';
import ProsesRowDrawer from '../components/dashboard/ProsesRowDrawer.jsx';
import { useSort } from '../hooks/useSort.js';
import { useColumnWidths, weightsToPercent } from '../hooks/useColumnWidths.js';
import { downloadXlsx } from '../exportXlsx.js';
import { readXlsxFile } from '../importXlsx.js';

const CLUSTERS = ['AD', 'BC', 'EF', 'FI'];

const TABS = [
  { key: 'ringkasan', label: 'Ringkasan' },
  { key: 'groupHeadManPower', label: 'Grup Head & Man Power' },
  { key: 'partProses', label: 'Part Name & Proses' },
  { key: 'kriteriaNg', label: 'Kriteria NG' },
  { key: 'overtimeTarget', label: 'Target Overtime' },
  { key: 'shiftHours', label: 'Shift' },
];

const MONTH_ID_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function Field({ label, hint, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>
        {label}{hint && <span style={{ textTransform: 'none', fontWeight: 400, letterSpacing: 0 }}> · {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder = 'Cari…' }) {
  // Local state gives instant typing feedback; the debounced value is what
  // actually gets pushed up to trigger filtering, so fast typing doesn't
  // re-filter (and re-render large tables) on every keystroke.
  const [local, setLocal] = useState(value);
  const debounced = useDebounce(local, 300);

  useEffect(() => { setLocal(value); }, [value]);
  useEffect(() => { if (debounced !== value) onChange(debounced); }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'relative', maxWidth: 320, marginBottom: 14 }}>
      <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
      <input
        className="form-input"
        style={{ paddingLeft: 32 }}
        placeholder={placeholder}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
      />
    </div>
  );
}

function matches(query, ...fields) {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return fields.some((f) => String(f ?? '').toLowerCase().includes(q));
}

export default function MasterData() {
  const { logout, username } = useAuth();
  const readOnly = isReadOnlyUser(username);
  const { masterDataTab, setMasterDataTab } = useUI();
  const showToast = useToast();
  const [tab, setTab] = useState('ringkasan');

  // Navigasi dari halaman lain (mis. tombol "Ke Master Data" di modal Edit
  // Data Produksi) bisa langsung menuju tab tertentu lewat UIContext,
  // bukan selalu jatuh ke tab Ringkasan default.
  useEffect(() => {
    if (!masterDataTab) return;
    setTab(masterDataTab);
    setMasterDataTab('');
  }, [masterDataTab, setMasterDataTab]);
  const [master, setMaster] = useState({ clusters: CLUSTERS, groupHeads: [], partNames: [], proses: [], manPower: [], kriteriaNg: [], overtimeTargets: [], shiftHours: [] });
  const [legacy, setLegacy] = useState({ manPower: [], mesin: [], proses: [], partNames: [] });
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchMaster({ clusters: CLUSTERS, groupHeads: [], partNames: [], proses: [], manPower: [], kriteriaNg: [], overtimeTargets: [], shiftHours: [] }, logout)
      .then((d) => { setMaster(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [logout]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetchLegacyLookups({ manPower: [], mesin: [], proses: [], partNames: [] }, logout).then(setLegacy);
  }, [logout]);

  // Gabungan Group Head -> Cluster -> Part Name -> Proses (+Cycle Time,
  // Line/Mesin) jadi satu tabel, tanpa mengubah cara data disimpan (tetap
  // 3 tabel terpisah supaya edit satu tempat tidak perlu ubah banyak baris
  // berulang). Baris terkecil = tiap Proses; join ke atas by
  // cluster/partName. Man Power sengaja tidak ikut di sini -- sekarang
  // dikelola lewat roster Grup Head, bukan per baris Proses lagi.
  const ringkasanRows = useMemo(() => {
    return master.proses.map((p) => {
      // Cluster dibaca dari baris Proses-nya sendiri (bukan join ke
      // MasterPartName) supaya konsisten dengan tab Part Name & Proses --
      // tiap baris Proses independen, bisa beda Cluster dari Part Name
      // lain yang kebetulan namanya sama.
      const cluster = p.cluster || '';
      const groupHeads = master.groupHeads.filter((g) => g.cluster === cluster).map((g) => g.name);
      return {
        key: p.id,
        groupHead: groupHeads.join(', ') || '—',
        cluster: cluster || '—',
        partName: p.partName,
        cycleTime: p.cycleTime,
        proses: p.proses,
        line: p.line,
        mesin: p.mesin,
      };
    });
  }, [master]);

  async function handleImport(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await importMasterFile(fd, logout);
      showToast(`Import selesai: ${data.groupHeads} grup head, ${data.partNames} part, ${data.proses} proses (${data.skipped} dilewati)`, 'green');
      load();
    } catch (err) { showToast(err.message, 'red'); }
  }

  return (
    <div className="page-view active">
      <div className="page-header">
        <div>
          <div className="page-title">Master Data</div>
        </div>
        {!readOnly && (
          <div className="header-actions">
            <button className="btn" onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} /> Import CSV
            </button>
            <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
          </div>
        )}
      </div>
      {readOnly && (
        <div style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', marginBottom: 16 }}>
          Mode lihat saja — akun ini tidak bisa menambah, mengubah, atau menghapus data Master Data.
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '9px 16px', fontSize: 13, fontWeight: tab === t.key ? 700 : 400,
              background: 'none', border: 'none', cursor: 'pointer',
              color: tab === t.key ? 'var(--accent)' : 'var(--muted)',
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ringkasan' && <RingkasanTab rows={ringkasanRows} loading={loading} />}
      {tab === 'groupHeadManPower' && (
        <GroupHeadTab
          data={master.groupHeads} manPower={master.manPower}
          loading={loading} onChanged={load} logout={logout} readOnly={readOnly}
        />
      )}
      {tab === 'partProses' && (
        <PartProsesTab
          proses={master.proses} partNames={master.partNames}
          loading={loading} onChanged={load} logout={logout} legacy={legacy} readOnly={readOnly}
        />
      )}
      {tab === 'kriteriaNg' && (
        <KriteriaNgTab data={master.kriteriaNg} loading={loading} onChanged={load} logout={logout} readOnly={readOnly} />
      )}
      {tab === 'overtimeTarget' && (
        <OvertimeTargetTab data={master.overtimeTargets} loading={loading} onChanged={load} logout={logout} readOnly={readOnly} />
      )}
      {tab === 'shiftHours' && (
        <ShiftHoursTab data={master.shiftHours} loading={loading} onChanged={load} logout={logout} readOnly={readOnly} />
      )}
    </div>
  );
}

/* ── Tab: Ringkasan (tampilan gabungan, read-only) ──── */
// Bukan tabel fisik baru -- ini cuma JOIN tampilan dari 3 tabel master
// (GroupHead/PartName/Proses) yang sudah ada, jadi edit/tambah data tetap
// lewat tab Grup Head / Part Name & Proses (satu tempat per jenis data,
// tidak perlu ubah banyak baris kalau ada perubahan).
function RingkasanTab({ rows, loading }) {
  const [query, setQuery] = useState('');
  const scrollRef = useHorizontalWheelScroll();
  const filtered = useMemo(
    () => rows.filter((r) => matches(query, r.groupHead, r.cluster, r.partName, r.proses, r.line, r.mesin)),
    [rows, query],
  );
  const { sorted: shown, sortKey, sortDir, toggleSort } = useSort(filtered);
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Ringkasan Relasi Master Data</div>
      </div>
      <SearchBox value={query} onChange={setQuery} placeholder="Cari Grup Head / Part Name / Proses / Mesin…" />
      <div ref={scrollRef} style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <SortTh sortKeyName="groupHead" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Grup Head</SortTh>
              <SortTh sortKeyName="cluster" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Cluster</SortTh>
              <SortTh sortKeyName="partName" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Part Name</SortTh>
              <SortTh sortKeyName="cycleTime" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Cycle Time</SortTh>
              <SortTh sortKeyName="proses" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Proses</SortTh>
              <SortTh sortKeyName="line" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Line Produksi</SortTh>
              <SortTh sortKeyName="mesin" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Mesin</SortTh>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <TableRowsSkeleton rows={6} colSpan={7} />
            ) : shown.length === 0 ? (
              <tr><td colSpan={7} style={td}>{rows.length === 0 ? 'Belum ada data. Isi dulu lewat tab Grup Head dan Part Name & Proses.' : 'Tidak ada yang cocok.'}</td></tr>
            ) : shown.map((r) => (
              <tr key={r.key}>
                <td style={{ ...td, maxWidth: 160 }}><ZoomCell label="Grup Head">{r.groupHead}</ZoomCell></td>
                <td style={td}>{r.cluster}</td>
                <td style={{ ...td, maxWidth: 160 }}><ZoomCell label="Part Name">{r.partName}</ZoomCell></td>
                <td style={td}>{r.cycleTime}</td>
                <td style={{ ...td, maxWidth: 140 }}><ZoomCell label="Proses">{r.proses}</ZoomCell></td>
                <td style={td}>{r.line}</td>
                <td style={td}>{r.mesin}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Tab: Grup Head & Man Power (digabung — Man Power tampil & dikelola
   langsung di baris Grup Head-nya masing-masing, supaya ganti anak buah
   pas pindah shift/peran tinggal buka satu baris) ─────────────────── */
function GroupHeadTab({ data, manPower, loading, onChanged, logout, readOnly = false }) {
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
      await createGroupHead({ name, cluster }, logout);
      setName(''); setCluster('');
      showToast('Grup Head berhasil ditambahkan', 'green');
      onChanged();
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }
  async function remove(id) {
    if (!(await confirm('Hapus Grup Head ini?'))) return;
    try {
      await deleteGroupHead(id, logout);
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
      await updateGroupHead({ id, name: editName, cluster: editCluster }, logout);
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
          <TableRowsSkeleton rows={6} colSpan={4} />
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
      await createManPower({ name, group_head: groupHead }, logout);
      setName('');
      showToast('Man Power berhasil ditambahkan', 'green');
      onChanged();
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }
  async function remove(id) {
    if (!(await confirm('Hapus Man Power ini?'))) return;
    try {
      await deleteManPower(id, logout);
      showToast('Man Power berhasil dihapus', 'green');
      onChanged();
    } catch (e) { showToast(e.message, 'red'); }
  }
  function startEdit(m) { setEditingId(m.id); setEditName(m.name); setEditGroupHead(m.groupHead); }
  async function saveEdit(id) {
    if (!editName.trim() || !editGroupHead) return;
    setBusy(true);
    try {
      await updateManPower({ id, name: editName, group_head: editGroupHead }, logout);
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

/* ── Tab: Part Name & Proses (digabung — Cycle Time ikut Proses, karena
   satu Part Name bisa punya beberapa Proses dengan Cycle Time beda) ─── */
// Warna latar berselang-seling per kelompok Part Name -- sama teknik
// seperti ProduksiTable, supaya semua Proses milik satu Part Name
// kelihatan sebagai satu kelompok. Hanya berlaku selama tabel belum
// diurutkan manual lewat klik header kolom lain.
const PP_GROUP_BG = ['transparent', 'var(--s2)'];
const PP_AKSI_PCT = 8;
const PP_DEFAULT_WIDTHS = weightsToPercent([
  { key: 'partName', weight: 220 },
  { key: 'cluster', weight: 90 },
  { key: 'idCode', weight: 110 },
  { key: 'proses', weight: 190 },
  { key: 'line', weight: 160 },
  { key: 'mesin', weight: 140 },
  { key: 'cycleTime', weight: 100 },
  { key: 'jumlahData', weight: 110 },
], PP_AKSI_PCT);

const orphanInp = { width: '100%', padding: '7px 10px', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--s1)', color: 'var(--text)' };

// Part Name yang muncul di data RC Harian Produksi (Supabase) tapi tidak
// cocok dengan Part Name mana pun yang sekarang ada di Master Data --
// biasanya nama lama/typo dari sebelum katalog dirapikan, atau memang
// sudah diganti namanya belakangan. Panel ini membiarkan nama lama itu
// "disamakan" ke Part Name Master Data yang benar -- backend akan
// menimpa nama di semua baris historis terkait (Produksi, Rejection,
// Problem Log) sekaligus, lihat POST /produksi-rename-partname.
function OrphanPartNamesPanel({ orphans, loading, partNameOptions, logout, showToast, onRenamed }) {
  const { navigateToDataProduksi } = useUI();
  const [target, setTarget] = useState({});
  const [newCluster, setNewCluster] = useState({});
  const [busyName, setBusyName] = useState(null);

  async function rename(orphanName) {
    const to = (target[orphanName] || '').trim();
    if (!to) return;
    setBusyName(orphanName);
    try {
      const r = await renamePartname(orphanName, to, logout);
      showToast(`${r.total} baris data diganti dari "${orphanName}" ke "${to}"`, 'green');
      setTarget((t) => { const n = { ...t }; delete n[orphanName]; return n; });
      onRenamed();
    } catch (e) { showToast(e.message, 'red'); }
    setBusyName(null);
  }

  // Part Name ini memang belum pernah didaftarkan ke Master Data sama
  // sekali (bukan typo/variasi dari Part Name lain) -- daftarkan
  // langsung pakai nama yang sama persis (idempotent, lihat
  // POST /master-part-name), tanpa perlu rename data historis apa pun
  // karena namanya memang sudah benar dari awal.
  async function createNew(o) {
    const cluster = newCluster[o.partName] || o.cluster;
    if (!cluster) return;
    setBusyName(o.partName);
    try {
      await createPartName({ part_name: o.partName, cluster }, logout);
      showToast(`"${o.partName}" berhasil didaftarkan ke Master Data (Cluster ${cluster}) — lanjutkan dengan menambahkan Proses & Proses Akhir`, 'green');
      setNewCluster((c) => { const n = { ...c }; delete n[o.partName]; return n; });
      onRenamed();
    } catch (e) { showToast(e.message, 'red'); }
    setBusyName(null);
  }

  if (loading || orphans.length === 0) return null;

  return (
    <div style={{ border: '1px solid #e0a30c', background: 'rgba(224,163,12,.08)', borderRadius: 8, padding: 14, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
        <AlertTriangle size={15} style={{ color: '#e0a30c' }} />
        Part Name Belum Terdaftar di Master Data ({orphans.length})
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12 }}>
        Nama Part di bawah ini ada di data RC Harian Produksi tapi tidak cocok dengan Part Name mana pun yang sekarang ada di Master Data. Kalau cuma beda ejaan/sudah diganti nama: pilih Part Name Master Data yang benar lalu klik Ganti (menyamakan semua data historisnya). Kalau memang Part Name baru yang belum pernah didaftarkan: pilih Cluster lalu klik Buat Baru.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
        {orphans.map((o) => (
          <div key={o.partName} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', flexWrap: 'wrap' }}>
            <div style={{ flex: '0 0 220px', minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={o.partName}>{o.partName}</div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{o.count.toLocaleString()} baris data{o.cluster && ` · biasa Cluster ${o.cluster}`}</div>
            </div>
            <button
              onClick={() => navigateToDataProduksi(o.partName)}
              className="btn"
              title="Buka baris RC Harian Produksi yang pakai nama ini, edit manual"
              style={{ flexShrink: 0, fontSize: 11.5, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
            >
              Ke Data Produksi <ArrowUpRight size={12} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 260px', minWidth: 220 }}>
              <ArrowRightLeft size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 140 }}>
                <Combobox
                  style={orphanInp}
                  value={target[o.partName] || ''}
                  options={partNameOptions}
                  onChange={(v) => setTarget((t) => ({ ...t, [o.partName]: v }))}
                  placeholder="Gabung ke Part Name yang benar…"
                />
              </div>
              <button
                disabled={!(target[o.partName] || '').trim() || busyName === o.partName}
                onClick={() => rename(o.partName)}
                className="btn primary"
                style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
              >
                {busyName === o.partName ? 'Mengganti…' : 'Ganti'}
              </button>
            </div>

            <div style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>atau</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <select
                className="form-input"
                style={{ ...orphanInp, width: 84 }}
                value={newCluster[o.partName] ?? o.cluster ?? ''}
                onChange={(e) => setNewCluster((c) => ({ ...c, [o.partName]: e.target.value }))}
              >
                <option value="">Cluster…</option>
                {CLUSTERS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button
                disabled={!(newCluster[o.partName] ?? o.cluster) || busyName === o.partName}
                onClick={() => createNew(o)}
                className="btn"
                title="Daftarkan nama ini apa adanya sebagai Part Name baru di Master Data"
                style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
              >
                {busyName === o.partName ? 'Membuat…' : 'Buat Baru'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Baris Proses yang Mesin-nya (data lama, diketik manual sebelum Tabel
// Machine dipakai sebagai katalog "Semua Mesin") belum cocok satu pun
// baris di Machine -- Line Produksi baris ini juga ikut tidak akurat
// (dulu ikut ketikan manual, bukan dari Machine.line). Klik baris buat
// mencarinya di tabel, lalu klik ikon pensil dan pilih Mesin yang benar
// dari dropdown (sudah tervalidasi ke Tabel Machine) -- koreksi
// sesungguhnya sengaja tetap manual oleh admin, bukan ditebak otomatis.
function MesinMismatchPanel({ items, loading, onFocusPartName }) {
  if (loading || items.length === 0) return null;
  return (
    <div style={{ border: '1px solid #3b82c4', background: 'rgba(59,130,196,.07)', borderRadius: 8, padding: 14, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
        <AlertTriangle size={15} style={{ color: '#3b82c4' }} />
        Mesin/Line Belum Sesuai Tabel Machine ({items.length})
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12 }}>
        Baris Proses di bawah ini Mesin-nya masih data lama (belum cocok dengan katalog "Semua Mesin"), jadi Line Produksi-nya juga ikut belum akurat. Klik salah satu buat mencarinya di tabel, lalu klik ikon pensil dan pilih Mesin yang benar dari dropdown.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => onFocusPartName(it.partName)}
            className="btn"
            style={{ fontSize: 12, padding: '6px 10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, textAlign: 'left' }}
            title={`Mesin saat ini: "${it.mesin || '(kosong)'}", Line: "${it.line || '(kosong)'}"`}
          >
            <span style={{ fontWeight: 700 }}>{it.partName} — {it.proses}</span>
            <span style={{ color: 'var(--muted)', fontSize: 10.5 }}>
              Mesin: {it.mesin || '—'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Part Name yang Total OK Input Rejection-nya tidak akan pernah bisa
// terhitung: entah belum punya baris Proses sama sekali, atau sudah ada
// Proses tapi belum ada satu pun yang ditandai Proses Akhir/Finish --
// Total OK butuh itu buat tahu Proses mana yang jadi acuan jumlah OK.
// Klik nama Part Name buat mencarinya di tabel (tambahkan Proses/tandai
// Proses Akhir lewat Edit), ATAU kalau ternyata baris ini cuma variasi
// ejaan dari Part Name lain yang sudah benar, gabungkan langsung lewat
// /master-part-name-merge tanpa perlu hapus manual satu-satu.
function MissingFinishPanel({ items, loading, onFocusPartName, partNameOptions, logout, showToast, onMerged }) {
  const { navigateToDataProduksi } = useUI();
  const [mergeTarget, setMergeTarget] = useState({});
  const [busyName, setBusyName] = useState(null);

  async function merge(fromName) {
    const to = (mergeTarget[fromName] || '').trim();
    if (!to) return;
    setBusyName(fromName);
    try {
      const r = await mergePartName(fromName, to, logout);
      showToast(`"${fromName}" digabung ke "${r.into}" (${r.total} baris data ikut disamakan)`, 'green');
      setMergeTarget((t) => { const n = { ...t }; delete n[fromName]; return n; });
      onMerged();
    } catch (e) { showToast(e.message, 'red'); }
    setBusyName(null);
  }

  if (loading || items.length === 0) return null;
  return (
    <div style={{ border: '1px solid #c0392b', background: 'rgba(192,57,43,.06)', borderRadius: 8, padding: 14, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
        <AlertTriangle size={15} style={{ color: '#c0392b' }} />
        Part Name Belum Punya Proses Akhir/Finish ({items.length})
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12 }}>
        Total OK di Input Rejection untuk Part Name di bawah ini akan selalu 0 sampai ini dibereskan. Kalau memang Part Name baru: klik namanya untuk mencarinya di tabel, lalu tambahkan Proses (kalau belum ada) atau buka Edit pada Proses yang benar dan centang Proses Akhir/Finish. Kalau ternyata cuma variasi ejaan dari Part Name lain yang sudah benar: pilih Part Name yang benar lalu Gabung.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
        {items.map((it) => (
          <div key={it.partName} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => onFocusPartName(it.partName)}
              className="btn"
              style={{ flex: '0 0 220px', minWidth: 0, fontSize: 12, padding: '6px 10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, textAlign: 'left' }}
              title={it.prosesCount === 0 ? 'Belum ada Proses sama sekali' : `Ada ${it.prosesCount} Proses, belum ada yang ditandai Proses Akhir`}
            >
              <span style={{ fontWeight: 700 }}>{it.partName}</span>
              <span style={{ color: 'var(--muted)', fontSize: 10.5 }}>
                {it.prosesCount === 0 ? 'Belum ada Proses' : `${it.prosesCount} Proses, belum ada Finish`}
              </span>
            </button>
            <button
              onClick={() => navigateToDataProduksi(it.partName)}
              className="btn"
              title="Buka baris RC Harian Produksi yang pakai nama ini, edit manual"
              style={{ flexShrink: 0, fontSize: 11.5, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
            >
              Ke Data Produksi <ArrowUpRight size={12} />
            </button>
            <ArrowRightLeft size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 160 }}>
              <Combobox
                style={orphanInp}
                value={mergeTarget[it.partName] || ''}
                options={partNameOptions.filter((p) => p !== it.partName)}
                onChange={(v) => setMergeTarget((t) => ({ ...t, [it.partName]: v }))}
                placeholder="Gabung ke Part Name yang benar…"
              />
            </div>
            <button
              disabled={!(mergeTarget[it.partName] || '').trim() || busyName === it.partName}
              onClick={() => merge(it.partName)}
              className="btn primary"
              style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              {busyName === it.partName ? 'Menggabung…' : 'Gabung'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Part Name yang tidak punya Proses sama sekali DAN tidak dipakai data
// historis manapun (ProduksiHarian/Rejection/ProblemLog/Rework) -- sisa
// entri lama yang sudah diganti/dihapus dari data lapangan, bukan Part
// Name baru yang perlu dilengkapi. Beda dari MissingFinishPanel yang
// khusus Part Name yang MASIH punya data tapi belum lengkap Proses
// Akhir-nya. Hapus dicek ulang di backend (/master-part-name-delete)
// supaya tidak bisa kehapus kalau ternyata masih ada datanya.
function UnusedPartNamesPanel({ items, loading, logout, showToast, onDeleted }) {
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState(null);

  async function remove(item) {
    if (!(await confirm(`Hapus Part Name "${item.partName}" dari Master Data? Part Name ini tidak punya Proses maupun data historis apa pun.`))) return;
    setBusyId(item.id);
    try {
      await deletePartName(item.id, logout);
      showToast(`"${item.partName}" berhasil dihapus`, 'green');
      onDeleted();
    } catch (e) { showToast(e.message, 'red'); }
    setBusyId(null);
  }

  if (loading || items.length === 0) return null;
  return (
    <div style={{ border: '1px solid var(--border)', background: 'var(--s2)', borderRadius: 8, padding: 14, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
        <AlertTriangle size={15} style={{ color: 'var(--muted)' }} />
        Part Name Tidak Terpakai ({items.length})
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12 }}>
        Part Name di bawah ini tidak punya Proses maupun data historis apa pun (Produksi/Rejection/Problem Log/Rework) -- biasanya sisa nama lama yang sudah diganti/dihapus, bukan bagian dari Data Produksi. Aman dihapus kalau memang bukan Part Name baru yang belum sempat dilengkapi.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
        {items.map((it) => (
          <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 6px 6px 10px' }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{it.partName}</span>
            <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>{it.cluster}</span>
            <button
              disabled={busyId === it.id}
              onClick={() => remove(it)}
              className="btn"
              style={{ flexShrink: 0, color: 'var(--red)', fontSize: 11.5, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
              title="Hapus Part Name ini"
            >
              <Trash2 size={12} /> {busyId === it.id ? 'Menghapus…' : 'Hapus'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Edit Part Name & Proses lewat modal di tengah layar -- gantikan baris
// tabel yang dulu berubah jadi input inline (terlalu sempit buat 7 kolom
// sekaligus). Sama pola dengan EditProduksiModal di Data Produksi: klik
// baris tabel buka ProsesRowDrawer (read-only), klik pensil Edit buka
// modal ini (bisa diubah).
function EditProsesModal({ row, partNames, legacy, machines, lineOptions = [], logout, onClose, onSaved }) {
  const showToast = useToast();
  const partNameMatch = partNames.find((pn) => pn.partName.toLowerCase() === row.partName.toLowerCase());
  const [form, setForm] = useState({
    partName: row.partName, cluster: row.cluster || '', proses: row.proses,
    line: row.line || '', mesin: row.mesin || '', cycleTime: row.cycleTime, idCode: partNameMatch?.idCode || '',
    isFinishProses: row.isFinishProses || false,
  });
  const [busy, setBusy] = useState(false);
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  const partNameOptionsRich = useMemo(
    () => partNames.map((p) => ({ value: p.partName, sub: `Cluster ${p.cluster}` })).sort((a, b) => a.value.localeCompare(b.value)),
    [partNames],
  );
  const machinesRich = useMemo(
    () => machines.map((m) => ({ value: m.machine, sub: m.cluster ? `Cluster ${m.cluster}` : null })),
    [machines],
  );
  function pickMesin(machineName) {
    setForm((f) => ({ ...f, mesin: machineName }));
  }

  // Simpan perubahan HANYA untuk baris Proses ini -- tidak pernah memanggil
  // master-part-name-update dengan Cluster (yang akan mengubah baris
  // MasterPartName bersama dan mempengaruhi semua Proses lain yang
  // berbagi Part Name yang sama). Kalau nama Part Name diketik ulang,
  // pakai master-part-name (cari-atau-buat, idempotent) supaya katalog
  // Part Name tetap ada, tanpa mengubah baris lain manapun. ID Code
  // (properti milik Part Name, bukan Proses) disinkron terpisah lewat
  // master-part-name-update dengan id saja (tanpa cluster) supaya Cluster
  // baris lain yang berbagi Part Name yang sama tidak ikut tertimpa.
  async function save() {
    if (!form.partName.trim() || !form.cluster || !form.proses.trim() || !form.mesin.trim()) {
      showToast('Part Name, Cluster, Proses, dan Mesin wajib diisi', 'red');
      return;
    }
    setBusy(true);
    try {
      if (form.partName !== row.partName) {
        await createPartName({ part_name: form.partName, cluster: form.cluster, id_code: form.idCode }, logout);
      } else {
        const match = partNames.find((pn) => pn.partName.toLowerCase() === form.partName.toLowerCase());
        if (match && form.idCode !== (match.idCode || '')) {
          await updatePartName({ id: match.id, id_code: form.idCode }, logout);
        }
      }
      await updateProses({
        id: row.id, proses: form.proses, part_name: form.partName, cluster: form.cluster,
        mesin: form.mesin, line: form.line, cycle_time: form.cycleTime,
      }, logout);
      // Proses Akhir/Finish -- endpoint terpisah karena backend perlu
      // mematikan tanda di baris Proses lain yang berbagi Part Name yang
      // sama (cuma boleh satu Proses Akhir per Part Name).
      if (form.isFinishProses !== (row.isFinishProses || false)) {
        await setProsesFinish(row.id, form.isFinishProses, logout);
      }
      showToast('Part Name / Proses berhasil diperbarui', 'green');
      onSaved();
      onClose();
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }

  // createPortal ke document.body -- tabel Part Name & Proses ada di
  // dalam .card, dan .card punya animasi (fadeUp) yang meninggalkan
  // transform aktif permanen setelah animasinya selesai. position:fixed
  // di dalam elemen manapun yang punya transform aktif jadi relatif ke
  // elemen itu, BUKAN ke viewport -- makanya tanpa portal, modal ini
  // ikut posisi scroll tabel/card alih-alih diam di posisi yang sama
  // (sama akar masalah dengan ProsesRowDrawer/ProduksiRowDrawer). Gaya
  // slide-up dari bawah (bukan center) juga dipakai supaya posisinya
  // selalu konsisten & gampang ditemukan, tidak peduli baris mana yang
  // diklik atau posisi scroll tabel.
  return createPortal(
    <div className="overlay show" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560, borderRadius: '14px 14px 0 0' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Edit Part Name &amp; Proses — {row.partName}</div>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Part Name">
              <Combobox style={editInp} value={form.partName} options={partNameOptionsRich} onChange={(v) => set('partName', v)} placeholder="Ketik atau pilih Part Name…" />
            </Field>
          </div>
          <Field label="Cluster">
            <select className="form-input" style={editInp} value={form.cluster} onChange={(e) => set('cluster', e.target.value)}>
              <option value="">Pilih…</option>
              {CLUSTERS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="ID Code">
            <input type="text" className="form-input" style={editInp} value={form.idCode} onChange={(e) => set('idCode', e.target.value)} placeholder="mis. D.FG.00126" />
          </Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Proses">
              <input className="form-input" style={editInp} list="dl-proses" value={form.proses} onChange={(e) => set('proses', e.target.value)} />
            </Field>
          </div>
          <Field label="Mesin" hint="dari Tabel Machine">
            <Combobox style={editInp} value={form.mesin} options={machinesRich} onChange={pickMesin} placeholder="Ketik atau pilih Mesin…" />
          </Field>
          <Field label="Line Produksi">
            <input className="form-input" style={editInp} list="dl-line-edit" value={form.line} onChange={(e) => set('line', e.target.value)} />
            <datalist id="dl-line-edit">{lineOptions.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
          <Field label="Cycle Time (detik/pcs)">
            <input type="number" className="form-input" style={editInp} value={form.cycleTime} onChange={(e) => set('cycleTime', e.target.value)} />
          </Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.isFinishProses} onChange={(e) => set('isFinishProses', e.target.checked)} />
              <span>
                Proses Akhir / Finish
                <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>
                  Dipakai sebagai acuan Total OK di Input Rejection. Cuma boleh satu per Part Name — menyalakan ini otomatis mematikan tanda di Proses lain milik Part Name yang sama.
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
          <button className="btn" onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Kolom yang dibaca/ditulis fitur Import & template contohnya -- header di
// file yang diupload dicocokkan ke label ini (case-insensitive, urutan
// kolom bebas), lihat mapImportRow.
const IMPORT_COLUMNS = [
  { key: 'part_name', label: 'Part Name' },
  { key: 'cluster', label: 'Cluster' },
  { key: 'id_code', label: 'ID Code' },
  { key: 'proses', label: 'Proses' },
  { key: 'mesin', label: 'Mesin' },
  { key: 'line', label: 'Line Produksi' },
  { key: 'cycle_time', label: 'Cycle Time' },
];

function mapImportRow(raw) {
  const normalized = {};
  for (const [k, v] of Object.entries(raw)) normalized[String(k).trim().toLowerCase()] = v;
  const get = (label) => normalized[label.toLowerCase()];
  return {
    part_name: String(get('Part Name') ?? '').trim(),
    cluster: String(get('Cluster') ?? '').trim(),
    id_code: String(get('ID Code') ?? '').trim(),
    proses: String(get('Proses') ?? '').trim(),
    mesin: String(get('Mesin') ?? '').trim(),
    line: String(get('Line Produksi') ?? '').trim(),
    cycle_time: get('Cycle Time') ?? '',
  };
}

// Gabungkan satu baris Proses ini ke Part Name+Proses lain -- dipakai kalau
// baris ini ternyata duplikat/typo dari baris lain yang sudah benar (mis.
// beda ejaan Part Name atau nama Proses). Semua data historis RC Harian
// Produksi ikut pindah ke tujuan (lihat mergeProses di backend), baris ini
// dihapus dari Master Data -- jadi "Jumlah Data"-nya otomatis jadi 0.
function MergeProsesModal({ row, partNames, proses, logout, onClose, onMerged }) {
  const showToast = useToast();
  const [toPartName, setToPartName] = useState('');
  const [toProses, setToProses] = useState('');
  const [busy, setBusy] = useState(false);

  const partNameOptionsRich = useMemo(
    () => partNames.map((p) => ({ value: p.partName, sub: `Cluster ${p.cluster}` })).sort((a, b) => a.value.localeCompare(b.value)),
    [partNames],
  );
  // Opsi Proses disaring ke Proses yang sudah ada milik Part Name tujuan
  // yang dipilih -- supaya gampang pilih Proses yang benar-benar sudah
  // ada, tapi tetap bisa ketik nama baru (Combobox selalu bisa diketik
  // bebas).
  const prosesOptions = useMemo(() => {
    if (!toPartName) return [];
    return [...new Set(proses.filter((p) => p.partName.toLowerCase() === toPartName.toLowerCase()).map((p) => p.proses))]
      .sort((a, b) => a.localeCompare(b));
  }, [proses, toPartName]);

  function pickToPartName(v) {
    setToPartName(v);
    setToProses('');
  }

  async function submit() {
    if (!toPartName.trim() || !toProses.trim()) {
      showToast('Part Name dan Proses tujuan wajib diisi', 'red');
      return;
    }
    setBusy(true);
    try {
      const r = await mergeProses(row.id, toPartName, toProses, logout);
      showToast(`${r.produksi} baris data dipindahkan ke "${r.into.partName}" / "${r.into.proses}"`, 'green');
      onMerged();
      onClose();
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }

  return createPortal(
    <div className="overlay show" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480, borderRadius: '14px 14px 0 0' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Gabung Part Name &amp; Proses</div>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>
          Semua data historis <strong>{row.partName}</strong> / <strong>{row.proses}</strong> ({row.mesin}) akan dipindahkan ke Part Name &amp; Proses tujuan di bawah, lalu baris ini dihapus dari Master Data (Jumlah Data-nya jadi 0).
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Part Name Tujuan">
            <Combobox style={editInp} value={toPartName} options={partNameOptionsRich} onChange={pickToPartName} placeholder="Ketik atau pilih Part Name…" />
          </Field>
          <Field label="Proses Tujuan" hint={toPartName ? undefined : 'pilih Part Name dulu'}>
            <Combobox style={editInp} value={toProses} options={prosesOptions} onChange={setToProses} disabled={!toPartName} placeholder="Ketik atau pilih Proses…" />
          </Field>
        </div>

        <div className="modal-footer">
          <button className="btn primary" disabled={busy || !toPartName.trim() || !toProses.trim()} onClick={submit}>
            {busy ? 'Menggabungkan…' : 'Gabungkan'}
          </button>
          <button className="btn" onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Import massal Part Name & Proses dari file Excel -- di-parse penuh di
// browser (lihat web/src/importXlsx.js), dikirim sebagai array biasa ke
// /master-proses-import. Satu baris file SELALU jadi satu baris Proses
// baru (tidak digabung ke baris yang sudah ada, sama seperti Add form
// sekarang -- lihat catatan di /master-proses backend), jadi cocok juga
// dipakai berulang buat menambah pilihan Mesin lain ke Part Name+Proses
// yang sama.
function ImportProsesModal({ logout, onClose, onImported }) {
  const showToast = useToast();
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  function downloadTemplate() {
    downloadXlsx('template-import-part-name-proses.xlsx', 'Template', IMPORT_COLUMNS, [
      { part_name: 'CONTOH PART NAME', cluster: 'AD', id_code: 'D.FG.00126', proses: 'Assy', mesin: 'ROBOT WELDING PANASONIC', line: 'Suzuki', cycle_time: 120 },
    ]);
  }

  async function handleFile(file) {
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    try {
      const raw = await readXlsxFile(file);
      setRows(raw.map(mapImportRow).filter((r) => r.part_name || r.proses));
    } catch (e) {
      showToast('Gagal membaca file: ' + e.message, 'red');
      setRows([]);
    }
  }

  async function doImport() {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      const r = await importMasterProses(rows, logout);
      setResult(r);
      if (r.imported > 0) {
        showToast(`${r.imported} baris berhasil diimport${r.errors.length ? `, ${r.errors.length} dilewati` : ''}`, r.errors.length ? 'yellow' : 'green');
        onImported();
      } else {
        showToast('Tidak ada baris yang berhasil diimport, cek daftar error di bawah', 'red');
      }
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }

  return createPortal(
    <div className="overlay show" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560, borderRadius: '14px 14px 0 0' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Import Part Name &amp; Proses</div>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>
          Kolom yang dibaca: <strong>Part Name, Cluster, ID Code, Proses, Mesin, Line Produksi, Cycle Time</strong> (Part Name/Cluster/Proses/Mesin wajib diisi, urutan kolom bebas). Satu baris file = satu baris Proses baru — kalau Part Name+Proses yang sama sudah ada, tetap dibuat baris baru (tidak digabung/dianggap 1).
        </div>

        <button className="btn" onClick={downloadTemplate} style={{ marginBottom: 12 }}>Download Template</button>

        <input
          type="file" accept=".xlsx,.xls"
          style={{ display: 'block', marginBottom: 12, fontSize: 12.5, color: 'var(--text)' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />

        {rows.length > 0 && !result && (
          <div style={{ fontSize: 12.5, marginBottom: 12 }}>
            <strong>{fileName}</strong> — {rows.length} baris terbaca.
          </div>
        )}

        {result && (
          <div style={{ fontSize: 12, marginBottom: 12, maxHeight: 180, overflowY: 'auto', background: 'var(--s2)', borderRadius: 8, padding: 10 }}>
            <div style={{ color: 'var(--green)', fontWeight: 700 }}>{result.imported} dari {result.total} baris berhasil diimport.</div>
            {result.unmatchedMesin > 0 && (
              <div style={{ color: '#e0a30c', marginTop: 4 }}>
                {result.unmatchedMesin} di antaranya Mesin-nya belum cocok Tabel Machine — cek panel "Mesin/Line Belum Sesuai Tabel Machine" di atas untuk mengoreksinya satu per satu.
              </div>
            )}
            {result.errors.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ color: 'var(--red)', fontWeight: 700 }}>{result.errors.length} baris dilewati:</div>
                {result.errors.map((e, i) => (
                  <div key={i} style={{ color: 'var(--muted)' }}>Baris {e.row}: {e.reason}</div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="modal-footer">
          <button className="btn primary" disabled={rows.length === 0 || busy} onClick={doImport}>
            {busy ? 'Mengimport…' : `Import${rows.length ? ` (${rows.length} baris)` : ''}`}
          </button>
          <button className="btn" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PartProsesTab({ proses, partNames, loading, onChanged, logout, legacy = { proses: [], mesin: [], manPower: [], partNames: [] }, readOnly = false }) {
  const showToast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState({ partName: '', cluster: '', proses: '', line: '', mesin: '', cycleTime: '', idCode: '' });
  const [busy, setBusy] = useState(false);
  // Klik baris (bukan tombol Edit/Hapus/bintang) buka drawer detail
  // read-only, sama pola dengan ProduksiRowDrawer di Data Produksi. Klik
  // pensil Edit buka EditProsesModal (bisa diubah, kotak di tengah layar)
  // -- bukan lagi baris tabel yang berubah jadi input inline.
  const [detailRow, setDetailRow] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [mergeRow, setMergeRow] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [query, setQuery] = useState('');
  const scrollRef = useHorizontalWheelScroll();
  const { widths, startResize } = useColumnWidths(PP_DEFAULT_WIDTHS, scrollRef);

  // Jumlah baris RC Harian Produksi per Part Name+Proses -- kolom "Jumlah
  // Data" di tabel, dan daftar Part Name yang muncul di data produksi
  // historis tapi tidak (lagi) cocok dengan Part Name mana pun di Master
  // Data -- biasanya nama lama/typo sebelum katalog dirapikan, atau nama
  // Part Name-nya sudah diganti belakangan di Master Data.
  const [counts, setCounts] = useState([]);
  const [orphans, setOrphans] = useState([]);
  const [orphanLoading, setOrphanLoading] = useState(true);
  const [missingFinish, setMissingFinish] = useState([]);
  const [missingFinishLoading, setMissingFinishLoading] = useState(true);
  // Part Name yang tidak punya Proses sama sekali DAN tidak dipakai data
  // historis manapun -- sisa entri lama, tidak termasuk Data Produksi
  // (beda dari missingFinish yang MASIH punya data tapi belum lengkap).
  const [unused, setUnused] = useState([]);
  const [unusedLoading, setUnusedLoading] = useState(true);
  // Baris Proses yang Mesin-nya (data lama, sebelum Tabel Machine dipakai
  // sebagai katalog) belum cocok satu pun baris di Machine -- perlu
  // dikoreksi manual oleh admin (lihat MesinMismatchPanel).
  const [mesinMismatch, setMesinMismatch] = useState([]);
  const [mesinMismatchLoading, setMesinMismatchLoading] = useState(true);
  // Katalog Mesin (tabel Machine, shared dgn Dashboard-MTN) -- Mesin di
  // form Proses WAJIB pilih dari sini (bukan ketik bebas lagi). Line
  // Produksi TIDAK lagi ikut otomatis dari Machine.line -- diisi manual
  // (datalist berisi Line yang sudah ada di baris Proses lain, sekadar
  // saran, bukan validasi).
  const [machines, setMachines] = useState([]);
  const loadCounts = useCallback(() => {
    fetchPartnameCounts(logout).then(setCounts);
    fetchMachines(logout).then(setMachines);
    setOrphanLoading(true);
    fetchOrphanPartnames(logout).then((d) => { setOrphans(d); setOrphanLoading(false); });
    setMissingFinishLoading(true);
    fetchPartnameMissingFinish(logout).then((d) => { setMissingFinish(d); setMissingFinishLoading(false); });
    setUnusedLoading(true);
    fetchPartnameUnused(logout).then((d) => { setUnused(d); setUnusedLoading(false); });
    setMesinMismatchLoading(true);
    fetchProsesMesinMismatch(logout).then((d) => { setMesinMismatch(d); setMesinMismatchLoading(false); });
  }, [logout]);
  useEffect(() => { loadCounts(); }, [loadCounts]);
  // Ketik-utk-cari (Combobox), TIDAK difilter per Cluster -- data Cluster
  // di Tabel Machine belum dirapikan (banyak masih "Cell AD" dkk, bukan
  // "AD" polos seperti dipakai di sini), jadi filter cluster-exact-match
  // pernah bikin hampir semua Mesin hilang dari pilihan. Cluster tetap
  // ditampilkan sebagai sub-teks (kalau ada) buat konteks, bukan filter.
  const machinesRich = useMemo(
    () => machines.map((m) => ({ value: m.machine, sub: m.cluster ? `Cluster ${m.cluster}` : null })),
    [machines],
  );
  // Saran Line Produksi (datalist) -- daftar Line yang sudah pernah
  // dipakai di baris Proses lain, sekadar bantu konsistensi penamaan,
  // bukan validasi (Line diisi manual, tidak lagi tergantung Mesin).
  const lineOptions = useMemo(
    () => [...new Set(proses.map((r) => r.line).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [proses],
  );
  const countMap = useMemo(() => {
    const map = new Map();
    counts.forEach((c) => map.set(`${c.partName.toLowerCase().trim()}|${c.proses.toLowerCase().trim()}`, c.count));
    return map;
  }, [counts]);

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  // Pilih Mesin dari katalog Machine -- Line Produksi TIDAK ikut berubah
  // (diisi manual, independen dari Mesin).
  function setMesin(machineName) {
    setForm((f) => ({ ...f, mesin: machineName }));
  }
  // Kalau ketik Part Name yang sudah ada, Cluster & ID Code-nya otomatis
  // kekunci ke yang sudah tersimpan (konsisten dengan cascading di /rmo).
  // Mesin direset kalau Cluster-nya berubah -- Mesin yang sebelumnya
  // dipilih belum tentu ada di Cluster yang baru.
  function setPartNameField(v) {
    const existing = partNames.find((p) => p.partName === v);
    setForm((f) => {
      const nextCluster = existing ? existing.cluster : f.cluster;
      const clusterChanged = nextCluster !== f.cluster;
      return {
        ...f, partName: v, cluster: nextCluster, idCode: existing ? (existing.idCode || '') : f.idCode,
        mesin: clusterChanged ? '' : f.mesin,
      };
    });
  }
  function setCluster(v) {
    setForm((f) => ({ ...f, cluster: v, mesin: '' }));
  }

  async function add() {
    if (!form.partName.trim() || !form.cluster || !form.proses.trim() || !form.mesin.trim()) return;
    setBusy(true);
    try {
      await createPartName({ part_name: form.partName, cluster: form.cluster, id_code: form.idCode }, logout);
      await createProses({
        proses: form.proses, part_name: form.partName, cluster: form.cluster,
        mesin: form.mesin, line: form.line, cycle_time: form.cycleTime,
      }, logout);
      setForm({ partName: '', cluster: '', proses: '', line: '', mesin: '', cycleTime: '', idCode: '' });
      showToast('Part Name / Proses berhasil ditambahkan', 'green');
      onChanged(); loadCounts();
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }
  async function remove(id) {
    if (!(await confirm('Hapus baris Proses ini?'))) return;
    try {
      await deleteProses(id, logout);
      showToast('Baris Proses berhasil dihapus', 'green');
      onChanged(); loadCounts();
    } catch (e) { showToast(e.message, 'red'); }
  }
  // Cluster dibaca langsung dari baris Proses-nya sendiri (bukan join ke
  // MasterPartName) -- lihat komentar di schema.prisma MasterProses.cluster.
  const rows = proses;
  const filtered = useMemo(
    () => rows.filter((r) => matches(query, r.partName, r.cluster, r.proses, r.line, r.mesin)),
    [rows, query],
  );
  // Default: urutkan berdasarkan Part Name, lalu Proses di dalamnya --
  // supaya semua Proses milik Part Name yang sama berurutan dan mudah
  // dicari. Klik header kolom untuk mengurutkan manual sesuai kolom itu.
  const defaultSorted = useMemo(
    () => [...filtered].sort((a, b) => a.partName.localeCompare(b.partName) || a.proses.localeCompare(b.proses)),
    [filtered],
  );
  const { sorted: shown, sortKey, sortDir, toggleSort } = useSort(defaultSorted);

  return (
    <div className="card">
      {!readOnly && (
        <>
          <MesinMismatchPanel
            items={mesinMismatch}
            loading={mesinMismatchLoading}
            onFocusPartName={setQuery}
          />

          <MissingFinishPanel
            items={missingFinish}
            loading={missingFinishLoading}
            onFocusPartName={setQuery}
            partNameOptions={partNames.map((p) => p.partName)}
            logout={logout}
            showToast={showToast}
            onMerged={loadCounts}
          />

          <UnusedPartNamesPanel
            items={unused}
            loading={unusedLoading}
            logout={logout}
            showToast={showToast}
            onDeleted={loadCounts}
          />

          <OrphanPartNamesPanel
            orphans={orphans}
            loading={orphanLoading}
            partNameOptions={partNames.map((p) => p.partName)}
            logout={logout}
            showToast={showToast}
            onRenamed={loadCounts}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr .6fr .9fr .9fr .9fr .7fr .7fr auto', gap: 12, alignItems: 'end', marginBottom: 18 }}>
            <Field label="Part Name">
              <input className="form-input" list="dl-part-names" value={form.partName} onChange={(e) => setPartNameField(e.target.value)} />
              <datalist id="dl-part-names">{legacy.partNames.map((s) => <option key={s} value={s} />)}</datalist>
            </Field>
            <Field label="Cluster">
              <select className="form-input" value={form.cluster} onChange={(e) => setCluster(e.target.value)}>
                <option value="">Pilih…</option>
                {CLUSTERS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Proses">
              <input className="form-input" list="dl-proses" value={form.proses} onChange={(e) => set('proses', e.target.value)} />
              <datalist id="dl-proses">{legacy.proses.map((s) => <option key={s} value={s} />)}</datalist>
            </Field>
            <Field label="Mesin" hint="dari Tabel Machine, ketik utk cari">
              <Combobox style={orphanInp} value={form.mesin} options={machinesRich} onChange={setMesin} placeholder="Ketik atau pilih Mesin…" />
            </Field>
            <Field label="Line Produksi">
              <input className="form-input" list="dl-line" value={form.line} onChange={(e) => set('line', e.target.value)} />
              <datalist id="dl-line">{lineOptions.map((s) => <option key={s} value={s} />)}</datalist>
            </Field>
            <Field label="Cycle Time (detik/pcs)">
              <input type="number" className="form-input" value={form.cycleTime} onChange={(e) => set('cycleTime', e.target.value)} />
            </Field>
            <Field label="ID Code">
              <input type="text" className="form-input" value={form.idCode} onChange={(e) => set('idCode', e.target.value)} placeholder="mis. D.FG.00126" />
            </Field>
            <button className="btn primary" disabled={busy} onClick={add} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> Tambah
            </button>
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <SearchBox value={query} onChange={setQuery} placeholder="Cari Part Name / Proses / Line / Mesin…" />
        </div>
        {!readOnly && (
          <button className="btn" onClick={() => setShowImport(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <Upload size={14} /> Import
          </button>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 10 }}>
        Baris berlabel <strong>Finish</strong> = Proses Akhir (dipakai sebagai Total OK di Input Rejection). Tandai lewat tombol Edit pada baris Proses yang benar — cuma boleh satu per Part Name.
      </div>

      <div ref={scrollRef} style={{ overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: `${widths.partName}%` }} />
            <col style={{ width: `${widths.cluster}%` }} />
            <col style={{ width: `${widths.idCode}%` }} />
            <col style={{ width: `${widths.proses}%` }} />
            <col style={{ width: `${widths.line}%` }} />
            <col style={{ width: `${widths.mesin}%` }} />
            <col style={{ width: `${widths.cycleTime}%` }} />
            <col style={{ width: `${widths.jumlahData}%` }} />
            <col style={{ width: `${PP_AKSI_PCT}%` }} />
          </colgroup>
          <thead>
            <tr>
              <SortTh sortKeyName="partName" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th} onResizeStart={startResize('partName')}>Part Name</SortTh>
              <SortTh sortKeyName="cluster" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th} onResizeStart={startResize('cluster')}>Cluster</SortTh>
              <th style={th}>ID Code</th>
              <SortTh sortKeyName="proses" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th} onResizeStart={startResize('proses')}>Proses</SortTh>
              <SortTh sortKeyName="line" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th} onResizeStart={startResize('line')}>Line Produksi</SortTh>
              <SortTh sortKeyName="mesin" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th} onResizeStart={startResize('mesin')}>Mesin</SortTh>
              <SortTh sortKeyName="cycleTime" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th} onResizeStart={startResize('cycleTime')}>Cycle Time</SortTh>
              <th style={th} title="Jumlah baris RC Harian Produksi yang pakai kombinasi Part Name + Proses ini">Jumlah Data</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              let groupIdx = -1;
              let prevPartName = null;
              if (loading && rows.length === 0) return <TableRowsSkeleton rows={6} colSpan={9} />;
              if (shown.length === 0) return <tr><td colSpan={9} style={td}>{rows.length === 0 ? 'Belum ada data.' : 'Tidak ada yang cocok.'}</td></tr>;
              return shown.map((p) => {
                if (p.partName !== prevPartName) { groupIdx++; prevPartName = p.partName; }
                const groupBg = PP_GROUP_BG[groupIdx % PP_GROUP_BG.length];
                const partNameMatch = partNames.find((pn) => pn.partName.toLowerCase() === p.partName.toLowerCase());
                const dataCount = countMap.get(`${p.partName.toLowerCase().trim()}|${p.proses.toLowerCase().trim()}`) || 0;
                return (
                  <tr
                    key={p.id}
                    style={{ background: groupBg, cursor: 'pointer' }}
                    onClick={() => setDetailRow({ ...p, idCode: partNameMatch?.idCode, dataCount })}
                  >
                    <td style={td}><ZoomCell label="Part Name">{p.partName}</ZoomCell></td>
                    <td style={td}>{p.cluster}</td>
                    <td style={td}>{partNameMatch?.idCode || '—'}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <ZoomCell label="Proses" style={{ flex: 1, minWidth: 0 }}>{p.proses}</ZoomCell>
                        {p.isFinishProses && (
                          <span
                            title="Proses Akhir/Finish -- dipakai sebagai Total OK Input Rejection"
                            style={{
                              flexShrink: 0, fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em',
                              color: '#e0a30c', border: '1px solid #e0a30c', borderRadius: 4, padding: '1px 5px',
                            }}
                          >
                            Finish
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={td}>{p.line}</td>
                    <td style={td}>{p.mesin}</td>
                    <td style={td}>{p.cycleTime}</td>
                    <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: dataCount === 0 ? 'var(--muted)' : 'var(--text)' }}>{dataCount}</td>
                    <td style={td}>
                      {!readOnly && (
                        <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => setEditRow(p)} style={iconBtn} title="Edit"><Pencil size={13} /></button>
                          <button onClick={() => setMergeRow(p)} style={iconBtn} title="Gabung ke Part Name & Proses lain"><ArrowRightLeft size={13} /></button>
                          <button onClick={() => remove(p.id)} style={{ ...iconBtn, color: 'var(--red)' }} title="Hapus"><Trash2 size={13} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </div>

      <ProsesRowDrawer row={detailRow} onClose={() => setDetailRow(null)} />
      {editRow && (
        <EditProsesModal
          row={editRow}
          partNames={partNames}
          legacy={legacy}
          machines={machines}
          lineOptions={lineOptions}
          logout={logout}
          onClose={() => setEditRow(null)}
          onSaved={() => { onChanged(); loadCounts(); }}
        />
      )}
      {showImport && (
        <ImportProsesModal
          logout={logout}
          onClose={() => setShowImport(false)}
          onImported={() => { onChanged(); loadCounts(); }}
        />
      )}
      {mergeRow && (
        <MergeProsesModal
          row={mergeRow}
          partNames={partNames}
          proses={proses}
          logout={logout}
          onClose={() => setMergeRow(null)}
          onMerged={() => { onChanged(); loadCounts(); }}
        />
      )}
    </div>
  );
}

/* ── Tab: Kriteria NG (daftar jenis cacat, dipilih saat Input Rejection) */
function KriteriaNgTab({ data, loading, onChanged, logout, readOnly = false }) {
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
      await createKriteriaNg(nama, logout);
      setNama('');
      showToast('Kriteria NG berhasil ditambahkan', 'green');
      onChanged();
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }
  async function remove(id) {
    if (!(await confirm('Hapus Kriteria NG ini?'))) return;
    try {
      await deleteKriteriaNg(id, logout);
      showToast('Kriteria NG berhasil dihapus', 'green');
      onChanged();
    } catch (e) { showToast(e.message, 'red'); }
  }
  function startEdit(k) { setEditingId(k.id); setEditNama(k.nama); }
  async function saveEdit(id) {
    if (!editNama.trim()) return;
    setBusy(true);
    try {
      await updateKriteriaNg(id, editNama, logout);
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
            <TableRowsSkeleton rows={4} colSpan={2} />
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

/* ── Tab: Target Overtime (target jam lembur per bulan, beda tiap bulan) */
const thisYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => thisYear - 2 + i);

function OvertimeTargetTab({ data, loading, onChanged, logout, readOnly = false }) {
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
      await createOvertimeTarget({ year, month, target_hours: targetHours }, logout);
      setTargetHours('');
      showToast('Target Overtime berhasil ditambahkan', 'green');
      onChanged();
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }
  async function remove(id) {
    if (!(await confirm('Hapus target Overtime bulan ini?'))) return;
    try {
      await deleteOvertimeTarget(id, logout);
      showToast('Target Overtime berhasil dihapus', 'green');
      onChanged();
    } catch (e) { showToast(e.message, 'red'); }
  }
  function startEdit(t) { setEditingId(t.id); setEditHours(String(t.targetHours ?? 0)); }
  async function saveEdit(id) {
    setBusy(true);
    try {
      await updateOvertimeTarget(id, editHours, logout);
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
            <TableRowsSkeleton rows={4} colSpan={4} />
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

/* ── Tab: Shift (default Waktu Efektif per Shift, auto-isi di RC Harian) */
function ShiftHoursTab({ data, loading, onChanged, logout, readOnly = false }) {
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
      await createShiftHours(shift, hours, logout);
      setShift(''); setHours('');
      showToast('Shift berhasil ditambahkan', 'green');
      onChanged();
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }
  async function remove(id) {
    if (!(await confirm('Hapus Shift ini?'))) return;
    try {
      await deleteShiftHours(id, logout);
      showToast('Shift berhasil dihapus', 'green');
      onChanged();
    } catch (e) { showToast(e.message, 'red'); }
  }
  function startEdit(s) { setEditingId(s.id); setEditHours(String(s.defaultHours ?? 0)); }
  async function saveEdit(id) {
    setBusy(true);
    try {
      await updateShiftHours(id, editHours, logout);
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
            <TableRowsSkeleton rows={4} colSpan={3} />
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

const th = { textAlign: 'left', padding: '5px 7px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', border: '1px solid var(--border)', whiteSpace: 'nowrap' };
const td = { padding: '4px 7px', fontSize: 10.5, border: '1px solid var(--border)', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const iconBtn = { background: 'none', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', color: 'var(--text)', padding: 4, display: 'flex' };
const editInp = { padding: '5px 8px', fontSize: 12.5 };
