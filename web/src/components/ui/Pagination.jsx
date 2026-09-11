import { ChevronLeft, ChevronRight } from 'lucide-react';

// Kontrol paging reusable untuk halaman listing (Data Rejection, Data
// Overtime, Data Rework, Problem Log, dst). Server sudah kirim
// { page, pageSize, total, totalPages } -- komponen ini cuma render
// kontrolnya dan panggil onPageChange(newPage), pemanggil yang urus
// fetch ulang (biasanya lewat useEffect yang depend ke `page`).
//
// Sengaja tidak tampil sama sekali kalau totalPages <= 1, supaya
// halaman yang datanya sedikit tidak keliatan penuh kontrol yang
// tidak berguna.
export default function Pagination({ page, totalPages, total, pageSize, onPageChange, disabled }) {
  if (!totalPages || totalPages <= 1) return null;

  const canPrev = page > 1 && !disabled;
  const canNext = page < totalPages && !disabled;

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, padding: '10px 2px', flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
        Menampilkan {from}–{to} dari {total} baris
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          className="btn-icon"
          onClick={() => canPrev && onPageChange(page - 1)}
          disabled={!canPrev}
          title="Halaman sebelumnya"
          style={{ opacity: canPrev ? 1 : 0.4, cursor: canPrev ? 'pointer' : 'default' }}
        >
          <ChevronLeft size={14} />
        </button>

        <span style={{ fontSize: 12, color: 'var(--text)', minWidth: 64, textAlign: 'center' }}>
          Hal {page} / {totalPages}
        </span>

        <button
          type="button"
          className="btn-icon"
          onClick={() => canNext && onPageChange(page + 1)}
          disabled={!canNext}
          title="Halaman berikutnya"
          style={{ opacity: canNext ? 1 : 0.4, cursor: canNext ? 'pointer' : 'default' }}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
