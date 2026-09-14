import { useEffect, useRef, useState } from 'react';

const MIN_VISIBLE = 3;
const ROTATE_THRESH = 35;
const ROTATE_ANGLE = -(40 * Math.PI) / 180;

function formatAxisLabel(label, hourly) {
  const s = String(label ?? '').trim();
  if (s === 'TOTAL' || s === 'Avg') return s;
  if (!hourly) return s;
  const h = parseInt(s, 10);
  if (!isNaN(h) && h >= 0 && h <= 23 && /^\d{1,2}$/.test(s)) {
    if (h === 0)  return '12AM';
    if (h < 12)   return `${h}AM`;
    if (h === 12) return '12PM';
    return `${h - 12}PM`;
  }
  return s;
}

// Garis tren mengikuti kontur data (rata-rata bergerak, bukan garis lurus
// regresi) -- window kecil di tengah tiap titik supaya tetap halus tapi
// naik-turun ikut bentuk data aslinya.
function calcSmoothTrend(arr, window = 3) {
  const n = arr.length;
  const half = Math.floor(window / 2);
  return arr.map((_, i) => {
    const lo = Math.max(0, i - half);
    const hi = Math.min(n - 1, i + half);
    let sum = 0, cnt = 0;
    for (let j = lo; j <= hi; j++) { sum += arr[j]; cnt++; }
    return sum / cnt;
  });
}

// Gambar garis halus (bukan segmen lurus antar titik) dengan kurva
// kuadratik lewat titik tengah tiap pasangan titik -- teknik umum untuk
// bikin line chart terlihat mengalir mengikuti kontur, bukan patah-patah.
function drawSmoothLine(ctx, points) {
  if (points.length < 2) return;
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
}

function ChartCanvas({
  data, valueKey, targetKey, color, unit, hourly,
  showMovingAvg, movingAvgColor, overTargetColor, targetColor, fixedMax,
}) {
  const canvasRef = useRef(null);
  const tipRef    = useRef(null);
  const wrapRef   = useRef(null);
  const zoomRef   = useRef(1);
  const panRef    = useRef(0);
  const [zoom, setZoom]         = useState(1);
  const [panStart, setPanStart] = useState(0);
  const [tick, setTick]         = useState(0);

  const hasTotal  = data?.[data.length - 1]?.day === 'TOTAL' || data?.[data.length - 1]?.day === 'Avg';
  const mainData  = hasTotal ? data.slice(0, -1) : (data || []);
  const totalRow  = hasTotal ? data[data.length - 1] : null;

  useEffect(() => {
    setZoom(1); setPanStart(0);
    zoomRef.current = 1; panRef.current = 0;
  }, [mainData.length]);

  const n            = mainData.length;
  const visibleCount = Math.max(MIN_VISIBLE, Math.min(n, Math.round(n * zoom)));
  const maxStart     = Math.max(0, n - visibleCount);
  const start        = Math.min(panStart, maxStart);
  const visibleMain  = mainData.slice(start, start + visibleCount);
  const visibleData  = totalRow ? [...visibleMain, totalRow] : visibleMain;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const handler = (e) => {
      if (!n) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const dir  = e.deltaY > 0 ? 1 : -1;
      const pz   = zoomRef.current;
      const pp   = panRef.current;
      const pv   = Math.max(MIN_VISIBLE, Math.min(n, Math.round(n * pz)));
      const nz   = Math.min(1, Math.max(MIN_VISIBLE / Math.max(n, 1), pz + dir * 0.12));
      const nv   = Math.max(MIN_VISIBLE, Math.min(n, Math.round(n * nz)));
      const np   = Math.max(0, Math.min(Math.max(0, n - nv),
                     Math.round(pp + relX * pv - relX * nv)));
      zoomRef.current = nz; panRef.current = np;
      setZoom(nz); setPanStart(np);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [n]);

  useEffect(() => {
    if (!visibleData?.length || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const wrapEl = canvas.parentElement;
    const W      = wrapEl.offsetWidth || 360;
    const m      = visibleData.length;
    const padL   = 34;
    const slotW  = (W - padL - 4) / Math.max(m, 1);
    const rotate = slotW < ROTATE_THRESH;
    const FONT   = 10;
    const padB   = rotate ? 46 : 18;
    // H SENGAJA tetap formula tetap (bukan wrapEl.clientHeight) -- sempat
    // dicoba baca tinggi .trend-wrap supaya kanvas ikut mengisi kartu yang
    // diregangkan lebih tinggi, tapi itu bikin lingkaran setan: tinggi
    // .trend-wrap (flex:1, tanpa CSS height selain dari kanvas anaknya)
    // sebagian ikut dipengaruhi tinggi kanvas, ResizeObserver di bawah
    // mendeteksi perubahan itu lalu redraw dengan H yang lebih besar lagi,
    // dst -- kartu (dan semua kartu sebaris lewat alignItems:'stretch')
    // membesar tanpa henti. Ruang kosong sisa di bawah kanvas sekarang
    // dibiarkan dibagi rata lewat CSS (align-items:center di .trend-wrap,
    // lihat index.css) supaya tidak menumpuk semua di bawah tanpa perlu
    // kanvas ikut membesar.
    const H      = 130 + (rotate ? 28 : 0);
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const pad = { t: 10, b: padB, l: padL, r: 4 };
    const iW  = W - pad.l - pad.r;
    const iH  = H - pad.t - pad.b;

    const styles  = getComputedStyle(document.documentElement);
    const muted   = styles.getPropertyValue('--muted').trim() || '#5a5a78';
    const accent2 = styles.getPropertyValue('--accent2').trim() || '#ff6b35';
    // Cincin putih di titik data dulu hardcode '#fff' -- di tema terang
    // baru (kartu putih juga) itu jadi nyaris tidak kelihatan (putih di
    // atas putih). Pakai warna permukaan kartu (--s1) supaya "cincin
    // pemisah"-nya tetap kontras dari garis tren, apa pun temanya.
    const dotRing = styles.getPropertyValue('--s1').trim() || '#fff';
    // Canvas tidak resolve custom property CSS (var(--x)) sendiri — kalau
    // warna dikirim sebagai var(--x), ambil nilai aktualnya di sini.
    const resolveColor = (c) => {
      const mm = /^var\((--[\w-]+)\)$/.exec((c || '').trim());
      return mm ? (styles.getPropertyValue(mm[1]).trim() || c) : c;
    };
    const resolvedMovingAvgColor = resolveColor(movingAvgColor);
    const resolvedTargetColor    = resolveColor(targetColor);
    const resolvedColor          = resolveColor(color);
    const resolvedOverTargetColor = resolveColor(overTargetColor);

    const vals    = visibleData.map((d) => d[valueKey] ?? 0);
    const targets = targetKey ? visibleData.map((d) => d[targetKey] ?? 0) : [];
    // Data di ekor yang masih 0 (tanggal/bulan yang belum terjadi/belum ada
    // entri) tidak ikut dihitung/ditampilkan di garis tren -- tren cuma
    // meliputi rentang yang datanya sudah benar-benar terisi.
    let filledLen = vals.length;
    while (filledLen > 0 && !vals[filledLen - 1]) filledLen--;
    const trend = showMovingAvg && filledLen >= 2
      ? calcSmoothTrend(vals.slice(0, filledLen).map((v) => (typeof v === 'number' ? v : 0)))
      : null;
    // Sumbu Y persentase dikunci 0-100 dengan kelipatan konstan (bukan
    // auto-scale ke angka aneh kayak 115/77/38) supaya gampang dibaca.
    const maxV      = fixedMax || Math.max(...vals, ...(targetKey ? targets : []), 1) * 1.15;
    const axisSteps = fixedMax ? 5 : 3; // 5 -> 0,20,...,100 ; 3 -> pola lama (non-persen)
    const barW    = Math.max(3, Math.min(slotW * 0.5, 40));
    const xOf     = (i) => pad.l + i * slotW + (slotW - barW) / 2;
    const cxOf    = (i) => pad.l + i * slotW + slotW / 2;
    const yOf     = (v) => pad.t + (1 - v / maxV) * iH;
    const isTotal = visibleData[m - 1]?.day === 'TOTAL' || visibleData[m - 1]?.day === 'Avg';

    function drawDot(x, y, c) {
      ctx.beginPath();
      ctx.arc(x, y, 3.6, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = dotRing;
      ctx.stroke();
    }

    function drawBase() {
      ctx.clearRect(0, 0, W, H);

      // Grid + Y-axis labels
      ctx.font = `${FONT}px Inter, sans-serif`;
      ctx.fillStyle = muted; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let i = 0; i <= axisSteps; i++) {
        const y = pad.t + iH * (i / axisSteps);
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y);
        ctx.strokeStyle = 'rgba(150,150,180,.18)';
        ctx.setLineDash([2, 5]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
        const tv = maxV * (1 - i / axisSteps);
        ctx.fillText(tv.toFixed(tv < 10 ? 1 : 0), pad.l - 5, y);
      }

      // TOTAL separator
      if (isTotal && m > 1) {
        const dx = pad.l + (m - 1) * slotW;
        ctx.beginPath(); ctx.moveTo(dx, pad.t); ctx.lineTo(dx, pad.t + iH);
        ctx.strokeStyle = 'rgba(150,150,170,.3)';
        ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
      }

      // Bars
      vals.forEach((v, i) => {
        const x = xOf(i); const y = yOf(v);
        const h = (pad.t + iH) - y;
        const r = Math.min(4, barW / 2);
        let bc = resolvedColor;
        if (resolvedOverTargetColor && targetKey && v > targets[i] && targets[i] > 0) bc = resolvedOverTargetColor;
        else if (!(isTotal && i === m - 1)) bc = resolvedColor + 'cc';
        ctx.fillStyle = bc;
        if (h > 0) {
          ctx.beginPath();
          ctx.moveTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
          ctx.arcTo(x + barW, y, x + barW, y + r, r);
          ctx.lineTo(x + barW, pad.t + iH); ctx.lineTo(x, pad.t + iH);
          ctx.closePath(); ctx.fill();
        }
      });

      // Target line — dashed, polos tanpa dot marker (dot cuma muncul saat hover)
      if (targetKey && targets.some((t) => t > 0)) {
        const tColor = resolvedTargetColor || 'rgba(150,150,180,.7)';
        ctx.beginPath(); ctx.lineWidth = 1.5;
        ctx.strokeStyle = tColor;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.setLineDash([6, 4]);
        targets.forEach((t, i) => {
          if (i === 0) ctx.moveTo(cxOf(0), yOf(t)); else ctx.lineTo(cxOf(i), yOf(t));
        });
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Garis tren — solid, halus mengikuti kontur data (bukan garis lurus),
      // cuma sepanjang rentang yang datanya sudah terisi (lihat filledLen).
      if (trend) {
        ctx.beginPath(); ctx.lineWidth = 2.2; ctx.strokeStyle = resolvedMovingAvgColor;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        drawSmoothLine(ctx, trend.map((v, i) => ({ x: cxOf(i), y: yOf(v) })));
        ctx.stroke();
      }

      // X-axis labels
      const step   = rotate ? 1 : Math.max(1, Math.ceil(22 / slotW));
      const labelY = pad.t + iH + 5;
      ctx.font = `${FONT}px Inter, sans-serif`;
      ctx.textBaseline = 'top';
      visibleData.forEach((d, i) => {
        if (i % step !== 0 && i !== m - 1) return;
        const isT  = d.day === 'TOTAL' || d.day === 'Avg';
        const label = formatAxisLabel(d.day, hourly);
        ctx.fillStyle = isT ? accent2 : muted;
        ctx.font      = isT
          ? `bold ${FONT}px Inter, sans-serif`
          : `${FONT}px Inter, sans-serif`;
        if (rotate && !isT) {
          ctx.save();
          ctx.translate(cxOf(i), labelY);
          ctx.rotate(ROTATE_ANGLE);
          ctx.textAlign = 'right';
          ctx.fillText(label, 0, 0);
          ctx.restore();
        } else {
          ctx.textAlign = 'center';
          ctx.fillText(label, cxOf(i), labelY);
        }
      });
    }

    // Crosshair + dot marker -- cuma di garis Nilai (aktual), Target dan
    // Tren tidak perlu ditandai/ditampilkan di detail hover.
    function drawCrosshair(idx) {
      const x = cxOf(idx);
      ctx.beginPath();
      ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + iH);
      ctx.strokeStyle = 'rgba(150,150,180,.55)';
      ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);

      drawDot(x, yOf(vals[idx]), resolvedColor);
    }

    drawBase();

    // Tooltip
    const tip = tipRef.current;
    const showTip = (clientX, rect) => {
      const mx = (clientX - rect.left) * (W / rect.width);
      let cl = 0, mn = 999;
      vals.forEach((_, i) => { const d = Math.abs(mx - cxOf(i)); if (d < mn) { mn = d; cl = i; } });
      if (mn < slotW) {
        drawBase();
        drawCrosshair(cl);
        tip.style.display = 'block';
        tip.style.left    = Math.min(xOf(cl), W - 130) + 'px';
        tip.style.top     = (Math.max(pad.t, yOf(vals[cl])) - 34) + 'px';
        tip.textContent = `${formatAxisLabel(visibleData[cl].day, hourly)}: ${vals[cl].toFixed(1)} ${unit}`;
      } else {
        drawBase();
        tip.style.display = 'none';
      }
    };
    canvas.onmousemove  = (e) => showTip(e.clientX, canvas.getBoundingClientRect());
    canvas.onmouseleave = () => { drawBase(); tip.style.display = 'none'; };
    canvas.ontouchmove  = (e) => { e.preventDefault(); showTip(e.touches[0].clientX, canvas.getBoundingClientRect()); };
    canvas.ontouchend   = () => setTimeout(() => { drawBase(); tip.style.display = 'none'; }, 1500);
  }, [visibleData, valueKey, targetKey, color, unit, hourly, showMovingAvg, movingAvgColor, overTargetColor, fixedMax, tick]);

  // Redraw kalau .trend-wrap berubah ukuran -- bukan cuma sekali saat
  // mount (dulu cuma requestAnimationFrame sekali, jadi kartu yang
  // diregangkan belakangan lewat flex, atau ukuran layout yang berubah
  // karena zoom browser/resize window, tidak pernah bikin chart re-plot
  // ukurannya). ResizeObserver juga langsung memberi ukuran final segera
  // setelah observe() dipanggil, jadi sekalian gantikan trik RAF sekali
  // jalan yang lama.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setTick((t) => t + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="trend-wrap" ref={wrapRef}>
      <canvas ref={canvasRef}></canvas>
      <div className="trend-tooltip" ref={tipRef}></div>
    </div>
  );
}

export default function LineTrendChart({
  title, data, valueKey, targetKey, color, unit, hourly = false,
  showMovingAvg = false, movingAvgColor = '#f0a500',
  overTargetColor = null, targetColor = 'rgba(150,150,180,.7)',
  legendItems = null, bare = false,
}) {
  const fixedMax = unit === '%' ? 100 : null;
  const legend = legendItems || (() => {
    const items = [{ type: 'dot', color, label: `${unit} (nilai)` }];
    if (showMovingAvg) items.push({ type: 'line', color: movingAvgColor, label: 'Tren' });
    if (targetKey) items.push({ type: 'dash', color: targetColor, label: 'Target' });
    return items;
  })();

  // `bare` -- lewati .card + header sendiri kalau pemanggil (mis.
  // ARDetail/OEEDetail/RejectionDetail/OvertimeDetail) sudah membungkus
  // komponen ini dengan .card + card-title sendiri (dulu dikirim
  // title="" untuk itu, tapi tetap merender .card KEDUA bersarang di
  // dalam .card pertama -- .trend-wrap di dalamnya jadi tidak pernah ikut
  // meregang mengisi tinggi .card luar walau .card luar sendiri sudah
  // diregangkan lewat alignItems:'stretch', nyisa ruang kosong di bawah
  // grafik). Kontennya sama persis, cuma tanpa pembungkus .card+header.
  const content = (
    <>
      <div className="axis-unit-label">{unit === '%' ? 'Persentase (%)' : 'Waktu (Jam)'}</div>
      <ChartCanvas
        data={data} valueKey={valueKey} targetKey={targetKey}
        color={color} unit={unit} hourly={hourly}
        showMovingAvg={showMovingAvg} movingAvgColor={movingAvgColor}
        overTargetColor={overTargetColor} targetColor={targetColor}
        fixedMax={fixedMax}
      />
      <div className="chart-legend" style={{ marginTop: 8 }}>
        {legend.map((l, i) => (
          <div key={i} className="legend-item">
            {l.type === 'dot' && <span className="legend-swatch" style={{ background: l.color }}></span>}
            {l.type === 'line' && (
              <span style={{ display: 'inline-block', width: 18, height: 2, background: l.color, borderRadius: 1, verticalAlign: 'middle', marginRight: 4 }}></span>
            )}
            {l.type === 'dash' && (
              <span style={{ display: 'inline-block', width: 18, height: 0, borderTop: `2px dashed ${l.color}`, verticalAlign: 'middle', marginRight: 4 }}></span>
            )}
            {l.label}
          </div>
        ))}
      </div>
    </>
  );

  if (bare) return content;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">{title}</div>
      </div>
      {content}
    </div>
  );
}
