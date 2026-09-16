import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useUI } from '../contexts/UIContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { apiFetch } from '../api.js';
import MiniRing from '../components/MiniRing.jsx';
import LineTrendChart from '../components/charts/LineTrendChart.jsx';
import { CLUSTER_COLORS } from '../components/ClusterBarList.jsx';
import HorizontalBarList from '../components/HorizontalBarList.jsx';
import KriteriaNgChart from '../components/charts/KriteriaNgChart.jsx';
import PeriodPicker from '../components/PeriodPicker.jsx';
import ZoomCell from '../components/ZoomCell.jsx';
import { SkeletonCircle, SkeletonBlock, SkeletonRows } from '../components/Skeleton.jsx';
import { formatDateID } from '../dateFmt.js';

// Diperkecil dari 200/62 -- sama pola dengan ARDetail.jsx: kartu
// Rejection & Kriteria NG sekarang disamakan tinggi alaminya dengan
// "5 Part Name Reject Tertinggi" (lihat baris row4 di bawah), donut
// yang lebih kecil ini muat tanpa bikin kartunya jadi lebih tinggi dari
// yang dituju.
const MAIN_SIZE = 150;
const MINI_SIZE = 48;
const REJECTION_TARGET = 5; // %, semakin rendah semakin baik -- di atas ini ring diwarnai merah
const CLUSTERS = ['AD', 'BC', 'EF', 'FI'];

function todayStr() { return new Date().toISOString().slice(0, 10); }

// Halaman detail Rejection -- sumber datanya RejectionEntry (menu Input
// Rejection), yang dimensinya beda dari ProduksiHarian: cuma Cluster +
// Part Name (tidak ada Line), jadi ranking-nya per Part Name (bukan per
// Line seperti Detail AR), dan donut-nya Kriteria NG (bukan Jenis
// Problem). Rejection semakin RENDAH semakin baik, jadi warna baik/buruk
// dan urutan Tertinggi/Terendah pada ranking Part Name sengaja dibalik
// dari versi AR.
export default function RejectionDetail() {
  const { navigate } = useUI();
  const { logout } = useAuth();

  const [period, setPeriod] = useState('today');
  const [refDate, setRefDate] = useState(todayStr());
  const [clusterFilter, setClusterFilter] = useState('all');

  const [byCluster, setByCluster]   = useState([]);
  const [byPartName, setByPartName] = useState([]);
  const [trend, setTrend]           = useState([]);
  const [kriteriaNg, setKriteriaNg] = useState([]);
  const [recent, setRecent]         = useState([]);
  const [loading, setLoading]       = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const qs = `period=${period}&date=${refDate}${clusterFilter !== 'all' ? `&cluster=${clusterFilter}` : ''}`;
    Promise.all([
      apiFetch(`/rejection-by-cluster?${qs}`, [], logout),
      apiFetch(`/rejection-by-partname?${qs}`, [], logout),
      apiFetch(`/rejection-trend?${qs}`, [], logout),
      apiFetch(`/kriteria-ng-stats?${qs}`, [], logout),
      apiFetch(`/rejection-entries?${qs}`, [], logout),
    ]).then(([c, p, t, k, r]) => {
      setByCluster(c);
      setByPartName(p);
      setTrend(t);
      setKriteriaNg(k);
      setRecent(r);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [period, refDate, clusterFilter, logout]);

  useEffect(() => { load(); }, [load]);

  // Sub-judul kartu ikut filter Cluster yang aktif, sama pola dengan
  // ARDetail/OEEDetail.
  const clusterLabel = clusterFilter === 'all' ? 'Semua Cluster' : `Cluster ${clusterFilter}`;

  const avgRejection = byCluster.length ? Number((byCluster.reduce((s, c) => s + c.rejection, 0) / byCluster.length).toFixed(1)) : 0;
  const trendWithTarget = useMemo(() => trend.map((d) => ({ ...d, target: REJECTION_TARGET })), [trend]);

  // byPartName sudah terurut turun (tertinggi dulu) dari backend.
  const highest5 = byPartName.slice(0, 5);
  const lowest5 = [...byPartName].reverse().slice(0, 5);

  const recentView = useMemo(
    () => (clusterFilter === 'all' ? recent : recent.filter((r) => r.cluster === clusterFilter)).slice(0, 8),
    [recent, clusterFilter],
  );

  return (
    <div className="page-view active">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn-icon" onClick={() => navigate('dashboard')} title="Kembali">
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="page-title">Detail Rejection</div>
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
          <PeriodPicker weekly pill period={period} setPeriod={setPeriod} refDate={refDate} setRefDate={setRefDate} />
        </div>
      </div>

      {/* Rejection & Kriteria NG -- dipisah dari Tren Rejection (dulu satu
          baris bertiga dengan alignItems:'stretch'), disamakan tinggi
          alaminya dengan "5 Part Name Reject Tertinggi" di baris bawah,
          sama pola dengan ARDetail.jsx. */}
      <div className="row4" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 16, alignItems: 'stretch' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header"><div className="card-title">Rejection {clusterLabel}</div></div>
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
                <MiniRing value={avgRejection} size={MAIN_SIZE} color={avgRejection > REJECTION_TARGET ? 'var(--red)' : 'var(--accent)'} showInsideText />
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Rata-rata</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'space-between' }}>
                {byCluster.map((c) => (
                  <MiniRing key={c.cluster} label={c.cluster} value={c.rejection} size={MINI_SIZE} color={c.rejection > REJECTION_TARGET ? 'var(--red)' : (CLUSTER_COLORS[c.cluster] || 'var(--accent)')} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header"><div className="card-title">Kriteria NG {clusterLabel}</div></div>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SkeletonCircle size={MAIN_SIZE} />
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <KriteriaNgChart data={kriteriaNg} mainSize={MAIN_SIZE} miniSize={MINI_SIZE} />
            </div>
          )}
        </div>

      </div>

      {/* Tren Rejection -- baris sendiri, lebar penuh, sama pola dengan
          ARDetail.jsx (blok grafik lebih lega + label nilai per bar dapat
          ruang cukup). */}
      <div className="row4" style={{ gridTemplateColumns: '1fr', marginBottom: 16 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div className="card-title">Tren Rejection {clusterLabel}</div>
          </div>
          {loading ? (
            <SkeletonBlock height={220} />
          ) : (
            <LineTrendChart
              bare
              data={trendWithTarget}
              valueKey="rejection"
              targetKey="target"
              color="var(--red)"
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
            <div className="card-header"><div className="card-title">5 Part Name Reject Tertinggi — {clusterLabel}</div></div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {loading ? <SkeletonRows rows={5} /> : <HorizontalBarList data={highest5} mode="bad" valueKey="rejection" />}
            </div>
          </div>
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="card-header"><div className="card-title">5 Part Name Reject Terendah — {clusterLabel}</div></div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {loading ? <SkeletonRows rows={5} /> : <HorizontalBarList data={lowest5} mode="good" valueKey="rejection" />}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div className="card-title">Data Rejection Terbaru — {clusterLabel}</div>
            <button className="card-action" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => navigate('datarejection')}>
              Lihat Semua <ChevronRight size={12} />
            </button>
          </div>
          {loading ? (
            <SkeletonRows rows={6} />
          ) : recentView.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Belum ada data.</div>
          ) : (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={prTh}>Tanggal</th>
                    <th style={prTh}>Part Name</th>
                    <th style={prTh}>Total OK</th>
                    <th style={prTh}>Total LMR</th>
                    <th style={prTh}>Ratio</th>
                    <th style={prTh}>Kriteria NG</th>
                  </tr>
                </thead>
                <tbody>
                  {recentView.map((r) => (
                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate('datarejection')}>
                      <td style={{ ...prTd, whiteSpace: 'nowrap' }}>{formatDateID(r.tanggal)}</td>
                      <td style={{ ...prTd, maxWidth: 130 }}><ZoomCell>{r.partName}</ZoomCell></td>
                      <td style={prTd}>{r.totalOk.toLocaleString()}</td>
                      <td style={prTd}>{r.totalLmr.toLocaleString()}</td>
                      <td style={{ ...prTd, fontWeight: 700, color: r.rejectRatio > REJECTION_TARGET ? 'var(--red)' : 'var(--green)' }}>{r.rejectRatio}%</td>
                      <td style={{ ...prTd, maxWidth: 130 }}><ZoomCell>{r.kriteriaNg || '—'}</ZoomCell></td>
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

const prTh = { padding: '8px 10px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--muted)', textAlign: 'left', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap' };
const prTd = { padding: '8px 10px', fontSize: 12.5, borderBottom: '1px solid var(--border)', color: 'var(--text)' };
