import { useState, useMemo } from 'react';

// Donut chart persentase Kriteria NG, diakumulasi dari RejectionEntry
// dalam periode terpilih -- struktur sama dengan JenisProblemChart, tapi
// warnanya dari palet siklik (bukan peta nama tetap) karena daftar
// Kriteria NG dikelola bebas lewat Master Data, bukan daftar 4M+1E yang
// sudah pasti.
const PALETTE = ['#ef4444', '#84cc16', '#ec4899', '#06b6d4', '#22c55e', '#6366f1', '#f59e0b', '#a855f7', '#14b8a6', '#f97316'];

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function MiniDot({ label, pct, size, color }) {
  const r = size / 2 - 2;
  const cx = size / 2, cy = size / 2;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill={color} />
      </svg>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{pct}%</div>
      </div>
    </div>
  );
}

export default function KriteriaNgChart({ data, mainSize = 200, miniSize = 62 }) {
  const [hover, setHover] = useState(null); // { jenis, count, pct, x, y }
  const colorOf = useMemo(() => {
    const map = {};
    data.forEach((d, i) => { map[d.jenis] = PALETTE[i % PALETTE.length]; });
    return map;
  }, [data]);

  if (!data.length) {
    return <div style={{ color: 'var(--muted)', fontSize: 12 }}>Belum ada data Kriteria NG.</div>;
  }
  const strokeW = mainSize * 0.16;
  const r = mainSize / 2 - strokeW / 2 - 1;
  const cx = mainSize / 2, cy = mainSize / 2;
  const circ = 2 * Math.PI * r;

  let acc = 0;
  const slices = data.map((d) => {
    const dash = (d.pct / 100) * circ;
    const offset = -((acc / 100) * circ);
    const mid = (acc + d.pct / 2) * 3.6; // persen -> derajat
    acc += d.pct;
    return { ...d, dash, offset, mid };
  });

  function moveTip(e, s) {
    const rect = e.currentTarget.closest('.kng-chart-wrap').getBoundingClientRect();
    setHover({ jenis: s.jenis, count: s.count, pct: s.pct, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
      <div className="kng-chart-wrap" style={{ position: 'relative', flexShrink: 0 }}>
        <svg width={mainSize} height={mainSize} viewBox={`0 0 ${mainSize} ${mainSize}`}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(150,155,165,.28)" strokeWidth={strokeW} />
          {slices.map((s) => (
            <circle
              key={s.jenis}
              cx={cx} cy={cy} r={r} fill="none"
              stroke={colorOf[s.jenis] || 'var(--accent)'} strokeWidth={strokeW}
              strokeDasharray={`${s.dash} ${circ - s.dash}`} strokeDashoffset={s.offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              opacity={hover && hover.jenis !== s.jenis ? 0.6 : 1}
              onMouseMove={(e) => moveTip(e, s)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer', transition: 'opacity .12s' }}
            />
          ))}
          {slices.map((s) => {
            if (s.pct < 6) return null;
            const pos = polarToCartesian(cx, cy, r, s.mid);
            return (
              <text
                key={s.jenis} x={pos.x} y={pos.y}
                textAnchor="middle" dominantBaseline="middle"
                style={{ fontSize: 12.5, fontWeight: 800, fill: '#fff', pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,.4)' }}
              >
                {s.pct}%
              </text>
            );
          })}
        </svg>
        {hover && (
          <div style={{
            position: 'absolute', left: hover.x + 12, top: hover.y - 8, transform: 'translateY(-100%)',
            background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px',
            fontSize: 11.5, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 5, boxShadow: '0 4px 12px rgba(0,0,0,.2)',
          }}>
            <strong>{hover.jenis}</strong>: {hover.pct}% ({hover.count})
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'space-between' }}>
        {slices.map((s) => (
          <MiniDot key={s.jenis} label={s.jenis} pct={s.pct} size={miniSize} color={colorOf[s.jenis] || 'var(--accent)'} />
        ))}
      </div>
    </div>
  );
}
