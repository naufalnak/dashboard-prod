import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useUI } from '../contexts/UIContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { apiFetch } from '../api.js';
import MiniRing from '../components/MiniRing.jsx';
import LineTrendChart from '../components/charts/LineTrendChart.jsx';
import { CLUSTER_COLORS } from '../components/ClusterBarList.jsx';
import HorizontalBarList from '../components/HorizontalBarList.jsx';
import JenisProblemChart from '../components/charts/JenisProblemChart.jsx';
import PeriodPicker from '../components/PeriodPicker.jsx';
import SortTh from '../components/SortTh.jsx';
import { SkeletonCircle, SkeletonBlock, SkeletonRows } from '../components/Skeleton.jsx';
import { useSort } from '../useSort.js';

// Diperkecil dari 200/62 -- sama pola dengan ARDetail.jsx: kartu OEE &
// Breakdown OEE sekarang disamakan tinggi alaminya dengan "5 Line
// Produksi OEE Tertinggi" (lihat baris row4 di bawah), donut yang lebih
// kecil ini muat tanpa bikin kartunya jadi lebih tinggi dari yang dituju.
const MAIN_SIZE = 150;
const MINI_SIZE = 48;
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
      apiFetch(`/oee-by-cluster?${qs}`, [], logout),
      apiFetch(`/oee-by-line?${qs}`, [], logout),
      apiFetch(`/oee-trend?${qs}`, [], logout),
      apiFetch(`/produksi-harian-summary?${qs}`, {}, logout),
    ]).then(([c, l, t, s]) => {
      setByCluster(c);
      setByLine(l);
      setTrend(t);
      setSummary(s);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [period, refDate, clusterFilter, logout]);

  useEffect(() => { load(); }, [load]);

  // Sub-judul kartu ikut filter Cluster yang aktif -- "OEE Cluster" jadi
  // "OEE Cluster AD" kalau Cluster dipilih, "OEE Semua Cluster" kalau
  // tidak. Sama pola dengan ARDetail.
  const clusterLabel = clusterFilter === 'all' ? 'Semua Cluster' : `Cluster ${clusterFilter}`;

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

      {/* OEE & Breakdown OEE -- dipisah dari Tren OEE (dulu satu baris
          bertiga dengan alignItems:'stretch'), disamakan tinggi alaminya
          dengan "5 Line Produksi OEE Tertinggi" di baris bawah, sama
          pola dengan ARDetail.jsx. */}
      <div className="row4" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 16, alignItems: 'stretch' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header"><div className="card-title">OEE {clusterLabel}</div></div>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
              <SkeletonCircle size={MAIN_SIZE} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[0, 1, 2, 3].map((i) => <SkeletonCircle key={i} size={MINI_SIZE} />)}
              </div>
            </div>
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
          <div className="card-header"><div className="card-title">Breakdown OEE {clusterLabel}</div></div>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SkeletonCircle size={MAIN_SIZE} />
            </div>
          ) : lossBreakdown.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Belum ada data.</div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <JenisProblemChart data={lossBreakdown} mainSize={MAIN_SIZE} miniSize={MINI_SIZE} colors={OEE_LOSS_COLORS} countLabel={null} />
            </div>
          )}
        </div>

      </div>

      {/* Tren OEE -- baris sendiri, lebar penuh, sama pola dengan
          ARDetail.jsx (blok grafik lebih lega + label nilai per bar dapat
          ruang cukup). */}
      <div className="row4" style={{ gridTemplateColumns: '1fr', marginBottom: 16 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div className="card-title">Tren OEE {clusterLabel}</div>
          </div>
          {loading ? (
            <SkeletonBlock height={220} />
          ) : (
            <LineTrendChart
              bare
              data={trendWithTarget}
              valueKey="oee"
              targetKey="target"
              color="var(--accent)"
              unit="%"
              showMovingAvg
              movingAvgColor="var(--blue)"
              targetColor="var(--red)"
            />
          )}
        </div>
      </div>

      <div className="row4" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 16, alignItems: 'stretch' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="card-header"><div className="card-title">5 Line Produksi OEE Tertinggi — {clusterLabel}</div></div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {loading ? <SkeletonRows rows={5} /> : <HorizontalBarList data={top5} mode="good" valueKey="oee" />}
            </div>
          </div>
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="card-header"><div className="card-title">5 Line Produksi OEE Terendah — {clusterLabel}</div></div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {loading ? <SkeletonRows rows={5} /> : <HorizontalBarList data={bottom5} mode="bad" valueKey="oee" />}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header"><div className="card-title">Tabel AVB / PERF / YIELD / OEE per {clusterLabel}</div></div>
          {loading ? (
            <SkeletonRows rows={4} />
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
