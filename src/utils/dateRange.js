// Pembagian rentang tanggal buat grafik tren (AR/OEE/Rejection/Overtime) --
// pola "today/week/month/year" ini sebelumnya diketik ulang identik di 4
// endpoint tren berbeda (ar-trend, oee-trend, rejection-trend,
// overtime-trend), cuma beda apa yang diakumulasi per bucket-nya.
//   period=today -> per tanggal dalam 1 bulan dari `ref`
//   period=week  -> per minggu (Week 1..5, lihat weekOfMonth) dalam 1 bulan dari `ref`
//   period=month -> per bulan dalam 1 tahun dari `ref`
//   period=year  -> per tahun, dari tahun data paling lama (lewat
//                   `findEarliestYear`, dipanggil HANYA untuk period ini)
//                   sampai tahun berjalan
//
// Return { start, end, labels, keyOf } -- `labels` adalah label bucket
// berurutan (dipakai juga sebagai jumlah bucket), `keyOf(date)` memetakan
// satu Date ke index bucket yang tepat (bisa di luar jangkauan array kalau
// datanya di luar rentang [start,end], caller WAJIB cek `buckets[idx]`
// ada sebelum dipakai -- sama seperti pola lama).
const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

async function buildTrendBuckets(period, ref, findEarliestYear) {
  if (period === 'year') {
    const earliestYear = (await findEarliestYear()) ?? ref.getFullYear();
    const thisYear = new Date().getFullYear();
    const fromYear = Math.min(earliestYear, thisYear);
    const years = [];
    for (let y = fromYear; y <= thisYear; y++) years.push(y);
    return {
      start: new Date(fromYear, 0, 1),
      end: new Date(thisYear, 11, 31, 23, 59, 59, 999),
      labels: years.map(String),
      keyOf: (date) => years.indexOf(date.getUTCFullYear()),
    };
  }

  if (period === 'week') {
    const year = ref.getFullYear(), month = ref.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const weekCount = Math.ceil(end.getDate() / 7);
    return {
      start, end,
      labels: Array.from({ length: weekCount }, (_, i) => `Week ${i + 1}`),
      keyOf: (date) => Math.ceil(date.getUTCDate() / 7) - 1,
    };
  }

  if (period === 'month') {
    const year = ref.getFullYear();
    return {
      start: new Date(year, 0, 1),
      end: new Date(year, 11, 31, 23, 59, 59, 999),
      labels: MONTHS_ID,
      keyOf: (date) => date.getUTCMonth(),
    };
  }

  // default: 'today' -> per tanggal dalam 1 bulan
  const year = ref.getFullYear(), month = ref.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const daysInMonth = end.getDate();
  return {
    start, end,
    labels: Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, '0')),
    keyOf: (date) => date.getUTCDate() - 1,
  };
}

module.exports = { buildTrendBuckets, MONTHS_ID };
