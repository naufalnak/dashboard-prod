const prisma = require('../lib/prisma');
const { parseCsv } = require('../utils/csv');

// ══════════════════════════════════════════════════════════════════════
// Master data gabungan & lookup baca-saja
// ══════════════════════════════════════════════════════════════════════

// Public — master data relasional lengkap untuk dropdown bertingkat di
// form /rmo: Group Head → Cluster → Part Name → Proses (+Cycle Time,
// Line Produksi, Mesin, Man Power).
async function getMasterData() {
  const [clusters, groupHeads, partNames, proses, manPower, kriteriaNg, overtimeTargets, shiftHours] = await Promise.all([
    prisma.masterCluster.findMany({ orderBy: { cluster: 'asc' } }),
    prisma.masterGroupHead.findMany({ orderBy: { name: 'asc' } }),
    prisma.masterPartName.findMany({ orderBy: { partName: 'asc' } }),
    prisma.masterProses.findMany({ orderBy: { proses: 'asc' } }),
    prisma.masterManPower.findMany({ orderBy: { name: 'asc' } }),
    prisma.masterKriteriaNg.findMany({ orderBy: { nama: 'asc' } }),
    prisma.masterOvertimeTarget.findMany({ orderBy: [{ year: 'desc' }, { month: 'desc' }] }),
    prisma.masterShiftHours.findMany({ orderBy: { id: 'asc' } }),
  ]);
  return {
    clusters: clusters.map((r) => r.cluster).filter(Boolean),
    groupHeads: groupHeads.map((r) => ({ id: r.id, name: r.name, cluster: r.cluster })),
    partNames: partNames.map((r) => ({ id: r.id, partName: r.partName, cluster: r.cluster, price: r.price, idCode: r.idCode })),
    proses: proses.map((r) => ({ id: r.id, proses: r.proses, partName: r.partName, cluster: r.cluster, line: r.line, mesin: r.mesin, manPower: r.manPower, cycleTime: r.cycleTime, isFinishProses: r.isFinishProses })),
    manPower: manPower.map((r) => ({ id: r.id, name: r.name, groupHead: r.groupHead })),
    kriteriaNg: kriteriaNg.map((r) => ({ id: r.id, nama: r.nama })),
    overtimeTargets: overtimeTargets.map((r) => ({ id: r.id, year: r.year, month: r.month, targetHours: r.targetHours })),
    shiftHours: shiftHours.map((r) => ({ id: r.id, shift: r.shift, defaultHours: r.defaultHours })),
  };
}

// Login-gated — daftar nama mentah dari tabel lama "MP", "Mesin", "Proses",
// "Nama Parts" yang dibuat manual di Supabase sebelum Master Data
// relasional ada. Tabel-tabel itu cuma daftar nama datar tanpa relasi
// (tidak tahu Part mana pakai Proses/Mesin/MP mana), jadi tidak bisa
// auto-migrate ke MasterPartName/MasterProses. Dipakai sebagai saran
// autocomplete (datalist) saja di menu Master Data supaya penamaan
// konsisten dengan histori, sambil relasinya diisi manual sekali oleh
// admin (yang tahu kombinasi aslinya di lapangan).
async function getLegacyLookups() {
  const [mp, mesin, proses, partNames] = await Promise.all([
    prisma.$queryRaw`SELECT "MP" AS name FROM "MP" ORDER BY "MP"`,
    prisma.$queryRaw`SELECT "Mesin" AS name FROM "Mesin" ORDER BY "Mesin"`,
    prisma.$queryRaw`SELECT "Proses" AS name FROM "Proses" ORDER BY "Proses"`,
    prisma.$queryRaw`SELECT "Nama Parts" AS name FROM "Nama Parts" ORDER BY "Nama Parts"`,
  ]);
  return {
    manPower: mp.map((r) => r.name?.trim()).filter(Boolean),
    mesin: mesin.map((r) => r.name?.trim()).filter(Boolean),
    proses: proses.map((r) => r.name?.trim()).filter(Boolean),
    partNames: partNames.map((r) => r.name?.trim()).filter(Boolean),
  };
}

// Login-gated — daftar mesin dari tabel Machine (shared dengan
// Dashboard-MTN, lihat model Machine di schema.prisma) buat dropdown Mesin
// di Master Data -> Part Name & Proses. Cluster & Line ikut disertakan
// supaya frontend bisa filter per Cluster & auto-isi Line Produksi begitu
// Mesin dipilih (lihat /master-proses & /master-proses-update).
async function getMachines() {
  return prisma.machine.findMany({ orderBy: [{ cluster: 'asc' }, { machine: 'asc' }] });
}

// ══════════════════════════════════════════════════════════════════════
// Analisis silang Data Produksi ↔ Master Data (panel "perlu perhatian")
// ══════════════════════════════════════════════════════════════════════

// Login-gated — jumlah baris ProduksiHarian per kombinasi Part Name +
// Proses, dipakai sebagai kolom "Jumlah Data" di Master Data -> Part
// Name & Proses (supaya kelihatan baris Proses mana yang benar-benar
// dipakai di data produksi, dan mana yang belum/tidak pernah kepakai).
async function getProduksiPartnameCounts() {
  const rows = await prisma.produksiHarian.groupBy({
    by: ['partName', 'proses'],
    _count: { _all: true },
  });
  return rows.map((r) => ({ partName: r.partName, proses: r.proses, count: r._count._all }));
}

// Login-gated — Part Name yang muncul di data ProduksiHarian historis
// tapi TIDAK cocok (case-insensitive) dengan Part Name mana pun yang
// sekarang ada di Master Data -- biasanya karena nama part diketik beda
// (typo/variasi) sebelum katalog Master Data-nya dirapikan, nama Part
// Name-nya sudah diganti di Master Data belakangan, atau memang Part
// Name baru yang belum pernah didaftarkan sama sekali ke Master Data.
// Dipakai supaya admin bisa menyamakan (rename) data lama itu ke nama
// yang benar lewat renamePartName, ATAU -- kalau memang nama baru yang
// valid -- langsung daftarkan ke Master Data lewat upsertPartName dengan
// nama yang sama persis. `cluster` di sini cuma saran (Cluster paling
// sering dipakai baris ProduksiHarian dengan nama ini), admin tetap bisa
// pilih Cluster lain sebelum daftar baru.
async function getProduksiOrphanPartnames() {
  const [rows, masterParts] = await Promise.all([
    prisma.produksiHarian.groupBy({ by: ['partName', 'cluster'], _count: { _all: true } }),
    prisma.masterPartName.findMany({ select: { partName: true } }),
  ]);
  const masterSet = new Set(masterParts.map((p) => p.partName.toLowerCase().trim()));
  const byName = new Map();
  for (const r of rows) {
    const key = r.partName.toLowerCase().trim();
    if (masterSet.has(key)) continue;
    if (!byName.has(key)) byName.set(key, { partName: r.partName, count: 0, clusterCounts: {} });
    const entry = byName.get(key);
    entry.count += r._count._all;
    const clusterKey = r.cluster || '';
    entry.clusterCounts[clusterKey] = (entry.clusterCounts[clusterKey] || 0) + r._count._all;
  }
  return [...byName.values()]
    .map((e) => ({
      partName: e.partName,
      count: e.count,
      cluster: Object.entries(e.clusterCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
    }))
    .sort((a, b) => b.count - a.count);
}

// Login-gated — Part Name di Master Data yang belum bisa dipakai buat
// resolve Total OK Input Rejection: entah belum punya baris Proses sama
// sekali, atau sudah punya Proses tapi belum ada satu pun yang ditandai
// Proses Akhir/Finish (bintang). Dipakai sebagai panel "perlu perhatian"
// di Master Data -> Part Name & Proses supaya tidak perlu menyisir
// manual satu-satu di tabel yang panjang. Part Name yang sudah tidak
// punya data historis SAMA SEKALI (ProduksiHarian/RejectionEntry/
// ProblemLog) sengaja tidak ikut ditampilkan -- Total OK tidak pernah
// dihitung untuk Part Name yang memang tidak dipakai, jadi tidak ada
// yang perlu "dibereskan"; biasanya ini sisa Part Name lama yang sudah
// diganti/dihapus dari data lapangan.
async function getPartnameMissingFinish() {
  const [partNames, proses, produksiRows, rejectionRows, problemRows] = await Promise.all([
    prisma.masterPartName.findMany({ orderBy: { partName: 'asc' } }),
    prisma.masterProses.findMany({ select: { partName: true, isFinishProses: true } }),
    prisma.produksiHarian.findMany({ select: { partName: true }, distinct: ['partName'] }),
    prisma.rejectionEntry.findMany({ select: { partName: true }, distinct: ['partName'] }),
    prisma.problemLog.findMany({ select: { partName: true }, distinct: ['partName'] }),
  ]);
  const usedSet = new Set();
  for (const r of [...produksiRows, ...rejectionRows, ...problemRows]) {
    if (r.partName) usedSet.add(r.partName.toLowerCase().trim());
  }
  const byPart = new Map();
  for (const p of proses) {
    const key = p.partName.toLowerCase().trim();
    if (!byPart.has(key)) byPart.set(key, { count: 0, hasFinish: false });
    const entry = byPart.get(key);
    entry.count++;
    if (p.isFinishProses) entry.hasFinish = true;
  }
  return partNames
    .map((pn) => {
      const key = pn.partName.toLowerCase().trim();
      const entry = byPart.get(key) || { count: 0, hasFinish: false };
      return { partName: pn.partName, cluster: pn.cluster, prosesCount: entry.count, hasFinish: entry.hasFinish, used: usedSet.has(key) };
    })
    .filter((r) => !r.hasFinish && r.used)
    .sort((a, b) => a.partName.localeCompare(b.partName));
}

// Login-gated — Part Name di Master Data yang tidak punya baris Proses
// SAMA SEKALI dan tidak direferensikan di data historis manapun
// (ProduksiHarian/RejectionEntry/ProblemLog/PartReworkEntry) -- sisa
// entri lama yang sudah diganti/dihapus dari data lapangan, tidak
// termasuk Data Produksi. Dipakai panel "Part Name Tidak Terpakai" di
// Master Data supaya bisa dibersihkan manual (lihat deletePartName),
// terpisah dari panel "Belum Punya Proses Akhir/Finish" yang khusus Part
// Name yang MASIH punya data tapi belum lengkap.
async function getPartnameUnused() {
  const [partNames, proses, produksiRows, rejectionRows, problemRows, reworkRows] = await Promise.all([
    prisma.masterPartName.findMany({ orderBy: { partName: 'asc' } }),
    prisma.masterProses.findMany({ select: { partName: true } }),
    prisma.produksiHarian.findMany({ select: { partName: true }, distinct: ['partName'] }),
    prisma.rejectionEntry.findMany({ select: { partName: true }, distinct: ['partName'] }),
    prisma.problemLog.findMany({ select: { partName: true }, distinct: ['partName'] }),
    prisma.partReworkEntry.findMany({ select: { partName: true }, distinct: ['partName'] }),
  ]);
  const usedSet = new Set();
  for (const r of [...proses, ...produksiRows, ...rejectionRows, ...problemRows, ...reworkRows]) {
    if (r.partName) usedSet.add(r.partName.toLowerCase().trim());
  }
  return partNames
    .filter((pn) => !usedSet.has(pn.partName.toLowerCase().trim()))
    .map((pn) => ({ id: pn.id, partName: pn.partName, cluster: pn.cluster }))
    .sort((a, b) => a.partName.localeCompare(b.partName));
}

// Login-gated — baris Proses yang Mesin-nya (data lama, diketik manual
// sebelum Tabel Machine dipakai sebagai katalog) TIDAK cocok dengan satu
// pun baris di Machine -- dipakai sebagai panel "perlu koreksi manual" di
// Master Data -> Part Name & Proses. Koreksi sesungguhnya (pilih Machine
// yang benar) tetap dilakukan manual oleh admin lewat tombol Edit baris
// itu (Mesin di form edit sudah wajib pilih dari Tabel Machine, lihat
// updateProses) -- function ini cuma bantu menemukan baris mana saja
// yang belum dikoreksi, bukan menebak sendiri koreksinya.
async function getProsesMesinMismatch() {
  const [prosesRows, machines] = await Promise.all([
    prisma.masterProses.findMany({ orderBy: [{ partName: 'asc' }, { proses: 'asc' }] }),
    prisma.machine.findMany({ select: { machine: true } }),
  ]);
  const machineSet = new Set(machines.map((m) => m.machine.toLowerCase().trim()));
  return prosesRows
    .filter((p) => !p.mesin || !machineSet.has(p.mesin.toLowerCase().trim()))
    .map((p) => ({ id: p.id, partName: p.partName, proses: p.proses, cluster: p.cluster, mesin: p.mesin, line: p.line }));
}

// Login-gated — ganti nama Part Name di semua data historis (Produksi
// Harian, Rejection, Problem Log) yang masih pakai nama lama (`from`) ke
// nama Part Name Master Data yang benar (`to`) -- match case-insensitive
// biar tidak perlu sama persis huruf besar/kecil.
async function renamePartName(from, to) {
  const where = { partName: { equals: from, mode: 'insensitive' } };
  const [produksi, rejection, problemLog] = await Promise.all([
    prisma.produksiHarian.updateMany({ where, data: { partName: to } }),
    prisma.rejectionEntry.updateMany({ where, data: { partName: to } }),
    prisma.problemLog.updateMany({ where, data: { partName: to } }),
  ]);
  return {
    produksi: produksi.count,
    rejection: rejection.count,
    problemLog: problemLog.count,
    total: produksi.count + rejection.count + problemLog.count,
  };
}

// ══════════════════════════════════════════════════════════════════════
// Master Group Head (CRUD)
// ══════════════════════════════════════════════════════════════════════

async function upsertGroupHead({ name, cluster }) {
  return prisma.masterGroupHead.upsert({ where: { name }, update: { cluster }, create: { name, cluster } });
}

async function updateGroupHead(id, { name, cluster }) {
  const existing = await prisma.masterGroupHead.findUnique({ where: { id } });
  if (!existing) return null;
  const data = {};
  if (name !== undefined) data.name = name;
  if (cluster !== undefined) data.cluster = cluster;
  const record = await prisma.masterGroupHead.update({ where: { id }, data });

  // Nama/Cluster Grup Head disnapshot ke ProduksiHarian.grupHead/cluster
  // (& MasterManPower.groupHead) saat entry dibuat -- kalau diganti di
  // Master Data, baris historis ikut disamakan supaya grafik/tabel
  // (AR Cluster, dsb) langsung ikut, bukan terkunci ke nama/Cluster lama.
  const effectiveName = data.name !== undefined ? data.name : existing.name;
  if (data.name !== undefined && data.name !== existing.name) {
    await Promise.all([
      prisma.masterManPower.updateMany({ where: { groupHead: existing.name }, data: { groupHead: data.name } }),
      prisma.produksiHarian.updateMany({ where: { grupHead: existing.name }, data: { grupHead: data.name } }),
    ]);
  }
  if (data.cluster !== undefined && data.cluster !== existing.cluster) {
    await prisma.produksiHarian.updateMany({ where: { grupHead: effectiveName }, data: { cluster: data.cluster } });
  }
  return record;
}

async function deleteGroupHead(id) {
  await prisma.masterGroupHead.delete({ where: { id } });
}

// ══════════════════════════════════════════════════════════════════════
// Master Man Power (CRUD) — roster per Group Head
// ══════════════════════════════════════════════════════════════════════

// Roster Man Power per Group Head -- name unik global, pindah shift/tempat
// tinggal update field group_head-nya (bukan bikin baris baru).
async function upsertManPower({ name, group_head }) {
  return prisma.masterManPower.upsert({
    where: { name }, update: { groupHead: group_head }, create: { name, groupHead: group_head },
  });
}

async function updateManPower(id, { name, group_head }) {
  const existing = await prisma.masterManPower.findUnique({ where: { id } });
  if (!existing) return null;
  const data = {};
  if (name !== undefined) data.name = name;
  if (group_head !== undefined) data.groupHead = group_head;
  const record = await prisma.masterManPower.update({ where: { id }, data });

  // Nama Man Power disnapshot ke ProduksiHarian.manPower & OvertimeEntry
  // (manPower/groupHead/cluster) saat entry dibuat -- kalau nama atau
  // Grup Head-nya diganti di Master Data, baris historis ikut
  // disamakan supaya grafik/tabel (ranking Overtime, dsb) langsung
  // ikut, bukan terkunci ke nama/Grup Head lama.
  if (name !== undefined && name !== existing.name) {
    await Promise.all([
      prisma.produksiHarian.updateMany({ where: { manPower: existing.name }, data: { manPower: name } }),
      prisma.overtimeEntry.updateMany({ where: { manPower: existing.name }, data: { manPower: name } }),
    ]);
  }
  if (group_head !== undefined && group_head !== existing.groupHead) {
    const gh = await prisma.masterGroupHead.findFirst({ where: { name: { equals: group_head, mode: 'insensitive' } } });
    const effectiveName = name !== undefined ? name : existing.name;
    await prisma.overtimeEntry.updateMany({
      where: { manPower: effectiveName },
      data: { groupHead: group_head, cluster: gh?.cluster || null },
    });
  }
  return record;
}

async function deleteManPower(id) {
  await prisma.masterManPower.delete({ where: { id } });
}

// ══════════════════════════════════════════════════════════════════════
// Master Part Name (CRUD + delete guard + merge)
// ══════════════════════════════════════════════════════════════════════

// Dicocokkan case-insensitive (bukan cuma exact match) supaya "collar
// guide b6h" yang diketik ulang dengan huruf beda tidak bikin Part Name
// duplikat baru -- nempel ke entri yang sudah ada (pakai kapitalisasi
// yang sudah tersimpan), cuma cluster-nya yang diupdate.
// part_name/proses/mesin/line/man_power dst DITRIM di sini (dan di
// function Master Data lain) sebelum disimpan -- spasi tersisa di
// depan/belakang (mis. dari copy-paste) bikin baris kelihatan sama tapi
// sebenarnya beda persis di database, jadi gagal cocok di
// mergePartNames dkk (pernah kejadian nyata: "Lwvwr cluth " vs "Lwvwr cluth").
async function upsertPartName({ part_name, cluster, price, id_code }) {
  const partName = String(part_name || '').trim();
  if (!partName || !cluster) return { status: 'invalid' };
  const existing = await prisma.masterPartName.findFirst({
    where: { partName: { equals: partName, mode: 'insensitive' } },
  });
  const priceData = price !== undefined ? { price: Number(price) || 0 } : {};
  const idCodeData = id_code !== undefined ? { idCode: id_code ? String(id_code).trim() || null : null } : {};
  const record = existing
    ? await prisma.masterPartName.update({ where: { id: existing.id }, data: { cluster, ...priceData, ...idCodeData } })
    : await prisma.masterPartName.create({ data: { partName, cluster, ...priceData, ...idCodeData } });
  return { status: 'ok', record };
}

async function updatePartName(id, { part_name, cluster, price, id_code }) {
  const existing = await prisma.masterPartName.findUnique({ where: { id } });
  if (!existing) return null;
  const data = {};
  if (part_name !== undefined) data.partName = String(part_name).trim();
  if (cluster !== undefined) data.cluster = cluster;
  if (price !== undefined) data.price = Number(price) || 0;
  if (id_code !== undefined) data.idCode = id_code ? String(id_code).trim() || null : null;
  // partName di MasterProses/ProduksiHarian/RejectionEntry/ProblemLog
  // cuma string biasa (bukan foreign key), jadi kalau nama Part Name
  // diganti harus ikut diupdate di semua baris turunannya -- supaya
  // tidak jadi yatim (tidak muncul lagi di dropdown) DAN supaya
  // grafik/tabel historis (AR, Rejection, Problem Log) langsung
  // mengikuti nama terbaru, bukan terkunci ke nama lama.
  if (part_name !== undefined && part_name !== existing.partName) {
    await Promise.all([
      prisma.masterProses.updateMany({ where: { partName: existing.partName }, data: { partName: part_name } }),
      prisma.produksiHarian.updateMany({ where: { partName: existing.partName }, data: { partName: part_name } }),
      prisma.rejectionEntry.updateMany({ where: { partName: existing.partName }, data: { partName: part_name } }),
      prisma.problemLog.updateMany({ where: { partName: existing.partName }, data: { partName: part_name } }),
    ]);
  }
  // Cluster Part Name ini disnapshot ke RejectionEntry.cluster saat
  // entry dibuat (RejectionEntry, beda dari ProduksiHarian.cluster yang
  // ikut Cluster Grup Head, bukan Cluster Part Name) -- kalau Cluster-
  // nya dikoreksi di Master Data, baris Rejection historis ikut
  // disamakan supaya ring per-Cluster di Detail Rejection tidak
  // kelihatan "kunci" ke Cluster lama. Price sengaja TIDAK dicascade --
  // itu snapshot harga saat transaksi, bukan grouping key, jadi harus
  // tetap historis akurat.
  if (cluster !== undefined && cluster !== existing.cluster) {
    const effectivePartName = part_name !== undefined ? part_name : existing.partName;
    await prisma.rejectionEntry.updateMany({ where: { partName: effectivePartName }, data: { cluster } });
  }
  return prisma.masterPartName.update({ where: { id }, data });
}

// Login-gated — hapus satu Part Name Master Data. Ditolak kalau ternyata
// masih punya baris Proses atau data historis apa pun -- dicek ULANG di
// sini (bukan cuma percaya frontend), supaya tombol Hapus di panel "Part
// Name Tidak Terpakai" tidak bisa dipakai untuk menghapus Part Name yang
// sebenarnya masih dipakai (mis. race condition, atau dipanggil manual
// lewat API tanpa lewat panel itu). Return discriminator status supaya
// route bisa mutusin status code (404 vs 400) tanpa service nyentuh res.
async function deletePartName(id) {
  const existing = await prisma.masterPartName.findUnique({ where: { id } });
  if (!existing) return { status: 'not_found' };
  const where = { partName: { equals: existing.partName, mode: 'insensitive' } };
  const [prosesCount, produksiCount, rejectionCount, problemCount, reworkCount] = await Promise.all([
    prisma.masterProses.count({ where }),
    prisma.produksiHarian.count({ where }),
    prisma.rejectionEntry.count({ where }),
    prisma.problemLog.count({ where }),
    prisma.partReworkEntry.count({ where }),
  ]);
  if (prosesCount + produksiCount + rejectionCount + problemCount + reworkCount > 0) {
    return { status: 'in_use' };
  }
  await prisma.masterPartName.delete({ where: { id } });
  return { status: 'ok' };
}

// Gabungkan dua Part Name Master Data yang sebenarnya part yang sama tapi
// kepencet jadi baris terpisah (typo/variasi ejaan, mis. "Pivot Chain Kzr"
// vs "PIVOT CAM KZR") -- SEMUA baris Proses milik `from` dipindah ke `to`
// apa adanya (tidak ada lagi drop-kalau-nama-Proses-sudah-ada, karena
// satu Part Name+Proses sekarang boleh punya lebih dari satu baris),
// semua data historis (Produksi, Rejection, Problem Log) ikut disamakan
// namanya, lalu baris MasterPartName `from` dihapus. Dipakai dari panel
// "Part Name Belum Punya Proses Akhir/Finish" saat Part Name yang belum
// ada Proses Akhir-nya itu ternyata cuma variasi ejaan dari Part Name
// lain yang sudah benar (bukan Part Name baru yang harus dilengkapi
// Proses-nya sendiri).
async function mergePartNames(from, to) {
  const [fromPart, toPart] = await Promise.all([
    prisma.masterPartName.findFirst({ where: { partName: { equals: from, mode: 'insensitive' } } }),
    prisma.masterPartName.findFirst({ where: { partName: { equals: to, mode: 'insensitive' } } }),
  ]);
  if (!fromPart) return { status: 'not_found', which: 'from' };
  if (!toPart) return { status: 'not_found', which: 'to' };
  if (fromPart.id === toPart.id) return { status: 'same' };

  const prosesMoved = await prisma.masterProses.updateMany({
    where: { partName: { equals: fromPart.partName, mode: 'insensitive' } },
    data: { partName: toPart.partName, cluster: toPart.cluster },
  });

  const where = { partName: { equals: fromPart.partName, mode: 'insensitive' } };
  const [produksi, rejection, problemLog] = await Promise.all([
    prisma.produksiHarian.updateMany({ where, data: { partName: toPart.partName } }),
    prisma.rejectionEntry.updateMany({ where, data: { partName: toPart.partName } }),
    prisma.problemLog.updateMany({ where, data: { partName: toPart.partName } }),
  ]);

  await prisma.masterPartName.delete({ where: { id: fromPart.id } });
  await autoMarkSoleFinishProses(toPart.partName);

  return {
    status: 'ok',
    merged: fromPart.partName,
    into: toPart.partName,
    prosesMoved: prosesMoved.count,
    produksi: produksi.count,
    rejection: rejection.count,
    problemLog: problemLog.count,
    total: produksi.count + rejection.count + problemLog.count,
  };
}

// Gabungkan satu baris Proses (fromId) ke Part Name+Proses lain -- dipakai
// kalau dua baris kelihatan beda ternyata sama, cuma beda ejaan/typo (mis.
// "SEAT VALVE SPG 14777-K0J-N000"/"Auto Chamfer" seharusnya sama dengan
// "SEAT VALVE SPRING KZR"/"Chamfer"). Beda dari mergePartNames (yang
// menggabung SELURUH Part Name apa pun Proses-nya): ini scoped ke satu
// baris Proses saja.
//
// Cuma ProduksiHarian yang punya kolom proses selain partName (Rejection/
// ProblemLog/PartReworkEntry cuma punya partName, lihat schema.prisma) --
// jadi cukup ProduksiHarian yang partName+proses-nya dipindahkan (bukan
// dihapus, supaya data historisnya tetap ada, cuma "berpindah rumah").
// Baris MasterProses asal dihapus sesudahnya, sehingga "Jumlah Data"-nya
// otomatis jadi 0 (tidak ada lagi ProduksiHarian yang cocok ke Proses itu).
async function mergeProses(fromId, toPartName, toProses) {
  toPartName = String(toPartName || '').trim();
  toProses = String(toProses || '').trim();
  if (!fromId) return { status: 'invalid' };
  if (!toPartName || !toProses) return { status: 'invalid' };

  const fromRow = await prisma.masterProses.findUnique({ where: { id: Number(fromId) } });
  if (!fromRow) return { status: 'not_found' };

  const targetPart = await prisma.masterPartName.findFirst({ where: { partName: { equals: toPartName, mode: 'insensitive' } } });
  if (!targetPart) return { status: 'target_not_found' };
  if (fromRow.partName.toLowerCase() === targetPart.partName.toLowerCase() && fromRow.proses.toLowerCase() === toProses.toLowerCase()) {
    return { status: 'same' };
  }

  const produksiMoved = await prisma.produksiHarian.updateMany({
    where: { partName: { equals: fromRow.partName, mode: 'insensitive' }, proses: { equals: fromRow.proses, mode: 'insensitive' } },
    data: { partName: targetPart.partName, proses: toProses },
  });

  await prisma.masterProses.delete({ where: { id: fromRow.id } });
  await autoMarkSoleFinishProses(targetPart.partName);

  return {
    status: 'ok',
    fromPartName: fromRow.partName,
    fromProses: fromRow.proses,
    produksi: produksiMoved.count,
    into: { partName: targetPart.partName, proses: toProses },
  };
}

// ══════════════════════════════════════════════════════════════════════
// Master Proses (CRUD + import massal + tandai Proses Akhir/Finish)
// ══════════════════════════════════════════════════════════════════════

// Kalau Part Name cuma punya SATU baris Proses, tidak ada ambiguitas soal
// mana yang "akhir/finish" -- tandai otomatis (dipakai sebagai Total OK
// Input Rejection) tanpa perlu admin klik bintang manual. Cuma Part Name
// dengan >1 Proses yang butuh penandaan manual (baru ada ambiguitas).
async function autoMarkSoleFinishProses(partName) {
  if (!partName) return;
  const rows = await prisma.masterProses.findMany({ where: { partName } });
  if (rows.length === 1 && !rows[0].isFinishProses) {
    await prisma.masterProses.update({ where: { id: rows[0].id }, data: { isFinishProses: true } });
  }
}

// Cocokkan Nama Mesin (case-insensitive) ke tabel Machine (shared dgn
// Dashboard-MTN) kalau ada yang cocok -- TIDAK lagi wajib ada di katalog
// itu supaya edit/tambah Master Data tidak pernah gagal gara-gara data
// lama yang Mesin-nya belum sempat dirapikan (lihat panel "Mesin/Line
// Belum Sesuai Tabel Machine"). Line Produksi TIDAK ikut di-derive dari
// sini -- diisi manual terpisah oleh admin.
async function resolveMachine(mesin) {
  return prisma.machine.findFirst({ where: { machine: { equals: mesin, mode: 'insensitive' } } });
}

// Selalu bikin baris Proses baru (TIDAK lagi cari-atau-update berdasar
// kombinasi Proses+Part Name) -- satu Part Name+Proses sekarang boleh
// punya lebih dari satu baris (mis. beberapa pilihan Mesin), constraint
// unique lama sudah dilepas dari schema (lihat migration
// 20260813000000_drop_proses_partname_unique).
async function createProses({ proses, part_name, mesin, line, man_power, cluster, cycle_time }) {
  const prosesTrim = String(proses || '').trim();
  const partNameTrim = String(part_name || '').trim();
  const mesinTrim = String(mesin || '').trim();
  const lineTrim = String(line || '').trim();
  const manPowerTrim = String(man_power || '').trim();
  if (!prosesTrim || !partNameTrim || !mesinTrim) return { status: 'invalid' };

  const cycleTime = cycle_time ? Number(cycle_time) : 0;
  const machine = await resolveMachine(mesinTrim);

  const existingPart = await prisma.masterPartName.findFirst({
    where: { partName: { equals: partNameTrim, mode: 'insensitive' } },
  });
  const resolvedPartName = existingPart?.partName || partNameTrim;
  // Cluster baris Proses ini: kalau dikirim eksplisit pakai itu, kalau
  // tidak jatuh balik ke Cluster milik Part Name-nya (mis. saat pertama
  // kali dibuat dari form RC Harian / tab tambah Master Data).
  const resolvedCluster = cluster || existingPart?.cluster || '';

  const record = await prisma.masterProses.create({
    data: {
      proses: prosesTrim, partName: resolvedPartName, cluster: resolvedCluster, line: lineTrim,
      mesin: machine ? machine.machine : mesinTrim, machineId: machine ? machine.id : null,
      manPower: manPowerTrim, cycleTime,
    },
  });
  await autoMarkSoleFinishProses(resolvedPartName);
  return { status: 'ok', record };
}

async function updateProses(id, { proses, part_name, cluster, mesin, line, man_power, cycle_time }) {
  const existing = await prisma.masterProses.findUnique({ where: { id } });
  if (!existing) return null;
  const data = {};
  if (proses !== undefined) data.proses = String(proses).trim();
  if (part_name !== undefined) data.partName = String(part_name).trim();
  if (cluster !== undefined) data.cluster = cluster;
  // Line Produksi diisi manual, independen dari Mesin (tidak lagi
  // ikut di-derive dari Machine.line).
  if (line !== undefined) data.line = String(line).trim();
  // Mesin SEBISA MUNGKIN dari Tabel Machine (dinormalisasi kalau
  // cocok), tapi TIDAK lagi diblokir kalau belum ada di katalog.
  if (mesin !== undefined) {
    const mesinTrimmed = String(mesin).trim();
    const machine = await resolveMachine(mesinTrimmed);
    data.mesin = machine ? machine.machine : mesinTrimmed;
    data.machineId = machine ? machine.id : null;
  }
  if (man_power !== undefined) data.manPower = String(man_power).trim();
  if (cycle_time !== undefined) data.cycleTime = Number(cycle_time) || 0;
  // Sengaja cuma update baris Proses ini sendiri (by id) -- tidak pernah
  // menyentuh MasterPartName, supaya mengedit satu baris tidak
  // mempengaruhi baris Proses lain yang berbagi Part Name yang sama.
  const record = await prisma.masterProses.update({ where: { id }, data });

  // Kalau nama Proses/Part Name/Line/Mesin baris ini diganti (mis.
  // membetulkan "Boss series" -> "Boss Series"), baris ProduksiHarian
  // historis yang sudah tercatat dengan kombinasi Part Name+Proses lama
  // ikut disamakan -- supaya grafik/tabel (mis. ranking 5 Line AR
  // Tertinggi/Terendah) langsung mengikuti Master Data terbaru, bukan
  // "terkunci" ke nama lama yang sudah diedit.
  const cascade = {};
  if (data.proses !== undefined && data.proses !== existing.proses) cascade.proses = data.proses;
  if (data.partName !== undefined && data.partName !== existing.partName) cascade.partName = data.partName;
  if (data.line !== undefined && data.line !== existing.line) cascade.line = data.line;
  if (data.mesin !== undefined && data.mesin !== existing.mesin) cascade.mesin = data.mesin;
  if (Object.keys(cascade).length > 0) {
    await prisma.produksiHarian.updateMany({
      where: { partName: existing.partName, proses: existing.proses },
      data: cascade,
    });
  }
  await autoMarkSoleFinishProses(data.partName ?? existing.partName);
  return record;
}

async function deleteProses(id) {
  const existing = await prisma.masterProses.findUnique({ where: { id } });
  await prisma.masterProses.delete({ where: { id } });
  // Kalau Part Name ini sekarang tersisa cuma satu Proses (yang tadinya
  // bukan finish), tandai otomatis -- lihat autoMarkSoleFinishProses.
  if (existing) await autoMarkSoleFinishProses(existing.partName);
}

// Import massal Part Name + Proses -- baris di-parse dari file Excel di
// FRONTEND (lihat web/src/importXlsx.js), dikirim ke sini sebagai array
// objek biasa lewat JSON (bukan multipart), konsisten dengan pola flat-
// endpoint/POST di seluruh domain ini. Satu baris file = satu baris
// Proses BARU (selalu dibuat, sama seperti createProses -- TIDAK dicari-
// atau-update berdasar Part Name+Proses yang sudah ada). Part Name yang
// belum terdaftar otomatis dibuat (cari-atau-buat, idempotent). Baris
// yang gagal validasi dilewati (tidak menggagalkan seluruh import),
// dilaporkan lewat `errors`.
// Ditulis sebagai operasi BULK (fetch katalog sekali, createMany sekali)
// bukan loop per-baris dengan beberapa query masing-masing -- versi
// per-baris (~5 query x N baris) kena timeout serverless Vercel untuk
// file import ratusan baris ("signal timed out" di frontend). Konsekuensi:
// kalau satu baris gagal karena alasan DB (bukan validasi field kosong,
// yang sudah disaring duluan), seluruh import gagal (tidak lagi isolasi
// per-baris seperti sebelumnya) -- trade-off yang diambil demi kecepatan,
// karena kegagalan DB di luar validasi field sangat jarang terjadi.
async function importProsesFromRows(rows) {
  const errors = [];
  const parsed = [];
  rows.forEach((r, i) => {
    r = r || {};
    const partName = String(r.part_name || '').trim();
    const cluster = String(r.cluster || '').trim().toUpperCase();
    const proses = String(r.proses || '').trim();
    const mesin = String(r.mesin || '').trim();
    const line = String(r.line || '').trim();
    const idCode = String(r.id_code || '').trim();
    const cycleTime = Number(r.cycle_time) || 0;
    if (!partName || !cluster || !proses || !mesin) {
      errors.push({ row: i + 2, reason: 'Part Name, Cluster, Proses, dan Mesin wajib diisi' });
      return;
    }
    parsed.push({ partName, cluster, proses, mesin, line, idCode, cycleTime });
  });

  if (parsed.length === 0) return { imported: 0, unmatchedMesin: 0, errors, total: rows.length };

  // Katalog Part Name & Machine di-fetch SEKALI (bukan per baris).
  const [existingParts, machines] = await Promise.all([
    prisma.masterPartName.findMany({ select: { id: true, partName: true, cluster: true, idCode: true } }),
    prisma.machine.findMany({ select: { id: true, machine: true } }),
  ]);
  const partByLower = new Map(existingParts.map((p) => [p.partName.toLowerCase(), p]));
  const machineByLower = new Map(machines.map((m) => [m.machine.toLowerCase(), m]));

  // Part Name baru (belum ada di katalog) -- dibuat sekaligus lewat
  // createMany, satu baris per Part Name unik (bukan per baris file).
  const newParts = new Map();
  for (const r of parsed) {
    const key = r.partName.toLowerCase();
    if (!partByLower.has(key) && !newParts.has(key)) {
      newParts.set(key, { partName: r.partName, cluster: r.cluster, idCode: r.idCode || null });
    }
  }
  if (newParts.size > 0) {
    await prisma.masterPartName.createMany({ data: [...newParts.values()], skipDuplicates: true });
  }
  // Part Name yang sudah ada tapi Cluster/ID Code-nya beda dari file --
  // diupdate satu-satu (biasanya cuma sedikit dari total baris).
  const partUpdates = [];
  for (const r of parsed) {
    const existing = partByLower.get(r.partName.toLowerCase());
    if (existing && r.idCode && (existing.cluster !== r.cluster || existing.idCode !== r.idCode)) {
      partUpdates.push(prisma.masterPartName.update({ where: { id: existing.id }, data: { cluster: r.cluster, idCode: r.idCode } }));
    }
  }
  if (partUpdates.length > 0) await Promise.all(partUpdates);

  // Ejaan Part Name yang benar-benar tersimpan (existing ATAU baru
  // dibuat barusan) -- dipakai supaya baris Proses konsisten dengan
  // MasterPartName, sama seperti perilaku createProses.
  const allParts = await prisma.masterPartName.findMany({ select: { partName: true } });
  const resolvedNameByLower = new Map(allParts.map((p) => [p.partName.toLowerCase(), p.partName]));

  let unmatchedMesin = 0;
  const prosesData = parsed.map((r) => {
    const machine = machineByLower.get(r.mesin.toLowerCase());
    if (!machine) unmatchedMesin++;
    return {
      proses: r.proses,
      partName: resolvedNameByLower.get(r.partName.toLowerCase()) || r.partName,
      cluster: r.cluster, line: r.line,
      mesin: machine ? machine.machine : r.mesin,
      machineId: machine ? machine.id : null,
      manPower: '', cycleTime: r.cycleTime,
    };
  });
  await prisma.masterProses.createMany({ data: prosesData });

  // Tandai otomatis kalau suatu Part Name jadi tersisa cuma 1 Proses
  // (lihat autoMarkSoleFinishProses) -- sekali per Part Name UNIK yang
  // kesentuh import ini, bukan per baris file.
  const touchedPartNames = [...new Set(prosesData.map((p) => p.partName))];
  await Promise.all(touchedPartNames.map((pn) => autoMarkSoleFinishProses(pn)));

  return { imported: prosesData.length, unmatchedMesin, errors, total: rows.length };
}

// Tandai/lepas status "Proses Akhir/Finish" satu baris Proses -- terpisah
// dari updateProses karena perlu menyentuh baris Proses LAIN yang berbagi
// Part Name yang sama (mematikan isFinishProses di baris lain saat satu
// baris dinyalakan -- cuma boleh satu Proses Akhir per Part Name, dipakai
// sebagai acuan Total OK Input Rejection).
async function setProsesFinish(id, value) {
  const row = await prisma.masterProses.findUnique({ where: { id } });
  if (!row) return null;
  if (value) {
    await prisma.masterProses.updateMany({
      where: { partName: row.partName, id: { not: id } },
      data: { isFinishProses: false },
    });
  }
  return prisma.masterProses.update({ where: { id }, data: { isFinishProses: value } });
}

// ══════════════════════════════════════════════════════════════════════
// Master Kriteria NG (CRUD) — jenis cacat dipilih saat input Rejection
// ══════════════════════════════════════════════════════════════════════

async function upsertKriteriaNg(nama) {
  if (!nama) return { status: 'invalid' };
  const existing = await prisma.masterKriteriaNg.findFirst({ where: { nama: { equals: nama, mode: 'insensitive' } } });
  const record = existing || await prisma.masterKriteriaNg.create({ data: { nama } });
  return { status: 'ok', record };
}

async function updateKriteriaNg(id, { nama }) {
  const data = {};
  if (nama !== undefined) data.nama = nama;
  return prisma.masterKriteriaNg.update({ where: { id }, data });
}

async function deleteKriteriaNg(id) {
  await prisma.masterKriteriaNg.delete({ where: { id } });
}

// ══════════════════════════════════════════════════════════════════════
// Master Overtime Target (CRUD) — target jam lembur per bulan
// ══════════════════════════════════════════════════════════════════════

// Target jam lembur per bulan -- upsert (cari-atau-buat) berdasar
// year+month, karena kombinasi itu unik (satu target per bulan).
async function upsertOvertimeTarget({ year, month, target_hours }) {
  const yearNum = Number(year);
  const monthNum = Number(month);
  if (!yearNum || !monthNum || monthNum < 1 || monthNum > 12) return { status: 'invalid' };
  const targetHours = Number(target_hours) || 0;
  const record = await prisma.masterOvertimeTarget.upsert({
    where: { year_month: { year: yearNum, month: monthNum } },
    update: { targetHours },
    create: { year: yearNum, month: monthNum, targetHours },
  });
  return { status: 'ok', record };
}

async function updateOvertimeTarget(id, { target_hours }) {
  const data = {};
  if (target_hours !== undefined) data.targetHours = Number(target_hours) || 0;
  return prisma.masterOvertimeTarget.update({ where: { id }, data });
}

async function deleteOvertimeTarget(id) {
  await prisma.masterOvertimeTarget.delete({ where: { id } });
}

// ══════════════════════════════════════════════════════════════════════
// Master Shift Hours (CRUD) — default Waktu Efektif (jam) per Shift
// ══════════════════════════════════════════════════════════════════════

// Default Waktu Efektif (jam) per Shift -- upsert (cari-atau-buat)
// berdasar nama shift, karena shift itu unik.
async function upsertShiftHours({ shift, default_hours }) {
  if (!shift) return { status: 'invalid' };
  const record = await prisma.masterShiftHours.upsert({
    where: { shift },
    update: { defaultHours: Number(default_hours) || 0 },
    create: { shift, defaultHours: Number(default_hours) || 0 },
  });
  return { status: 'ok', record };
}

async function updateShiftHours(id, { shift, default_hours }) {
  const data = {};
  if (shift !== undefined) data.shift = shift;
  if (default_hours !== undefined) data.defaultHours = Number(default_hours) || 0;
  return prisma.masterShiftHours.update({ where: { id }, data });
}

async function deleteShiftHours(id) {
  await prisma.masterShiftHours.delete({ where: { id } });
}

// ══════════════════════════════════════════════════════════════════════
// Import CSV massal (Group Head + Part Name + Proses sekaligus)
// ══════════════════════════════════════════════════════════════════════

// Login-gated — import CSV massal: Group Head, Cluster, Part Name,
// Cycle Time, Proses, Line Produksi, Mesin, Man Power. Tiap baris mengisi
// ketiga tabel master (upsert, aman dijalankan berulang).
async function importMasterCsv(fileBufferText) {
  const rows = parseCsv(fileBufferText);

  let groupHeads = 0, partNames = 0, prosesRows = 0, skipped = 0;
  for (const row of rows) {
    const lookup = {};
    Object.keys(row).forEach((k) => { lookup[k.trim().toLowerCase()] = row[k]; });
    const field = (...keys) => {
      for (const key of keys) {
        const v = lookup[key.toLowerCase()];
        if (v !== undefined && v !== '') return String(v).trim();
      }
      return '';
    };

    const cluster = field('Cluster').toUpperCase();
    const groupHead = field('Group Head', 'Grup Head');
    const partName = field('Part Name', 'Nama Part');
    const proses = field('Proses');
    const line = field('Line Produksi', 'Line');
    const mesin = field('Mesin', 'Nama Mesin');
    const manPower = field('Man Power', 'MP');
    const cycleTimeRaw = field('Cycle Time', 'CT');
    const cycleTime = cycleTimeRaw && !isNaN(Number(cycleTimeRaw)) ? Number(cycleTimeRaw) : 0;

    if (!cluster) { skipped++; continue; }

    if (groupHead) {
      await prisma.masterGroupHead.upsert({
        where: { name: groupHead }, update: { cluster }, create: { name: groupHead, cluster },
      });
      groupHeads++;
    }
    if (partName) {
      await prisma.masterPartName.upsert({
        where: { partName }, update: { cluster }, create: { partName, cluster },
      });
      partNames++;
      if (proses && line && mesin) {
        await prisma.masterProses.upsert({
          where: { proses_partName: { proses, partName } },
          update: { line, mesin, manPower, cycleTime },
          create: { proses, partName, line, mesin, manPower, cycleTime },
        });
        prosesRows++;
      }
    }
  }

  return { groupHeads, partNames, proses: prosesRows, skipped, total: rows.length };
}

module.exports = {
  getMasterData,
  getLegacyLookups,
  getMachines,
  getProduksiPartnameCounts,
  getProduksiOrphanPartnames,
  getPartnameMissingFinish,
  getPartnameUnused,
  getProsesMesinMismatch,
  renamePartName,
  upsertGroupHead,
  updateGroupHead,
  deleteGroupHead,
  upsertManPower,
  updateManPower,
  deleteManPower,
  upsertPartName,
  updatePartName,
  deletePartName,
  mergePartNames,
  mergeProses,
  createProses,
  updateProses,
  deleteProses,
  importProsesFromRows,
  setProsesFinish,
  upsertKriteriaNg,
  updateKriteriaNg,
  deleteKriteriaNg,
  upsertOvertimeTarget,
  updateOvertimeTarget,
  deleteOvertimeTarget,
  upsertShiftHours,
  updateShiftHours,
  deleteShiftHours,
  importMasterCsv,
};
