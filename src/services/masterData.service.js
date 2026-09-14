// Business logic & query Prisma untuk domain Master Data (Part Name,
// Proses, Group Head, Man Power, Kriteria NG, Overtime Target, Shift
// Hours, legacy lookups, import CSV/Excel) -- dipindah dari
// routes/masterData.routes.js.
const prisma = require('../lib/prisma');
const { upper } = require('../utils/formatters');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// ── GET /api/master ────────────────────────────────────
// Public — master data relasional lengkap untuk dropdown bertingkat di
// form /rmo: Group Head → Cluster → Part Name → Proses (+Cycle Time,
// Line Produksi, Mesin, Man Power).
async function getMaster() {
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

// ── GET /api/legacy-lookups ─────────────────────────────
// Login-gated — daftar nama mentah dari tabel lama "MP", "Mesin", "Proses",
// "Nama Parts" yang dibuat manual di Supabase sebelum Master Data
// relasional ada. Dipakai sebagai saran autocomplete (datalist) saja.
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

// ── GET /api/produksi-partname-counts ──────────────────
// Login-gated — jumlah baris ProduksiHarian per kombinasi Part Name +
// Proses, dipakai sebagai kolom "Jumlah Data" di Master Data -> Part
// Name & Proses.
async function getProduksiPartNameCounts() {
  const rows = await prisma.produksiHarian.groupBy({ by: ['partName', 'proses'], _count: { _all: true } });
  return rows.map((r) => ({ partName: r.partName, proses: r.proses, count: r._count._all }));
}

// ── GET /api/produksi-orphan-partnames ──────────────────
// Login-gated — Part Name yang muncul di data ProduksiHarian historis
// tapi TIDAK cocok (case-insensitive) dengan Part Name mana pun yang
// sekarang ada di Master Data. `cluster` di sini cuma saran (Cluster
// paling sering dipakai baris ProduksiHarian dengan nama ini).
async function getOrphanPartNames() {
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

// ── GET /api/master-partname-missing-finish ─────────────
// Login-gated — Part Name di Master Data yang belum bisa dipakai buat
// resolve Total OK Input Rejection. Part Name yang sudah tidak punya data
// historis SAMA SEKALI sengaja tidak ikut ditampilkan.
async function getMissingFinishPartNames() {
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

// ── GET /api/master-partname-unused ──────────────────────
// Login-gated — Part Name di Master Data yang tidak punya baris Proses
// SAMA SEKALI dan tidak direferensikan di data historis manapun.
async function getUnusedPartNames() {
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

// ── POST /api/master-part-name-delete ────────────────────
// Login-gated — hapus satu Part Name Master Data. Ditolak (400) kalau
// ternyata masih punya baris Proses atau data historis apa pun -- dicek
// ULANG di sini (bukan cuma percaya frontend).
async function deletePartName(id) {
  const existing = await prisma.masterPartName.findUnique({ where: { id } });
  if (!existing) throw httpError(404, 'Not found');
  const where = { partName: { equals: existing.partName, mode: 'insensitive' } };
  const [prosesCount, produksiCount, rejectionCount, problemCount, reworkCount] = await Promise.all([
    prisma.masterProses.count({ where }),
    prisma.produksiHarian.count({ where }),
    prisma.rejectionEntry.count({ where }),
    prisma.problemLog.count({ where }),
    prisma.partReworkEntry.count({ where }),
  ]);
  if (prosesCount + produksiCount + rejectionCount + problemCount + reworkCount > 0) {
    throw httpError(400, 'Part Name ini masih punya data, tidak bisa dihapus');
  }
  await prisma.masterPartName.delete({ where: { id } });
}

// ── GET /api/master-proses-mesin-mismatch ────────────────
// Login-gated — baris Proses yang Mesin-nya TIDAK cocok dengan satu pun
// baris di Machine -- panel "perlu koreksi manual".
async function getMesinMismatch() {
  const [prosesRows, machines] = await Promise.all([
    prisma.masterProses.findMany({ orderBy: [{ partName: 'asc' }, { proses: 'asc' }] }),
    prisma.machine.findMany({ select: { machine: true } }),
  ]);
  const machineSet = new Set(machines.map((m) => m.machine.toLowerCase().trim()));
  return prosesRows
    .filter((p) => {
      const mesin = (p.mesin || '').trim().toLowerCase();
      // Mesin "Manual" = Proses sengaja tidak pakai mesin (dikerjakan
      // tangan) -- bukan data lama yang perlu dikoreksi ke Tabel Machine,
      // jadi dikecualikan dari panel ini.
      if (mesin === 'manual') return false;
      return !mesin || !machineSet.has(mesin);
    })
    .map((p) => ({ id: p.id, partName: p.partName, proses: p.proses, cluster: p.cluster, mesin: p.mesin, line: p.line }));
}

// ── POST /api/produksi-rename-partname ─────────────────
// Login-gated — ganti nama Part Name di semua data historis (Produksi
// Harian, Rejection, Problem Log) yang masih pakai nama lama (`from`) ke
// nama Part Name Master Data yang benar (`to`).
async function renameProduksiPartName(from, to) {
  from = String(from || '').trim();
  to = upper(to) || '';
  if (!from || !to) throw httpError(400, 'from dan to wajib diisi');

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

async function createGroupHead(name, cluster) {
  if (!name || !cluster) throw httpError(400, 'name dan cluster wajib diisi');
  return prisma.masterGroupHead.upsert({ where: { name }, update: { cluster }, create: { name, cluster } });
}

async function updateGroupHead(id, body) {
  const existing = await prisma.masterGroupHead.findUnique({ where: { id } });
  if (!existing) throw httpError(404, 'Not found');
  const { name, cluster } = body;
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

// Roster Man Power per Group Head -- name unik global, pindah shift/tempat
// tinggal update field group_head-nya (bukan bikin baris baru).
async function createManPower(name, groupHead) {
  if (!name || !groupHead) throw httpError(400, 'name dan group_head wajib diisi');
  return prisma.masterManPower.upsert({ where: { name }, update: { groupHead }, create: { name, groupHead } });
}

async function updateManPower(id, body) {
  const existing = await prisma.masterManPower.findUnique({ where: { id } });
  if (!existing) throw httpError(404, 'Not found');
  const { name, group_head: groupHead } = body;
  const data = {};
  if (name !== undefined) data.name = name;
  if (groupHead !== undefined) data.groupHead = groupHead;
  const record = await prisma.masterManPower.update({ where: { id }, data });

  // Nama Man Power disnapshot ke ProduksiHarian.manPower & OvertimeEntry
  // (manPower/groupHead/cluster) saat entry dibuat -- kalau nama atau
  // Grup Head-nya diganti di Master Data, baris historis ikut disamakan.
  if (name !== undefined && name !== existing.name) {
    await Promise.all([
      prisma.produksiHarian.updateMany({ where: { manPower: existing.name }, data: { manPower: name } }),
      prisma.overtimeEntry.updateMany({ where: { manPower: existing.name }, data: { manPower: name } }),
    ]);
  }
  if (groupHead !== undefined && groupHead !== existing.groupHead) {
    const gh = await prisma.masterGroupHead.findFirst({ where: { name: { equals: groupHead, mode: 'insensitive' } } });
    const effectiveName = name !== undefined ? name : existing.name;
    await prisma.overtimeEntry.updateMany({
      where: { manPower: effectiveName },
      data: { groupHead, cluster: gh?.cluster || null },
    });
  }
  return record;
}

async function deleteManPower(id) {
  await prisma.masterManPower.delete({ where: { id } });
}

// Cocokkan Nama Mesin (case-insensitive) ke tabel Machine (shared dgn
// Dashboard-MTN) kalau ada yang cocok -- TIDAK lagi wajib ada di katalog
// itu supaya edit/tambah Master Data tidak pernah gagal gara-gara data
// lama yang Mesin-nya belum sempat dirapikan. Line Produksi TIDAK ikut
// di-derive dari sini -- diisi manual terpisah oleh admin.
async function resolveMachine(mesin) {
  return prisma.machine.findFirst({ where: { machine: { equals: mesin, mode: 'insensitive' } } });
}

// Dicocokkan case-insensitive (bukan cuma exact match) supaya "collar
// guide b6h" yang diketik ulang dengan huruf beda tidak bikin Part Name
// duplikat baru -- nempel ke entri yang sudah ada, cuma cluster-nya yang
// diupdate. part_name dkk DITRIM sebelum disimpan -- spasi tersisa di
// depan/belakang bikin baris kelihatan sama tapi sebenarnya beda persis
// di database (pernah kejadian nyata: "Lwvwr cluth " vs "Lwvwr cluth").
async function createPartName(body) {
  const part_name = upper(body.part_name) || '';
  const cluster = body.cluster;
  const { price, id_code } = body;
  if (!part_name || !cluster) throw httpError(400, 'part_name dan cluster wajib diisi');
  const existing = await prisma.masterPartName.findFirst({
    where: { partName: { equals: part_name, mode: 'insensitive' } },
  });
  const priceData = price !== undefined ? { price: Number(price) || 0 } : {};
  const idCodeData = id_code !== undefined ? { idCode: id_code ? String(id_code).trim() || null : null } : {};
  return existing
    ? prisma.masterPartName.update({ where: { id: existing.id }, data: { cluster, ...priceData, ...idCodeData } })
    : prisma.masterPartName.create({ data: { partName: part_name, cluster, ...priceData, ...idCodeData } });
}

async function updatePartName(id, body) {
  const { part_name, cluster, price, id_code } = body;
  const existing = await prisma.masterPartName.findUnique({ where: { id } });
  if (!existing) throw httpError(404, 'Not found');
  const data = {};
  if (part_name !== undefined) data.partName = upper(part_name);
  if (cluster !== undefined) data.cluster = cluster;
  if (price !== undefined) data.price = Number(price) || 0;
  if (id_code !== undefined) data.idCode = id_code ? String(id_code).trim() || null : null;
  // partName di MasterProses/ProduksiHarian/RejectionEntry/ProblemLog
  // cuma string biasa (bukan foreign key), jadi kalau nama Part Name
  // diganti harus ikut diupdate di semua baris turunannya.
  if (part_name !== undefined && part_name !== existing.partName) {
    await Promise.all([
      prisma.masterProses.updateMany({ where: { partName: existing.partName }, data: { partName: part_name } }),
      prisma.produksiHarian.updateMany({ where: { partName: existing.partName }, data: { partName: part_name } }),
      prisma.rejectionEntry.updateMany({ where: { partName: existing.partName }, data: { partName: part_name } }),
      prisma.problemLog.updateMany({ where: { partName: existing.partName }, data: { partName: part_name } }),
    ]);
  }
  // Cluster Part Name ini disnapshot ke RejectionEntry.cluster saat entry
  // dibuat -- kalau Cluster-nya dikoreksi di Master Data, baris Rejection
  // historis ikut disamakan. Price sengaja TIDAK dicascade -- itu
  // snapshot harga saat transaksi, bukan grouping key.
  if (cluster !== undefined && cluster !== existing.cluster) {
    const effectivePartName = part_name !== undefined ? part_name : existing.partName;
    await prisma.rejectionEntry.updateMany({ where: { partName: effectivePartName }, data: { cluster } });
  }
  return prisma.masterPartName.update({ where: { id }, data });
}

// Kalau Part Name cuma punya SATU baris Proses, tidak ada ambiguitas soal
// mana yang "akhir/finish" -- tandai otomatis tanpa perlu admin klik
// manual. Cuma Part Name dengan >1 Proses yang butuh penandaan manual.
async function autoMarkSoleFinishProses(partName) {
  if (!partName) return;
  const rows = await prisma.masterProses.findMany({ where: { partName } });
  if (rows.length === 1 && !rows[0].isFinishProses) {
    await prisma.masterProses.update({ where: { id: rows[0].id }, data: { isFinishProses: true } });
  }
}

// Selalu bikin baris Proses baru (TIDAK cari-atau-update berdasar
// kombinasi Proses+Part Name) -- satu Part Name+Proses boleh punya lebih
// dari satu baris (mis. beberapa pilihan Mesin), constraint unique lama
// sudah dilepas dari schema.
async function createProses(body) {
  const proses = String(body.proses || '').trim();
  const part_name = upper(body.part_name) || '';
  const mesin = String(body.mesin || '').trim();
  const line = upper(body.line) || '';
  const man_power = String(body.man_power || '').trim();
  const { cluster, cycle_time } = body;
  if (!proses || !part_name || !mesin) throw httpError(400, 'proses, part_name, dan mesin wajib diisi');
  const cycleTime = cycle_time ? Number(cycle_time) : 0;
  const machine = await resolveMachine(mesin);

  const existingPart = await prisma.masterPartName.findFirst({
    where: { partName: { equals: part_name, mode: 'insensitive' } },
  });
  // upper(...) lagi di sini -- kalau existingPart kebetulan baris lama
  // yang masih tersimpan huruf kecil (belum sempat kena normalisasi ini),
  // baris Proses baru tetap dibuat dengan Part Name huruf besar.
  const resolvedPartName = upper(existingPart?.partName || part_name);
  // Cluster baris Proses ini: kalau dikirim eksplisit pakai itu, kalau
  // tidak jatuh balik ke Cluster milik Part Name-nya.
  const resolvedCluster = cluster || existingPart?.cluster || '';

  const record = await prisma.masterProses.create({
    data: {
      proses, partName: resolvedPartName, cluster: resolvedCluster, line,
      mesin: machine ? machine.machine : mesin, machineId: machine ? machine.id : null,
      manPower: man_power, cycleTime,
    },
  });
  await autoMarkSoleFinishProses(resolvedPartName);
  return record;
}

async function updateProses(id, body) {
  const existing = await prisma.masterProses.findUnique({ where: { id } });
  if (!existing) throw httpError(404, 'Not found');
  const { proses, part_name, cluster, mesin, line, man_power, cycle_time } = body;
  const data = {};
  if (proses !== undefined) data.proses = String(proses).trim();
  if (part_name !== undefined) data.partName = upper(part_name);
  if (cluster !== undefined) data.cluster = cluster;
  // Line Produksi diisi manual, independen dari Mesin.
  if (line !== undefined) data.line = upper(line);
  // Mesin SEBISA MUNGKIN dari Tabel Machine (dinormalisasi kalau cocok),
  // tapi TIDAK diblokir kalau belum ada di katalog.
  if (mesin !== undefined) {
    const mesinTrimmed = String(mesin).trim();
    const machine = await resolveMachine(mesinTrimmed);
    data.mesin = machine ? machine.machine : mesinTrimmed;
    data.machineId = machine ? machine.id : null;
  }
  if (man_power !== undefined) data.manPower = String(man_power).trim();
  if (cycle_time !== undefined) data.cycleTime = Number(cycle_time) || 0;
  // Sengaja cuma update baris Proses ini sendiri (by id) -- tidak pernah
  // menyentuh MasterPartName.
  const record = await prisma.masterProses.update({ where: { id }, data });

  // Kalau nama Proses/Part Name/Line/Mesin baris ini diganti, baris
  // ProduksiHarian historis yang sudah tercatat dengan kombinasi Part
  // Name+Proses lama ikut disamakan -- supaya grafik/tabel langsung
  // mengikuti Master Data terbaru.
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
  // bukan finish), tandai otomatis.
  if (existing) await autoMarkSoleFinishProses(existing.partName);
}

// ── POST /api/master-proses-import ──────────────────────
// Import massal Part Name + Proses -- baris di-parse dari file Excel di
// FRONTEND, dikirim sebagai array objek biasa lewat JSON. Satu baris file
// = satu baris Proses BARU (selalu dibuat, sama seperti createProses --
// TIDAK dicari-atau-update). Part Name yang belum terdaftar otomatis
// dibuat (cari-atau-buat, idempotent). Baris yang gagal validasi
// dilewati, dilaporkan lewat `errors`.
// Ditulis sebagai operasi BULK (fetch katalog sekali, createMany sekali)
// bukan loop per-baris dengan beberapa query masing-masing -- versi
// per-baris kena timeout serverless Vercel untuk file import ratusan
// baris ("signal timed out"). Konsekuensi: kalau satu baris gagal karena
// alasan DB (bukan validasi field kosong, yang sudah disaring duluan),
// seluruh import gagal -- trade-off demi kecepatan.
async function importProses(rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw httpError(400, 'Tidak ada baris untuk diimport');

  const errors = [];
  const parsed = [];
  rows.forEach((r, i) => {
    r = r || {};
    const partName = upper(r.part_name) || '';
    const cluster = String(r.cluster || '').trim().toUpperCase();
    const proses = String(r.proses || '').trim();
    const mesin = String(r.mesin || '').trim();
    const line = upper(r.line) || '';
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
  // MasterPartName.
  const allParts = await prisma.masterPartName.findMany({ select: { partName: true } });
  const resolvedNameByLower = new Map(allParts.map((p) => [p.partName.toLowerCase(), p.partName]));

  let unmatchedMesin = 0;
  const prosesData = parsed.map((r) => {
    const machine = machineByLower.get(r.mesin.toLowerCase());
    // "Manual" sengaja tidak dihitung -- bukan mismatch yang perlu
    // dikoreksi, lihat catatan di getMesinMismatch.
    if (!machine && r.mesin.toLowerCase().trim() !== 'manual') unmatchedMesin++;
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

  // Tandai otomatis kalau suatu Part Name jadi tersisa cuma 1 Proses --
  // sekali per Part Name UNIK yang kesentuh import ini, bukan per baris.
  const touchedPartNames = [...new Set(prosesData.map((p) => p.partName))];
  await Promise.all(touchedPartNames.map((pn) => autoMarkSoleFinishProses(pn)));

  return { imported: prosesData.length, unmatchedMesin, errors, total: rows.length };
}

// Tandai/lepas status "Proses Akhir/Finish" satu baris Proses -- terpisah
// dari updateProses karena perlu menyentuh baris Proses LAIN yang berbagi
// Part Name yang sama (mematikan isFinishProses di baris lain saat satu
// baris dinyalakan -- cuma boleh satu Proses Akhir per Part Name).
async function setFinishProses(id, value) {
  const row = await prisma.masterProses.findUnique({ where: { id } });
  if (!row) throw httpError(404, 'Not found');
  if (value) {
    await prisma.masterProses.updateMany({
      where: { partName: row.partName, id: { not: id } },
      data: { isFinishProses: false },
    });
  }
  return prisma.masterProses.update({ where: { id }, data: { isFinishProses: value } });
}

// Gabungkan dua Part Name Master Data yang sebenarnya part yang sama tapi
// kepencet jadi baris terpisah (typo/variasi ejaan) -- SEMUA baris Proses
// milik `from` dipindah ke `to` apa adanya, semua data historis ikut
// disamakan namanya, lalu baris MasterPartName `from` dihapus.
async function mergePartName(from, to) {
  from = String(from || '').trim();
  to = String(to || '').trim();
  if (!from || !to) throw httpError(400, 'from dan to wajib diisi');

  const [fromPart, toPart] = await Promise.all([
    prisma.masterPartName.findFirst({ where: { partName: { equals: from, mode: 'insensitive' } } }),
    prisma.masterPartName.findFirst({ where: { partName: { equals: to, mode: 'insensitive' } } }),
  ]);
  if (!fromPart) throw httpError(404, `Part Name "${from}" tidak ditemukan`);
  if (!toPart) throw httpError(404, `Part Name "${to}" tidak ditemukan`);
  if (fromPart.id === toPart.id) throw httpError(400, 'from dan to adalah Part Name yang sama');

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
    merged: fromPart.partName,
    into: toPart.partName,
    prosesMoved: prosesMoved.count,
    produksi: produksi.count,
    rejection: rejection.count,
    problemLog: problemLog.count,
    total: produksi.count + rejection.count + problemLog.count,
  };
}

// Gabungkan satu grup Part Name+Proses (fromIds = id semua baris
// MasterProses miliknya, bisa lebih dari satu kalau punya beberapa pilihan
// Mesin) ke Part Name+Proses lain -- dipakai kalau dua baris yang
// kelihatan beda ternyata sama, cuma beda ejaan/typo (mis. "SEAT VALVE
// SPG 14777-K0J-N000"/"Auto Chamfer" seharusnya sama dengan "SEAT VALVE
// SPRING KZR"/"Chamfer"). Beda dari mergePartName (yang menggabung SELURUH
// Part Name apa pun Proses-nya): ini scoped ke satu kombinasi Proses saja,
// jadi kombinasi Part Name+Proses lain milik Part Name yang sama TIDAK
// ikut kepindah.
//
// Cuma ProduksiHarian yang punya kolom proses selain partName (Rejection/
// ProblemLog/PartReworkEntry cuma punya partName, lihat schema.prisma) --
// jadi cukup ProduksiHarian yang partName+proses-nya dipindahkan (bukan
// dihapus, supaya data historisnya tetap ada, cuma "berpindah rumah").
// Baris MasterProses asal dihapus sesudahnya, sehingga "Jumlah Data"-nya
// otomatis jadi 0 (tidak ada lagi ProduksiHarian yang cocok ke Proses itu).
async function mergeProses(fromIds, toPartName, toProses) {
  toPartName = String(toPartName || '').trim();
  toProses = String(toProses || '').trim();
  if (!Array.isArray(fromIds) || fromIds.length === 0) throw httpError(400, 'from_ids wajib diisi');
  if (!toPartName || !toProses) throw httpError(400, 'to_part_name dan to_proses wajib diisi');

  const fromRows = await prisma.masterProses.findMany({ where: { id: { in: fromIds.map(Number) } } });
  if (fromRows.length === 0) throw httpError(404, 'Baris Proses asal tidak ditemukan');
  const { partName: fromPartName, proses: fromProses } = fromRows[0];
  const sameGroup = fromRows.every((r) =>
    r.partName.toLowerCase() === fromPartName.toLowerCase() && r.proses.toLowerCase() === fromProses.toLowerCase());
  if (!sameGroup) throw httpError(400, 'Semua baris asal harus dari satu grup Part Name+Proses yang sama');

  const targetPart = await prisma.masterPartName.findFirst({ where: { partName: { equals: toPartName, mode: 'insensitive' } } });
  if (!targetPart) throw httpError(404, `Part Name "${toPartName}" belum terdaftar di Master Data`);
  if (fromPartName.toLowerCase() === targetPart.partName.toLowerCase() && fromProses.toLowerCase() === toProses.toLowerCase()) {
    throw httpError(400, 'Tujuan sama dengan Part Name+Proses asal');
  }

  const produksiMoved = await prisma.produksiHarian.updateMany({
    where: { partName: { equals: fromPartName, mode: 'insensitive' }, proses: { equals: fromProses, mode: 'insensitive' } },
    data: { partName: targetPart.partName, proses: toProses },
  });

  await prisma.masterProses.deleteMany({ where: { id: { in: fromRows.map((r) => r.id) } } });
  await autoMarkSoleFinishProses(targetPart.partName);

  return {
    fromPartName, fromProses,
    mesinMoved: fromRows.length,
    produksi: produksiMoved.count,
    into: { partName: targetPart.partName, proses: toProses },
  };
}

// Daftar Kriteria NG (jenis cacat) -- dipilih saat input Rejection.
async function createKriteriaNg(nama) {
  const existing = await prisma.masterKriteriaNg.findFirst({ where: { nama: { equals: nama, mode: 'insensitive' } } });
  return existing || prisma.masterKriteriaNg.create({ data: { nama } });
}

async function updateKriteriaNg(id, nama) {
  const data = {};
  if (nama !== undefined) data.nama = nama;
  return prisma.masterKriteriaNg.update({ where: { id }, data });
}

async function deleteKriteriaNg(id) {
  await prisma.masterKriteriaNg.delete({ where: { id } });
}

// Target jam lembur per bulan -- upsert (cari-atau-buat) berdasar
// year+month, karena kombinasi itu unik (satu target per bulan).
async function createOvertimeTarget(body) {
  const year = Number(body.year);
  const month = Number(body.month);
  const targetHours = Number(body.target_hours) || 0;
  if (!year || !month || month < 1 || month > 12) throw httpError(400, 'year dan month (1-12) wajib diisi');
  return prisma.masterOvertimeTarget.upsert({
    where: { year_month: { year, month } },
    update: { targetHours },
    create: { year, month, targetHours },
  });
}

async function updateOvertimeTarget(id, targetHoursRaw) {
  const data = {};
  if (targetHoursRaw !== undefined) data.targetHours = Number(targetHoursRaw) || 0;
  return prisma.masterOvertimeTarget.update({ where: { id }, data });
}

async function deleteOvertimeTarget(id) {
  await prisma.masterOvertimeTarget.delete({ where: { id } });
}

// Default Waktu Efektif (jam) per Shift -- upsert (cari-atau-buat)
// berdasar nama shift, karena shift itu unik.
async function createShiftHours(shift, defaultHoursRaw) {
  if (!shift) throw httpError(400, 'shift wajib diisi');
  const defaultHours = Number(defaultHoursRaw) || 0;
  return prisma.masterShiftHours.upsert({
    where: { shift }, update: { defaultHours }, create: { shift, defaultHours },
  });
}

async function updateShiftHours(id, body) {
  const data = {};
  if (body.shift !== undefined) data.shift = body.shift;
  if (body.default_hours !== undefined) data.defaultHours = Number(body.default_hours) || 0;
  return prisma.masterShiftHours.update({ where: { id }, data });
}

async function deleteShiftHours(id) {
  await prisma.masterShiftHours.delete({ where: { id } });
}

// Minimal CSV parser supporting quoted fields with embedded commas/newlines,
// auto-detect delimiter (comma/semicolon/tab) dari baris header.
function parseCsv(text) {
  const firstLine = text.split(/\r?\n/)[0] || '';
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  const delim = tabs > commas && tabs > semis ? '\t' : semis > commas ? ';' : ',';

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delim) {
      row.push(field); field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
  }

  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim(); });
    return obj;
  });
}

// ── POST /api/master/import ────────────────────────────
// Login-gated — import CSV massal: Group Head, Cluster, Part Name, Cycle
// Time, Proses, Line Produksi, Mesin, Man Power. Tiap baris mengisi
// ketiga tabel master (upsert, aman dijalankan berulang).
async function importMasterCsv(fileBuffer) {
  const rows = parseCsv(fileBuffer.toString('utf-8'));

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
    const partName = upper(field('Part Name', 'Nama Part')) || '';
    const proses = field('Proses');
    const line = upper(field('Line Produksi', 'Line')) || '';
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
  getMaster,
  getLegacyLookups,
  getProduksiPartNameCounts,
  getOrphanPartNames,
  getMissingFinishPartNames,
  getUnusedPartNames,
  deletePartName,
  getMesinMismatch,
  renameProduksiPartName,
  createGroupHead,
  updateGroupHead,
  deleteGroupHead,
  createManPower,
  updateManPower,
  deleteManPower,
  createPartName,
  updatePartName,
  createProses,
  updateProses,
  deleteProses,
  importProses,
  setFinishProses,
  mergePartName,
  mergeProses,
  createKriteriaNg,
  updateKriteriaNg,
  deleteKriteriaNg,
  createOvertimeTarget,
  updateOvertimeTarget,
  deleteOvertimeTarget,
  createShiftHours,
  updateShiftHours,
  deleteShiftHours,
  importMasterCsv,
};
