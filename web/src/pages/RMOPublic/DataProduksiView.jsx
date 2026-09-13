import { useState, useEffect, useMemo, useCallback } from 'react';
import { RefreshCw, LogOut } from 'lucide-react';
import ProduksiTable from '../../components/ProduksiTable.jsx';
import PeriodPicker from '../../components/PeriodPicker.jsx';
import LineTrendChart from '../../components/charts/LineTrendChart.jsx';
import EditProduksiModal from './EditProduksiModal.jsx';
import { API, todayStr } from './shared.jsx';

/* ── Data Produksi ter-filter ke Cluster Grup Head yang login, dengan
   filter Tanggal/Shift/Cari sendiri (period+date memicu fetch ulang ke
   server, Shift+Cari cuma menyaring baris yang sudah ada di layar --
   sama seperti pola menu Data Produksi di dashboard admin). ───────── */
export default function DataProduksiView({ auth, onLogout, shiftOptions, master }) {
  const [period, setPeriod] = useState('today');
  const [refDate, setRefDate] = useState(todayStr());
  const [shiftFilter, setShiftFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState([]);
  const [cluster, setCluster] = useState('');
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [editRow, setEditRow] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError('');
    const qs = `period=${period}&date=${refDate}`;
    fetch(`${API}/produksi-harian-my-cluster?${qs}`, { headers: { Authorization: `Bearer ${auth.token}` } })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Gagal memuat data');
        setCluster(data.cluster);
        setRows(data.rows);
        setLoading(false);
        fetch(`${API}/ar-trend?${qs}&cluster=${data.cluster}`, { headers: { Authorization: `Bearer ${auth.token}` } })
          .then((tr) => tr.json()).then(setTrend).catch(() => setTrend([]));
      })
      .catch((err) => {
        setLoading(false);
        setLoadError(err.message);
        if (String(err.message).toLowerCase().includes('session') || String(err.message).toLowerCase().includes('login')) onLogout();
      });
  }, [period, refDate, auth.token, onLogout]);

  useEffect(() => { load(); }, [load]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (shiftFilter !== 'all' && r.shift !== shiftFilter) return false;
      if (!q) return true;
      return r.partName.toLowerCase().includes(q) || r.mesin.toLowerCase().includes(q)
        || (r.noLot || '').toLowerCase().includes(q) || (r.proses || '').toLowerCase().includes(q);
    });
  }, [rows, shiftFilter, query]);

  const trendWithTarget = useMemo(() => trend.map((d) => ({ ...d, target: 100 })), [trend]);

  return (
    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div className="group-box" style={{ margin: '16px 24px 0', background: '#fff' }}>
        <span className="group-box-title">Apply Filters</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <PeriodPicker pill period={period} setPeriod={setPeriod} refDate={refDate} setRefDate={setRefDate} />
          <select className="pp-select" value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)} style={{ height: 34 }}>
            <option value="all">Semua Shift</option>
            {shiftOptions.map((s) => <option key={s.shift} value={s.shift}>{s.shift}</option>)}
          </select>
          <div style={{ flex: 1, minWidth: 160, maxWidth: 260 }}>
            <input type="text" style={{ background: '#fff', border: '1px solid #c9d4d4', borderRadius: 7, padding: '9px 12px', fontSize: 13, width: '100%', boxSizing: 'border-box' }}
              value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari Part/Mesin/No Lot…" />
          </div>
          <button onClick={load} title="Refresh data" style={{ padding: '9px 12px', fontSize: 13, borderRadius: 7, background: '#0e5a52', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex' }}>
            <RefreshCw size={14} />
          </button>
          <button onClick={onLogout} title="Keluar" style={{ marginLeft: 'auto', padding: '9px 12px', fontSize: 12.5, borderRadius: 7, background: '#eef2f2', border: '1px solid #c9d4d4', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <LogOut size={13} /> {auth.username}
          </button>
        </div>
      </div>

      <div style={{ padding: '16px 24px' }}>
        {loadError && <div style={{ color: '#d9534f', fontSize: 13, marginBottom: 12 }}>{loadError}</div>}
        {cluster && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#0e5a52', marginBottom: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0e5a52', display: 'inline-block' }} />
            Cluster {cluster} ({filteredRows.length} baris)
          </div>
        )}
        <div style={{ marginBottom: 16, background: '#fff', border: '1px solid #d7e0e0', borderRadius: 10, padding: 14 }}>
          <LineTrendChart
            title={`Tren AR — Cluster ${cluster || '…'}`}
            data={trendWithTarget}
            valueKey="ar"
            targetKey="target"
            color="#0e5a52"
            unit="%"
            showMovingAvg
            movingAvgColor="#2563eb"
            targetColor="#d9534f"
          />
        </div>
        <div style={{ position: 'relative', border: '2px solid #17a2b8', borderRadius: 6, background: '#fff', padding: '18px 12px 12px' }}>
          <span style={{ position: 'absolute', top: -11, left: 14, background: '#fff', padding: '0 8px', fontSize: 12, fontWeight: 800, color: '#17a2b8', textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Data Produksi
          </span>
          <ProduksiTable rows={filteredRows} loading={loading} onEdit={setEditRow} />
        </div>
      </div>

      {editRow && (
        <EditProduksiModal row={editRow} master={master} token={auth.token} onClose={() => setEditRow(null)} onSaved={load} />
      )}
    </div>
  );
}
