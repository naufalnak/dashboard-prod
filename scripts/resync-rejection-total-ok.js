// One-time backfill -- RejectionEntry.totalOk dulu cuma dihitung SEKALI
// (lewat resolveTotalOkFromProduksi) saat baris Input Rejection itu
// sendiri dibuat/diedit, tidak pernah disinkron ulang kalau baris RC
// Harian Produksi Part Name+tanggal yang sama diinput/dikoreksi
// BELAKANGAN -- urutan yang lumrah di lapangan (rejection dicatat
// duluan, produksinya baru diinput shift berikutnya). Sejak fitur
// auto-resync ditambahkan ke createProduksi/updateProduksi/deleteProduksi
// (lihat resyncRejectionTotalOk di src/services/rejection.service.js),
// data BARU akan selalu ikut sinkron -- script ini cuma buat merapikan
// baris RejectionEntry LAMA yang sudah kadung nyangkut di Total OK = 0.
//
// Usage: node scripts/resync-rejection-total-ok.js
require('dotenv').config();
const prisma = require('../src/lib/prisma');
const { resolveTotalOkFromProduksi } = require('../src/services/produksiMetrics.service');

async function main() {
  const rows = await prisma.rejectionEntry.findMany({ select: { id: true, partName: true, tanggal: true, totalOk: true } });
  console.log(`Total RejectionEntry rows: ${rows.length}`);

  // Group per (partName lower + tanggal) -- satu resolveTotalOkFromProduksi
  // per kombinasi unik, bukan per baris (banyak baris Rejection bisa
  // berbagi Part Name+tanggal yang sama, mis. beberapa Kriteria NG beda
  // baris tapi Part Name & tanggalnya sama).
  const groups = new Map();
  for (const r of rows) {
    const key = `${r.partName.toLowerCase().trim()}|${r.tanggal.toISOString().slice(0, 10)}`;
    if (!groups.has(key)) groups.set(key, { partName: r.partName, tanggal: r.tanggal, ids: [], oldTotalOk: r.totalOk });
    groups.get(key).ids.push(r.id);
  }
  console.log(`Kombinasi unik Part Name+tanggal: ${groups.size}`);

  let changed = 0;
  let checked = 0;
  for (const g of groups.values()) {
    checked++;
    const { totalOk } = await resolveTotalOkFromProduksi(g.partName, g.tanggal);
    if (totalOk !== g.oldTotalOk) {
      await prisma.rejectionEntry.updateMany({ where: { id: { in: g.ids } }, data: { totalOk } });
      changed++;
      console.log(`"${g.partName}" ${g.tanggal.toISOString().slice(0, 10)}: ${g.oldTotalOk} -> ${totalOk} (${g.ids.length} baris)`);
    }
    if (checked % 100 === 0) console.log(`...${checked}/${groups.size} diperiksa`);
  }
  console.log(`Selesai. ${changed} dari ${groups.size} kombinasi Part Name+tanggal berubah Total OK-nya.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
