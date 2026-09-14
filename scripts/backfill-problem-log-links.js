// One-time backfill -- ProduksiHarian rows with a real downtime signal
// (Jenis Problem terisi + Loss Time/Breakdown Mesin/Keterangan) yang
// belum punya baris ProblemLog terhubung (produksiHarianId), biasanya
// karena dibuat SEBELUM fitur auto-link (syncLinkedProblemLog, commit
// e4014c0, 2026-08-19) ada. Baris baru sudah otomatis ke-link sejak
// fitur itu + validasi dua-arah Jenis Problem<->downtime (commit
// de02a6a) -- script ini cuma buat merapikan data LAMA yang ketinggalan,
// supaya Dashboard-MTN (yang query lewat ProblemLog, bukan langsung ke
// ProduksiHarian) bisa mencocokkan baris-baris ini juga.
//
// Status baris yang dibuat SELALU 'open' -- script ini TIDAK menebak
// mana yang sudah selesai dikerjakan (itu proses maintenance nyata di
// MTN, bukan sesuatu yang bisa direkonstruksi dari data lama).
//
// Usage: node scripts/backfill-problem-log-links.js
require('dotenv').config();
const prisma = require('../src/lib/prisma');

async function main() {
  const downtimeRows = await prisma.produksiHarian.findMany({
    where: {
      jenisProblem: { not: null },
      OR: [{ lostTime: { gt: 0 } }, { breakdownMesin: { gt: 0 } }, { keterangan: { not: null } }],
    },
  });
  console.log(`Total ProduksiHarian rows dengan sinyal downtime: ${downtimeRows.length}`);

  const linkedLogs = await prisma.problemLog.findMany({
    where: { produksiHarianId: { in: downtimeRows.map((r) => r.id) } },
    select: { produksiHarianId: true },
  });
  const linkedSet = new Set(linkedLogs.map((l) => l.produksiHarianId));
  const unlinked = downtimeRows.filter((r) => !linkedSet.has(r.id));
  console.log(`Baris yang belum punya ProblemLog terhubung: ${unlinked.length}`);

  if (unlinked.length === 0) {
    console.log('Tidak ada yang perlu di-backfill.');
    return;
  }

  const data = unlinked.map((row) => ({
    tanggal: row.tanggal,
    line: row.line,
    mesin: row.mesin,
    partName: row.partName,
    jenisProblem: row.jenisProblem,
    lostTime: row.lostTime,
    breakdownMesin: row.breakdownMesin,
    problem: (row.keterangan || '').trim() || row.jenisProblem || 'Downtime',
    status: 'open',
    produksiHarianId: row.id,
  }));

  const result = await prisma.problemLog.createMany({ data, skipDuplicates: true });
  console.log(`ProblemLog baru dibuat: ${result.count}`);

  const byJenis = {};
  for (const r of unlinked) byJenis[r.jenisProblem] = (byJenis[r.jenisProblem] || 0) + 1;
  console.log('Rincian per Jenis Problem:', byJenis);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
