import { Search } from 'lucide-react';

export const CLUSTERS = ['AD', 'BC', 'EF', 'FI'];

export const MONTH_ID_FULL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export function Field({ label, hint, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>
        {label}{hint && <span style={{ textTransform: 'none', fontWeight: 400, letterSpacing: 0 }}> · {hint}</span>}
      </label>
      {children}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Cari…' }) {
  return (
    <div style={{ position: 'relative', maxWidth: 320, marginBottom: 14 }}>
      <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
      <input
        className="form-input"
        style={{ paddingLeft: 32 }}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function matches(query, ...fields) {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return fields.some((f) => String(f ?? '').toLowerCase().includes(q));
}

export const th = { textAlign: 'left', padding: '5px 7px', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', border: '1px solid var(--border)', whiteSpace: 'nowrap' };
export const td = { padding: '4px 7px', fontSize: 10.5, border: '1px solid var(--border)', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
export const iconBtn = { background: 'none', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', color: 'var(--text)', padding: 4, display: 'flex' };
export const editInp = { padding: '5px 8px', fontSize: 12.5 };
