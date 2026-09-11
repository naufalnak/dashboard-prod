const { rowMetrics, aggregateOee, avgArValues } = require('../../src/services/produksiMetrics.service');

// Fungsi-fungsi ini murni (tidak nyentuh Prisma/req/res), jadi test-nya
// cuma objek in -> objek out. Nilai expected di bawah dihitung langsung
// dari rowMetrics() asli (bukan dikira-kira), supaya test ini jadi
// "characterization test" yang jujur: kalau rumus di produksiMetrics
// berubah secara tidak sengaja pas refactor Tier 3 (agregasi DB), test
// ini yang pertama teriak.

describe('rowMetrics', () => {
  test('kasus normal: semua kolom terisi wajar', () => {
    const row = {
      ok1: 80, ok2: 10, rework: 5, reject: 5,
      waktuEfektif: 8, breakdownMesin: 30, cycleTime: 25,
      lostTime: 20, plan: 100,
    };
    expect(rowMetrics(row)).toEqual({
      totalOk: 90,
      totalProses: 100,
      avb: 83.8,
      perf: 8.6,
      yield: 90,
      ar: 100,
      oee: 6.5,
    });
  });

  test('plan = 0 -> AR jadi 0 (bukan Infinity/NaN)', () => {
    const row = {
      ok1: 50, ok2: 0, rework: 0, reject: 0,
      waktuEfektif: 8, breakdownMesin: 0, cycleTime: 20,
      lostTime: 0, plan: 0,
    };
    const m = rowMetrics(row);
    expect(m.ar).toBe(0);
    expect(Number.isFinite(m.ar)).toBe(true);
  });

  test('waktuEfektif = 0 -> semua metrik 0, tidak NaN', () => {
    const row = {
      ok1: 0, ok2: 0, rework: 0, reject: 0,
      waktuEfektif: 0, breakdownMesin: 0, cycleTime: 10,
      lostTime: 0, plan: 100,
    };
    const m = rowMetrics(row);
    expect(m).toEqual({
      totalOk: 0, totalProses: 0, avb: 0, perf: 0, yield: 0, ar: 0, oee: 0,
    });
  });

  test('totalProses = 0 (tidak ada produksi sama sekali) -> yield & ar 0, bukan NaN', () => {
    const row = {
      ok1: 0, ok2: 0, rework: 0, reject: 0,
      waktuEfektif: 8, breakdownMesin: 10, cycleTime: 15,
      lostTime: 5, plan: 50,
    };
    const m = rowMetrics(row);
    expect(m.yield).toBe(0);
    expect(m.ar).toBe(0);
    expect(m.avb).toBe(87.9);
  });

  test('breakdown ekstrem -> AVB diklem ke 0 (tidak minus)', () => {
    const row = {
      ok1: 40, ok2: 0, rework: 0, reject: 0,
      waktuEfektif: 8, breakdownMesin: 1000, cycleTime: 30,
      lostTime: 0, plan: 40,
    };
    const m = rowMetrics(row);
    expect(m.avb).toBe(0);
    expect(m.avb).toBeGreaterThanOrEqual(0);
  });

  test('AVB tidak pernah lebih dari plafon 90', () => {
    const row = {
      ok1: 100, ok2: 0, rework: 0, reject: 0,
      waktuEfektif: 8, breakdownMesin: 0, cycleTime: 1,
      lostTime: 0, plan: 100,
    };
    expect(rowMetrics(row).avb).toBeLessThanOrEqual(90);
  });

  test('OEE tidak pernah lebih dari plafon 85', () => {
    const row = {
      ok1: 1000, ok2: 0, rework: 0, reject: 0,
      waktuEfektif: 8, breakdownMesin: 0, cycleTime: 0.01,
      lostTime: 0, plan: 1000,
    };
    expect(rowMetrics(row).oee).toBeLessThanOrEqual(85);
  });
});

describe('aggregateOee', () => {
  test('array kosong -> semua 0, bukan NaN', () => {
    expect(aggregateOee([])).toEqual({ avb: 0, perf: 0, yield: 0, oee: 0 });
  });

  test('rata-rata polos dari beberapa baris', () => {
    const rowA = {
      ok1: 80, ok2: 10, rework: 5, reject: 5,
      waktuEfektif: 8, breakdownMesin: 30, cycleTime: 25,
      lostTime: 20, plan: 100,
    };
    const rowB = {
      ok1: 50, ok2: 0, rework: 0, reject: 0,
      waktuEfektif: 8, breakdownMesin: 0, cycleTime: 20,
      lostTime: 0, plan: 0,
    };
    expect(aggregateOee([rowA, rowB])).toEqual({
      avb: 86.9, perf: 6.1, yield: 95, oee: 4.9,
    });
  });
});

describe('avgArValues', () => {
  test('array kosong -> 0, bukan NaN', () => {
    expect(avgArValues([])).toBe(0);
  });

  test('rata-rata dibulatkan 1 desimal', () => {
    expect(avgArValues([10, 20, 30.456])).toBe(20.2);
  });
});
