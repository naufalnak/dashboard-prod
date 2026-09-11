// Format tanggal jadi urutan hari/bulan/tahun (DD/MM/YYYY) untuk tampilan
// tabel di seluruh website — sebelumnya banyak tabel menampilkan tanggal
// mentah dari API dalam format ISO (YYYY-MM-DD).
export function formatDateID(value) {
  if (!value) return '—';
  const s = String(value).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return String(value);
  return `${d}/${m}/${y}`;
}

const DOW_FULL_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTH_FULL_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// Jam realtime di header -- format Indonesia "Senin, 20 Juli 2026" + jam
// 24-jam (bukan format Inggris "Wed, Jul 29" + AM/PM bawaan toLocaleString).
// Dipecah jadi 2 baris (hari+tanggal / jam) supaya muat di kolom sempit
// tanpa terpotong -- formatDateTimeID (satu baris) tinggal menggabungkan
// keduanya untuk tempat yang lebih lega (mis. Topbar dashboard).
export function formatDateTimeIDParts(date = new Date()) {
  const dow = DOW_FULL_ID[date.getDay()];
  const month = MONTH_FULL_ID[date.getMonth()];
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return {
    dateLine: `${dow}, ${date.getDate()} ${month} ${date.getFullYear()}`,
    timeLine: `${hh}:${mm}:${ss}`,
  };
}

export function formatDateTimeID(date = new Date()) {
  const { dateLine, timeLine } = formatDateTimeIDParts(date);
  return `${dateLine} ${timeLine}`;
}
