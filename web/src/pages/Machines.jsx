import { useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { fetchMachines } from '../services/masterService.js';
import { useDebounce } from '../hooks/useDebounce.js';

export default function Machines() {
  const { logout } = useAuth();
  const [machines, setMachines] = useState([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [filterCluster, setFilterCluster] = useState('');
  const [filterLine, setFilterLine] = useState('');

  useEffect(() => {
    fetchMachines(logout).then(setMachines);
  }, [logout]);

  const clusters = useMemo(() => [...new Set(machines.map((m) => m.cluster).filter(Boolean))].sort(), [machines]);
  const lines = useMemo(() => {
    const src = filterCluster ? machines.filter((m) => m.cluster === filterCluster) : machines;
    return [...new Set(src.map((m) => m.line).filter(Boolean))].sort();
  }, [machines, filterCluster]);

  const data = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return machines.filter((m) =>
      (!q || m.machine.toLowerCase().includes(q) || (m.cluster || '').toLowerCase().includes(q) || (m.line || '').toLowerCase().includes(q)) &&
      (!filterCluster || m.cluster === filterCluster) &&
      (!filterLine || m.line === filterLine)
    );
  }, [machines, debouncedSearch, filterCluster, filterLine]);

  return (
    <div className="page-view active" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div className="page-header">
        <div><div className="page-title">Semua Mesin</div></div>
      </div>
      <div className="card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
          <div className="search-wrap" style={{ flex: 1, minWidth: 140 }}>
            <span className="search-icon"><Search size={14} /></span>
            <input className="search-input" placeholder="Cari Mesin…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="btn" style={{ padding: '6px 10px' }} value={filterCluster}
            onChange={(e) => { setFilterCluster(e.target.value); setFilterLine(''); }}>
            <option value="">Semua Cluster</option>
            {clusters.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="btn" style={{ padding: '6px 10px' }} value={filterLine}
            onChange={(e) => setFilterLine(e.target.value)}>
            <option value="">Semua Line Produksi</option>
            {lines.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="table-scroll" style={{ flex: 1, minHeight: 0, maxHeight: 'none', overflow: 'auto' }}>
          <table className="machine-table" style={{ minWidth: 820 }}>
            <thead><tr><th>Mesin</th><th>Nomor Asset</th><th>Type</th><th>Merk</th><th>Tahun</th><th>Daya</th><th>Cluster</th><th>Line Produksi</th><th>Shift</th><th style={{ textAlign: 'center' }}>Aktif</th></tr></thead>
            <tbody>
              {!data.length ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>Tidak ada mesin yang cocok</td></tr>
              ) : data.map((m) => {
                return (
                  <tr key={m.id}>
                    <td><strong>{m.machine}</strong></td>
                    <td style={{ color: 'var(--muted)' }}>{m.idAssetMachine || '—'}</td>
                    <td style={{ color: 'var(--muted)' }}>{m.typeMachine || '—'}</td>
                    <td style={{ color: 'var(--muted)' }}>{m.brandMachine || '—'}</td>
                    <td style={{ color: 'var(--muted)' }}>{m.yearMachine || '—'}</td>
                    <td style={{ color: 'var(--muted)' }}>{m.powerMachine || '—'}</td>
                    <td style={{ color: 'var(--muted)' }}>{m.cluster || '—'}</td>
                    <td style={{ color: 'var(--muted)' }}>{m.line || '—'}</td>
                    <td style={{ color: 'var(--muted)' }}>{m.shift || '—'}</td>
                    <td style={{ textAlign: 'center' }}><span className={`aktif-pill ${m.active ? 'aktif' : 'nonaktif'}`}><span className="aktif-dot"></span>{m.active ? 'Aktif' : 'Nonaktif'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
