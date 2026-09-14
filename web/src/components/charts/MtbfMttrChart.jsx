import LineTrendChart from './LineTrendChart.jsx';

export default function MtbfMttrChart({ data, lineLabel, year, lines = [], mtbfLine = '', setMtbfLine }) {
  const scope = lineLabel ? ` — LINE ${lineLabel.toUpperCase()}` : '';
  return (
    <div>
      {lines.length > 0 && setMtbfLine && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>Line:</span>
          <div className="gc-pill-wrap">
            <select
              className={`gc-pill-select${mtbfLine ? ' selected' : ''}`}
              value={mtbfLine}
              onChange={(e) => setMtbfLine(e.target.value)}
            >
              <option value="">Semua Line</option>
              {lines.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="gc-caret" style={{ pointerEvents: 'none' }}><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
      )}
      <div className="row2-equal">
        <LineTrendChart
          title={`MTBF${scope}`}
          data={data} valueKey="mtbf" targetKey="mtbfTarget"
          color="var(--purple)" unit="jam"
          targetColor="var(--yellow)"
          legendItems={[
            { type: 'dot', color: 'var(--purple)', label: 'MTBF (jam)' },
            { type: 'line', color: 'var(--yellow)', label: 'Target MTBF' },
          ]}
        />
        <LineTrendChart
          title={`MTTR${scope}`}
          data={data} valueKey="mttr" targetKey="mttrTarget"
          color="var(--yellow)" overTargetColor="var(--red)" unit="jam"
          targetColor="var(--yellow)"
          legendItems={[
            { type: 'dot', color: 'var(--yellow)', label: 'MTTR (jam)' },
            { type: 'line', color: 'var(--yellow)', label: 'Target ≤1 jam' },
          ]}
        />
      </div>
    </div>
  );
}
