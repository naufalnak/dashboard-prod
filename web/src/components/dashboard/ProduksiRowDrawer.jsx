import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { formatDateID } from '../../dateFmt.js';

// Drawer detail 1 baris Data Produksi -- pengganti fitur "zoom per sel"
// (ZoomCell) yang sebelumnya dipakai di ProduksiTable: sekarang klik baris
// mana pun langsung menampilkan SEMUA field baris itu sekaligus (setara 1
// kali input RC Harian Produksi), bukan cuma satu sel yang diklik. Pakai
// kelas .overlay/.modal yang sudah ada (slide-up dari bawah), bukan
// komponen baru -- konsisten dengan modal lain di app ini.
//
// Dirender lewat createPortal ke document.body (bukan langsung di tempat
// komponen ini dipanggil) -- ProduksiTable selalu dipakai di dalam
// elemen ber-class .card, dan .card punya animasi (fadeUp) yang
// meninggalkan `transform` aktif permanen di akhir animasinya. `position:
// fixed` di dalam elemen manapun yang punya transform aktif jadi relatif
// ke elemen itu, BUKAN ke viewport -- makanya tanpa portal, drawer ini
// ikut tergeser saat halaman discroll alih-alih diam menutupi satu layar
// penuh. Portal ke body melewati masalah containing-block ini sepenuhnya.
const FIELD_GROUPS = [
  {
    title: 'Umum',
    fields: [
      ['Tanggal', (r) => formatDateID(r.tanggal)],
      ['Shift', (r) => r.shift],
      ['Cluster', (r) => r.cluster],
      ['Grup Head', (r) => r.grupHead || '—'],
      ['Line Produksi', (r) => r.line || '—'],
    ],
  },
  {
    title: 'Part & Proses',
    fields: [
      ['Nama Parts', (r) => r.partName],
      ['No Lot', (r) => r.noLot || '—'],
      ['Proses', (r) => r.proses],
      ['Mesin', (r) => r.mesin],
      ['Man Power', (r) => r.manPower || '—'],
    ],
  },
  {
    title: 'Produksi',
    fields: [
      ['Cycle Time', (r) => r.cycleTime],
      ['Waktu Efektif (Jam)', (r) => r.waktuEfektif],
      ['Plan', (r) => r.plan?.toLocaleString()],
      ['Rework', (r) => r.rework || 0],
      ['Reject', (r) => r.reject || 0],
      ['Total OK', (r) => r.totalOk?.toLocaleString()],
      ['Total Proses', (r) => r.totalProses?.toLocaleString()],
    ],
  },
  {
    title: 'Kendala',
    fields: [
      ['Breakdown Mesin (menit)', (r) => r.breakdownMesin || 0],
      ['Lost Time (menit)', (r) => r.lostTime || 0],
      ['Keterangan', (r) => r.keterangan || '—'],
    ],
  },
  {
    title: 'Pencapaian',
    fields: [
      ['AR', (r) => `${r.ar}%`],
      ['AVB', (r) => `${r.avb}%`],
      ['PERF', (r) => `${r.perf}%`],
      ['YIELD', (r) => `${r.yield}%`],
      ['OEE', (r) => `${r.oee}%`],
    ],
  },
];

export default function ProduksiRowDrawer({ row, onClose }) {
  if (!row) return null;
  return createPortal(
    <div className="overlay show" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560, borderRadius: '14px 14px 0 0' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{row.partName}</div>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        {FIELD_GROUPS.map((g) => (
          <div key={g.title} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
              {g.title}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px 16px' }}>
              {g.fields.map(([label, get]) => (
                <div key={label}>
                  <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{get(row) ?? '—'}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
