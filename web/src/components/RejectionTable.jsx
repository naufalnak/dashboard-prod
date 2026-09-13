import { useMemo } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import useHorizontalWheelScroll from '../useHorizontalWheelScroll.js';
import SortTh from './SortTh.jsx';
import ZoomCell from './ZoomCell.jsx';
import { useSort } from '../useSort.js';
import { useColumnWidths, weightsToPercent } from '../useColumnWidths.js';
import { formatDateID } from '../dateFmt.js';
import { SkeletonRows } from './Skeleton.jsx';

const GROUP_BG = ['transparent', 'var(--s2)'];

const COLUMNS = [
  { key: 'tanggal', label: 'Tanggal', weight: 90 },
  { key: 'waktu', label: 'Waktu', weight: 70 },
  { key: 'cluster', label: 'Cluster', weight: 70 },
  { key: 'partName', label: 'Part Name', weight: 200 },
  { key: 'totalOk', label: 'Total OK', weight: 100 },
  { key: 'totalLmr', label: 'Total LMR', weight: 100 },
  { key: 'totalProses', label: 'Total Proses', weight: 110 },
  { key: 'rejectRatio', label: 'Reject Ratio', weight: 100 },
  { key: 'kriteriaNg', label: 'Kriteria NG', weight: 160 },
  { key: 'keterangan', label: 'Keterangan', weight: 220 },
];
const AKSI_PCT = 6;
const DEFAULT_WIDTHS = weightsToPercent(COLUMNS, AKSI_PCT);

// Tabel hasil input Input Rejection -- dipakai di menu "Data Rejection"
// (login-gated). Kolom "Aksi" (edit/hapus) hanya muncul kalau onEdit
// diberikan. Lebar kolom dalam PERSEN supaya tabel selalu pas satu
// layar tanpa scroll horizontal/zoom -- bisa digeser manual (drag
// pinggir kanan header) lewat useColumnWidths.
export default function RejectionTable({ rows, loading, onEdit, onDelete }) {
  const scrollRef = useHorizontalWheelScroll();
  const editable = !!onEdit;
  const { widths, startResize } = useColumnWidths(DEFAULT_WIDTHS, scrollRef);
  // Header dulu warna kuning terang hardcode (#f5c542) -- tabrakan sama
  // tema gelap di semua tempat lain (lihat standar "no hardcoded hex" di
  // skill dashboard-prod-design). Diganti ke token var(--s2)/var(--muted)
  // yang sudah dipakai tabel lain (DataRework dkk), sekalian z-index
  // eksplisit dari skala supaya kolom Aksi (sticky kiri+atas) selalu di
  // atas header biasa (sticky atas) dan sel Aksi per baris (sticky kiri).
  const th = { padding: '5px 6px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em', color: 'var(--muted)', background: 'var(--s2)', border: '1px solid var(--border)', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 5, cursor: 'pointer', userSelect: 'none' };
  const td = { padding: '4px 6px', fontSize: 10.5, border: '1px solid var(--border)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text)' };
  const tdOk = { ...td, background: 'rgba(14,90,82,.1)' };
  const tdRatio = (v) => ({ ...td, background: v > 5 ? 'rgba(200,30,58,.1)' : 'rgba(15,140,63,.14)', fontWeight: 700, textAlign: 'center' });

  const defaultSortedRows = useMemo(
    () => [...rows].sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || '')),
    [rows],
  );
  const { sorted: sortedRows, sortKey, sortDir, toggleSort } = useSort(defaultSortedRows);

  // Cuma tampilkan placeholder kalau belum ada data sama sekali -- refresh
  // di belakang layar (mis. setelah edit) tetap menampilkan data lama
  // supaya tabel tidak collapse dan tampilan tidak lompat balik ke atas.
  if (loading && rows.length === 0) return <div style={{ padding: '20px 24px' }}><SkeletonRows rows={6} height={20} /></div>;
  if (rows.length === 0) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Belum ada data.</div>;

  let groupIdx = -1;
  let prevPartName = null;

  return (
    <div ref={scrollRef} style={{ overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900, tableLayout: 'fixed', background: 'var(--s1)' }}>
        <colgroup>
          {editable && <col style={{ width: `${AKSI_PCT}%` }} />}
          {COLUMNS.map((c) => <col key={c.key} style={{ width: `${widths[c.key]}%` }} />)}
        </colgroup>
        <thead>
          <tr>
            {editable && <th style={{ ...th, position: 'sticky', left: 0, zIndex: 10, cursor: 'default' }}>Aksi</th>}
            {COLUMNS.map((c) => (
              <SortTh key={c.key} sortKeyName={c.key} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th} onResizeStart={startResize(c.key)}>{c.label}</SortTh>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((r) => {
            if (r.partName !== prevPartName) { groupIdx++; prevPartName = r.partName; }
            const groupBg = GROUP_BG[groupIdx % GROUP_BG.length];
            return (
              <tr key={r.id} style={{ background: groupBg }}>
                {editable && (
                  <td style={{ ...td, position: 'sticky', left: 0, zIndex: 1, background: groupBg === 'transparent' ? 'var(--s1)' : groupBg }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => onEdit(r)} title="Edit" style={actionBtn}><Pencil size={12} /></button>
                      {onDelete && <button onClick={() => onDelete(r)} title="Hapus" style={{ ...actionBtn, color: 'var(--red)' }}><Trash2 size={12} /></button>}
                    </div>
                  </td>
                )}
                <td style={td}>{formatDateID(r.tanggal)}</td>
                <td style={td}>{r.waktu || '—'}</td>
                <td style={td}>{r.cluster || '—'}</td>
                <td style={td}><ZoomCell label="Part Name">{r.partName}</ZoomCell></td>
                <td style={tdOk}>{r.totalOk.toLocaleString()}</td>
                <td style={td}>{r.totalLmr.toLocaleString()}</td>
                <td style={tdOk}>{r.totalProses.toLocaleString()}</td>
                <td style={tdRatio(r.rejectRatio)}>{r.rejectRatio}%</td>
                <td style={td}><ZoomCell label="Kriteria NG">{r.kriteriaNg || '—'}</ZoomCell></td>
                <td style={td}><ZoomCell label="Keterangan">{r.keterangan || ''}</ZoomCell></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const actionBtn = { background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 5, padding: '4px 6px', cursor: 'pointer', color: 'var(--text)', display: 'inline-flex' };
