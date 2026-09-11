import { useMemo, useState, useRef, useEffect } from 'react';
import { Pencil, Trash2, MoreVertical } from 'lucide-react';
import useHorizontalWheelScroll from '../../hooks/useHorizontalWheelScroll.js';
import SortTh from '../ui/SortTh.jsx';
import ProduksiRowDrawer from './ProduksiRowDrawer.jsx';
import EmptyErrorState from '../ui/EmptyErrorState.jsx';
import TableSkeleton from '../ui/TableSkeleton.jsx';
import { useSort } from '../../hooks/useSort.js';
import { useColumnWidths, weightsToPercent } from '../../hooks/useColumnWidths.js';
import { formatDateID } from '../../dateFmt.js';

// Baris dari satu submit multi-Mesin (RC Harian input mode centang-
// banyak-Mesin, atau "+ Tambah Mesin" di Data Produksi) berbagi
// `batchId` yang SAMA (lihat createProduksiHarian/updateProduksiHarian &
// schema.prisma) -- link EKSPLISIT dari backend, BUKAN ditebak dari
// kecocokan field produksi. Baris dengan batchId null (mayoritas,
// termasuk SEMUA data lama sebelum kolom ini ada) tidak pernah digabung.
function groupProduksiRows(rows) {
  const map = new Map();
  const singles = [];
  for (const r of rows) {
    if (!r.batchId) { singles.push({ ...r, _group: [r] }); continue; }
    if (!map.has(r.batchId)) map.set(r.batchId, []);
    map.get(r.batchId).push(r);
  }
  const batched = [...map.values()].map((group) => {
    if (group.length === 1) return { ...group[0], _group: group };
    const mesinList = [...new Set(group.map((r) => r.mesin).filter(Boolean))];
    // Breakdown Mesin/Lost Time dijumlahkan -- biasanya cuma satu baris
    // di batch yang punya downtime (yang lain 0), jadi hasilnya sama
    // saja dengan nilai baris itu. Keterangan/Jenis Problem ambil dari
    // baris yang ada isinya. AR/AVB/PERF/YIELD/OEE identik di semua
    // baris batch (field produksinya sama persis by design), ambil dari
    // baris pertama.
    return {
      ...group[0],
      mesin: mesinList.join(', '),
      breakdownMesin: group.reduce((s, r) => s + (r.breakdownMesin || 0), 0),
      lostTime: group.reduce((s, r) => s + (r.lostTime || 0), 0),
      keterangan: group.find((r) => r.keterangan)?.keterangan || '',
      jenisProblem: group.find((r) => r.jenisProblem)?.jenisProblem || '',
      _group: group,
    };
  });
  return [...singles, ...batched];
}

// Menu titik-tiga per baris batch (>1 Mesin) -- pilih Mesin mana yang mau
// di-Edit, atau Hapus Semua sekaligus. Baris biasa (batchId null) tetap
// 2 tombol Edit/Hapus langsung seperti sebelumnya.
function GroupActionsMenu({ group, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function onDocClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }} onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setOpen((v) => !v)} style={actionBtn} title={`${group.length} Mesin di batch ini`}>
        <MoreVertical size={12} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 60,
          background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: '0 12px 32px rgba(0,0,0,.18)', minWidth: 190, overflow: 'hidden',
        }}>
          <div style={{ padding: '7px 12px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
            Edit Mesin
          </div>
          {group.map((r) => (
            <button key={r.id} onClick={() => { setOpen(false); onEdit(r); }} style={menuItem}>
              <Pencil size={12} /> {r.mesin}
            </button>
          ))}
          {onDelete && (
            <button onClick={() => { setOpen(false); onDelete(group); }} style={{ ...menuItem, color: 'var(--red)', borderTop: '1px solid var(--border)' }}>
              <Trash2 size={12} /> Hapus Semua ({group.length} baris)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Warna latar berselang-seling per kelompok Part Name -- baris ganjil vs
// genap tiap kali Part Name berganti, bukan per baris, supaya semua
// Proses milik satu Part Name kelihatan sebagai satu kelompok. Hanya
// berlaku selama tabel belum diurutkan manual lewat klik header kolom.
const GROUP_BG = ['transparent', 'var(--s2)'];

const COLUMNS = [
  { key: 'shift', label: 'Shift', weight: 90 },
  { key: 'tanggal', label: 'Tanggal', weight: 100 },
  { key: 'partName', label: 'Nama Parts', weight: 200 },
  { key: 'noLot', label: 'No Lot', weight: 110 },
  { key: 'proses', label: 'Proses', weight: 160 },
  { key: 'line', label: 'Line Produksi', weight: 150 },
  { key: 'mesin', label: 'Mesin', weight: 130 },
  { key: 'manPower', label: 'MP', weight: 130 },
  { key: 'cycleTime', label: 'CT', weight: 70 },
  { key: 'waktuEfektif', label: 'Waktu Efektif (Jam)', weight: 150 },
  { key: 'plan', label: 'Plan', weight: 90 },
  { key: 'rework', label: 'Rwk', weight: 70 },
  { key: 'reject', label: 'Rjct', weight: 70 },
  { key: 'totalOk', label: 'Total OK', weight: 100 },
  { key: 'totalProses', label: 'Total Proses', weight: 110 },
  { key: 'breakdownMesin', label: 'Breakdown MC', weight: 130 },
  { key: 'lostTime', label: 'Lost Time', weight: 100 },
  { key: 'keterangan', label: 'Keterangan', weight: 220 },
  { key: 'ar', label: 'AR', weight: 80 },
  { key: 'avb', label: 'AVB', weight: 80 },
  { key: 'perf', label: 'PERF', weight: 80 },
  { key: 'yield', label: 'YIELD', weight: 80 },
  { key: 'oee', label: 'OEE', weight: 80 },
];
const AKSI_PCT = 4.5;
const DEFAULT_WIDTHS = weightsToPercent(COLUMNS, AKSI_PCT);
// Jumlah weight semua kolom -- dipakai langsung sebagai minWidth px tabel
// (1 unit weight ≈ 1px) supaya di layar sempit tabel tetap selebar ini
// (scroll ke samping), tidak dimampatkan sampai tidak terbaca.
const TABLE_MIN_WIDTH = COLUMNS.reduce((sum, c) => sum + c.weight, 0);

// Tabel hasil input Resume Control Harian Produksi — dipakai bersama oleh
// halaman /rmo (tab "Data Tabel") dan menu "Data Produksi" di dashboard
// utama. Kolom "Aksi" (edit/hapus) hanya muncul kalau onEdit diberikan —
// dipakai di Data Produksi (login-gated), tidak di /rmo publik. Lebar
// kolom dalam PERSEN dengan minWidth (lihat TABLE_MIN_WIDTH) -- di layar
// lebar kolomnya proporsional pas 100%, di HP tabel TIDAK dimampatkan
// (22 kolom kalau dipaksa muat HP jadi tidak terbaca), melainkan tetap
// selebar minWidth-nya dan discroll ke samping (lihat useHorizontalWheelScroll
// pada wrapper). Header kolom & isi sel sama-sama 1 baris rata tengah +
// ellipsis kalau kepanjangan (tidak wrap) -- klik baris mana pun untuk
// lihat detail lengkapnya lewat drawer (lihat ProduksiRowDrawer), jadi
// tidak perlu lagi zoom per sel.
// Lebar kolom bisa digeser manual (drag pinggir kanan header) lewat
// useColumnWidths, geserannya proporsional terhadap lebar wadah tabel.
export default function ProduksiTable({ rows, loading, error, onRetry, onEdit, onDelete }) {
  const scrollRef = useHorizontalWheelScroll();
  const editable = !!onEdit;
  const { widths, startResize } = useColumnWidths(DEFAULT_WIDTHS, scrollRef);
  // Klik baris mana pun membuka drawer detail (semua field baris itu
  // sekaligus, setara 1 kali input RC Harian Produksi) -- pengganti fitur
  // "zoom per sel" (ZoomCell) yang lama, supaya lihat detail cukup 1 klik
  // di mana saja pada baris, bukan klik satu-satu tiap kolom yang panjang.
  const [detailRow, setDetailRow] = useState(null);
  const th = { padding: '5px 4px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.01em', color: '#3d4b4b', background: '#f5c542', border: '1px solid #d9b93a', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', position: 'sticky', top: 0, cursor: 'pointer', userSelect: 'none' };
  const td = { padding: '4px 6px', fontSize: 10.5, border: '1px solid var(--border)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text)' };
  const tdOk = { ...td, background: 'rgba(14,90,82,.1)' };
  const tdPct = (v, target) => ({ ...td, background: v >= target ? 'rgba(15,140,63,.14)' : 'rgba(200,30,58,.1)', fontWeight: 700, textAlign: 'center' });

  // Grup dulu (lewat batchId eksplisit, lihat groupProduksiRows di atas)
  // sebelum sort -- satu baris tampilan per batch, bukan per Mesin.
  const groupedRows = useMemo(() => groupProduksiRows(rows), [rows]);

  // Default: urutkan berdasarkan Part Name supaya semua Proses milik part
  // yang sama berurutan (sort stabil -- urutan asli tiap part tetap
  // terjaga). Klik header kolom untuk mengurutkan manual sesuai kolom itu.
  const defaultSortedRows = useMemo(
    () => [...groupedRows].sort((a, b) => a.partName.localeCompare(b.partName)),
    [groupedRows],
  );
  const { sorted: sortedRows, sortKey, sortDir, toggleSort } = useSort(defaultSortedRows);

  // PENCAPAIAN RATA-RATA (footer) -- rata-rata polos dari AR/AVB/PERF/
  // YIELD/OEE tiap baris tampilan (per batch, bukan per Mesin -- baris
  // batch cuma dihitung sekali biar tidak berat sebelah ke batch yang
  // Mesin-nya banyak; field-field ini identik di semua Mesin satu batch
  // by design, lihat groupProduksiRows). Dashboard (ring AR/OEE Cluster &
  // Line) sengaja disamakan ke pola yang sama (lihat rowMetrics-average
  // di backend), supaya angka di tabel ini dan di dashboard selalu
  // konsisten untuk tanggal/Cluster yang sama.
  const avg = (key) => groupedRows.length ? (groupedRows.reduce((s, r) => s + (r[key] || 0), 0) / groupedRows.length).toFixed(1) : '0.0';

  // loading cuma menampilkan placeholder kalau BENAR-BENAR belum ada data
  // (mis. pertama kali buka halaman) -- refresh di belakang layar setelah
  // edit/tambah/hapus tetap menampilkan data lama sampai data baru
  // datang, supaya tabel tidak "collapse" jadi satu baris "Memuat…" yang
  // bikin tampilan lompat balik ke atas.
  if (loading && rows.length === 0) return <TableSkeleton rows={8} columns={10} />;
  if (rows.length === 0) return <EmptyErrorState status={error ? 'error' : 'empty'} onRetry={onRetry} />;

  let groupIdx = -1;
  let prevPartName = null;

  return (
    <>
    <div ref={scrollRef} style={{ overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: TABLE_MIN_WIDTH, tableLayout: 'fixed', background: 'var(--s1)' }}>
        <colgroup>
          {editable && <col style={{ width: `${AKSI_PCT}%` }} />}
          {COLUMNS.map((c) => <col key={c.key} style={{ width: `${widths[c.key]}%` }} />)}
        </colgroup>
        <thead>
          <tr>
            {editable && <th style={{ ...th, position: 'sticky', left: 0, zIndex: 1, cursor: 'default' }}>Aksi</th>}
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
              <tr key={r.id} style={{ background: groupBg, cursor: 'pointer' }} onClick={() => setDetailRow(r)}>
                {editable && (
                  <td
                    style={{ ...td, position: 'sticky', left: 0, background: groupBg === 'transparent' ? 'var(--s1)' : groupBg }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {r._group.length > 1 ? (
                      <GroupActionsMenu group={r._group} onEdit={onEdit} onDelete={onDelete} />
                    ) : (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => onEdit(r)} title="Edit" style={actionBtn}><Pencil size={12} /></button>
                        {onDelete && <button onClick={() => onDelete(r)} title="Hapus" style={{ ...actionBtn, color: 'var(--red)' }}><Trash2 size={12} /></button>}
                      </div>
                    )}
                  </td>
                )}
                <td style={td}>{r.shift || '—'}</td>
                <td style={td}>{formatDateID(r.tanggal)}</td>
                <td style={td}>{r.partName}</td>
                <td style={td}>{r.noLot || '—'}</td>
                <td style={td}>{r.proses}</td>
                <td style={td}>{r.line || '—'}</td>
                <td style={td}>{r.mesin}</td>
                <td style={td}>{r.manPower || '—'}</td>
                <td style={td}>{r.cycleTime}</td>
                <td style={td}>{r.waktuEfektif}</td>
                <td style={td}>{r.plan.toLocaleString()}</td>
                <td style={td}>{r.rework || ''}</td>
                <td style={td}>{r.reject || ''}</td>
                <td style={tdOk}>{r.totalOk.toLocaleString()}</td>
                <td style={tdOk}>{r.totalProses.toLocaleString()}</td>
                <td style={td}>{r.breakdownMesin || ''}</td>
                <td style={td}>{r.lostTime || ''}</td>
                <td style={td}>{r.keterangan || ''}</td>
                <td style={tdPct(r.ar, 100)}>{r.ar}%</td>
                <td style={tdPct(r.avb, 90)}>{r.avb}%</td>
                <td style={tdPct(r.perf, 95)}>{r.perf}%</td>
                <td style={tdPct(r.yield, 100)}>{r.yield}%</td>
                <td style={tdPct(r.oee, 85)}>{r.oee}%</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ ...td, fontWeight: 700, background: '#f5c542', color: '#3d4b4b' }} colSpan={editable ? 19 : 18}>PENCAPAIAN RATA-RATA</td>
            <td style={{ ...td, fontWeight: 700, background: '#f5c542', color: '#3d4b4b', textAlign: 'center' }}>{avg('ar')}%</td>
            <td style={{ ...td, fontWeight: 700, background: '#f5c542', color: '#3d4b4b', textAlign: 'center' }}>{avg('avb')}%</td>
            <td style={{ ...td, fontWeight: 700, background: '#f5c542', color: '#3d4b4b', textAlign: 'center' }}>{avg('perf')}%</td>
            <td style={{ ...td, fontWeight: 700, background: '#f5c542', color: '#3d4b4b', textAlign: 'center' }}>{avg('yield')}%</td>
            <td style={{ ...td, fontWeight: 700, background: '#f5c542', color: '#3d4b4b', textAlign: 'center' }}>{avg('oee')}%</td>
          </tr>
        </tfoot>
      </table>
    </div>
    <ProduksiRowDrawer row={detailRow} onClose={() => setDetailRow(null)} />
    </>
  );
}

const actionBtn = { background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 5, padding: '4px 6px', cursor: 'pointer', color: 'var(--text)', display: 'inline-flex' };
const menuItem = { display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', textAlign: 'left' };
