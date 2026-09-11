import Skeleton from '../components/ui/Skeleton.jsx';
import TableSkeleton from '../components/ui/TableSkeleton.jsx';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useUI } from '../contexts/UIContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { fetchOeeBreakdown, fetchOeeTrend } from '../services/produksiService.js';
import MiniRing from '../components/charts/MiniRing.jsx';
import LineTrendChart from '../components/charts/LineTrendChart.jsx';
import { CLUSTER_COLORS } from '../components/charts/ClusterBarList.jsx';
import HorizontalBarList from '../components/charts/HorizontalBarList.jsx';
import JenisProblemChart from '../components/charts/JenisProblemChart.jsx';
import PeriodPicker from '../components/maintenance/PeriodPicker.jsx';
import SortTh from '../components/ui/SortTh.jsx';
import { useSort } from '../hooks/useSort.js';

const MAIN_SIZE = 200;
const MINI_SIZE = 62;
const OEE_OK_THRESHOLD = 85; // di bawah ini ring diwarnai merah, sama pola dengan AR_OK_THRESHOLD di ARDetail
const CLUSTERS = ['AD', 'BC', 'EF', 'FI'];

// Warna breakdown OEE loss -- beda dari JENIS_COLORS bawaan JenisProblemChart
// (dipakai buat Jenis Problem), supaya tidak ketuker maknanya. OEE (hijau,
// "hasil baik") sengaja paling menonjol, tiga loss lainnya nada merah/oranye
// makin gelap sesuai urutan waterfall standar OEE (Availability -> Performance
// -> Quality).
const OEE_LOSS_COLORS = {
  OEE: '#0e8c3f',
  'Loss Availability': '#c0392b',
  'Loss Performance': '#e08a3c',
  'Loss Quality': '#e0b400',
};

function todayStr() { return new Date().toISOString().slice(0, 10); }

export default function OEEDetail() {
  const { navigate } = useUI();
  const { logout } = useAuth();

  const [period, setPeriod] = useState('today');
  const [refDate, setRefDate] = useState(todayStr());
  const [clusterFilter, setClusterFilter] = useState('all');

  const [byCluster, setByCluster] = useState([]);
  const [byLine, setByLine]       = useState([]);
  const [trend, setTrend]         = useState([]);
  const [summary, setSummary]     = useState({ availability: 0, performance: 0, yield: 0, oee: 0 });
  const [loading, setLoading]     = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const qs = `period=${period}&date=${refDate}${clusterFilter !== 'all' ? `&cluster=${clusterFilter}` : ''}`;
    Promise.all([
      fetchOeeBreakdown(qs, { overall: { avb: 0, perf: 0, yield: 0, oee: 0 }, byCluster: [], byLine: [] }, logout),
      fetchOeeTrend(qs, [], logout),
    ]).then(([b, t]) => {
      setByCluster(b.byCluster);
      setByLine(b.byLine);
      setTrend(t);
      // Field summary di sini dulu {availability, performance, yield, oee}
      // dari /produksi-harian-summary -- oee-breakdown.overall punya nama
      // field yang beda (avb/perf/yield/oee, sama dengan aggregateOee() di
      // backend), dipetakan di sini supaya lossBreakdown & JSX di bawah
      // (yang sudah pakai nama summary.availability dst) tidak perlu ikut
      // diubah.
      setSummary({ availability: b.overall.avb, performance: b.overall.perf, yield: b.overall.yield, oee: b.overall.oee });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [period, refDate, clusterFilter, logout]);

  useEffect(() => { load(); }, [load]);

  const avgOee = byCluster.length ? Number((byCluster.reduce((s, c) => s + c.oee, 0) / byCluster.length).toFixed(1)) : 0;
  const trendWithTarget = useMemo(() => trend.map((d) => ({ ...d, target: 85 })), [trend]);

  // Waterfall OEE standar: dari 100% Waktu Efektif, berkurang bertahap oleh
  // Availability Loss -> Performance Loss -> Quality Loss, sisanya OEE.
  // Keempatnya WAJIB dijumlah 100 (lihat komentar di sisi backend
  // aggregateOee) supaya donut chart-nya utuh 1 lingkaran penuh.
  const lossBreakdown = useMemo(() => {
    const { availability: avb, performance: perf, yield: yld, oee } = summary;
    const afterAvb = avb;
    const afterPerf = avb * perf / 100;
    const afterYield = avb * perf * yld / 10000;
    const lossAvb = Math.max(0, 100 - afterAvb);
    const lossPerf = Math.max(0, afterAvb - afterPerf);
    const lossYield = Math.max(0, afterPerf - afterYield);
    const total = oee + lossAvb + lossPerf + lossYield;
    if (total <= 0) return [];
    const mk = (jenis, value) => ({ jenis, count: Number(value.toFixed(1)), pct: Number(((value / total) * 100).toFixed(1)) });
    return [mk('OEE', oee), mk('Loss Availability', lossAvb), mk('Loss Performance', lossPerf), mk('Loss Quality', lossYield)]
      .filter((d) => d.pct > 0);
  }, [summary]);

  const top5 = byLine.slice(0, 5);
  const bottom5 = [...byLine].reverse().slice(0, 5);

  const { sorted: sortedCluster, sortKey: clSortKey, sortDir: clSortDir, toggleSort: toggleClSort } = useSort(byCluster);

  return (
    <div className="page-view active">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn-icon" onClick={() => navigate('dashboard')} title="Kembali">
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="page-title">Detail OEE — Overall Equipment Effectiveness</div>
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
          <div className="card-header"><div className="card-title">OEE Cluster</div></div>
          {loading ? (
            <Skeleton width="100%" height={160} radius={8} />
          ) : byCluster.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Belum ada data.</div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <MiniRing value={avgOee} size={MAIN_SIZE} color={avgOee < OEE_OK_THRESHOLD ? 'var(--red)' : 'var(--accent)'} showInsideText />
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Rata-rata</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'space-between' }}>
                {byCluster.map((c) => (
                  <MiniRing key={c.cluster} label={c.cluster} value={c.oee} size={MINI_SIZE} color={c.oee < OEE_OK_THRESHOLD ? 'var(--red)' : (CLUSTER_COLORS[c.cluster] || 'var(--accent)')} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header"><div className="card-title">Breakdown OEE</div></div>
          {loading ? (
            <Skeleton width="100%" height={160} radius={8} />
          ) : lossBreakdown.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Belum ada data.</div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <JenisProblemChart data={lossBreakdown} mainSize={MAIN_SIZE} miniSize={MINI_SIZE} colors={OEE_LOSS_COLORS} countLabel={null} />
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Tren OEE</div>
          </div>
          <LineTrendChart
            title=""
            data={trendWithTarget}
            valueKey="oee"
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
            <div className="card-header"><div className="card-title">5 Line Produksi OEE Tertinggi</div></div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <HorizontalBarList data={top5} mode="good" valueKey="oee" />
            </div>
          </div>
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="card-header"><div className="card-title">5 Line Produksi OEE Terendah</div></div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <HorizontalBarList data={bottom5} mode="bad" valueKey="oee" />
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header"><div className="card-title">Tabel AVB / PERF / YIELD / OEE per Cluster</div></div>
          {loading ? (
            <TableSkeleton rows={5} columns={5} />
          ) : byCluster.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Belum ada data.</div>
          ) : (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <SortTh sortKeyName="cluster" sortKey={clSortKey} sortDir={clSortDir} onSort={toggleClSort} style={{ borderBottom: '2px solid var(--border)' }}>Cluster</SortTh>
                    <SortTh sortKeyName="avb" sortKey={clSortKey} sortDir={clSortDir} onSort={toggleClSort} style={{ borderBottom: '2px solid var(--border)' }}>Availability</SortTh>
                    <SortTh sortKeyName="perf" sortKey={clSortKey} sortDir={clSortDir} onSort={toggleClSort} style={{ borderBottom: '2px solid var(--border)' }}>Performance</SortTh>
                    <SortTh sortKeyName="yield" sortKey={clSortKey} sortDir={clSortDir} onSort={toggleClSort} style={{ borderBottom: '2px solid var(--border)' }}>Yield</SortTh>
                    <SortTh sortKeyName="oee" sortKey={clSortKey} sortDir={clSortDir} onSort={toggleClSort} style={{ borderBottom: '2px solid var(--border)' }}>OEE</SortTh>
                  </tr>
                </thead>
                <tbody>
                  {sortedCluster.map((c) => (
                    <tr key={c.cluster}>
                      <td style={oeeTd}><strong>{c.cluster}</strong></td>
                      <td style={oeeTd}>{c.avb}%</td>
                      <td style={oeeTd}>{c.perf}%</td>
                      <td style={oeeTd}>{c.yield}%</td>
                      <td style={{ ...oeeTd, fontWeight: 700, color: c.oee < OEE_OK_THRESHOLD ? 'var(--red)' : 'var(--accent)' }}>{c.oee}%</td>
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

const oeeTd = { padding: '8px 10px', fontSize: 12.5, borderBottom: '1px solid var(--border)', color: 'var(--text)' };