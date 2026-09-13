// Donut/ring chart satu-nilai -- gaya stroke berlubang di tengah (sama
// seperti gauge AR/OEE di Dashboard, lihat GaugeCard.jsx), bukan pie
// solid penuh seperti sebelumnya. showInsideText menampilkan angka
// persen di tengah lubang ring (dipakai untuk ring utama yang besar);
// kalau false, label + angka ditulis di sebelah ring (dipakai untuk
// ring-ring kecil per Cluster/Jenis).
export default function MiniRing({ label, value, size = 50, color = '#0e5a52', showInsideText = false }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  const strokeW = Math.max(4, size * 0.14);
  const r = size / 2 - strokeW / 2 - 1;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const filled = (v / 100) * circ;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(150,155,165,.28)" strokeWidth={strokeW} />
        {v > 0 && (
          <circle
            cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={strokeW}
            strokeLinecap="round" strokeDasharray={`${filled} ${circ - filled}`}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        )}
        {showInsideText && (
          <text
            x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill={color}
            style={{ fontSize: size * 0.19, fontWeight: 800, fontFamily: 'Inter, sans-serif', fontVariantNumeric: 'tabular-nums' }}
          >
            {v}%
          </text>
        )}
      </svg>
      {!showInsideText && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>{label}</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{v}%</div>
        </div>
      )}
    </div>
  );
}
