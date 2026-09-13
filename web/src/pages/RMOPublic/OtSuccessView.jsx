import { CheckCircle2 } from 'lucide-react';
import { num } from './shared.jsx';

/* ── Layar sukses setelah submit Input Overtime ─────── */
export default function OtSuccessView({ data, onReset }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', overflow: 'auto' }}>
      <CheckCircle2 size={56} style={{ color: '#00a884', marginBottom: 14 }} />
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.4px', marginBottom: 8 }}>
        Data Overtime Berhasil Dikirim!
      </div>
      <div style={{ color: '#5a6b73', fontSize: 14, lineHeight: 1.7, marginBottom: 20, maxWidth: 460 }}>
        {data.manPower} telah tercatat lembur {num(data.durasiJam)} jam.
      </div>

      <div style={{ width: '100%', maxWidth: 480, background: '#f4f7f7', border: '1px solid #d7e0e0', borderRadius: 10, padding: '14px 18px', marginBottom: 22, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          ['Tanggal / Waktu', `${data.tanggal} · ${data.waktu}`],
          ['Man Power', data.manPower || '—'],
          ['Durasi Lembur', `${num(data.durasiJam)} jam`],
          ['Keterangan', data.keterangan || '—'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
            <span style={{ color: '#5a6b73', flexShrink: 0 }}>{k}</span>
            <span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span>
          </div>
        ))}
      </div>
      <button className="btn primary" style={{ width: '100%', maxWidth: 480, padding: '14px', fontSize: 16, color: '#fff', background: '#0e5a52', border: 'none', borderRadius: 8, cursor: 'pointer' }} onClick={onReset}>
        Input Overtime Baru
      </button>
    </div>
  );
}
