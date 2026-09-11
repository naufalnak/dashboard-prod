import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';

// Batas maksimal yang diizinkan server (lihat apiHelpers.js di backend).
export const PAGE_SIZE = 200;

// Hook reusable untuk pola "load daftar per-halaman dari server, dengan
// state loading/error yang konsisten" -- sebelumnya diduplikasi persis
// (state rows/page/totalPages/total/loading/error + logika load()) di
// DataRejection, DataOvertime, DataRework, DataProduksi, dan
// ProblemLogPage.
//
// fetchFn: fungsi service dengan signature (qs, fallback, logout, onError)
//   -- semua fungsi fetchX di web/src/services/ (fetchRejectionEntries,
//   fetchOvertimeEntries, fetchPartReworkEntries, fetchProblemLog,
//   fetchProduksiHarian) sudah cocok dengan signature ini.
// buildQs(page, pageSize): membangun query string untuk halaman tsb
//   (filter + page/pageSize). Dipanggil ulang tiap kali `deps` berubah.
// deps: dependency tambahan di luar `page` yang harus memicu reload
//   (mis. [period, refDate]).
export function usePaginatedList(fetchFn, buildQs, deps = []) {
  const { logout } = useAuth();
  const showToast = useToast();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    const qs = buildQs(page, PAGE_SIZE);
    fetchFn(
      qs,
      { rows: [], total: 0, totalPages: 1 },
      logout,
      () => { setError(true); showToast('Gagal memuat data. Periksa koneksi lalu coba lagi.', 'red'); },
    ).then((data) => {
      setRows(data.rows || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setLoading(false);
    }).catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` datang dari pemanggil
  }, [page, logout, ...deps]);

  useEffect(() => { load(); }, [load]);

  return { rows, page, setPage, totalPages, total, loading, error, reload: load };
}
