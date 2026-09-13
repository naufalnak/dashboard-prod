import { describe, it, expect } from 'vitest';
import period from '../../src/lib/period.js';

const { getPeriodRange, daysInRange } = period;

// getPeriodRange dipakai hampir semua endpoint agregat dashboard (AR/OEE/
// Rejection/Overtime by-cluster & trend) untuk menentukan rentang tanggal
// -- kalau ini salah, filter tanggal salah di HAMPIR SELURUH dashboard
// sekaligus, jadi prioritas tinggi untuk ditest.

describe('getPeriodRange', () => {
  it('period "today": tanggal spesifik saja (00:00:00 s/d 23:59:59), bukan sebulan penuh', () => {
    const { start, end } = getPeriodRange('today', '2026-08-15');
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(7); // Agustus (0-indexed)
    expect(start.getDate()).toBe(15);
    expect(start.getHours()).toBe(0);
    expect(end.getDate()).toBe(15);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });

  it('period "month": satu tahun penuh dari tanggal referensi (bukan cuma satu bulan)', () => {
    const { start, end } = getPeriodRange('month', '2026-08-15');
    expect(start).toEqual(new Date(2026, 0, 1));
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(11);
    expect(end.getDate()).toBe(31);
  });

  it('period "year": rentang lebar mencakup semua tahun (2000-2099)', () => {
    const { start, end } = getPeriodRange('year', '2026-08-15');
    expect(start.getFullYear()).toBe(2000);
    expect(end.getFullYear()).toBe(2099);
  });

  it('period "all": rentang lebar 2000-2099, sama seperti "year"', () => {
    const { start, end } = getPeriodRange('all');
    expect(start.getFullYear()).toBe(2000);
    expect(end.getFullYear()).toBe(2099);
  });

  it('period "week": Senin s/d Minggu yang mencakup tanggal referensi', () => {
    // 2026-08-19 adalah hari Rabu -- Senin minggu itu = 2026-08-17.
    const { start, end } = getPeriodRange('week', '2026-08-19');
    expect(start.getDay()).toBe(1); // Senin
    expect(start.getDate()).toBe(17);
    expect(end.getDay()).toBe(0); // Minggu
    expect(end.getDate()).toBe(23);
  });

  it('period "week": kalau referensi jatuh hari Minggu, tetap ambil Senin SEBELUMNYA (bukan minggu depan)', () => {
    // 2026-08-23 adalah hari Minggu.
    const { start } = getPeriodRange('week', '2026-08-23');
    expect(start.getDay()).toBe(1);
    expect(start.getDate()).toBe(17);
  });

  it('period "range": pakai start/end eksplisit, bukan tanggal referensi', () => {
    const { start, end } = getPeriodRange('range', null, '2026-01-01', '2026-01-31');
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(0);
    expect(end.getDate()).toBe(31);
    expect(end.getHours()).toBe(23);
  });

  it('period "range" tanpa start/end lengkap jatuh balik ke default (hari ini)', () => {
    const { start } = getPeriodRange('range', '2026-08-15');
    // Tidak crash, dan balik ke perilaku "today" karena start/end kosong.
    expect(start.getDate()).toBe(15);
  });

  it('tanpa refDate, pakai tanggal sekarang (tidak crash)', () => {
    const { start, end } = getPeriodRange('today');
    expect(start.getTime()).toBeLessThanOrEqual(Date.now());
    expect(end.getTime()).toBeGreaterThanOrEqual(start.getTime());
  });
});

describe('daysInRange', () => {
  it('minimal 1 hari walau start===end', () => {
    const d = new Date(2026, 0, 1);
    expect(daysInRange(d, d)).toBe(1);
  });

  it('menghitung jumlah hari yang benar untuk rentang lebih dari 1 hari', () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 0, 8); // 7 hari kemudian
    expect(daysInRange(start, end)).toBe(7);
  });
});
