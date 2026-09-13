import { CheckCircle2 } from 'lucide-react';
import { num } from './shared.jsx';

/* ── Layar sukses setelah submit Input Rejection ────── */
export default function RejSuccessView({ data, onReset }) {
  const totalProses = num(data.totalOk) + num(data.totalLmr);
  const ratio = num(data.totalOk) > 0 ? ((num(data.totalLmr) / num(data.totalOk)) * 100).toFixed(1) : '0.0';
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', overflow: 'auto' }}>
      <CheckCircle2 size={56} style={{ color: '#00a884', marginBottom: 14 }} />
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.4px', marginBottom: 8 }}>
        Data Rejection Berhasil Dikirim!
      </div>
      <div style={{ color: '#5a6b73', fontSize: 14, lineHeight: 1.7, marginBottom: 20, maxWidth: 460 }}>
        {data.partName} ({data.cluster}) telah tercatat.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10, width: '100%', maxWidth: 460, marginBottom: 20 }}>
        {[['Total Proses', totalProses.toLocaleString()], ['Total LMR', num(data.totalLmr).toLocaleString()], ['Reject Ratio', `${ratio}%`]].map(([label, val]) => (
          <div key={label} style={{ background: '#0e5a52', color: '#fff', borderRadius: 8, padding: '12px 6px' }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{val}</div>
            <div style={{ fontSize: 10, opacity: .85, marginTop: 2, letterSpacing: '.04em' }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ width: '100%', maxWidth: 480, background: '#f4f7f7', border: '1px solid #d7e0e0', borderRadius: 10, padding: '14px 18px', marginBottom: 22, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          ['Tanggal / Waktu', `${data.tanggal} · ${data.waktu}`],
          ['Total OK', num(data.totalOk).toLocaleString()],
          ['Kriteria NG', data.kriteriaNg || '—'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
            <span style={{ color: '#5a6b73', flexShrink: 0 }}>{k}</span>
            <span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span>
          </div>
        ))}
      </div>
      <button className="btn primary" style={{ width: '100%', maxWidth: 480, padding: '14px', fontSize: 16, color: '#fff', background: '#0e5a52', border: 'none', borderRadius: 8, cursor: 'pointer' }} onClick={onReset}>
        Input Rejection Baru
      </button>
    </div>
  );
}
