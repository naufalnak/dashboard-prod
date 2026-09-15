import * as XLSX from 'xlsx';

// Baca file .xlsx yang diupload user jadi array objek baris (sheet
// pertama, header baris pertama jadi key) -- pasangan dengan downloadXlsx
// di exportXlsx.js, dipakai fitur Import (mis. Master Data Part Name &
// Proses).
export function readXlsxFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        // cellDates:true -- sel berformat Tanggal di Excel jadi objek Date
        // JS asli (bukan angka serial Excel), dipakai fitur Import Data
        // Produksi yang punya kolom Tanggal. Import lain yang tidak punya
        // kolom Tanggal (mis. Part Name & Proses) tidak terpengaruh.
        const workbook = XLSX.read(e.target.result, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(sheet, { defval: '' }));
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsArrayBuffer(file);
  });
}
