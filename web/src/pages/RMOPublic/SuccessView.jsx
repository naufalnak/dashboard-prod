import { CheckCircle2 } from 'lucide-react';

/* ── Layar sukses setelah submit ────────────────────── */
export default function SuccessView({ data, metrics, onReset }) {
  const tiles = [
    ['AR', metrics.ar], ['AVB', metrics.avb], ['PERF', metrics.perf],
    ['YIELD', metrics.yield], ['OEE', metrics.oee],
  ];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', overflow: 'auto' }}>
      <CheckCircle2 size={56} style={{ color: '#00a884', marginBottom: 14 }} />
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.4px', marginBottom: 8 }}>
        Data Berhasil Dikirim!
      </div>
      <div style={{ color: '#5a6b73', fontSize: 14, lineHeight: 1.7, marginBottom: 20, maxWidth: 460 }}>
        {data.partName} — {data.proses} ({data.mesin}) untuk <strong>{data.line}</strong> telah tercatat.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))', gap: 10, width: '100%', maxWidth: 560, marginBottom: 20 }}>
        {tiles.map(([label, val]) => (
          <div key={label} style={{ background: '#0e5a52', color: '#fff', borderRadius: 8, padding: '12px 6px' }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{val}%</div>
            <div style={{ fontSize: 10, opacity: .85, marginTop: 2, letterSpacing: '.04em' }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ width: '100%', maxWidth: 480, background: '#f4f7f7', border: '1px solid #d7e0e0', borderRadius: 10, padding: '14px 18px', marginBottom: 22, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          ['Tanggal / Shift', `${data.tanggal} · ${data.shift}`],
          ['Cluster / Line', `${data.cluster} / ${data.line}`],
          ['Total OK / Total Proses', `${metrics.totalOk} / ${metrics.totalProses}`],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
            <span style={{ color: '#5a6b73', flexShrink: 0 }}>{k}</span>
            <span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span>
          </div>
        ))}
      </div>
      <button className="btn primary" style={{ width: '100%', maxWidth: 480, padding: '14px', fontSize: 16, color: '#fff', background: '#0e5a52', border: 'none', borderRadius: 8, cursor: 'pointer' }} onClick={onReset}>
        Buat Laporan Baru
      </button>
    </div>
  );
}
