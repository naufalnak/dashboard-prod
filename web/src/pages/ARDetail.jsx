import Skeleton from '../components/ui/Skeleton.jsx';
import TableSkeleton from '../components/ui/TableSkeleton.jsx';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useUI } from '../contexts/UIContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { fetchArBreakdown, fetchArTrend } from '../services/produksiService.js';
import { fetchProblemLog } from '../services/problemLogService.js';
import MiniRing from '../components/charts/MiniRing.jsx';
import LineTrendChart from '../components/charts/LineTrendChart.jsx';
import { CLUSTER_COLORS } from '../components/charts/ClusterBarList.jsx';
import HorizontalBarList from '../components/charts/HorizontalBarList.jsx';
import JenisProblemChart from '../components/charts/JenisProblemChart.jsx';
import PeriodPicker from '../components/maintenance/PeriodPicker.jsx';
import SortTh from '../components/ui/SortTh.jsx';
import ZoomCell from '../components/ui/ZoomCell.jsx';
import { useSort } from '../hooks/useSort.js';
import { formatDateID } from '../dateFmt.js';

const MAIN_SIZE = 200;
const MINI_SIZE = 62;
const AR_OK_THRESHOLD = 90; // di bawah ini ring diwarnai merah -- sinyal "kurang baik"
const CLUSTERS = ['AD', 'BC', 'EF', 'FI'];

const STATUS_LABEL = { open: 'Open', in_progress: 'In Progress', closed: 'Closed' };
const STATUS_COLOR = { open: 'var(--red)', in_progress: 'var(--yellow)', closed: 'var(--green)' };

function todayStr() { return new Date().toISOString().slice(0, 10); }

export default function ARDetail() {
  const { navigate } = useUI();
  const { logout } = useAuth();

  // Satu filter periode dipakai bersama oleh AR Cluster, Tren AR, dan
  // Top5/Bottom5 Line -- sebelumnya Tren AR punya PeriodPicker sendiri
  // sementara AR Cluster & Top5/Bottom5 diam-diam terkunci ke bulan
  // berjalan, jadi filter di Tren AR kelihatan tidak berpengaruh ke
  // widget lain.
  const [period, setPeriod] = useState('today');
  const [refDate, setRefDate] = useState(todayStr());
  const [clusterFilter, setClusterFilter] = useState('all');

  const [byCluster, setByCluster]     = useState([]);
  const [byLine, setByLine]           = useState([]);
  const [trend, setTrend]             = useState([]);
  const [problems, setProblems]       = useState([]);
  const [jenisProblem, setJenisProblem] = useState([]);
  const [loading, setLoading]         = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const qs = `period=${period}&date=${refDate}${clusterFilter !== 'all' ? `&cluster=${clusterFilter}` : ''}`;
    // Problem & Root Cause Log TIDAK ikut filter tanggal PeriodPicker --
    // panel ini selalu menampilkan semua problem (diprioritaskan status
    // Open + tanggal terbaru di atas, lihat GET /problem-log), supaya
    // isu yang masih terbuka tidak "hilang" cuma karena tanggalnya beda
    // dari yang sedang difilter di widget lain.
    Promise.all([
      fetchArBreakdown(qs, { byCluster: [], byLine: [], jenisProblem: [] }, logout),
      fetchArTrend(qs, [], logout),
      fetchProblemLog('', [], logout),
    ]).then(([b, t, p]) => {
      setByCluster(b.byCluster);
      setByLine(b.byLine);
      setTrend(t);
      setProblems(p.rows || []);
      setJenisProblem(b.jenisProblem);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [period, refDate, clusterFilter, logout]);

  useEffect(() => { load(); }, [load]);

  const avgAr = byCluster.length ? Number((byCluster.reduce((s, c) => s + c.ar, 0) / byCluster.length).toFixed(1)) : 0;
  const trendWithTarget = useMemo(() => trend.map((d) => ({ ...d, target: 100 })), [trend]);

  const top5 = byLine.slice(0, 5);
  const bottom5 = [...byLine].reverse().slice(0, 5);

  const problemsView = problems.slice(0, 8);
  const { sorted: sortedProblems, sortKey: probSortKey, sortDir: probSortDir, toggleSort: toggleProbSort } = useSort(problemsView);

  return (
    <div className="page-view active">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn-icon" onClick={() => navigate('dashboard')} title="Kembali">
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="page-title">Detail AR — Achievement Rate</div>
          </div>
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

      <div className="row4" style={{ gridTemplateColumns: '0.95fr 0.95fr 1.3fr', marginBottom: 16, alignItems: 'stretch' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header"><div className="card-title">AR Cluster</div></div>
          {loading ? (
            <Skeleton width="100%" height={160} radius={8} />
          ) : byCluster.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Belum ada data.</div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <MiniRing value={avgAr} size={MAIN_SIZE} color={avgAr < AR_OK_THRESHOLD ? 'var(--red)' : 'var(--accent)'} showInsideText />
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Rata-rata</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'space-between' }}>
                {byCluster.map((c) => (
                  <MiniRing key={c.cluster} label={c.cluster} value={c.ar} size={MINI_SIZE} color={c.ar < AR_OK_THRESHOLD ? 'var(--red)' : (CLUSTER_COLORS[c.cluster] || 'var(--accent)')} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header"><div className="card-title">Jenis Problem</div></div>
          {loading ? (
            <Skeleton width="100%" height={160} radius={8} />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <JenisProblemChart data={jenisProblem} mainSize={MAIN_SIZE} miniSize={MINI_SIZE} />
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Tren AR</div>
          </div>
          <LineTrendChart
            title=""
            data={trendWithTarget}
            valueKey="ar"
            targetKey="target"
            color="#0e5a52"
            unit="%"
            showMovingAvg
            movingAvgColor="var(--blue)"
            targetColor="var(--red)"
          />
        </div>
      </div>

      <div className="row4" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 16, alignItems: 'stretch' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="card-header"><div className="card-title">5 Line Produksi AR Tertinggi</div></div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <HorizontalBarList data={top5} mode="good" />
            </div>
          </div>
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="card-header"><div className="card-title">5 Line Produksi AR Terendah</div></div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <HorizontalBarList data={bottom5} mode="bad" />
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div className="card-title">Problem Produksi</div>
            <button className="card-action" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => navigate('problemlog')}>
              Lihat Semua <ChevronRight size={12} />
            </button>
          </div>
          {loading ? (
            <TableSkeleton rows={5} columns={7} />
          ) : problems.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Belum ada data.</div>
          ) : (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <SortTh sortKeyName="tanggal" sortKey={probSortKey} sortDir={probSortDir} onSort={toggleProbSort} style={{ borderBottom: '2px solid var(--border)' }}>Tanggal</SortTh>
                    <SortTh sortKeyName="line" sortKey={probSortKey} sortDir={probSortDir} onSort={toggleProbSort} style={{ borderBottom: '2px solid var(--border)' }}>Line Produksi</SortTh>
                    <SortTh sortKeyName="partName" sortKey={probSortKey} sortDir={probSortDir} onSort={toggleProbSort} style={{ borderBottom: '2px solid var(--border)' }}>Part Name</SortTh>
                    <SortTh sortKeyName="problem" sortKey={probSortKey} sortDir={probSortDir} onSort={toggleProbSort} style={{ borderBottom: '2px solid var(--border)' }}>Problem</SortTh>
                    <SortTh sortKeyName="jenisProblem" sortKey={probSortKey} sortDir={probSortDir} onSort={toggleProbSort} style={{ borderBottom: '2px solid var(--border)' }}>Jenis Problem</SortTh>
                    <SortTh sortKeyName="rootCause" sortKey={probSortKey} sortDir={probSortDir} onSort={toggleProbSort} style={{ borderBottom: '2px solid var(--border)' }}>Root Cause</SortTh>
                    <SortTh sortKeyName="status" sortKey={probSortKey} sortDir={probSortDir} onSort={toggleProbSort} style={{ borderBottom: '2px solid var(--border)' }}>Status</SortTh>
                  </tr>
                </thead>
                <tbody>
                  {sortedProblems.map((p) => (
                    <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate('problemlog')}>
                      <td style={{ ...prTd, whiteSpace: 'nowrap' }}>{formatDateID(p.tanggal)}</td>
                      <td style={{ ...prTd, maxWidth: 95 }}><ZoomCell label="Line Produksi">{p.line || '—'}</ZoomCell></td>
                      <td style={{ ...prTd, maxWidth: 110 }}><ZoomCell label="Part Name">{p.partName || '—'}</ZoomCell></td>
                      <td style={{ ...prTd, maxWidth: 130 }}><ZoomCell label="Problem">{p.problem}</ZoomCell></td>
                      <td style={{ ...prTd, maxWidth: 110 }}><ZoomCell label="Jenis Problem">{p.jenisProblem || '—'}</ZoomCell></td>
                      <td style={{ ...prTd, maxWidth: 130 }}><ZoomCell label="Root Cause">{p.rootCause || '—'}</ZoomCell></td>
                      <td style={{ ...prTd, whiteSpace: 'nowrap' }}>
                        <span style={{ color: STATUS_COLOR[p.status] || 'var(--muted)', fontWeight: 700 }}>{STATUS_LABEL[p.status] || p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const prTd = { padding: '8px 10px', fontSize: 12.5, borderBottom: '1px solid var(--border)', color: 'var(--text)' };