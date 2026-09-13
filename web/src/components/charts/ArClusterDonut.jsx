import { useState } from 'react';
import { CLUSTER_COLORS } from '../ClusterBarList.jsx';

const AR_OK_THRESHOLD = 90;

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// Donut AR per Cluster -- gaya sama dengan JenisProblemChart (ring
// berlubang, tiap Cluster satu segmen stroke), tapi UKURAN segmennya
// proporsional ke kontribusi Cluster itu terhadap total volume produksi
// (Ok+Rework+Reject semua Cluster), BUKAN ke nilai AR-nya sendiri -- AR
// itu persen per Cluster yang tidak otomatis jadi 100% kalau dijumlah
// semua Cluster, jadi tidak valid dipakai langsung sebagai ukuran slice
// pie/donut. Warna & label tetap AR% masing-masing Cluster. Klik slice
// atau baris legend memanggil onClickCluster (buka popup rincian per
// Shift, lihat ArShiftPopup.jsx).
export default function ArClusterDonut({ data, avgAr, mainSize = 200, onClickCluster }) {
  const [hover, setHover] = useState(null);

  if (!data.length) {
    return <div style={{ color: 'var(--muted)', fontSize: 12 }}>Belum ada data.</div>;
  }

  const strokeW = mainSize * 0.16;
  const r = mainSize / 2 - strokeW / 2 - 1;
  const cx = mainSize / 2, cy = mainSize / 2;
  const circ = 2 * Math.PI * r;
  const totalVolume = data.reduce((s, d) => s + (d.volume || 0), 0) || 1;

  let acc = 0;
  const slices = data.map((d) => {
    const sharePct = (d.volume || 0) / totalVolume * 100;
    const dash = (sharePct / 100) * circ;
    const offset = -((acc / 100) * circ);
    const mid = (acc + sharePct / 2) * 3.6;
    acc += sharePct;
    return { ...d, sharePct, dash, offset, mid };
  });

  function moveTip(e, s) {
    const rect = e.currentTarget.closest('.ar-donut-wrap').getBoundingClientRect();
    setHover({ cluster: s.cluster, ar: s.ar, sharePct: s.sharePct, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', minWidth: 0 }}>
      <div className="ar-donut-wrap" style={{ position: 'relative', flexShrink: 0, width: mainSize, maxWidth: '100%', minWidth: Math.max(90, mainSize * 0.5), aspectRatio: '1' }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${mainSize} ${mainSize}`}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(150,155,165,.28)" strokeWidth={strokeW} />
          {slices.map((s) => (
            <circle
              key={s.cluster}
              cx={cx} cy={cy} r={r} fill="none"
              stroke={CLUSTER_COLORS[s.cluster] || 'var(--accent)'} strokeWidth={strokeW}
              strokeDasharray={`${s.dash} ${circ - s.dash}`} strokeDashoffset={s.offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              opacity={hover && hover.cluster !== s.cluster ? 0.6 : 1}
              onMouseMove={(e) => moveTip(e, s)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onClickCluster?.(s.cluster)}
              style={{ cursor: onClickCluster ? 'pointer' : 'default', transition: 'opacity .12s' }}
            />
          ))}
          {slices.map((s) => {
            if (s.sharePct < 8) return null;
            const pos = polarToCartesian(cx, cy, r, s.mid);
            return (
              <text
                key={s.cluster} x={pos.x} y={pos.y}
                textAnchor="middle" dominantBaseline="middle"
                style={{ fontSize: 12.5, fontWeight: 800, fill: '#fff', pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,.4)' }}
              >
                {s.cluster}
              </text>
            );
          })}
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: avgAr < AR_OK_THRESHOLD ? 'var(--red)' : 'var(--accent)', lineHeight: 1 }}>{avgAr}%</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Rata-rata</div>
        </div>
        {hover && (
          <div style={{
            position: 'absolute', left: hover.x + 12, top: hover.y - 8, transform: 'translateY(-100%)',
            background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px',
            fontSize: 11.5, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 5, boxShadow: '0 4px 12px rgba(0,0,0,.2)',
          }}>
            <strong>Cluster {hover.cluster}</strong>: AR {hover.ar}% · {hover.sharePct.toFixed(0)}% volume produksi
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'space-between', minWidth: 0 }}>
        {slices.map((s) => (
          <div
            key={s.cluster}
            onClick={() => onClickCluster?.(s.cluster)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: onClickCluster ? 'pointer' : 'default' }}
            title={onClickCluster ? `Lihat rincian AR per Shift — Cluster ${s.cluster}` : undefined}
          >
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: CLUSTER_COLORS[s.cluster] || 'var(--accent)', flexShrink: 0 }}></span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Cluster {s.cluster}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: s.ar < AR_OK_THRESHOLD ? 'var(--red)' : 'var(--text)' }}>{s.ar}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
