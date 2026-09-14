// Calendar-aligned period range, anchored to an optional reference date
// (defaults to now). Aligned with the bucketing used by /downtime-by-day
// and /mtbf-mttr-trend so every endpoint agrees on what "this week"/
// "this month" means.
function getPeriodRange(period, refDateStr, rangeStartStr, rangeEndStr) {
  if (period === 'all') {
    return { start: new Date(2000, 0, 1), end: new Date(2040, 11, 31, 23, 59, 59, 999) };
  }

  if (period === 'range' && rangeStartStr && rangeEndStr) {
    const s = new Date(rangeStartStr); s.setHours(0, 0, 0, 0);
    const e = new Date(rangeEndStr); e.setHours(23, 59, 59, 999);
    return { start: s, end: e };
  }

  const ref = refDateStr ? new Date(refDateStr) : new Date();
  let start, end;

  if (period === 'year') {
    // Sama pola dengan "Bulanan" (lihat catatan di atas) -- dulu sengaja
    // (atau tersisa dari desain lama) diset rentang lebar 2000-2099,
    // fungsinya jadi sama persis dengan period="all" walau tahun yang
    // dipilih di YearPicker (mis. 2026) diabaikan sama sekali. Sekarang
    // "Tahunan" benar-benar memfilter ke tahun spesifik yang dipilih (1
    // Jan - 31 Des tahun itu saja), konsisten dengan "Harian" dan
    // "Bulanan" yang sudah direvisi ke prinsip yang sama.
    start = new Date(ref.getFullYear(), 0, 1);
    end   = new Date(ref.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else if (period === 'week') {
    const dayOfWeek = ref.getDay(); // 0 = Sunday .. 6 = Saturday
    const mondayOffset = (dayOfWeek + 6) % 7;
    start = new Date(ref);
    start.setDate(start.getDate() - mondayOffset);
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'month') {
    // "Bulanan" dulu sengaja diset satu TAHUN penuh (lihat riwayat commit
    // acc2d68 "Filter Harian: kembalikan ke tanggal spesifik") -- waktu itu
    // cuma "Harian" yang direvisi ke tanggal spesifik, "Bulanan" sengaja
    // tidak disentuh karena bukan scope perbaikan itu. Sekarang direvisi
    // juga jadi bulan spesifik yang dipilih saja (sama alasan dengan
    // "Harian" sebelumnya): tabel data (Data Rejection dkk) menampilkan
    // SEMUA baris satu tahun penuh padahal PeriodPicker-nya bilang "Bulanan
    // Agustus", bukan cuma bulan itu.
    start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
  } else {
    // default ("today" / "Harian"): tanggal spesifik yang dipilih saja --
    // ganti tanggal di PeriodPicker harus benar-benar mengubah data yang
    // ditampilkan (sebelumnya sempat diset ke satu bulan penuh, yang bikin
    // ganti tanggal dalam bulan yang sama tidak kelihatan ada efeknya).
    start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
    end = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999);
  }

  return { start, end };
}

function daysInRange(start, end) {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, ms / (1000 * 60 * 60 * 24));
}

// Calculates total planned hours for a date range using WorkingCalendar data.
// wcRows: array of { year, month, workingDays } from the DB.
// If no WC row exists for a month, falls back to calendar days for that month.
// plannedHrsPerDay: sum of machine.plannedHours in scope.
function calcPlannedHours(start, end, plannedHrsPerDay, wcRows = []) {
  if (!plannedHrsPerDay) return 0;
  const wcMap = {};
  for (const r of wcRows) wcMap[`${r.year}-${r.month}`] = r.workingDays;

  let total = 0;
  let y = start.getFullYear(), m = start.getMonth() + 1;
  const ey = end.getFullYear(), em = end.getMonth() + 1;

  while (y < ey || (y === ey && m <= em)) {
    const calDays = new Date(y, m, 0).getDate();
    const workDays = wcMap[`${y}-${m}`] ?? calDays;
    const mStart = new Date(y, m - 1, 1);
    const mEnd   = new Date(y, m, 0, 23, 59, 59, 999);
    const covStart = start > mStart ? start : mStart;
    const covEnd   = end   < mEnd   ? end   : mEnd;
    const covDays  = Math.max(0, Math.round((covEnd - covStart) / 86400000) + 1);
    total += plannedHrsPerDay * workDays * (covDays / calDays);
    m++; if (m > 12) { m = 1; y++; }
  }
  return total;
}

module.exports = { getPeriodRange, daysInRange, calcPlannedHours };
