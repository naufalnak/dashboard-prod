import { CheckCircle2 } from 'lucide-react';
import InfoTip from './InfoTip.jsx';
import { useTargets } from '../contexts/TargetsContext.jsx';

export default function AvailabilityCard({ kpi }) {
  const { availabilityTarget } = useTargets();
  const av      = kpi.availability ?? 0;
  const planned = kpi.planned_hours ?? 0;
  const plannedMnt = kpi.planned_hours_minutes ?? Math.round(planned * 60);
  const downtime = kpi.downtime_hrs ?? 0;
  const uptime  = Math.max(0, planned - downtime);

  const isOk   = av >= availabilityTarget;
  const isWarn = av >= (availabilityTarget * 0.85) && !isOk;
  const colVar = isOk ? 'var(--green)' : isWarn ? 'var(--yellow)' : 'var(--red)';

  const r    = 66;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(av / 100, 1) * circ;

  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div className="card-title">Availability</div>
          <InfoTip text={`(Jam Kerja Mesin × Hari Kerja − Downtime) ÷ (Jam Kerja Mesin × Hari Kerja) × 100%. Hari kerja sesuai Kalender Kerja di menu Pengaturan. Target ≥ ${availabilityTarget}%.`} />
        </div>
      </div>

      {/* SVG circle gauge — nilai ditampilkan di stats row, bukan di tengah
          lingkaran. Wrapper width:174+maxWidth:100% (bukan svg width/height
          fixed 174px) supaya ring ikut menyusut kalau kartunya lebih sempit
          dari itu, bukan overflow lalu terpotong .card{overflow:hidden} --
          minWidth+flexShrink:0 supaya tidak ikut menyusut tanpa batas kalau
          kartu induknya jadi sangat sempit di zoom ekstrem. */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 8px' }}>
        <div style={{ width: 174, maxWidth: '100%', minWidth: 100, aspectRatio: '1', flexShrink: 0 }}>
          <svg width="100%" height="100%" viewBox="0 0 174 174">
            {/* track */}
            <circle cx={87} cy={87} r={r} fill="none" stroke="var(--s3)" strokeWidth={13} />
            {/* arc */}
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
            {/* percentage in center */}
            <text x={87} y={87} textAnchor="middle" dominantBaseline="middle"
              fill={colVar}
              style={{ fontSize: 30, fontWeight: 700, fontFamily: 'Inter,sans-serif', letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>
              {av.toFixed(1)}%
            </text>
          </svg>
        </div>
      </div>

      {/* target status */}
      <div style={{ textAlign: 'center', fontSize: 12, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
        {isOk ? (
          <>
            <CheckCircle2 size={13} style={{ color: colVar, flexShrink: 0 }} />
            <span style={{ color: colVar }}>Target {availabilityTarget}% — terlampaui</span>
          </>
        ) : (
          <span style={{ color: 'var(--muted)' }}>Target {availabilityTarget}% — belum tercapai</span>
        )}
      </div>

      {/* stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 16, fontWeight: 700 }}>{planned.toFixed(1)}</div>
          <div style={{ fontSize: 8, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 1 }}>Total Waktu Kerja</div>
          <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{plannedMnt.toLocaleString()} mnt</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 16, fontWeight: 700, color: 'var(--red)' }}>{downtime.toFixed(1)}</div>
          <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>Downtime (jam)</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 16, fontWeight: 700, color: 'var(--green)' }}>{uptime.toFixed(1)}</div>
          <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>Uptime (jam)</div>
        </div>
      </div>
    </div>
  );
}
