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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      {/* width/height SVG dulu fixed px sama persis dengan `size` -- di
          kartu yang jadi lebih sempit dari `size` (layar kecil, atau zoom
          browser tinggi yang mengecilkan grid dalam satuan px CSS), SVG
          tidak ikut menyempit dan malah overflow lalu terpotong oleh
          .card{overflow:hidden}. width/height 100% + wrapper maxWidth
          bikin ring ini menyusut mengikuti ruang yang benar-benar
          tersedia, `size` cuma jadi batas atas seperti sebelumnya --
          minWidth jadi batas BAWAH supaya tidak ikut menyusut tanpa batas
          kalau kartu induknya sendiri jadi sangat sempit (mis. zoom
          browser ekstrem), ring cukup berhenti di ukuran kecil yang masih
          wajar dibaca, sisanya boleh sedikit mepet/scroll. */}
      <div style={{ width: size, maxWidth: '100%', minWidth: Math.max(28, size * 0.45), aspectRatio: '1', flexShrink: 0 }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`}>
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
      </div>
      {!showInsideText && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>{label}</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{v}%</div>
        </div>
      )}
    </div>
  );
}
