import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { apiFetch } from '../api.js';
import { Skeleton } from './Skeleton.jsx';

const AR_OK_THRESHOLD = 90;

// Popup (bukan halaman/menu baru) berisi rincian AR% per Shift untuk satu
// Cluster -- muncul saat slice/legend Cluster di ArClusterDonut (Detail
// AR) diklik. createPortal ke document.body sama pola dengan modal-modal
// lain yang dipanggil dari dalam .card (lihat catatan di
// PartProsesTab.jsx EditProsesModal) -- .card punya animasi fadeUp yang
// meninggalkan transform aktif permanen, bikin position:fixed di
// dalamnya jadi relatif ke .card itu sendiri kalau tidak di-portal.
export default function ArShiftPopup({ cluster, period, refDate, logout, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = `cluster=${encodeURIComponent(cluster)}&period=${period}&date=${refDate}`;
    apiFetch(`/ar-by-shift?${qs}`, [], logout).then((d) => { setRows(d); setLoading(false); });
  }, [cluster, period, refDate, logout]);

  const max = Math.max(...rows.map((r) => r.ar), 1);

  // Overlay/modal app ini defaultnya gaya bottom-sheet (align-items:
  // flex-end, border-radius cuma di atas -- lihat .overlay/.modal di
  // index.css, dipakai konsisten di semua modal lain). Popup kecil ini
  // sengaja beda: di-tengah layar, bukan nempel di bawah, jadi override
  // lewat inline style di sini saja (bukan ubah .overlay/.modal global
  // yang dipakai modal-modal lain).
  return createPortal(
    <div className="overlay show" style={{ alignItems: 'center', padding: 20 }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 460, width: 'auto', minWidth: 380, borderRadius: 14 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">AR per Shift — Cluster {cluster}</div>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        {loading ? (
          <Skeleton height={14} width="60%" />
        ) : rows.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>Belum ada data untuk periode ini.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {rows.map((r) => (
              <div key={r.shift} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 110, flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }} title={r.shift}>{r.shift}</div>
                <div style={{ flex: 1, background: 'var(--s3)', borderRadius: 4, height: 14, overflow: 'hidden' }}>
                  <div style={{
                    width: `${(r.ar / max) * 100}%`, height: '100%', borderRadius: 4, transition: 'width .5s ease',
                    background: r.ar < AR_OK_THRESHOLD ? 'var(--red)' : 'var(--accent)',
                  }}></div>
                </div>
                <div style={{ width: 46, flexShrink: 0, textAlign: 'right', fontSize: 12.5, fontWeight: 700, color: r.ar < AR_OK_THRESHOLD ? 'var(--red)' : 'var(--text)' }}>{r.ar}%</div>
                <div style={{ width: 60, flexShrink: 0, textAlign: 'right', fontSize: 10.5, color: 'var(--muted)' }}>{r.entries} data</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
