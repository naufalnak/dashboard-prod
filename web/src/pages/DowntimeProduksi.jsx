import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, AlertOctagon } from 'lucide-react';
import { useUI } from '../contexts/UIContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { fetchDowntimeAudit, fetchArBreakdown } from '../services/produksiService.js';
import JenisProblemChart from '../components/charts/JenisProblemChart.jsx';
import PeriodPicker from '../components/maintenance/PeriodPicker.jsx';
import SortTh from '../components/ui/SortTh.jsx';
import ZoomCell from '../components/ui/ZoomCell.jsx';
import TableSkeleton from '../components/ui/TableSkeleton.jsx';
import { useSort } from '../hooks/useSort.js';

const CLUSTERS = ['AD', 'BC', 'EF', 'FI'];

function todayStr() { return new Date().toISOString().slice(0, 10); }

// Halaman "Downtime Produksi" -- rekap semua baris RC Harian Produksi yang
// punya sinyal downtime (Jenis Problem/Loss Time/Breakdown Mesin/
// Keterangan), termasuk baris yang datanya BELUM LENGKAP (mis. Jenis
// Problem terisi tapi durasinya belum) supaya gampang dicari & dibetulkan.
// Beda dari menu Problem & Root Cause (ProblemLogPage) yang berbasis tabel
// Problem Log tersendiri -- ini baca langsung dari ProduksiHarian. Lihat
// catatan lengkap di backend: produksi.service.js#getDowntimeAudit.
export default function DowntimeProduksi() {
  const { navigate } = useUI();
  const { logout } = useAuth();

  const [period, setPeriod] = useState('today');
  const [refDate, setRefDate] = useState(todayStr());
  const [clusterFilter, setClusterFilter] = useState('all');
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);

  const [rows, setRows] = useState([]);
  const [jenisProblem, setJenisProblem] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const qs = `period=${period}&date=${refDate}${clusterFilter !== 'all' ? `&cluster=${clusterFilter}` : ''}`;
    Promise.all([
      fetchDowntimeAudit(qs, [], logout),
      fetchArBreakdown(qs, { byCluster: [], byLine: [], jenisProblem: [] }, logout),
    ]).then(([auditRows, breakdown]) => {
      setRows(auditRows);
      setJenisProblem(breakdown.jenisProblem);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [period, refDate, clusterFilter, logout]);

  useEffect(() => { load(); }, [load]);

  const shown = onlyIncomplete ? rows.filter((r) => !r.isComplete) : rows;
  const { sorted, sortKey, sortDir, toggleSort } = useSort(shown);
  const incompleteCount = rows.filter((r) => !r.isComplete).length;

  const th = { padding: '8px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '2px solid var(--border)' };
  const td = { padding: '8px 10px', fontSize: 12.5, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };

  return (
    <div className="page-view active">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn-icon" onClick={() => navigate('dashboard')} title="Kembali">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1>Downtime Produksi</h1>
            <div className="page-subtitle">Audit baris RC Harian Produksi dengan sinyal downtime, termasuk yang datanya belum lengkap.</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <select className="form-input" value={clusterFilter} onChange={(e) => setClusterFilter(e.target.value)} style={{ padding: '6px 10px', fontSize: 12.5 }}>
            <option value="all">Semua Cluster</option>
            {CLUSTERS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <PeriodPicker period={period} setPeriod={setPeriod} refDate={refDate} setRefDate={setRefDate} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Jenis Problem (4M+1E + Setting &amp; Tool)</div>
        <JenisProblemChart data={jenisProblem} mainSize={180} miniSize={56} />
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Daftar Baris Downtime ({shown.length})</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--muted)', cursor: 'pointer' }}>
            <input type="checkbox" checked={onlyIncomplete} onChange={(e) => setOnlyIncomplete(e.target.checked)} />
            Tampilkan cuma yang belum lengkap ({incompleteCount})
          </label>
        </div>

        {loading ? (
          <TableSkeleton rows={6} columns={9} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <SortTh sortKeyName="tanggal" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Tanggal</SortTh>
                  <SortTh sortKeyName="cluster" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Cluster</SortTh>
                  <SortTh sortKeyName="line" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Line</SortTh>
                  <SortTh sortKeyName="mesin" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Mesin</SortTh>
                  <SortTh sortKeyName="partName" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Part Name</SortTh>
                  <SortTh sortKeyName="jenisProblem" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Jenis Problem</SortTh>
                  <th style={th}>Loss Time / Breakdown</th>
                  <th style={th}>Keterangan</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 && (
                  <tr><td colSpan={9} style={td}>Tidak ada baris downtime untuk periode ini.</td></tr>
                )}
                {sorted.map((r) => (
                  <tr key={r.id} style={{ background: r.isComplete ? undefined : 'color-mix(in srgb, var(--red) 6%, transparent)' }}>
                    <td style={td}>{r.tanggal}</td>
                    <td style={td}>{r.cluster}</td>
                    <td style={td}>{r.line}</td>
                    <td style={td}>{r.mesin}</td>
                    <td style={td}><ZoomCell label="Part Name">{r.partName}</ZoomCell></td>
                    <td style={td}>{r.jenisProblem || '—'}</td>
                    <td style={td}>{r.lostTime > 0 || r.breakdownMesin > 0 ? `${r.lostTime}m / ${r.breakdownMesin}m` : '—'}</td>
                    <td style={td}><ZoomCell label="Keterangan">{r.keterangan}</ZoomCell></td>
                    <td style={td}>
                      {r.isComplete ? (
                        <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: 11.5 }}>Lengkap</span>
                      ) : (
                        <span title={r.missingFields.join(', ')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--red)', fontWeight: 700, fontSize: 11.5, cursor: 'help' }}>
                          <AlertOctagon size={12} /> Belum lengkap
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
