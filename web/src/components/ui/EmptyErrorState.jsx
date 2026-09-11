import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';

// Placeholder reusable buat tabel/listing kalau datanya kosong ATAU
// request-nya gagal -- dua kondisi ini sebelumnya kelihatan SAMA
// ("Belum ada data.") karena apiFetch diam-diam fallback ke array kosong
// baik saat sukses-tapi-kosong maupun saat network/server error. Itu
// bahaya di dashboard produksi: user bisa mengira rejection/overtime-nya
// nol padahal sebenarnya cuma gagal fetch.
//
// Pemanggil cukup kasih tahu status ('empty' | 'error' | null/undefined
// buat tidak render apa-apa) -- biasanya dari state `error` yang di-set
// lewat parameter onError di apiFetch (lihat api.js).
//
// as="block": standalone (dipakai di RejectionTable/ProduksiTable yang
// render <div> pengganti seluruh tabel).
// as="row": satu <tr><td colSpan=...> (dipakai di tabel yang strukturnya
// sudah <table><tbody> duluan, mis. DataOvertime/DataRework/ProblemLogPage).
export default function EmptyErrorState({
  status,
  emptyText = 'Belum ada data.',
  errorText = 'Gagal memuat data. Periksa koneksi lalu coba lagi.',
  onRetry,
  as = 'block',
  colSpan,
}) {
  if (status !== 'empty' && status !== 'error') return null;

  const isError = status === 'error';
  const Icon = isError ? AlertTriangle : Inbox;
  const color = isError ? 'var(--red)' : 'var(--muted)';
  const text = isError ? errorText : emptyText;

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 40, textAlign: 'center', color }}>
      <Icon size={20} />
      <div style={{ fontSize: 13 }}>{text}</div>
      {isError && onRetry && (
        <button
          type="button"
          className="btn-icon"
          onClick={onRetry}
          style={{ marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 6, width: 'auto', padding: '6px 12px' }}
        >
          <RefreshCw size={12} /> Coba lagi
        </button>
      )}
    </div>
  );

  if (as === 'row') {
    return (
      <tr>
        <td colSpan={colSpan} style={{ padding: 0, border: '1px solid var(--border)' }}>{content}</td>
      </tr>
    );
  }

  return content;
}
