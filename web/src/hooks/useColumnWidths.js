import { useState, useCallback, useRef } from 'react';

// Lebar kolom tabel dalam PERSEN (bukan px) -- supaya tabel selalu pas
// mengisi lebar layar yang tersedia tanpa perlu scroll horizontal
// (kolom mengecil proporsional kalau layar sempit), bukan lebar tetap
// yang gampang melebihi lebar layar dan memaksa scroll/zoom-out. Bisa
// digeser manual (drag pinggir kanan header, dipakai bersama SortTh) --
// geseran dikonversi dari delta piksel mouse ke delta persen relatif
// lebar wadah tabel saat itu (containerRef, opsional -- kalau tidak
// dikirim dianggap 1000px). defaults: { key: persenAngka }.
export function useColumnWidths(defaults, containerRef) {
  const [widths, setWidths] = useState(defaults);
  const dragRef = useRef(null); // { key, startX, startWidth, containerWidth }

  const startResize = useCallback((key) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const containerWidth = containerRef?.current?.offsetWidth || 1000;
    dragRef.current = { key, startX: e.clientX, startWidth: widths[key] || 5, containerWidth };

    function onMove(ev) {
      const d = dragRef.current;
      if (!d) return;
      const deltaPct = ((ev.clientX - d.startX) / d.containerWidth) * 100;
      const next = Math.max(2, d.startWidth + deltaPct);
      setWidths((w) => ({ ...w, [d.key]: next }));
    }
    function onUp() {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [widths, containerRef]);

  return { widths, startResize };
}

// Ubah daftar kolom { key, label, weight } jadi peta persen yang
// jumlahnya (100 - reserved) -- reserved dipakai buat kolom Aksi yang
// lebarnya tetap kecil di luar hitungan proporsional. weight bebas
// (boleh dianggap "bekas lebar px" dari desain sebelumnya) -- yang
// penting rasio antar kolom, bukan angka mutlaknya.
export function weightsToPercent(columns, reserved = 0) {
  const totalWeight = columns.reduce((s, c) => s + c.weight, 0);
  const available = 100 - reserved;
  return Object.fromEntries(columns.map((c) => [c.key, (c.weight / totalWeight) * available]));
}
