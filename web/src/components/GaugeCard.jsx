import { CheckCircle2, ChevronRight } from 'lucide-react';
import InfoTip from './InfoTip.jsx';
import { SkeletonCircle, Skeleton } from './Skeleton.jsx';

export default function GaugeCard({ title, value, target, infoText, onClick, comingSoon, loading = false, invert = false }) {
  if (comingSoon) {
    return (
      <div className="card" style={{ opacity: .55, background: 'var(--s2)' }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div className="card-title">{title}</div>
            {infoText && <InfoTip text={infoText} />}
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '38px 0' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Data belum tersedia</div>
        </div>
      </div>
    );
  }

  const v = value ?? 0;
  const isOk   = invert ? v <= target : v >= target;
  const isWarn = !isOk && (invert ? v <= target * 1.15 : v >= target * 0.85);
  const colVar = isOk ? 'var(--green)' : isWarn ? 'var(--yellow)' : 'var(--red)';

  const r    = 66;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(v / 100, 1) * circ;

  return (
    <div className="card" onClick={onClick} style={{ background: 'var(--s2)', ...(onClick ? { cursor: 'pointer' } : null) }}>
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div className="card-title">{title}</div>
          {infoText && <InfoTip text={infoText} />}
        </div>
        {onClick && <ChevronRight size={15} style={{ color: 'var(--muted)' }} />}
      </div>

      {loading ? (
        <>
          <div style={{ textAlign: 'center', padding: '4px 0 8px', display: 'flex', justifyContent: 'center' }}>
            <SkeletonCircle size={174} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Skeleton width={140} height={12} />
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 8px' }}>
            {/* Dulu width/height fixed 174px -- kartu yang jadi lebih
                sempit dari itu (zoom browser tinggi/layar kecil) bikin
                ring ini overflow lalu terpotong oleh .card{overflow:hidden}.
                Wrapper width:174 + maxWidth:100% bikin 174 cuma jadi batas
                atas, SVG-nya sendiri ikut menyusut kalau ruangnya sempit --
                minWidth+flexShrink:0 supaya tidak ikut menyusut tanpa batas
                kalau kartu induknya jadi sangat sempit di zoom ekstrem. */}
            <div style={{ width: 174, maxWidth: '100%', minWidth: 100, aspectRatio: '1', flexShrink: 0 }}>
              <svg width="100%" height="100%" viewBox="0 0 174 174">
                <circle cx={87} cy={87} r={r} fill="none" stroke="rgba(150,155,165,.28)" strokeWidth={13} />
                <circle
                  cx={87} cy={87} r={r}
                  fill="none"
                  stroke={colVar}
                  strokeWidth={13}
                  strokeLinecap="round"
                  strokeDasharray={`${filled} ${circ}`}
                  transform="rotate(-90 87 87)"
                  style={{ transition: 'stroke-dasharray 1.4s cubic-bezier(.4,0,.2,1)' }}
                />
                <text x={87} y={87} textAnchor="middle" dominantBaseline="middle"
                  fill={colVar}
                  style={{ fontSize: 30, fontWeight: 700, fontFamily: 'Inter,sans-serif', letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>
                  {v.toFixed(1)}%
                </text>
              </svg>
            </div>
          </div>

          <div style={{ textAlign: 'center', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            {isOk ? (
              <>
                <CheckCircle2 size={13} style={{ color: colVar, flexShrink: 0 }} />
                <span style={{ color: colVar }}>Target {invert ? '≤' : ''}{target}% — tercapai</span>
              </>
            ) : (
              <span style={{ color: 'var(--muted)' }}>Target {invert ? '≤' : ''}{target}% — belum tercapai</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
