import { useState, useMemo } from 'react';

// Hook sorting generik untuk tabel: klik header kolom -> urut naik, klik
// lagi -> urut turun, klik lagi -> kembali ke urutan asli (tanpa sort).
// getValue(row, key) opsional untuk kolom yang perlu ekstraksi nilai
// khusus (mis. angka dari string, atau field bertingkat).
export function useSort(rows, getValue) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc'

  function toggleSort(key) {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); }
    else if (sortDir === 'asc') setSortDir('desc');
    else { setSortKey(null); setSortDir('asc'); }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const get = getValue || ((r, k) => r[k]);
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = get(a, sortKey);
      const vb = get(b, sortKey);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      let cmp;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), 'id', { numeric: true, sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, sortDir, getValue]);

  return { sorted, sortKey, sortDir, toggleSort };
}
