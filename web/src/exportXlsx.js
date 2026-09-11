import * as XLSX from 'xlsx';

// Export tabel ke file .xlsx asli (bukan CSV yang dibuka Excel) -- dipakai
// tombol "Download Excel" di halaman data. columns: [{ key, label }], rows:
// array objek. Kolom dibuat dengan urutan & label sesuai `columns`, bukan
// urutan key asli objek row-nya.
export function downloadXlsx(filename, sheetName, columns, rows) {
  const data = rows.map((r) => {
    const obj = {};
    columns.forEach((c) => { obj[c.label] = r[c.key]; });
    return obj;
  });
  const worksheet = XLSX.utils.json_to_sheet(data, { header: columns.map((c) => c.label) });

  // Auto-size lebar tiap kolom (dalam satuan "character width" Excel)
  // sesuai teks terpanjang di kolom itu -- header ATAU isi data, mana yang
  // lebih panjang -- supaya tidak perlu resize manual sesudah dibuka.
  // Dibatasi maksimal 60 supaya kolom seperti Keterangan yang bisa sangat
  // panjang tidak bikin satu kolom melebar sampai tidak wajar.
  worksheet['!cols'] = columns.map((c) => {
    const headerLen = String(c.label).length;
    const maxDataLen = rows.reduce((max, r) => {
      const v = r[c.key];
      const len = v == null ? 0 : String(v).length;
      return Math.max(max, len);
    }, 0);
    return { wch: Math.min(60, Math.max(headerLen, maxDataLen) + 2) };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || 'Data');
  XLSX.writeFile(workbook, filename);
}
