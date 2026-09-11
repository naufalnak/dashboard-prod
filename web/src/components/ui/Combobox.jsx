import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';

// Kombo pilih-atau-ketik yang sepenuhnya custom (bukan input+datalist
// bawaan browser) -- daftar pilihan TIDAK otomatis tertutup begitu teks
// yang diketik sudah persis cocok dengan salah satu opsi. Klik/fokus ke
// field atau tombol panah selalu membuka daftar LENGKAP (tidak
// difilter oleh isi field saat ini), baru menyempit lagi begitu mulai
// mengetik -- jadi untuk ganti pilihan tidak perlu hapus teks manual
// dulu.
export default function Combobox({ value, onChange, options, style, disabled, placeholder }) {
  const norm = useMemo(
    () => options.map((o) => (typeof o === 'string' ? { value: o, sub: null } : o)),
    [options],
  );
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return norm;
    return norm.filter((o) => o.value.toLowerCase().includes(q));
  }, [norm, filter]);

  function openList() {
    if (disabled) return;
    setFilter('');
    setHighlight(-1);
    setOpen(true);
  }

  function handleChange(e) {
    const v = e.target.value;
    onChange(v);
    setFilter(v);
    setOpen(true);
    setHighlight(-1);
  }

  function pick(v) {
    onChange(v);
    setOpen(false);
    setFilter('');
  }

  // Enter TIDAK di-preventDefault kecuali sedang memilih salah satu opsi
  // yang di-highlight -- supaya kalau field ditinggal kosong/dropdown
  // tertutup, Enter tetap bisa "mengalir" ke luar (bubbling) dan dipakai
  // form induk untuk pindah ke input berikutnya (lihat handleFormKeyDown
  // di RMOPublic.jsx).
  function handleKeyDown(e) {
    if (!open) {
      if (e.key === 'ArrowDown') { e.preventDefault(); openList(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') {
      if (highlight >= 0 && filtered[highlight]) { e.preventDefault(); pick(filtered[highlight].value); }
      else setOpen(false);
    } else if (e.key === 'Escape') setOpen(false);
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        style={{ ...style, paddingRight: 30 }}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        onChange={handleChange}
        onFocus={openList}
        onClick={openList}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        title="Tampilkan pilihan"
        style={{
          position: 'absolute', right: 3, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', padding: 6, display: 'flex', alignItems: 'center',
          color: disabled ? '#b7c2c2' : '#5a6b73', cursor: disabled ? 'default' : 'pointer',
        }}
      >
        <ChevronDown size={15} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>

      {open && !disabled && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 60,
          background: '#fff', border: '1px solid #c9d4d4', borderRadius: 8,
          boxShadow: '0 12px 32px rgba(0,0,0,.18)', maxHeight: 240, overflowY: 'auto',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12.5, color: '#8a9a9a' }}>Tidak ada yang cocok — akan disimpan sebagai baru</div>
          ) : filtered.map((o, i) => (
            <div
              key={o.value}
              onMouseDown={(e) => { e.preventDefault(); pick(o.value); }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                padding: '8px 12px', fontSize: 13.5, cursor: 'pointer', color: '#1c2b2b',
                background: i === highlight ? '#eef7f5' : '#fff',
                borderBottom: i < filtered.length - 1 ? '1px solid #f0f3f3' : 'none',
              }}
            >
              <div style={{ fontWeight: 600 }}>{o.value}</div>
              {o.sub && <div style={{ fontSize: 11, color: '#8a9a9a', marginTop: 2 }}>{o.sub}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
