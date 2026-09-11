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
        const workbook = XLSX.read(e.target.result, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(sheet, { defval: '' }));
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsArrayBuffer(file);
  });
}
