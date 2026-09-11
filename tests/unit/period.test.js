const { getPeriodRange, daysInRange, calcPlannedHours } = require('../../src/lib/period');

// Semua fungsi di period.js pakai getter lokal (getFullYear/getMonth/dst),
// bukan UTC/ISO -- jadi test ini sengaja bikin input & assert expected
// juga lewat konstruktor Date lokal (new Date(y, m, d, ...)), bukan
// string ISO literal. Ini bikin test tetap benar berapa pun timezone
// runner CI-nya, karena "lokal" di sisi kode dan "lokal" di sisi test
// selalu sinkron satu sama lain.

function localDay(y, m, d, h = 0, mi = 0, s = 0, ms = 0) {
  return new Date(y, m - 1, d, h, mi, s, ms);
}

describe('getPeriodRange', () => {
  test('period=today (default) -> tanggal spesifik saja, bukan sebulan penuh', () => {
    const { start, end } = getPeriodRange('today', '2026-08-20');
    expect(start).toEqual(localDay(2026, 8, 20, 0, 0, 0, 0));
    expect(end).toEqual(localDay(2026, 8, 20, 23, 59, 59, 999));
  });

  test('period tidak dikenal -> jatuh ke perilaku default (harian)', () => {
    const { start, end } = getPeriodRange(undefined, '2026-08-20');
    expect(start).toEqual(localDay(2026, 8, 20, 0, 0, 0, 0));
    expect(end).toEqual(localDay(2026, 8, 20, 23, 59, 59, 999));
  });

  test('period=week -> Senin s.d. Minggu yang sama, dari tengah minggu (Kamis)', () => {
    const { start, end } = getPeriodRange('week', '2026-08-20'); // Kamis
    expect(start).toEqual(localDay(2026, 8, 17, 0, 0, 0, 0)); // Senin
    expect(end).toEqual(localDay(2026, 8, 23, 23, 59, 59, 999)); // Minggu
  });

  test('period=week -> ref di hari Senin tetap start di hari itu juga', () => {
    const { start } = getPeriodRange('week', '2026-08-17'); // Senin
    expect(start).toEqual(localDay(2026, 8, 17, 0, 0, 0, 0));
  });

  test('period=week -> ref di hari Minggu tetap masuk minggu yang sama (bukan minggu depan)', () => {
    const { start, end } = getPeriodRange('week', '2026-08-23'); // Minggu
    expect(start).toEqual(localDay(2026, 8, 17, 0, 0, 0, 0));
    expect(end).toEqual(localDay(2026, 8, 23, 23, 59, 59, 999));
  });

  test('period=month -> satu tahun penuh (Jan-Des tahun ref), bukan sebulan', () => {
    const { start, end } = getPeriodRange('month', '2026-08-20');
    expect(start).toEqual(localDay(2026, 1, 1, 0, 0, 0, 0));
    expect(end).toEqual(localDay(2026, 12, 31, 23, 59, 59, 999));
  });

  test('period=year -> dibatasi MAX_RANGE_YEARS (2 tahun) ke belakang dari ref', () => {
    const { start, end } = getPeriodRange('year', '2026-08-20');
    expect(start).toEqual(localDay(2024, 8, 20, 0, 0, 0, 0));
    expect(end).toEqual(localDay(2026, 8, 20, 23, 59, 59, 999));
  });

  test('period=all -> sama batasannya dengan year (bukan unbounded)', () => {
    const { start, end } = getPeriodRange('all', '2026-08-20');
    expect(start).toEqual(localDay(2024, 8, 20, 0, 0, 0, 0));
    expect(end).toEqual(localDay(2026, 8, 20, 23, 59, 59, 999));
  });

  test('period=range dalam batas -> start/end persis dari query', () => {
    const { start, end } = getPeriodRange('range', null, '2026-01-01', '2026-03-01');
    expect(start).toEqual(localDay(2026, 1, 1, 0, 0, 0, 0));
    expect(end).toEqual(localDay(2026, 3, 1, 23, 59, 59, 999));
  });

  test('period=range yang coba "menyelundupkan" rentang unbounded -> diklem ke MAX_RANGE_YEARS dari end', () => {
    const { start, end } = getPeriodRange('range', null, '2000-01-01', '2026-03-01');
    expect(start).toEqual(localDay(2024, 3, 1, 0, 0, 0, 0));
    expect(end).toEqual(localDay(2026, 3, 1, 23, 59, 59, 999));
  });
});

describe('daysInRange', () => {
  test('rentang 1 hari (00:00 s.d. 23:59:59.999) -> dibulatkan minimal 1', () => {
    const days = daysInRange(localDay(2026, 1, 1), localDay(2026, 1, 1, 23, 59, 59, 999));
    expect(days).toBeCloseTo(1, 5);
  });

  test('rentang 10 hari kalender -> mendekati 10 (bukan 9 atau 11)', () => {
    const days = daysInRange(localDay(2026, 1, 1), localDay(2026, 1, 10, 23, 59, 59, 999));
    expect(days).toBeCloseTo(10, 2);
  });

  test('start > end (rentang terbalik) tetap tidak pernah di bawah 1', () => {
    const days = daysInRange(localDay(2026, 1, 10), localDay(2026, 1, 1));
    expect(days).toBeGreaterThanOrEqual(1);
  });
});

describe('calcPlannedHours', () => {
  const wcRows = [
    { year: 2026, month: 1, workingDays: 22 },
    { year: 2026, month: 2, workingDays: 20 },
  ];

  test('plannedHrsPerDay = 0 -> selalu 0, tidak peduli rentang', () => {
    const total = calcPlannedHours(localDay(2026, 1, 1), localDay(2026, 1, 31), 0, wcRows);
    expect(total).toBe(0);
  });

  test('satu bulan penuh dengan WorkingCalendar row -> pakai workingDays dari DB', () => {
    const total = calcPlannedHours(
      localDay(2026, 1, 1), localDay(2026, 1, 31, 23, 59, 59, 999), 8, wcRows,
    );
    // 8 jam/hari * 22 hari kerja * (31 hari cakupan / 31 hari kalender)
    expect(total).toBeCloseTo(181.677419, 5);
  });

  test('bulan tanpa WorkingCalendar row -> fallback ke jumlah hari kalender penuh', () => {
    const total = calcPlannedHours(
      localDay(2026, 3, 1), localDay(2026, 3, 31, 23, 59, 59, 999), 8, wcRows,
    );
    // Tidak ada row utk bulan 3 -> workDays = 31 (hari kalender Maret)
    expect(total).toBeCloseTo(256, 5);
  });

  test('rentang lintas 2 bulan -> dijumlah proporsional per bulan', () => {
    const total = calcPlannedHours(
      localDay(2026, 1, 1), localDay(2026, 2, 28, 23, 59, 59, 999), 8, wcRows,
    );
    // Jan: 8*22*(31/31)=176 ; Feb: 8*20*(28/28)=160 (2026 bukan kabisat)
    expect(total).toBeCloseTo(347.391705, 5);
  });

  test('rentang parsial di tengah bulan -> proporsional sesuai jumlah hari cakupan', () => {
    const total = calcPlannedHours(
      localDay(2026, 1, 15), localDay(2026, 1, 20, 23, 59, 59, 999), 8, wcRows,
    );
    // 6 hari cakupan (15-20) dari 31 hari kalender Jan, workingDays=22
    expect(total).toBeCloseTo(39.74193548387097, 5);
  });

  test('wcRows kosong -> semua bulan fallback ke hari kalender', () => {
    const total = calcPlannedHours(
      localDay(2026, 4, 1), localDay(2026, 4, 30, 23, 59, 59, 999), 8, [],
    );
    expect(total).toBeCloseTo(248, 5); // 8 * 30 hari kalender April
  });
});
