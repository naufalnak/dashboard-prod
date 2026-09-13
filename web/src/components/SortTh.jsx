import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

// Header <th> yang bisa diklik untuk mengurutkan tabel (abjad/angka
// naik-turun). Dipakai bersama hook useSort — lihat useSort.js.
// Opsional bisa digeser lebar-nya manual: kirim `onResizeStart` (dari
// useColumnWidths' startResize(key)) untuk memunculkan handle geser di
// pinggir kanan header -- dipakai bersama <colgroup>/<col> di tabelnya
// supaya lebar kolom benar-benar berubah, bukan cuma header-nya.
export default function SortTh({ children, sortKeyName, sortKey, sortDir, onSort, style, onResizeStart }) {
  const active = sortKey === sortKeyName;
  const Icon = active ? (sortDir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <th
      onClick={() => onSort(sortKeyName)}
      style={{
        padding: '8px 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        color: active ? 'var(--text)' : 'var(--muted)', textAlign: 'left', whiteSpace: 'nowrap',
        borderBottom: '2px solid var(--border)', cursor: 'pointer', userSelect: 'none',
        position: 'relative', ...style,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {children}
        <Icon size={12} style={{ opacity: active ? 1 : 0.45, flexShrink: 0 }} />
      </span>
      {onResizeStart && (
        <span
          onMouseDown={onResizeStart}
          onClick={(e) => e.stopPropagation()}
          title="Geser untuk mengubah lebar kolom"
          style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: 7,
            cursor: 'col-resize', touchAction: 'none',
          }}
        />
      )}
    </th>
  );
}
