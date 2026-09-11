import { RefreshCw, Maximize2, Minimize2 } from 'lucide-react';

import { useUI } from '../contexts/UIContext.jsx';
import { useDashboard } from '../hooks/useDashboard.js';

import GaugeCard from '../components/charts/GaugeCard.jsx';
import PeriodPicker from '../components/maintenance/PeriodPicker.jsx';
import GaugeSkeleton from '../components/ui/GaugeSkeleton.jsx';

export default function Dashboard() {
  const { presentMode, togglePresentMode, navigate } = useUI();

  const {
    period,
    setPeriod,
    refDate,
    setRefDate,
    summary,
    loading,
    reload,
  } = useDashboard();

  return (
    <div className="page-view active monitoring-bg">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Monitoring</div>
        </div>
      </div>

      {/* Filter */}
      <div className="group-box" style={{ marginBottom: 16 }}>
        <span className="group-box-title">Apply Filters</span>

        <div className="dash-filter-bar">
          <PeriodPicker
            pill
            period={period}
            setPeriod={setPeriod}
            refDate={refDate}
            setRefDate={setRefDate}
          />

          <button
            className="btn-icon"
            title="Refresh data"
            onClick={reload}
          >
            <RefreshCw size={14} />
          </button>

          <button
            className="btn-icon"
            title={
              presentMode
                ? 'Keluar mode layar penuh'
                : 'Mode layar penuh'
            }
            onClick={togglePresentMode}
          >
            {presentMode ? (
              <Minimize2 size={14} />
            ) : (
              <Maximize2 size={14} />
            )}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="row-monitoring">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <GaugeSkeleton key={i} />
          ))
        ) : (
          <>
            <GaugeCard
              title="AR"
              value={summary.ar}
              target={100}
              infoText="Total Proses ÷ Plan Produksi × 100%"
              onClick={() => navigate('ardetail')}
            />

            <GaugeCard
              title="Rejection"
              value={summary.rejection}
              target={5}
              invert
              infoText="Reject ÷ Total Proses × 100%"
              onClick={() => navigate('rejectiondetail')}
            />

            <GaugeCard
              title="OEE"
              value={summary.oee}
              target={85}
              infoText="Availability × Performance × Yield"
              onClick={() => navigate('oeedetail')}
            />

            <GaugeCard
              title="Overtime"
              value={summary.overtime}
              target={100}
              infoText={`Aktual ${summary.overtimeHours} Jam / Target ${summary.overtimeTargetHours} Jam`}
              onClick={() => navigate('overtimedetail')}
            />

            <GaugeCard title="Improvement (SS)" comingSoon />
            <GaugeCard title="Improvement (QCC)" comingSoon />
            <GaugeCard title="Otomation" comingSoon />
            <GaugeCard title="Matrix Skill" comingSoon />
          </>
        )}
      </div>
    </div>
  );
}