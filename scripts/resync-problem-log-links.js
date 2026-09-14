// One-time repair -- ProblemLog rows that ARE linked to a ProduksiHarian
// row (produksiHarianId set) but whose copied tanggal/line/mesin/
// partName/jenisProblem/lostTime/breakdownMesin fields have gone stale
// relative to the CURRENT ProduksiHarian row (e.g. Mesin got corrected/
// normalized against the Machine catalog after the ProblemLog row was
// first created/synced, but the copy was never refreshed).
//
// Found via investigating why PROD's "Machine, closed, August 2026"
// ProblemLog count didn't line up with Dashboard-MTN's day+mesin+line
// text-matching KPI ("Perbaikan" card): several linked rows had a
// slightly different Mesin string than their own source row (e.g.
// "CNC GFIR TG45 NO 03 (COLLAR GUIDE)" vs the corrected "CNC GFIR TG35
// NO 3"), causing MTN's text match to silently miss them even though
// the link (produksiHarianId) was perfectly intact.
//
// syncLinkedProblemLog (src/services/produksi.service.js) already keeps
// this in sync going forward on every ProduksiHarian create/update --
// this script just catches up EXISTING links that went stale before
// that logic ran, or from an edit made outside the normal update path.
//
// Usage: node scripts/resync-problem-log-links.js
require('dotenv').config();
const prisma = require('../src/lib/prisma');

async function main() {
  const linked = await prisma.problemLog.findMany({ where: { produksiHarianId: { not: null } } });
  console.log(`Baris ProblemLog dengan link produksiHarianId: ${linked.length}`);

  const sourceRows = await prisma.produksiHarian.findMany({
    where: { id: { in: linked.map((r) => r.produksiHarianId) } },
  });
  const sourceById = new Map(sourceRows.map((r) => [r.id, r]));

  let updated = 0;
  let missingSource = 0;
  for (const pl of linked) {
    const ph = sourceById.get(pl.produksiHarianId);
    if (!ph) { missingSource++; continue; }
    const stale = pl.tanggal?.getTime() !== ph.tanggal?.getTime()
      || pl.line !== ph.line || pl.mesin !== ph.mesin || pl.partName !== ph.partName
      || pl.jenisProblem !== ph.jenisProblem || pl.lostTime !== ph.lostTime || pl.breakdownMesin !== ph.breakdownMesin;
    if (!stale) continue;
    await prisma.problemLog.update({
      where: { id: pl.id },
      data: {
        tanggal: ph.tanggal, line: ph.line, mesin: ph.mesin, partName: ph.partName,
        jenisProblem: ph.jenisProblem, lostTime: ph.lostTime, breakdownMesin: ph.breakdownMesin,
      },
    });
    updated++;
  }

  console.log(`Baris yang direfresh (copy-nya sebelumnya stale): ${updated}`);
  if (missingSource) console.log(`Peringatan: ${missingSource} baris ProblemLog menunjuk ke produksiHarianId yang sudah tidak ada (baris ProduksiHarian-nya terhapus) -- tidak disentuh.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
