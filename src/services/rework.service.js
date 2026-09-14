// Business logic & query Prisma untuk domain Data Pengerjaan Part Rework
// (PartReworkEntry) -- dipindah dari routes/rework.routes.js.
const prisma = require('../lib/prisma');
const { getPeriodRange } = require('../lib/period');
const { toDateOnly, upper } = require('../utils/formatters');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Cocokkan NAMA Grup Head yang dipilih di form ke baris master-nya buat
// dapat id + Cluster-nya -- beda dari resolveGroupHeadByUsername di
// produksi.service.js (yang cocokkan USERNAME login ke kata pertama nama).
async function resolveGroupHead(groupHeadName) {
  if (!groupHeadName) return { groupHeadId: null, cluster: null };
  const gh = await prisma.masterGroupHead.findFirst({ where: { name: { equals: groupHeadName, mode: 'insensitive' } } });
  return { groupHeadId: gh?.id || null, cluster: gh?.cluster || null };
}

// No Lot Rework di-generate otomatis dari Tanggal Repair -- format
// DDMMYYYY + "R" (mis. 1 Agustus 2020 -> "01082020R"), bukan diketik
// manual oleh operator.
function generateNoLotRework(tanggalRepair) {
  const d = new Date(tanggalRepair);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}${mm}${yyyy}R`;
}

function serializePartRework(r) {
  return {
    id: r.id,
    tanggalDitemukan: toDateOnly(r.tanggalDitemukan),
    noLotOriginal: r.noLotOriginal,
    tanggalRepair: toDateOnly(r.tanggalRepair),
    noLotRework: r.noLotRework,
    partName: r.partName,
    kriteriaRework: r.kriteriaRework,
    metodeRework: r.metodeRework,
    mesin: r.mesin,
    picRework: r.picRework,
    grupHead: r.grupHead,
    cluster: r.cluster,
    totalRework: r.totalRework,
    totalOk: r.totalOk,
    totalReject: r.totalReject,
    metodeCheck: r.metodeCheck,
    tanggalCheck: r.tanggalCheck ? toDateOnly(r.tanggalCheck) : null,
    picCheck: r.picCheck,
  };
}

// Public — submit satu baris Data Pengerjaan Part Rework dari /lhp (tab
// "Rework", tanpa login), mirip pola /overtime-entry & /rejection-entry.
// Part Name & Mesin di-resolve (soft -- tetap diterima kalau belum cocok
// Master Data/Tabel Machine, beda dari validasi WAJIB di Master Data admin
// /master-proses, supaya operator lapangan tidak terblokir). Grup Head
// WAJIB cocok Master Data karena itu satu-satunya sumber Cluster untuk
// baris ini.
async function createPartRework(body) {
  const {
    tanggal_ditemukan, no_lot_original, tanggal_repair, part_name,
    kriteria_rework, metode_rework, mesin, pic_rework, grup_head,
    total_rework, total_ok, total_reject, metode_check, tanggal_check, pic_check,
  } = body;
  if (!tanggal_ditemukan || !tanggal_repair || !part_name || !grup_head) {
    throw httpError(400, 'tanggal_ditemukan, tanggal_repair, part_name, dan grup_head wajib diisi');
  }

  const [partNameMaster, machineMaster, { groupHeadId, cluster }] = await Promise.all([
    prisma.masterPartName.findFirst({ where: { partName: { equals: part_name, mode: 'insensitive' } } }),
    mesin ? prisma.machine.findFirst({ where: { machine: { equals: mesin, mode: 'insensitive' } } }) : null,
    resolveGroupHead(grup_head),
  ]);
  if (!groupHeadId) throw httpError(400, `Grup Head "${grup_head}" tidak ditemukan di Master Data`);

  const record = await prisma.partReworkEntry.create({
    data: {
      tanggalDitemukan: new Date(tanggal_ditemukan),
      noLotOriginal: no_lot_original || null,
      tanggalRepair: new Date(tanggal_repair),
      noLotRework: generateNoLotRework(tanggal_repair),
      partName: upper(partNameMaster?.partName || part_name),
      partNameId: partNameMaster?.id || null,
      kriteriaRework: kriteria_rework || null,
      metodeRework: metode_rework || null,
      mesin: machineMaster?.machine || mesin || null,
      machineId: machineMaster?.id || null,
      picRework: pic_rework || null,
      grupHead: grup_head,
      grupHeadId: groupHeadId,
      cluster,
      totalRework: Number(total_rework) || 0,
      totalOk: Number(total_ok) || 0,
      totalReject: Number(total_reject) || 0,
      metodeCheck: metode_check || null,
      tanggalCheck: tanggal_check ? new Date(tanggal_check) : null,
      picCheck: pic_check || null,
    },
  });
  return serializePartRework(record);
}

// Login-gated — daftar semua Data Pengerjaan Part Rework untuk menu Data
// Rework, difilter periode sama pola dengan overtime.service.js.
async function listPartRework(query) {
  const { start, end } = getPeriodRange(query.period, query.date, query.start, query.end);
  const rows = await prisma.partReworkEntry.findMany({
    where: { tanggalRepair: { gte: start, lte: end } },
    orderBy: [{ tanggalRepair: 'desc' }, { id: 'desc' }],
  });
  return rows.map(serializePartRework);
}

async function updatePartRework(id, body) {
  const {
    tanggal_ditemukan, no_lot_original, tanggal_repair, part_name,
    kriteria_rework, metode_rework, mesin, pic_rework, grup_head,
    total_rework, total_ok, total_reject, metode_check, tanggal_check, pic_check,
  } = body;

  const data = {};
  if (tanggal_ditemukan !== undefined) data.tanggalDitemukan = new Date(tanggal_ditemukan);
  if (no_lot_original !== undefined) data.noLotOriginal = no_lot_original || null;
  // No Lot Rework ikut di-regenerate kalau Tanggal Repair diedit -- tetap
  // otomatis, tidak pernah diketik manual.
  if (tanggal_repair !== undefined) {
    data.tanggalRepair = new Date(tanggal_repair);
    data.noLotRework = generateNoLotRework(tanggal_repair);
  }
  if (part_name !== undefined) {
    const partNameMaster = await prisma.masterPartName.findFirst({ where: { partName: { equals: part_name, mode: 'insensitive' } } });
    data.partName = upper(partNameMaster?.partName || part_name);
    data.partNameId = partNameMaster?.id || null;
  }
  if (kriteria_rework !== undefined) data.kriteriaRework = kriteria_rework || null;
  if (metode_rework !== undefined) data.metodeRework = metode_rework || null;
  if (mesin !== undefined) {
    const machineMaster = mesin ? await prisma.machine.findFirst({ where: { machine: { equals: mesin, mode: 'insensitive' } } }) : null;
    data.mesin = machineMaster?.machine || mesin || null;
    data.machineId = machineMaster?.id || null;
  }
  if (pic_rework !== undefined) data.picRework = pic_rework || null;
  if (grup_head !== undefined) {
    const { groupHeadId, cluster } = await resolveGroupHead(grup_head);
    if (!groupHeadId) throw httpError(400, `Grup Head "${grup_head}" tidak ditemukan di Master Data`);
    data.grupHead = grup_head;
    data.grupHeadId = groupHeadId;
    data.cluster = cluster;
  }
  if (total_rework !== undefined) data.totalRework = Number(total_rework) || 0;
  if (total_ok !== undefined) data.totalOk = Number(total_ok) || 0;
  if (total_reject !== undefined) data.totalReject = Number(total_reject) || 0;
  if (metode_check !== undefined) data.metodeCheck = metode_check || null;
  if (tanggal_check !== undefined) data.tanggalCheck = tanggal_check ? new Date(tanggal_check) : null;
  if (pic_check !== undefined) data.picCheck = pic_check || null;

  const record = await prisma.partReworkEntry.update({ where: { id }, data });
  return serializePartRework(record);
}

async function deletePartRework(id) {
  await prisma.partReworkEntry.delete({ where: { id } });
}

module.exports = {
  createPartRework,
  listPartRework,
  updatePartRework,
  deletePartRework,
};
