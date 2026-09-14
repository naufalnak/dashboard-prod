import { useState, useMemo } from 'react';
import useHorizontalWheelScroll from '../../useHorizontalWheelScroll.js';
import SortTh from '../../components/SortTh.jsx';
import ZoomCell from '../../components/ZoomCell.jsx';
import { useSort } from '../../useSort.js';
import { matches, SearchBox, th, td } from './shared.jsx';
import { Skeleton } from '../../components/Skeleton.jsx';

/* ── Tab: Ringkasan (tampilan gabungan, read-only) ──── */
// Bukan tabel fisik baru -- ini cuma JOIN tampilan dari 3 tabel master
// (GroupHead/PartName/Proses) yang sudah ada, jadi edit/tambah data tetap
// lewat tab Grup Head / Part Name & Proses (satu tempat per jenis data,
// tidak perlu ubah banyak baris kalau ada perubahan).
export default function RingkasanTab({ rows, loading }) {
  const [query, setQuery] = useState('');
  const scrollRef = useHorizontalWheelScroll();
  const filtered = useMemo(
    () => rows.filter((r) => matches(query, r.groupHead, r.cluster, r.partName, r.proses, r.line, r.mesin)),
    [rows, query],
  );
  const { sorted: shown, sortKey, sortDir, toggleSort } = useSort(filtered);
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Ringkasan Relasi Master Data</div>
      </div>
      <SearchBox value={query} onChange={setQuery} placeholder="Cari Grup Head / Part Name / Proses / Mesin…" />
      <div ref={scrollRef} style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <SortTh sortKeyName="groupHead" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Grup Head</SortTh>
              <SortTh sortKeyName="cluster" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Cluster</SortTh>
              <SortTh sortKeyName="partName" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Part Name</SortTh>
              <SortTh sortKeyName="cycleTime" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Cycle Time</SortTh>
              <SortTh sortKeyName="proses" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Proses</SortTh>
              <SortTh sortKeyName="line" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Line Produksi</SortTh>
              <SortTh sortKeyName="mesin" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th}>Mesin</SortTh>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td colSpan={7} style={td}><Skeleton height={12} width="60%" /></td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={7} style={td}>{rows.length === 0 ? 'Belum ada data. Isi dulu lewat tab Grup Head dan Part Name & Proses.' : 'Tidak ada yang cocok.'}</td></tr>
            ) : shown.map((r) => (
              <tr key={r.key}>
                <td style={{ ...td, maxWidth: 160 }}><ZoomCell label="Grup Head">{r.groupHead}</ZoomCell></td>
                <td style={td}>{r.cluster}</td>
                <td style={{ ...td, maxWidth: 160 }}><ZoomCell label="Part Name">{r.partName}</ZoomCell></td>
                <td style={td}>{r.cycleTime}</td>
                <td style={{ ...td, maxWidth: 140 }}><ZoomCell label="Proses">{r.proses}</ZoomCell></td>
                <td style={td}>{r.line}</td>
                <td style={td}>{r.mesin}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
