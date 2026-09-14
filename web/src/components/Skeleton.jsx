// Placeholder blok generik buat kondisi loading -- dipakai gantikan teks
// "Memuat…" di seluruh halaman. Reuse animasi @keyframes pulse yang sudah
// ada di index.css (bukan bikin animasi baru), cuma beda elemen: di sini
// jadi blok abu-abu berdenyut, bukan teks yang berkedip.
export function Skeleton({ width = '100%', height = 14, radius = 6, style, className = '' }) {
  return <div className={`skeleton ${className}`} style={{ width, height, borderRadius: radius, ...style }} />;
}

// Placeholder lingkaran -- buat gauge/ring/donut yang lagi loading.
export function SkeletonCircle({ size = 174, style }) {
  return <Skeleton width={size} height={size} radius="50%" style={style} />;
}

// Beberapa baris teks placeholder lebar berbeda-beda (biar tidak kelihatan
// seperti kotak sempurna berulang).
export function SkeletonText({ lines = 1, height = 12, gap = 8, style }) {
  const widths = Array.from({ length: lines }, (_, i) => `${92 - (i % 3) * 14}%`);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, ...style }}>
      {widths.map((w, i) => <Skeleton key={i} width={w} height={height} />)}
    </div>
  );
}

// Satu blok persegi -- buat area chart/trend yang lagi loading.
export function SkeletonBlock({ height = 160, radius = 9, style }) {
  return <Skeleton width="100%" height={height} radius={radius} style={style} />;
}

// Beberapa baris selebar berbeda -- buat list/bar-list/tabel yang lagi
// loading (mirip bentuk baris data aslinya tanpa perlu tahu bentuk persis).
export function SkeletonRows({ rows = 4, height = 16, gap = 12, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap, padding: '4px 0', ...style }}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={height} width={`${90 - (i % 4) * 8}%`} />
      ))}
    </div>
  );
}
