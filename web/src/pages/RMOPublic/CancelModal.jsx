import { AlertTriangle } from 'lucide-react';

/* ── Popup konfirmasi batal ─────────────────────────── */
export default function CancelModal({ onConfirm, onDismiss }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onDismiss}>
      <div style={{ background: '#fff', border: '1px solid #d7e0e0', borderRadius: 12, padding: '32px 28px', maxWidth: 380, width: '88%', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
        <AlertTriangle size={40} style={{ color: '#d9534f', marginBottom: 14 }} />
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Batalkan Input?</div>
        <div style={{ fontSize: 13, color: '#5a6b73', lineHeight: 1.6, marginBottom: 24 }}>Semua data yang sudah diisi akan dihapus dan tidak tersimpan.</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ flex: 1, padding: '11px', fontSize: 14, background: '#eef2f2', border: '1px solid #d7e0e0', borderRadius: 7, cursor: 'pointer', fontWeight: 600 }} onClick={onDismiss}>Tidak</button>
          <button style={{ flex: 1, padding: '11px', fontSize: 14, background: '#d9534f', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 600 }} onClick={onConfirm}>Ya, Batalkan</button>
        </div>
      </div>
    </div>
  );
}
