import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../../src/app.js';

// Integration test lewat server Express BETULAN (app.listen di port
// acak), bukan mock -- membuktikan routing (requireAuth ke-pasang di
// path yang benar, req.query/req.body sampai ke service dengan bentuk
// yang benar) beneran nyambung dari HTTP sampai ke Prisma, bukan cuma
// lolos unit test fungsi murninya sendiri-sendiri.
//
// SENGAJA cuma endpoint READ-ONLY (GET, publik atau 401 tanpa token) --
// terhubung ke database yang sama dipakai dev lokal (.env DATABASE_URL),
// supaya aman dijalankan berulang tanpa risiko menulis data uji ke
// database beneran. Endpoint mutasi (POST) divalidasi manual lewat smoke
// test tiap kali domain diubah (lihat riwayat komit "Restructure backend
// into domain routes + services").
let server;
let baseUrl;

beforeAll(() => new Promise((resolve) => {
  server = app.listen(0, () => {
    baseUrl = `http://localhost:${server.address().port}`;
    resolve();
  });
}));

afterAll(() => new Promise((resolve) => server.close(resolve)));

describe('GET /api/produksi-harian (public)', () => {
  it('balas 200 dengan array baris ProduksiHarian, tiap baris punya metrik AR/AVB/PERF/YIELD/OEE 0-100', async () => {
    const res = await fetch(`${baseUrl}/api/produksi-harian?period=today`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    for (const row of body) {
      expect(row).toHaveProperty('id');
      expect(row).toHaveProperty('partName');
      for (const key of ['ar', 'avb', 'perf', 'yield', 'oee']) {
        expect(row[key]).toBeGreaterThanOrEqual(0);
        expect(row[key]).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('GET /api/produksi-ok-for-part (public)', () => {
  it('tanpa query part_name/tanggal balas default nol, bukan error', async () => {
    const res = await fetch(`${baseUrl}/api/produksi-ok-for-part`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ totalOk: 0, hasFinishProses: false });
  });
});

describe('GET /api/master (public)', () => {
  it('balas 200 dengan struktur master data lengkap (clusters/groupHeads/partNames/proses/dst)', async () => {
    const res = await fetch(`${baseUrl}/api/master`);
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const key of ['clusters', 'groupHeads', 'partNames', 'proses', 'manPower', 'kriteriaNg', 'overtimeTargets', 'shiftHours']) {
      expect(Array.isArray(body[key])).toBe(true);
    }
  });
});

// Endpoint login-gated -- tanpa token WAJIB 401, bukan 500/200. Ini yang
// paling penting dibuktikan lewat integration test (bukan unit test)
// karena requireAuth ada di LAYER ROUTING (middleware Express), bukan di
// dalam fungsi service yang ditest terpisah.
describe('endpoint login-gated tanpa token', () => {
  const gatedGetPaths = [
    '/api/produksi-harian-summary',
    '/api/ar-by-cluster',
    '/api/ar-by-line',
    '/api/oee-by-cluster',
    '/api/oee-by-line',
    '/api/rejection-entries',
    '/api/overtime-entries',
    '/api/part-rework-entries',
    '/api/problem-log',
    '/api/legacy-lookups',
    '/api/master-partname-missing-finish',
  ];

  for (const path of gatedGetPaths) {
    it(`GET ${path} balas 401 tanpa token`, async () => {
      const res = await fetch(`${baseUrl}${path}`);
      expect(res.status).toBe(401);
    });
  }
});

describe('validasi input balas 400 dengan pesan yang jelas (bukan 500 generik)', () => {
  it('POST /api/produksi-harian tanpa field wajib balas 400', async () => {
    const res = await fetch(`${baseUrl}/api/produksi-harian`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/wajib diisi/);
  });

  it('POST /api/produksi-harian dengan Loss Time tapi tanpa Jenis Problem balas 400', async () => {
    const res = await fetch(`${baseUrl}/api/produksi-harian`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tanggal: '2026-08-19', shift: 'Shift 1', cluster: 'AD', line: 'X',
        part_name: 'X', proses: 'X', mesin: 'X', lost_time: 30,
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Jenis Problem/);
  });
});
