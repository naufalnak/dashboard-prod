import { useState } from 'react';
import { X } from 'lucide-react';

// Sel tabel generik: teks tidak pernah di-wrap (dipotong dengan ellipsis
// jika kepanjangan), tapi bisa diklik untuk membuka teks lengkapnya dalam
// tampilan "zoom" (modal), supaya nama/keterangan yang panjang tetap bisa
// dibaca tanpa merusak lebar kolom tabel. `label` (nama head kolomnya,
// mis. "Problem" atau "Root Cause") ditampilkan sebagai judul popup
// supaya jelas data apa yang sedang dilihat -- bukan cuma "Detail" polos.
export default function ZoomCell({ children, maxWidth, style, title, label }) {
  const [zoom, setZoom] = useState(false);
  const text = children == null || children === '' ? '—' : children;
  const hasText = children != null && children !== '';

  return (
    <>
      <span
        onClick={hasText ? (e) => { e.stopPropagation(); setZoom(true); } : undefined}
        title={title || (typeof text === 'string' ? text : undefined)}
        style={{
          display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: maxWidth || '100%', cursor: hasText ? 'zoom-in' : 'default', ...style,
        }}
      >
        {text}
      </span>
      {zoom && (
        <div className="overlay show" onClick={(e) => { e.stopPropagation(); setZoom(false); }}>
          <div className="modal" style={{ maxWidth: 480, borderRadius: 14, margin: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ fontSize: 15 }}>{label || 'Detail'}</div>
              <button className="modal-close" onClick={() => setZoom(false)}><X size={20} /></button>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
              {text}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
