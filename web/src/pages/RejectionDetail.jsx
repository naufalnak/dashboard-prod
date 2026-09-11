import Skeleton from '../components/ui/Skeleton.jsx';
import TableSkeleton from '../components/ui/TableSkeleton.jsx';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useUI } from '../contexts/UIContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { fetchRejectionBreakdown, fetchRejectionTrend, fetchRejectionEntries } from '../services/rejectionService.js';
import MiniRing from '../components/charts/MiniRing.jsx';
import LineTrendChart from '../components/charts/LineTrendChart.jsx';
import { CLUSTER_COLORS } from '../components/charts/ClusterBarList.jsx';
import HorizontalBarList from '../components/charts/HorizontalBarList.jsx';
import KriteriaNgChart from '../components/charts/KriteriaNgChart.jsx';
import PeriodPicker from '../components/maintenance/PeriodPicker.jsx';
import ZoomCell from '../components/ui/ZoomCell.jsx';
import { formatDateID } from '../dateFmt.js';

const MAIN_SIZE = 200;
const MINI_SIZE = 62;
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
      fetchRejectionBreakdown(qs, { byCluster: [], byPartName: [], kriteriaNg: [] }, logout),
      fetchRejectionTrend(qs, [], logout),
      fetchRejectionEntries(qs, { rows: [] }, logout),
    ]).then(([b, t, r]) => {
      setByCluster(b.byCluster);
      setByPartName(b.byPartName);
      setTrend(t);
      setKriteriaNg(b.kriteriaNg);
      setRecent(r.rows || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [period, refDate, clusterFilter, logout]);

  useEffect(() => { load(); }, [load]);

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

      <div className="row4" style={{ gridTemplateColumns: '0.95fr 0.95fr 1.3fr', marginBottom: 16, alignItems: 'stretch' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header"><div className="card-title">Rejection Cluster</div></div>
          {loading ? (
            <Skeleton width="100%" height={160} radius={8} />
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
          <div className="card-header"><div className="card-title">Kriteria NG</div></div>
          {loading ? (
            <Skeleton width="100%" height={160} radius={8} />
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <KriteriaNgChart data={kriteriaNg} mainSize={MAIN_SIZE} miniSize={MINI_SIZE} />
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Tren Rejection</div>
          </div>
          <LineTrendChart
            title=""
            data={trendWithTarget}
            valueKey="rejection"
            targetKey="target"
            color="#d9534f"
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
            <div className="card-header"><div className="card-title">5 Part Name Reject Tertinggi</div></div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <HorizontalBarList data={highest5} mode="bad" valueKey="rejection" />
            </div>
          </div>
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="card-header"><div className="card-title">5 Part Name Reject Terendah</div></div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <HorizontalBarList data={lowest5} mode="good" valueKey="rejection" />
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div className="card-title">Data Rejection Terbaru</div>
            <button className="card-action" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => navigate('datarejection')}>
              Lihat Semua <ChevronRight size={12} />
            </button>
          </div>
          {loading ? (
            <TableSkeleton rows={5} columns={6} />
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