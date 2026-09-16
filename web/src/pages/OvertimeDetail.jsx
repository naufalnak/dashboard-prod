import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useUI } from '../contexts/UIContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { apiFetch } from '../api.js';
import LineTrendChart from '../components/charts/LineTrendChart.jsx';
import { CLUSTER_COLORS } from '../components/ClusterBarList.jsx';
import HorizontalBarList from '../components/HorizontalBarList.jsx';
import KriteriaNgChart from '../components/charts/KriteriaNgChart.jsx';
import PeriodPicker from '../components/PeriodPicker.jsx';
import ZoomCell from '../components/ZoomCell.jsx';
import { SkeletonCircle, SkeletonBlock, SkeletonRows } from '../components/Skeleton.jsx';
import { formatDateID } from '../dateFmt.js';

const CLUSTERS = ['AD', 'BC', 'EF', 'FI'];

function todayStr() { return new Date().toISOString().slice(0, 10); }

// Total jam lembur per Cluster -- bar relatif (bukan ring persentase
// seperti AR/Rejection), karena jam lembur tidak punya batas atas 0-100
// yang wajar buat digambar sebagai ring.
function ClusterHoursBars({ data }) {
  if (!data.length) return <div style={{ color: 'var(--muted)', fontSize: 12 }}>Belum ada data.</div>;
  const max = Math.max(...data.map((d) => d.jam), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
      {data.map((d) => (
        <div key={d.cluster} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 46, flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{d.cluster}</div>
          <div style={{ flex: 1, background: 'var(--s3)', borderRadius: 4, height: 16, overflow: 'hidden' }}>
            <div style={{ width: `${(d.jam / max) * 100}%`, height: '100%', background: CLUSTER_COLORS[d.cluster] || 'var(--accent)', borderRadius: 4, transition: 'width .6s ease' }}></div>
          </div>
          <div style={{ width: 64, flexShrink: 0, textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{d.jam.toLocaleString()} jam</div>
        </div>
      ))}
    </div>
  );
}

// Halaman detail Overtime -- struktur mengikuti Detail Rejection: ranking
// per Man Power (bukan per Line/Part Name, OvertimeEntry tidak punya
// dimensi itu), donut per Grup Head (bukan Kriteria NG), tren jam lembur
// (bukan persentase, karena tidak ada rasio OK/LMR yang setara).
export default function OvertimeDetail() {
  const { navigate } = useUI();
  const { logout } = useAuth();

  const [period, setPeriod] = useState('today');
  const [refDate, setRefDate] = useState(todayStr());
  const [clusterFilter, setClusterFilter] = useState('all');

  const [byCluster, setByCluster]     = useState([]);
  const [byManPower, setByManPower]   = useState([]);
  const [trend, setTrend]             = useState([]);
  const [byGroupHead, setByGroupHead] = useState([]);
  const [recent, setRecent]           = useState([]);
  const [loading, setLoading]         = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const qs = `period=${period}&date=${refDate}${clusterFilter !== 'all' ? `&cluster=${clusterFilter}` : ''}`;
    Promise.all([
      apiFetch(`/overtime-by-cluster?${qs}`, [], logout),
      apiFetch(`/overtime-by-manpower?${qs}`, [], logout),
      apiFetch(`/overtime-trend?${qs}`, [], logout),
      apiFetch(`/overtime-by-group-head?${qs}`, [], logout),
      apiFetch(`/overtime-entries?${qs}`, [], logout),
    ]).then(([c, m, t, g, r]) => {
      setByCluster(c);
      setByManPower(m);
      setTrend(t);
      setByGroupHead(g);
      setRecent(r);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [period, refDate, clusterFilter, logout]);

  useEffect(() => { load(); }, [load]);

  // Sub-judul kartu ikut filter Cluster yang aktif, sama pola dengan
  // ARDetail/OEEDetail/RejectionDetail.
  const clusterLabel = clusterFilter === 'all' ? 'Semua Cluster' : `Cluster ${clusterFilter}`;

  const totalJam = useMemo(() => byCluster.reduce((s, c) => s + c.jam, 0), [byCluster]);

  // byManPower sudah terurut turun (tertinggi dulu) dari backend.
  const highest5 = byManPower.slice(0, 5);
  const lowest5 = [...byManPower].reverse().slice(0, 5);

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
            <div className="page-title">Detail Overtime</div>
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

      {/* Overtime & Overtime per Grup Head -- dipisah dari Tren Overtime
          (dulu satu baris bertiga dengan alignItems:'stretch'), sama pola
          dengan ARDetail.jsx supaya kartunya tidak ikut diregangkan
          setinggi grafik tren yang sekarang sengaja dibuat lebih lega. */}
      <div className="row4" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 16, alignItems: 'stretch' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header"><div className="card-title">Overtime {clusterLabel}</div></div>
          {loading ? (
            <SkeletonRows rows={4} />
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)' }}>{totalJam.toLocaleString()}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Total Jam Lembur</div>
              </div>
              <ClusterHoursBars data={byCluster} />
            </div>
          )}
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header"><div className="card-title">Overtime per Grup Head {clusterLabel}</div></div>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SkeletonCircle size={150} />
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <KriteriaNgChart data={byGroupHead} mainSize={150} miniSize={48} />
            </div>
          )}
        </div>
      </div>

      {/* Tren Overtime -- baris sendiri, lebar penuh, sama pola dengan
          ARDetail.jsx (blok grafik lebih lega + label nilai per bar dapat
          ruang cukup). */}
      <div className="row4" style={{ gridTemplateColumns: '1fr', marginBottom: 16 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div className="card-title">Tren Overtime {clusterLabel}</div>
          </div>
          {loading ? (
            <SkeletonBlock height={220} />
          ) : (
            <LineTrendChart
              bare
              data={trend}
              valueKey="overtime"
              color="var(--accent)"
              unit="jam"
              showMovingAvg
              movingAvgColor="var(--blue)"
            />
          )}
        </div>
      </div>

      <div className="row4" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 16, alignItems: 'stretch' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="card-header"><div className="card-title">5 Man Power Overtime Tertinggi — {clusterLabel}</div></div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {loading ? <SkeletonRows rows={5} /> : <HorizontalBarList data={highest5} mode="bad" valueKey="jam" unit=" jam" />}
            </div>
          </div>
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="card-header"><div className="card-title">5 Man Power Overtime Terendah — {clusterLabel}</div></div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {loading ? <SkeletonRows rows={5} /> : <HorizontalBarList data={lowest5} mode="good" valueKey="jam" unit=" jam" />}
            </div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div className="card-title">Data Overtime Terbaru — {clusterLabel}</div>
            <button className="card-action" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => navigate('dataovertime')}>
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
                    <th style={prTh}>Man Power</th>
                    <th style={prTh}>Grup Head</th>
                    <th style={prTh}>Durasi</th>
                    <th style={prTh}>Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {recentView.map((r) => (
                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate('dataovertime')}>
                      <td style={{ ...prTd, whiteSpace: 'nowrap' }}>{formatDateID(r.tanggal)}</td>
                      <td style={{ ...prTd, maxWidth: 130 }}><ZoomCell>{r.manPower || '—'}</ZoomCell></td>
                      <td style={{ ...prTd, maxWidth: 120 }}><ZoomCell>{r.groupHead || '—'}</ZoomCell></td>
                      <td style={{ ...prTd, fontWeight: 700 }}>{r.durasiJam} jam</td>
                      <td style={{ ...prTd, maxWidth: 140 }}><ZoomCell>{r.keterangan || '—'}</ZoomCell></td>
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
