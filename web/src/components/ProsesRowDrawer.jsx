import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Drawer detail 1 baris Part Name & Proses di Master Data -- sama pola
// dengan ProduksiRowDrawer (klik baris tabel Data Produksi), dirender
// lewat createPortal ke document.body karena alasan containing-block yang
// sama (lihat komentar di ProduksiRowDrawer.jsx). `row` di sini adalah
// baris MasterProses, ditambah `price`/`dataCount` yang dihitung di
// pemanggil (PartProsesTab) karena keduanya bukan bagian dari row aslinya.
const FIELD_GROUPS = [
  {
    title: 'Umum',
    fields: [
      ['Part Name', (r) => r.partName],
      ['Cluster', (r) => r.cluster || '—'],
      ['ID Code', (r) => r.idCode || '—'],
    ],
  },
  {
    title: 'Proses',
    fields: [
      ['Proses', (r) => r.proses],
      ['Line Produksi', (r) => r.line || '—'],
      ['Mesin', (r) => r.mesin || '—'],
      ['Man Power', (r) => r.manPower || '—'],
      ['Cycle Time (detik/pcs)', (r) => r.cycleTime],
    ],
  },
  {
    title: 'Status',
    fields: [
      ['Proses Akhir/Finish', (r) => (r.isFinishProses ? 'Ya — dipakai sebagai Total OK Input Rejection' : 'Belum')],
      ['Jumlah Data', (r) => `${(r.dataCount ?? 0).toLocaleString()} baris RC Harian Produksi`],
    ],
  },
];

export default function ProsesRowDrawer({ row, onClose }) {
  if (!row) return null;
  return createPortal(
    <div className="overlay show" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560, borderRadius: '14px 14px 0 0' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {row.partName}
          </div>
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
