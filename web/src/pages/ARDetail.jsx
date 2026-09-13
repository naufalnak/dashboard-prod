import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
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
import ZoomCell from '../components/ZoomCell.jsx';
import { SkeletonCircle, SkeletonBlock, SkeletonRows } from '../components/Skeleton.jsx';
import { useSort } from '../useSort.js';
import { formatDateID } from '../dateFmt.js';

const MAIN_SIZE = 200;
const MINI_SIZE = 62;
const AR_OK_THRESHOLD = 90; // di bawah ini ring diwarnai merah -- sinyal "kurang baik"
const CLUSTERS = ['AD', 'BC', 'EF', 'FI'];

const STATUS_LABEL = { open: 'Open', closed: 'Closed' };
const STATUS_COLOR = { open: 'var(--red)', closed: 'var(--green)' };

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
  const [shiftFilter, setShiftFilter] = useState('all');

  const [byCluster, setByCluster]     = useState([]);
  const [byLine, setByLine]           = useState([]);
  const [trend, setTrend]             = useState([]);
  const [problems, setProblems]       = useState([]);
  const [jenisProblem, setJenisProblem] = useState([]);
  const [shiftOptions, setShiftOptions] = useState([]);
  const [loading, setLoading]         = useState(true);

  // Opsi Shift ikut Master Data (tab Shift) -- konsisten dengan RC Harian
  // Produksi/Data Produksi, tidak di-hardcode di sini.
  useEffect(() => {
    apiFetch('/master', { shiftHours: [] }, logout).then((d) => setShiftOptions(d.shiftHours || []));
  }, [logout]);

  const load = useCallback(() => {
    setLoading(true);
    const qs = `period=${period}&date=${refDate}`
      + (clusterFilter !== 'all' ? `&cluster=${clusterFilter}` : '')
      + (shiftFilter !== 'all' ? `&shift=${encodeURIComponent(shiftFilter)}` : '');
    // Problem & Root Cause Log TIDAK ikut filter tanggal/Cluster/Shift --
    // panel ini selalu menampilkan semua problem (diprioritaskan status
    // Open + tanggal terbaru di atas, lihat GET /problem-log), supaya
    // isu yang masih terbuka tidak "hilang" cuma karena tanggalnya beda
    // dari yang sedang difilter di widget lain.
    Promise.all([
      apiFetch(`/ar-by-cluster?${qs}`, [], logout),
      apiFetch(`/ar-by-line?${qs}`, [], logout),
      apiFetch(`/ar-trend?${qs}`, [], logout),
      apiFetch('/problem-log', [], logout),
      apiFetch(`/jenis-problem-stats?${qs}`, [], logout),
    ]).then(([c, l, t, p, jp]) => {
      setByCluster(c);
      setByLine(l);
      setTrend(t);
      setProblems(p);
      setJenisProblem(jp);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [period, refDate, clusterFilter, shiftFilter, logout]);

  useEffect(() => { load(); }, [load]);

  // Sub-judul kartu ikut filter Cluster/Shift yang aktif -- "AR Cluster"
  // jadi "AR Cluster AD" kalau Cluster dipilih, "AR Semua Cluster" kalau
  // tidak; Shift ikut sebagai keterangan tambahan kalau dipilih.
  const clusterLabel = clusterFilter === 'all' ? 'Semua Cluster' : `Cluster ${clusterFilter}`;
  const shiftSuffix = shiftFilter === 'all' ? '' : ` — ${shiftFilter}`;
  const filterSuffix = `${clusterLabel}${shiftSuffix}`;

  const avgAr = byCluster.length ? Number((byCluster.reduce((s, c) => s + c.ar, 0) / byCluster.length).toFixed(1)) : 0;
  const trendWithTarget = useMemo(() => trend.map((d) => ({ ...d, target: 100 })), [trend]);

  const top5 = byLine.slice(0, 5);
  const bottom5 = [...byLine].reverse().slice(0, 5);

  // Dulu dibatasi 8 baris -- dinaikkan ke 15 (lebih banyak Problem
  // sekaligus, bukan cuma segelintir) dengan tabelnya dibuat scroll
  // internal (lihat maxHeight di bawah) supaya kartunya tidak jadi jauh
  // lebih tinggi dari 2 kartu Line Produksi di sampingnya. Tetap dibatasi
  // ke angka wajar (bukan tanpa batas -- /problem-log tidak difilter
  // tanggal sama sekali, lihat catatan di load()) karena panel ini tetap
  // ringkasan dashboard, bukan menu Problem Produksi penuh -- "Lihat
  // Semua" di header sudah jadi jalan keluar buat lihat semuanya.
  const problemsView = problems.slice(0, 15);
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
          <select
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
            className="pp-select"
            style={{ height: 34 }}
          >
            <option value="all">Semua Shift</option>
            {shiftOptions.map((s) => <option key={s.shift} value={s.shift}>{s.shift}</option>)}
          </select>
          <PeriodPicker pill period={period} setPeriod={setPeriod} refDate={refDate} setRefDate={setRefDate} />
        </div>
      </div>

      <div className="row4" style={{ gridTemplateColumns: '0.95fr 0.95fr 1.3fr', marginBottom: 16, alignItems: 'stretch' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header"><div className="card-title">AR {filterSuffix}</div></div>
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
          <div className="card-header"><div className="card-title">Jenis Problem {filterSuffix}</div></div>
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

        <div className="card">
          <div className="card-header">
            <div className="card-title">Tren AR {filterSuffix}</div>
          </div>
          {loading ? (
            <SkeletonBlock height={220} />
          ) : (
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
          )}
        </div>
      </div>

      <div className="row4" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 16, alignItems: 'stretch' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* justifyContent flex-start (bukan center) -- kartu ini ikut
              meregang setinggi panel Problem Produksi di sampingnya (lihat
              alignItems:'stretch' di row4 pembungkusnya), jadi kalau
              Problem Produksi jadi lebih tinggi (lihat problemsView di
              atas), 5 baris bar list yang di-center akan nyisa ruang
              kosong SAMA BESAR di atas & bawah -- kelihatan seperti
              "kepotong"/tidak sejajar dengan header di atasnya. Rata
              atas (nempel di bawah header) lebih rapi -- sisa ruang jadi
              satu gap bersih di bawah, bukan dua gap ganjil. */}
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="card-header"><div className="card-title">5 Line Produksi AR Tertinggi — {filterSuffix}</div></div>
            <div style={{ paddingTop: 4 }}>
              {loading ? <SkeletonRows rows={5} /> : <HorizontalBarList data={top5} mode="good" />}
            </div>
          </div>
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="card-header"><div className="card-title">5 Line Produksi AR Terendah — {filterSuffix}</div></div>
            <div style={{ paddingTop: 4 }}>
              {loading ? <SkeletonRows rows={5} /> : <HorizontalBarList data={bottom5} mode="bad" />}
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
            <SkeletonRows rows={6} />
          ) : problems.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>Belum ada data.</div>
          ) : (
            /* maxHeight (bukan cuma flex:1) -- supaya kartu ini kira-kira
               setinggi 2 kartu Line Produksi di sampingnya (masing-masing
               ~header + 5 baris bar), bukan meregang mengikuti jumlah
               Problem yang sekarang bisa sampai 15 baris. Lebihnya scroll
               di dalam, header tabelnya sticky supaya tetap kelihatan
               saat scroll. */
            <div style={{ flex: 1, maxHeight: 480, overflow: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <SortTh sortKeyName="tanggal" sortKey={probSortKey} sortDir={probSortDir} onSort={toggleProbSort} style={thSticky}>Tanggal</SortTh>
                    <SortTh sortKeyName="line" sortKey={probSortKey} sortDir={probSortDir} onSort={toggleProbSort} style={thSticky}>Line Produksi</SortTh>
                    <SortTh sortKeyName="partName" sortKey={probSortKey} sortDir={probSortDir} onSort={toggleProbSort} style={thSticky}>Part Name</SortTh>
                    <SortTh sortKeyName="problem" sortKey={probSortKey} sortDir={probSortDir} onSort={toggleProbSort} style={thSticky}>Problem</SortTh>
                    <SortTh sortKeyName="jenisProblem" sortKey={probSortKey} sortDir={probSortDir} onSort={toggleProbSort} style={thSticky}>Jenis Problem</SortTh>
                    <SortTh sortKeyName="totalLossTime" sortKey={probSortKey} sortDir={probSortDir} onSort={toggleProbSort} style={thSticky}>Loss Time</SortTh>
                    <SortTh sortKeyName="status" sortKey={probSortKey} sortDir={probSortDir} onSort={toggleProbSort} style={thSticky}>Status</SortTh>
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
                      <td style={{ ...prTd, whiteSpace: 'nowrap' }}>{p.totalLossTime ? `${p.totalLossTime} menit` : '—'}</td>
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
const thSticky = { borderBottom: '2px solid var(--border)', position: 'sticky', top: 0, background: 'var(--s1)', zIndex: 5 };
