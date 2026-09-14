import { useState } from 'react';

// Ranked horizontal/side bar chart — tiap baris satu Line Produksi, bar
// tumbuh dari kiri ke kanan. Urutan render = urutan array (baris pertama
// paling atas), jadi caller yang menentukan mana yang tampil di atas
// (untuk "Tertinggi" berarti AR tertinggi, untuk "Terendah" berarti AR
// terendah/paling perlu perhatian).
// mode="good" (hijau) atau mode="bad" (merah) menimpa warna cluster
// default supaya makna baik/buruknya jelas sekilas.
// Label nama Line ditulis di sebelah kiri dan dibiarkan turun ke baris
// berikutnya (wrap) kalau kepanjangan -- tidak pernah dipotong dengan
// ellipsis -- dan mengarahkan cursor ke bar-nya menampilkan tooltip
// dengan nama lengkap + persentase, meniru contoh yang diberikan.
export default function HorizontalBarList({ data, mode = null, valueKey = 'ar', unit = '%' }) {
  const [hoverIdx, setHoverIdx] = useState(null);

  if (!data.length) {
    return <div style={{ color: 'var(--muted)', fontSize: 12 }}>Belum ada data.</div>;
  }
  const max = Math.max(...data.map((d) => d[valueKey]), 1);
  const barColor = mode === 'good' ? 'var(--green)' : mode === 'bad' ? 'var(--red)' : 'var(--accent)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {data.map((d, i) => {
        const val = d[valueKey];
        const wPct = (val / max) * 100;
        const hovered = hoverIdx === i;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 106, flexShrink: 0 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.25, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                {d.line}
              </div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--muted)' }}>{d.cluster}</div>
            </div>
            <div
              style={{ flex: 1, position: 'relative', background: 'var(--s3)', borderRadius: 4, height: 16, overflow: 'visible', minWidth: 0 }}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx((v) => (v === i ? null : v))}
            >
              <div style={{ width: `${wPct}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width .6s ease', overflow: 'hidden' }}></div>
              {hovered && (
                <div style={{
                  position: 'absolute', left: 0, bottom: 'calc(100% + 6px)', zIndex: 20,
                  background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 6,
                  padding: '5px 9px', fontSize: 11.5, whiteSpace: 'nowrap', boxShadow: '0 6px 18px rgba(0,0,0,.28)',
                  pointerEvents: 'none',
                }}>
                  <strong>{d.line}</strong> ({d.cluster}): {val}{unit}
                </div>
              )}
            </div>
            <div style={{ width: 42, flexShrink: 0, textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{val}{unit}</div>
          </div>
        );
      })}
    </div>
  );
}
