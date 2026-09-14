import { describe, it, expect } from 'vitest';
import produksiMetrics from '../../src/services/produksiMetrics.service.js';

const { rowMetrics, aggregateOee, avgArValues, rejectionMetrics, weekOfMonth } = produksiMetrics;

// Fungsi murni (rowMetrics, aggregateOee, avgArValues, rejectionMetrics,
// weekOfMonth) yang paling sering dipakai ulang di seluruh dashboard --
// diprioritaskan duluan karena satu bug di sini langsung salah di banyak
// tempat (AR Cluster, OEE Cluster, footer tabel Data Produksi, dll).
// resolveTotalOkFromProduksi & sumOvertimeTargetHours butuh Prisma (DB
// I/O) jadi belum ditest di sini -- integration test terpisah.

describe('rowMetrics', () => {
  const base = {
    ok1: 100, ok2: 0, rework: 0, reject: 0,
    plan: 100, waktuEfektif: 8, breakdownMesin: 0, lostTime: 0, cycleTime: 60,
  };

  it('AR 100% saat Total Proses persis sama dengan Plan', () => {
    const m = rowMetrics(base);
    expect(m.totalOk).toBe(100);
    expect(m.totalProses).toBe(100);
    expect(m.ar).toBe(100);
  });

  it('AR dipatok maksimal 100% walau Total Proses melebihi Plan', () => {
    const m = rowMetrics({ ...base, ok1: 150 });
    expect(m.ar).toBe(100);
  });

  it('AR 0% kalau Plan 0 (hindari divide-by-zero)', () => {
    const m = rowMetrics({ ...base, plan: 0 });
    expect(m.ar).toBe(0);
  });

  it('YIELD turun kalau ada Reject (Total OK < Total Proses)', () => {
    const m = rowMetrics({ ...base, ok1: 90, reject: 10 });
    expect(m.totalOk).toBe(90);
    expect(m.totalProses).toBe(100);
    expect(m.yield).toBe(90);
  });

  it('AVB dipatok maksimal 90 (plafon standar OEE)', () => {
    // Waktu Efektif besar, Breakdown Mesin 0 -> AVB harusnya mentok di 90,
    // bukan 100, sesuai plafon yang dipakai seluruh dashboard.
    const m = rowMetrics({ ...base, waktuEfektif: 100, breakdownMesin: 0 });
    expect(m.avb).toBeLessThanOrEqual(90);
  });

  it('PERF dipatok maksimal 95 (plafon standar OEE)', () => {
    const m = rowMetrics({ ...base, cycleTime: 999999 });
    expect(m.perf).toBeLessThanOrEqual(95);
  });

  it('OEE dipatok maksimal 85 (plafon standar OEE)', () => {
    const m = rowMetrics(base);
    expect(m.oee).toBeLessThanOrEqual(85);
  });

  it('semua metrik 0 kalau baris kosong total (tidak ada NaN)', () => {
    const m = rowMetrics({ ok1: 0, ok2: 0, rework: 0, reject: 0, plan: 0, waktuEfektif: 0, breakdownMesin: 0, lostTime: 0, cycleTime: 0 });
    expect(m.ar).toBe(0);
    expect(m.avb).toBe(0);
    expect(m.perf).toBe(0);
    expect(m.yield).toBe(0);
    expect(m.oee).toBe(0);
    expect(Number.isNaN(m.oee)).toBe(false);
  });
});

describe('aggregateOee', () => {
  it('{avb:0,perf:0,yield:0,oee:0} kalau tidak ada baris (bukan NaN/crash)', () => {
    expect(aggregateOee([])).toEqual({ avb: 0, perf: 0, yield: 0, oee: 0 });
  });

  it('rata-rata POLOS dari metrik tiap baris (bukan tertimbang) -- harus sama dengan footer tabel Data Produksi', () => {
    const rowSmall = { ok1: 1, ok2: 0, rework: 0, reject: 0, plan: 1, waktuEfektif: 8, breakdownMesin: 0, lostTime: 0, cycleTime: 60 }; // AR 100%
    const rowBig = { ok1: 5, ok2: 0, rework: 0, reject: 5, plan: 10, waktuEfektif: 8, breakdownMesin: 0, lostTime: 0, cycleTime: 60 }; // YIELD 50%
    const result = aggregateOee([rowSmall, rowBig]);
    // Rata-rata polos YIELD: (100 + 50) / 2 = 75, BUKAN tertimbang
    // (yang akan kasih hasil beda kalau baris size-nya jomplang).
    expect(result.yield).toBe(75);
  });
});

describe('avgArValues', () => {
  it('0 kalau array kosong (bukan NaN)', () => {
    expect(avgArValues([])).toBe(0);
  });

  it('rata-rata sederhana dibulatkan 1 desimal', () => {
    expect(avgArValues([100, 90, 80])).toBe(90);
    expect(avgArValues([100, 91])).toBe(95.5);
  });
});

describe('rejectionMetrics', () => {
  it('reject ratio dihitung dari LMR/OK (bukan LMR/TotalProses)', () => {
    const m = rejectionMetrics({ totalOk: 90, totalLmr: 10, price: 1000 });
    expect(m.totalProses).toBe(100);
    expect(m.rejectRatio).toBeCloseTo((10 / 90) * 100, 2);
  });

  it('nilaiOk/nilaiLmr = qty x price', () => {
    const m = rejectionMetrics({ totalOk: 10, totalLmr: 2, price: 500 });
    expect(m.nilaiOk).toBe(5000);
    expect(m.nilaiLmr).toBe(1000);
  });

  it('reject ratio 0 kalau Total OK 0 (hindari divide-by-zero)', () => {
    const m = rejectionMetrics({ totalOk: 0, totalLmr: 5, price: 100 });
    expect(m.rejectRatio).toBe(0);
  });
});

describe('weekOfMonth', () => {
  it('tanggal 1-7 = minggu 1', () => {
    expect(weekOfMonth(new Date(Date.UTC(2026, 0, 1)))).toBe(1);
    expect(weekOfMonth(new Date(Date.UTC(2026, 0, 7)))).toBe(1);
  });

  it('tanggal 8-14 = minggu 2', () => {
    expect(weekOfMonth(new Date(Date.UTC(2026, 0, 8)))).toBe(2);
  });

  it('tanggal 29-31 = minggu 5', () => {
    expect(weekOfMonth(new Date(Date.UTC(2026, 0, 31)))).toBe(5);
  });
});
