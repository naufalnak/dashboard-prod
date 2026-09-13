import { CheckCircle2 } from 'lucide-react';
import { previewNoLotRework } from './shared.jsx';

/* ── Layar sukses setelah submit Data Pengerjaan Rework ─────── */
export default function RwSuccessView({ data, onReset }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', overflow: 'auto' }}>
      <CheckCircle2 size={56} style={{ color: '#00a884', marginBottom: 14 }} />
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.4px', marginBottom: 8 }}>
        Data Pengerjaan Rework Berhasil Dikirim!
      </div>
      <div style={{ color: '#5a6b73', fontSize: 14, lineHeight: 1.7, marginBottom: 20, maxWidth: 460 }}>
        {data.partName} — No Lot Rework <strong>{previewNoLotRework(data.tanggalRepair)}</strong>
      </div>
      <button className="btn primary" style={{ width: '100%', maxWidth: 480, padding: '14px', fontSize: 16, color: '#fff', background: '#0e5a52', border: 'none', borderRadius: 8, cursor: 'pointer' }} onClick={onReset}>
        Input Rework Baru
      </button>
    </div>
  );
}
