import { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw, Maximize2, Minimize2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext.jsx';
import { useUI } from '../contexts/UIContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { apiFetch } from '../api.js';
import GaugeCard from '../components/GaugeCard.jsx';
import PeriodPicker from '../components/PeriodPicker.jsx';

const EMPTY_SUMMARY = { availability: 0, performance: 0, yield: 0, ar: 0, rejection: 0, oee: 0, overtime: 0, overtimeHours: 0, overtimeTargetHours: 0, entries: 0 };

function todayStr() { return new Date().toISOString().slice(0, 10); }

export default function Dashboard() {
  const { isLoading, setIsLoading } = useApp();
  const { presentMode, togglePresentMode, navigate } = useUI();
  const { logout } = useAuth();

  const [period, setPeriod]               = useState('today');
  const [refDate, setRefDate]             = useState(todayStr());
  const reqIdRef = useRef(0);

  const [summary, setSummary] = useState(EMPTY_SUMMARY);

  const loadDashboard = useCallback(() => {
    const myId = ++reqIdRef.current;
    setIsLoading(true);
    const qs = `period=${period}&date=${refDate}`;
    apiFetch(`/produksi-harian-summary?${qs}`, EMPTY_SUMMARY, logout).then((s) => {
      if (myId !== reqIdRef.current) return;
      setSummary(s);
      setIsLoading(false);
    }).catch(() => {
      if (myId !== reqIdRef.current) return;
      setIsLoading(false);
    });
  }, [period, refDate, logout, setIsLoading]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  return (
    <div className="page-view active monitoring-bg">

      {/* ── Page header ────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <div className="page-title">Monitoring</div>
        </div>
        <div className="dash-filter-bar">
          <PeriodPicker
            pill
            period={period} setPeriod={setPeriod}
            refDate={refDate} setRefDate={setRefDate}
          />

          <button className="btn-icon" title="Refresh data" onClick={loadDashboard}>
            <RefreshCw size={14} />
          </button>
          <button
            className="btn-icon"
            onClick={togglePresentMode}
            title={presentMode ? 'Keluar mode layar penuh' : 'Mode layar penuh'}
          >
            {presentMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* ── KPI gauges ───────────────────────────────────── */}
      <div className="row-monitoring">
        <GaugeCard title="AR" value={summary.ar} target={100} loading={isLoading}
          infoText="Total Proses ÷ Plan Produksi × 100%. Target 100%. Klik untuk detail per Cluster."
          onClick={() => navigate('ardetail')} />
        <GaugeCard title="Rejection" value={summary.rejection} target={5} invert loading={isLoading}
          infoText="Reject ÷ Total Proses × 100%. Semakin rendah semakin baik, target ≤5%. Klik untuk detail per Cluster."
          onClick={() => navigate('rejectiondetail')} />
        <GaugeCard title="OEE" value={summary.oee} target={85} loading={isLoading}
          infoText="Availability × Performance × Yield. Target ≥ 85%. Klik untuk detail per Cluster."
          onClick={() => navigate('oeedetail')} />
        <GaugeCard title="Overtime" value={summary.overtime} target={100} loading={isLoading}
          infoText={`Total Jam Lembur ÷ Target Jam Lembur × 100%. Aktual: ${summary.overtimeHours} jam, Target: ${summary.overtimeTargetHours} jam (diatur di Master Data). Klik untuk detail per Cluster.`}
          onClick={() => navigate('overtimedetail')} />
        <GaugeCard title="Improvement (SS)" comingSoon infoText="Suggestion System — menunggu sumber data usulan karyawan." />
        <GaugeCard title="Improvement (QCC)" comingSoon infoText="Quality Control Circle — menunggu sumber data." />
        <GaugeCard title="Otomation" comingSoon infoText="Menunggu sumber data proyek otomasi." />
        <GaugeCard title="Matrix Skill" comingSoon infoText="Menunggu sumber data kompetensi karyawan." />
      </div>
    </div>
  );
}
