import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AlertOctagon, Pencil, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { apiFetch, apiSend } from '../api.js';
import { CLUSTER_COLORS } from '../components/ClusterBarList.jsx';
import JenisProblemChart from '../components/charts/JenisProblemChart.jsx';
import PeriodPicker from '../components/PeriodPicker.jsx';
import SortTh from '../components/SortTh.jsx';
import ZoomCell from '../components/ZoomCell.jsx';
import Combobox from '../components/Combobox.jsx';
import { Skeleton, SkeletonCircle, SkeletonRows } from '../components/Skeleton.jsx';
import { useSort } from '../useSort.js';
import { formatDateID } from '../dateFmt.js';

const CLUSTERS = ['AD', 'BC', 'EF', 'FI'];
const JENIS_PROBLEM_OPTS = ['Machine', 'Material', 'Method', 'Man', 'Setting & Tool'];
const MAIN_SIZE = 160;
const MINI_SIZE = 50;

function todayStr() { return new Date().toISOString().slice(0, 10); }

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

// Edit langsung di tempat -- ganti pendekatan lama (tombol "Ke Data
// Produksi" yang cuma lompat ke menu lain) supaya Jenis Problem/Loss
// Time/Breakdown Mesin/Problem baris ini bisa dibetulkan tanpa
// meninggalkan Downtime Produksi. Reuse /produksi-harian-update (endpoint
// yang sama dipakai EditProduksiModal di Data Produksi), cuma kirim 4
// field yang relevan di sini.
function EditKendalaModal({ row, logout, master, machines, onClose, onSaved }) {
  const showToast = useToast();
  const [form, setForm] = useState({
    line: row.line || '',
    mesin: row.mesin || '',
    jenisProblem: row.jenisProblem || '',
    lostTime: row.lostTime || 0,
    breakdownMesin: row.breakdownMesin || 0,
    keterangan: row.keterangan || '',
  });
  const [busy, setBusy] = useState(false);
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  // Sama pola dengan EditProduksiModal di Data Produksi -- Mesin
  // sebisa mungkin dari Tabel Machine (katalog "Semua Mesin"), tapi
  // tetap bisa disimpan manual kalau belum ada di katalog.
  const lineOptions = useMemo(
    () => [...new Set((master.proses || []).map((p) => p.line).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [master.proses],
  );
  const machinesRich = useMemo(
    () => (machines || []).map((m) => ({ value: m.machine, sub: m.cluster ? `Cluster ${m.cluster}` : null })),
    [machines],
  );
  const mesinLinked = useMemo(
    () => !form.mesin.trim() || (machines || []).some((m) => m.machine.toLowerCase() === form.mesin.trim().toLowerCase()),
    [machines, form.mesin],
  );
  // Mesin "Manual" = Proses tidak pakai mesin -- Breakdown Mesin dikunci
  // 0, sama pola dengan EditProduksiModal di Data Produksi.
  const isManualMesin = form.mesin.trim().toLowerCase() === 'manual';

  async function save() {
    if (!form.line.trim() || !form.mesin.trim()) {
      showToast('Line dan Mesin wajib diisi', 'red');
      return;
    }
    setBusy(true);
    try {
      await apiSend('/produksi-harian-update', 'POST', {
        id: row.id,
        line: form.line,
        mesin: form.mesin,
        jenis_problem: form.jenisProblem || null,
        lost_time: form.lostTime,
        breakdown_mesin: form.breakdownMesin,
        keterangan: form.keterangan,
      }, logout);
      showToast('Data Kendala berhasil diperbarui', 'green');
      onSaved();
      onClose();
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }

  return createPortal(
    <div className="overlay show" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480, borderRadius: '14px 14px 0 0' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Edit Kendala — {row.partName}</div>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
          {formatDateID(row.tanggal)} · Cluster {row.cluster} · {row.proses}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Line Produksi">
              <Combobox style={editInp} value={form.line} options={lineOptions} onChange={(v) => set('line', v)} placeholder="Ketik atau pilih Line…" />
            </Field>
            <Field label="Mesin">
              <Combobox style={editInp} value={form.mesin} options={machinesRich} onChange={(v) => set('mesin', v)} placeholder="Ketik atau pilih Mesin…" />
              {!mesinLinked && (
                <div style={{ color: 'var(--yellow)', fontSize: 10.5, marginTop: 4 }}>
                  Belum terhubung ke Tabel Machine, boleh disimpan tetap.
                </div>
              )}
            </Field>
          </div>
          <Field label="Jenis Problem">
            <Combobox style={editInp} value={form.jenisProblem} options={JENIS_PROBLEM_OPTS} onChange={(v) => set('jenisProblem', v)} placeholder="Ketik atau pilih…" />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Loss Time (menit)">
              <input type="number" className="form-input" style={editInp} value={form.lostTime} onChange={(e) => set('lostTime', e.target.value)} />
            </Field>
            <Field label="Breakdown Mesin (menit)">
              <input
                type="number"
                className="form-input"
                style={isManualMesin ? { ...editInp, opacity: .6, cursor: 'not-allowed' } : editInp}
                value={isManualMesin ? 0 : form.breakdownMesin}
                disabled={isManualMesin}
                onChange={(e) => set('breakdownMesin', e.target.value)}
              />
              {isManualMesin && (
                <div style={{ color: 'var(--muted)', fontSize: 10.5, marginTop: 4 }}>Mesin "Manual" — Breakdown Mesin tidak berlaku.</div>
              )}
            </Field>
          </div>
          <Field label="Problem / Keterangan">
            <textarea className="form-input" style={{ ...editInp, minHeight: 70, resize: 'vertical' }} value={form.keterangan} onChange={(e) => set('keterangan', e.target.value)} />
          </Field>
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

// Jumlah baris per Cluster (total & belum lengkap) -- cuma masuk akal
// ditampilkan kalau clusterFilter = "Semua Cluster" (kalau sudah difilter
// ke satu Cluster, semua baris yang tampil ya dari Cluster itu saja).
function ClusterCountBars({ data }) {
  if (!data.length) return <div style={{ color: 'var(--muted)', fontSize: 12 }}>Belum ada data.</div>;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
      {data.map((d) => (
        <div key={d.cluster} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{d.cluster}</div>
          <div style={{ flex: 1, background: 'var(--s3)', borderRadius: 4, height: 16, overflow: 'hidden' }}>
            <div style={{ width: `${(d.count / max) * 100}%`, height: '100%', background: CLUSTER_COLORS[d.cluster] || 'var(--accent)', borderRadius: 4, transition: 'width .6s ease' }}></div>
          </div>
          <div style={{ width: 130, flexShrink: 0, textAlign: 'right', fontSize: 11.5, color: 'var(--text)' }}>
            <strong>{d.count}</strong> baris
            {d.incomplete > 0 && <span style={{ color: 'var(--red)' }}> · {d.incomplete} blm lengkap</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// Menu ini beda dari Problem Produksi (ProblemLogPage, berbasis tabel
// ProblemLog) -- baca LANGSUNG dari RC Harian Produksi (lihat
// getDowntimeAudit di backend) supaya baris yang datanya belum lengkap
// (mis. cuma Jenis Problem diisi tanpa Loss Time, atau sebaliknya) tetap
// kelihatan, tidak "hilang" cuma karena belum lengkap. Tujuannya justru
// menemukan baris begitu supaya bisa dibetulkan manual -- lihat kolom
// Kelengkapan.
export default function DowntimeProduksi() {
  const { logout } = useAuth();
  const [period, setPeriod] = useState('month');
  const [refDate, setRefDate] = useState(todayStr());
  const [clusterFilter, setClusterFilter] = useState('all');
  const [rows, setRows] = useState([]);
  const [jenisProblem, setJenisProblem] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editRow, setEditRow] = useState(null);
  const [master, setMaster] = useState({ proses: [] });
  const [machines, setMachines] = useState([]);

  const load = useCallback(() => {
    setLoading(true);
    const qs = `period=${period}&date=${refDate}${clusterFilter !== 'all' ? `&cluster=${clusterFilter}` : ''}`;
    Promise.all([
      apiFetch(`/downtime-audit?${qs}`, [], logout),
      apiFetch(`/jenis-problem-stats?${qs}`, [], logout),
    ]).then(([r, jp]) => {
      setRows(r);
      setJenisProblem(jp);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [period, refDate, clusterFilter, logout]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiFetch('/master', { proses: [] }, logout).then(setMaster);
    apiFetch('/machines', [], logout).then(setMachines);
  }, [logout]);

  const clusterLabel = clusterFilter === 'all' ? 'Semua Cluster' : `Cluster ${clusterFilter}`;

  const totalRows = rows.length;
  const incompleteRows = useMemo(() => rows.filter((r) => !r.isComplete), [rows]);
  const completePct = totalRows > 0 ? Math.round(((totalRows - incompleteRows.length) / totalRows) * 100) : 0;

  const byCluster = useMemo(() => {
    const map = {};
    for (const r of rows) {
      if (!map[r.cluster]) map[r.cluster] = { cluster: r.cluster, count: 0, incomplete: 0 };
      map[r.cluster].count++;
      if (!r.isComplete) map[r.cluster].incomplete++;
    }
    return CLUSTERS.map((c) => map[c]).filter(Boolean);
  }, [rows]);

  const { sorted: shown, sortKey, sortDir, toggleSort } = useSort(rows);

  return (
    <div className="page-view active">
      <div className="page-header">
        <div>
          <div className="page-title">Downtime Produksi</div>
          <div className="page-sub">Rekap Jenis Problem / Loss Time / Breakdown Mesin / Problem dari RC Harian Produksi — termasuk baris yang datanya belum lengkap.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={clusterFilter}
            onChange={(e) => setClusterFilter(e.target.value)}
            className="pp-select"
            style={{ height: 34 }}
          >
            <option value="all">Semua Cluster</option>
            {CLUSTERS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <PeriodPicker pill period={period} setPeriod={setPeriod} refDate={refDate} setRefDate={setRefDate} />
        </div>
      </div>

      <div className="row4" style={{ gridTemplateColumns: '0.85fr 0.85fr 1.3fr', marginBottom: 16, alignItems: 'stretch' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header"><div className="card-title">Kelengkapan Data {clusterLabel}</div></div>
          {loading ? (
            <SkeletonRows rows={3} />
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center', textAlign: 'center' }}>
              <div>
                <div style={{ fontSize: 34, fontWeight: 800, color: incompleteRows.length > 0 ? 'var(--red)' : 'var(--green)' }}>{completePct}%</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Baris Lengkap</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {totalRows.toLocaleString()} baris punya data Kendala, <strong style={{ color: incompleteRows.length > 0 ? 'var(--red)' : 'var(--text)' }}>{incompleteRows.length.toLocaleString()} belum lengkap</strong>.
              </div>
            </div>
          )}
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header"><div className="card-title">Jenis Problem {clusterLabel}</div></div>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SkeletonCircle size={MAIN_SIZE} />
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <JenisProblemChart data={jenisProblem} mainSize={MAIN_SIZE} miniSize={MINI_SIZE} />
            </div>
          )}
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header"><div className="card-title">Jumlah Baris per Cluster</div></div>
          {loading ? (
            <SkeletonRows rows={4} />
          ) : clusterFilter !== 'all' ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 12, textAlign: 'center' }}>
              Pilih "Semua Cluster" untuk bandingkan antar Cluster.
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              <ClusterCountBars data={byCluster} />
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Detail Baris {clusterLabel}</div>
          <div className="card-sub">{totalRows.toLocaleString()} baris</div>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 10 }}>
          Baris dengan kolom <strong>Kelengkapan</strong> berwarna merah berarti belum semua dari Jenis Problem/durasi (Loss Time atau Breakdown Mesin, cukup salah satu)/Problem terisi — klik ikon pensil untuk edit langsung di tempat, otomatis mengubah data di Data Produksi juga.
        </div>
        <div style={{ overflow: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <SortTh sortKeyName="tanggal" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Tanggal</SortTh>
                <SortTh sortKeyName="cluster" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Cluster</SortTh>
                <SortTh sortKeyName="line" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Line</SortTh>
                <SortTh sortKeyName="partName" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Part Name / Proses</SortTh>
                <SortTh sortKeyName="jenisProblem" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Jenis Problem</SortTh>
                <SortTh sortKeyName="lostTime" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Loss Time</SortTh>
                <SortTh sortKeyName="breakdownMesin" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Breakdown Mesin</SortTh>
                <SortTh sortKeyName="keterangan" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Problem</SortTh>
                <th style={th}>Kelengkapan</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ padding: '10px 16px' }}><Skeleton height={12} width="60%" /></td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={10} style={td}>Belum ada data Kendala untuk filter ini.</td></tr>
              ) : shown.map((r) => {
                // Loss Time & Breakdown Mesin dianggap satu sinyal (cukup
                // salah satu) -- kalau salah satunya sudah terisi, "—" di
                // kolom yang satunya lagi bukan masalah (netral), bukan
                // tanda kurang lengkap.
                const hasDuration = r.lostTime > 0 || r.breakdownMesin > 0;
                const durationColor = hasDuration ? 'var(--muted)' : 'var(--red)';
                return (
                  <tr key={r.id}>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{formatDateID(r.tanggal)}</td>
                    <td style={td}>{r.cluster}</td>
                    <td style={{ ...td, maxWidth: 100 }}><ZoomCell label="Line">{r.line || '—'}</ZoomCell></td>
                    <td style={{ ...td, maxWidth: 160 }}><ZoomCell label="Part Name / Proses">{`${r.partName} — ${r.proses}`}</ZoomCell></td>
                    <td style={td}>{r.jenisProblem || <span style={{ color: 'var(--red)' }}>—</span>}</td>
                    <td style={td}>{r.lostTime > 0 ? `${r.lostTime} menit` : <span style={{ color: durationColor }}>—</span>}</td>
                    <td style={td}>{r.breakdownMesin > 0 ? `${r.breakdownMesin} menit` : <span style={{ color: durationColor }}>—</span>}</td>
                    <td style={{ ...td, maxWidth: 160 }}>
                      {r.keterangan ? <ZoomCell label="Problem">{r.keterangan}</ZoomCell> : <span style={{ color: 'var(--red)' }}>—</span>}
                    </td>
                    <td style={td}>
                      {r.isComplete ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--green)', fontWeight: 700, fontSize: 11.5 }}>Lengkap</span>
                      ) : (
                        <span
                          title={`Belum diisi: ${r.missingFields.join(', ')}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--red)', fontWeight: 700, fontSize: 11.5, cursor: 'help' }}
                        >
                          <AlertOctagon size={12} /> {r.missingFields.length} belum diisi
                        </span>
                      )}
                    </td>
                    <td style={td}>
                      <button onClick={() => setEditRow(r)} style={iconBtn} title="Edit Kendala baris ini">
                        <Pencil size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editRow && (
        <EditKendalaModal row={editRow} logout={logout} master={master} machines={machines} onClose={() => setEditRow(null)} onSaved={load} />
      )}
    </div>
  );
}

const th = { padding: '8px 10px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--muted)', textAlign: 'left', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap' };
const td = { padding: '8px 10px', fontSize: 12.5, borderBottom: '1px solid var(--border)', color: 'var(--text)' };
const iconBtn = { background: 'none', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', color: 'var(--text)', padding: 4, display: 'flex' };
const editInp = { padding: '7px 10px', fontSize: 12.5 };
