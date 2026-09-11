import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CalendarDays } from 'lucide-react';

const PERIOD_OPTIONS = [
  { key: 'today', label: 'Harian' },
  { key: 'month', label: 'Bulanan' },
  { key: 'year',  label: 'Tahunan' },
];
// Tier Mingguan (opsional, di-gate lewat prop `weekly`) -- dipakai khusus
// Detail Rejection, tidak dipasang di AR/Dashboard supaya perilaku yang
// sudah ada tidak berubah.
const PERIOD_OPTIONS_WEEKLY = [
  { key: 'today', label: 'Harian' },
  { key: 'week',  label: 'Mingguan' },
  { key: 'month', label: 'Bulanan' },
  { key: 'year',  label: 'Tahunan' },
];
const MONTH_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const MONTH_ID_FULL = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const DOW_ID = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

function parseLocal(str) {
  if (!str) return new Date();
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function toStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
// Harian = pilih tanggal (dalam satu bulan), Bulanan = pilih nama bulan
// (dalam satu tahun), Tahunan = pilih tahun. Grafik tetap menampilkan
// seluruh bulan/tahun yang bersangkutan (dibucketkan per-tanggal /
// per-bulan / per-tahun) -- tanggal/bulan/tahun yang dipilih menentukan
// bulan/tahun mana yang sedang dilihat.
function formatLabel(period, dateStr) {
  const d = parseLocal(dateStr);
  if (period === 'month') return `${MONTH_ID[d.getMonth()]} ${d.getFullYear()}`;
  if (period === 'year') return `${d.getFullYear()}`;
  if (period === 'week') return `Minggu ${Math.ceil(d.getDate() / 7)} - ${MONTH_ID[d.getMonth()]} ${d.getFullYear()}`;
  return `${d.getDate()} ${MONTH_ID[d.getMonth()]} ${d.getFullYear()}`;
}
function shiftDate(period, dateStr, dir) {
  const d = parseLocal(dateStr);
  if (period === 'month') d.setMonth(d.getMonth() + dir);
  else if (period === 'year') d.setFullYear(d.getFullYear() + dir);
  else if (period === 'week') d.setDate(d.getDate() + dir * 7);
  else d.setDate(d.getDate() + dir);
  return toStr(d);
}

function buildDayCells(year, month) {
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

function DayCalendar({ dateStr, onChange }) {
  const sel = parseLocal(dateStr);
  const [year, setYear] = useState(sel.getFullYear());
  const [month, setMonth] = useState(sel.getMonth());
  const today = new Date();
  const cells = buildDayCells(year, month);

  function navMonth(dir) {
    let m = month + dir, y = year;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  }

  return (
    <div className="dp-popup">
      <div className="dp-header">
        <button className="dp-nav" onClick={() => navMonth(-1)}><ChevronLeft size={13}/></button>
        <span className="dp-title">{MONTH_ID_FULL[month]} {year}</span>
        <button className="dp-nav" onClick={() => navMonth(1)}><ChevronRight size={13}/></button>
      </div>
      <div className="dp-dow-row">
        {DOW_ID.map((d) => <span key={d} className="dp-dow">{d}</span>)}
      </div>
      <div className="dp-day-grid">
        {cells.map((d, i) => d === null ? <span key={i} /> : (
          <button key={i}
            className={'dp-day'
              + (year === sel.getFullYear() && month === sel.getMonth() && d === sel.getDate() ? ' sel' : '')
              + (year === today.getFullYear() && month === today.getMonth() && d === today.getDate() ? ' today' : '')}
            onClick={() => onChange(toStr(new Date(year, month, d)))}>
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}

function YearPicker({ dateStr, onChange }) {
  const sel = parseLocal(dateStr);
  const thisYear = new Date().getFullYear();
  const [base, setBase] = useState(Math.floor(sel.getFullYear() / 10) * 10);
  const years = Array.from({ length: 12 }, (_, i) => base + i);
  return (
    <div className="dp-popup">
      <div className="dp-header">
        <button className="dp-nav" onClick={() => setBase(b => b - 10)}><ChevronsLeft size={13}/></button>
        <span className="dp-title">{base} – {base + 11}</span>
        <button className="dp-nav" onClick={() => setBase(b => b + 10)}><ChevronsRight size={13}/></button>
      </div>
      <div className="dp-month-grid">
        {years.map(y => (
          <button key={y}
            className={'dp-month-cell' + (y === sel.getFullYear() ? ' sel' : '') + (y === thisYear ? ' today' : '')}
            onClick={() => onChange(toStr(new Date(y, 0, 1)))}>
            {y}
          </button>
        ))}
      </div>
    </div>
  );
}

function MonthGrid({ dateStr, onChange }) {
  const sel = parseLocal(dateStr);
  const [year, setYear] = useState(sel.getFullYear());
  return (
    <div className="dp-popup">
      <div className="dp-header">
        <button className="dp-nav" onClick={() => setYear(y => y-1)}><ChevronsLeft size={13}/></button>
        <span className="dp-title">{year}</span>
        <button className="dp-nav" onClick={() => setYear(y => y+1)}><ChevronsRight size={13}/></button>
      </div>
      <div className="dp-month-grid">
        {MONTH_ID_FULL.map((m, i) => (
          <button key={i}
            className={'dp-month-cell' + (year === sel.getFullYear() && i === sel.getMonth() ? ' sel' : '')}
            onClick={() => onChange(toStr(new Date(year, i, 1)))}>
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PeriodPicker({ period, setPeriod, refDate, setRefDate, pill, weekly }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const fn = e => { if (open && ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open]);

  const label = formatLabel(period, refDate);
  const wrapCls = `period-picker${pill ? ' pp-pill-mode' : ''}`;
  const options = weekly ? PERIOD_OPTIONS_WEEKLY : PERIOD_OPTIONS;

  return (
    <div className={wrapCls} ref={ref}>
      <select className="pp-select" value={period}
        onChange={e => { setPeriod(e.target.value); setOpen(false); }}>
        {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>

      <button className="pp-nav" onClick={() => setRefDate(shiftDate(period, refDate, -1))} title="Periode sebelumnya">
        <ChevronLeft size={16}/>
      </button>

      <button className="pp-label" onClick={() => setOpen(v => !v)}>
        <span>{label}</span>
        <CalendarDays size={13} style={{ color: 'var(--muted)', flexShrink: 0 }}/>
      </button>

      <button className="pp-nav pp-nav-tail" onClick={() => setRefDate(shiftDate(period, refDate, 1))} title="Periode berikutnya">
        <ChevronRight size={16}/>
      </button>

      {open && (
        period === 'month' ? <MonthGrid dateStr={refDate} onChange={d => { setRefDate(d); setOpen(false); }} /> :
        period === 'year'  ? <YearPicker dateStr={refDate} onChange={d => { setRefDate(d); setOpen(false); }} /> :
                              <DayCalendar dateStr={refDate} onChange={d => { setRefDate(d); setOpen(false); }} />
      )}
    </div>
  );
}
