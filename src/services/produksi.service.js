const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { isPrivilegedUsername } = require('../lib/auth');
const { resolveTotalOkFromProduksi } = require('../lib/apiHelpers');
const { ROW_METRICS_SELECT, rowMetrics, aggregateOee, avgArValues } = require('./produksiMetrics.service');

// Proses yang Mesin-nya diketik literal "Manual" (case-insensitive) --
// dikerjakan tangan, tidak pakai mesin sama sekali. Breakdown Mesin
// dipaksa 0 untuk baris begini (tidak ada mesin yang bisa breakdown),
// ditegakkan di sini (server-side) supaya konsisten walau field
// Breakdown Mesin di form frontend sudah dikunci juga. Loss Time tetap
// boleh diisi (delay proses tetap bisa terjadi meski manual).
function isManualMesin(mesin) {
  return String(mesin || '').trim().toLowerCase() === 'manual';
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Jenis Problem <-> Loss Time/Breakdown Mesin wajib DUA ARAH, ditegakkan
// di sini (server-side, bukan cuma validasi UI di form RC Harian) supaya
// berlaku juga lewat Data Produksi:
//  1. Ada Loss Time/Breakdown Mesin tanpa Jenis Problem -- downtime jadi
//     tidak jelas kategorinya di Problem Produksi maupun Dashboard-MTN.
//  2. Jenis Problem terisi tanpa Loss Time/Breakdown Mesin sama sekali --
//     baris begini tidak akan pernah punya baris Problem Produksi
//     terhubung (lihat syncLinkedProblemLog, syaratnya ada durasi
//     downtime), padahal tetap ikut kehitung di pie chart Jenis Problem.
function assertJenisProblemIfDowntime(lostTime, breakdownMesin, jenisProblem) {
  const hasDowntime = lostTime > 0 || breakdownMesin > 0;
  if (hasDowntime && !jenisProblem) {
    throw httpError(400, 'Jenis Problem wajib diisi kalau ada Loss Time / Breakdown Mesin');
  }
  if (jenisProblem && !hasDowntime) {
    throw httpError(400, 'Loss Time atau Breakdown Mesin wajib diisi kalau Jenis Problem dipilih');
  }
}

// Sinkron baris ProblemLog yang terhubung ke satu baris ProduksiHarian
// lewat produksiHarianId (@unique) -- dipanggil dari createProduksiHarian
// dan updateProduksiHarian supaya Loss Time/Breakdown Mesin selalu muncul
// di menu Problem Produksi, termasuk data yang dikoreksi lewat Data
// Produksi (bukan cuma input awal RC Harian Produksi/RMOPublic).
// `explicitProblem` (teks bebas dari field Problem di RC Harian) dan
// `dueDate` dipakai HANYA saat baris ProblemLog dibuat pertama kali --
// update berikutnya sengaja tidak menimpa problem/status/notes/dueDate,
// supaya elaborasi manual admin lewat menu Problem Produksi tidak hilang
// begitu baris produksinya diedit lagi. Tidak melakukan apa-apa kalau
// tidak ada sinyal apa pun (Loss Time/Breakdown Mesin/teks Problem).
async function syncLinkedProblemLog(row, explicitProblem, dueDate) {
  const hasSignal = row.lostTime > 0 || row.breakdownMesin > 0 || (explicitProblem && explicitProblem.trim());
  if (!hasSignal) return;
  const existing = await prisma.problemLog.findUnique({ where: { produksiHarianId: row.id } });
  const shared = {
    tanggal: row.tanggal, line: row.line, mesin: row.mesin, partName: row.partName,
    jenisProblem: row.jenisProblem, lostTime: row.lostTime, breakdownMesin: row.breakdownMesin,
  };
  if (existing) {
    await prisma.problemLog.update({ where: { id: existing.id }, data: shared });
  } else {
    const problem = (explicitProblem || '').trim() || (row.keterangan || '').trim() || row.jenisProblem || 'Downtime';
    await prisma.problemLog.create({ data: { ...shared, problem, status: 'open', dueDate: dueDate ? new Date(dueDate) : null, produksiHarianId: row.id } });
  }
}

// ── Mapping payload dari body request (snake_case form lama) ke kolom
// Prisma ProduksiHarian (camelCase). Dipakai bareng create & update.
function mapCreatePayload(body) {
  const {
    tanggal, waktu, shift, cluster, line, grup_head,
    no_lot, part_name, part_number, proses, mesin, man_power, cycle_time,
    waktu_efektif, plan, ok1, ok2, rwk, rjct,
    breakdown_mesin, jenis_problem, lost_time, keterangan,
  } = body;

  return {
    tanggal: new Date(tanggal),
    waktu: waktu || null,
    shift, cluster, line,
    grupHead: grup_head || null,
    noLot: no_lot || null,
    partName: part_name,
    partNumber: part_number || null,
    proses, mesin,
    manPower: man_power || null,
    cycleTime: cycle_time ? Number(cycle_time) : 0,
    waktuEfektif: waktu_efektif ? Number(waktu_efektif) : 0,
    plan: plan ? Number(plan) : 0,
    ok1: ok1 ? Number(ok1) : 0,
    ok2: ok2 ? Number(ok2) : 0,
    rework: rwk ? Number(rwk) : 0,
    reject: rjct ? Number(rjct) : 0,
    breakdownMesin: breakdown_mesin ? Number(breakdown_mesin) : 0,
    jenisProblem: jenis_problem || null,
    lostTime: lost_time ? Number(lost_time) : 0,
    keterangan: keterangan || null,
  };
}

// Body wajib untuk create -- dicek terpisah dari mapping supaya pesan
// error field-nya jelas sebelum data dibentuk.
// Validasi field wajib untuk POST /produksi-harian sekarang dilakukan lewat
// middleware validateBody() di produksi.routes.js (lihat middlewares/
// validate.js) -- validateCreatePayload() yang dulu ada di sini dihapus
// karena sudah tidak dipakai, supaya tidak ada 2 sumber kebenaran untuk
// validasi yang sama.

async function createProduksiHarian(body) {
  const {
    tanggal, waktu, shift, cluster, line, grup_head,
    no_lot, part_name, part_number, proses, mesin, mesin_list, problem_mesin, man_power, cycle_time,
    waktu_efektif, plan, ok1, ok2, rwk, rjct,
    breakdown_mesin, jenis_problem, lost_time, keterangan, problem, due_date,
  } = body;

  // Mode multi-Mesin (mesin_list terisi -- Proses dengan >1 Mesin
  // tercatat di Master Data, mis. "jalan 5 mesin bareng"): satu submit
  // fan-out jadi SATU BARIS ProduksiHarian PER MESIN, bukan satu baris
  // dengan Mesin gabungan -- sengaja, supaya kolom `mesin` tetap satu
  // nilai per baris (Dashboard-MTN mencocokkan baris lewat day+mesin+line
  // persis, gabungan teks kayak "M/C 1, M/C 2" tidak akan pernah cocok
  // apa pun di katalognya). Total OK/Rework/Reject/Cycle Time/dll SAMA di
  // tiap baris (bukan dibagi rata -- angka yang diisi dianggap
  // representasi grup itu sendiri). Downtime (Jenis Problem/Loss
  // Time/Breakdown Mesin/Keterangan) CUMA nempel ke baris Mesin yang
  // ditunjuk `problem_mesin` -- Mesin lain di grup itu tetap tercatat
  // "tidak ada problem". Body lama yang cuma kirim `mesin` tunggal (tanpa
  // mesin_list) tetap jalan persis seperti sebelumnya -- backward compatible.
  const mesinArray = Array.isArray(mesin_list) && mesin_list.length > 0
    ? [...new Set(mesin_list.filter(Boolean))]
    : [mesin];

  const lostTimeInput = lost_time ? Number(lost_time) : 0;
  const breakdownMesinInput = breakdown_mesin ? Number(breakdown_mesin) : 0;
  const hasDowntimeInput = lostTimeInput > 0 || breakdownMesinInput > 0 || !!jenis_problem;
  if (mesinArray.length > 1 && hasDowntimeInput && !mesinArray.includes(problem_mesin)) {
    throw httpError(400, 'Mesin Bermasalah wajib dipilih (salah satu dari Mesin yang dicentang) kalau ada Jenis Problem/Loss Time/Breakdown Mesin');
  }

  // batchId: link EKSPLISIT antar baris satu submit ini -- cuma diisi
  // kalau memang >1 Mesin (baris tunggal tidak perlu batch apa pun).
  const batchId = mesinArray.length > 1 ? crypto.randomUUID() : null;

  const records = [];
  for (const m of mesinArray) {
    const isProblemMesin = mesinArray.length === 1 || m === problem_mesin;
    const lostTime = isProblemMesin ? lostTimeInput : 0;
    const breakdownMesin = isProblemMesin && !isManualMesin(m) ? breakdownMesinInput : 0;
    const jenisProblem = isProblemMesin ? (jenis_problem || null) : null;
    assertJenisProblemIfDowntime(lostTime, breakdownMesin, jenisProblem);

    const data = mapCreatePayload({
      tanggal, waktu, shift, cluster, line, grup_head, no_lot, part_name, part_number,
      proses, mesin: m, man_power, cycle_time, waktu_efektif, plan, ok1, ok2, rwk, rjct,
      breakdown_mesin: breakdownMesin, jenis_problem: jenisProblem, lost_time: lostTime,
      keterangan: isProblemMesin ? keterangan : null,
    });
    const record = await prisma.produksiHarian.create({ data: { ...data, batchId } });
    if (isProblemMesin) await syncLinkedProblemLog(record, problem, due_date);
    records.push(record);
  }

  const primary = records.find((r) => r.mesin === problem_mesin) || records[0];
  return { id: primary.id, ids: records.map((r) => r.id), ...rowMetrics(primary) };
}

async function getProduksiHarianById(id) {
  return prisma.produksiHarian.findUnique({ where: { id } });
}

// Akun Admin buat Grup Head dibuat dari nama depannya saja (mis. username
// "AGUNG"), sedangkan MasterGroupHead.name kadang punya inisial belakang
// (mis. "Agung W") -- jadi dicocokkan lewat KATA PERTAMA nama itu, bukan
// exact-match nama lengkap.
async function resolveGroupHeadByUsername(username) {
  const groupHeads = await prisma.masterGroupHead.findMany();
  const target = String(username || '').trim().toLowerCase();
  return groupHeads.find((g) => g.name.trim().split(/\s+/)[0].toLowerCase() === target) || null;
}

// Akun privileged (123/pradana/sugeng) boleh mengubah/menghapus data
// cluster mana pun. Akun lain (Grup Head login lewat /rmo maupun dashboard
// utama) cuma boleh mengubah/menghapus baris di cluster mereka sendiri --
// dicocokkan lewat resolveGroupHeadByUsername, sama seperti endpoint
// /produksi-harian-my-cluster. Grup Head yang tidak dikenali (bukan akun
// privileged & tidak match Master Grup Head manapun) ditolak. Function ini
// murni cek boolean -- keputusan status HTTP (403) tetap di route.
async function canEditCluster(username, rowCluster) {
  if (isPrivilegedUsername(username)) return true;
  const groupHead = await resolveGroupHeadByUsername(username);
  return !!groupHead && groupHead.cluster === rowCluster;
}

async function updateProduksiHarian(id, body, { isPrivileged }) {
  const existing = await prisma.produksiHarian.findUnique({ where: { id } });
  if (!existing) return null;

  const {
    tanggal, waktu, shift, cluster, line, grup_head,
    no_lot, part_name, part_number, proses, mesin, man_power, cycle_time,
    waktu_efektif, plan, ok1, ok2, rwk, rjct,
    breakdown_mesin, jenis_problem, lost_time, keterangan, additional_mesin,
  } = body;

  // Loss Time/Breakdown Mesin/Jenis Problem dicek pakai nilai EFEKTIF
  // (yang baru dikirim kalau ada, jatuh balik ke nilai lama) supaya
  // validasi tetap tertegak walau field yang diedit cuma sebagian (mis.
  // cuma ganti Total OK, Loss Time lama tetap terbawa).
  const effMesin = mesin !== undefined ? mesin : existing.mesin;
  const effLostTime = lost_time !== undefined ? Number(lost_time) || 0 : existing.lostTime;
  const effBreakdownMesin = isManualMesin(effMesin) ? 0 : (breakdown_mesin !== undefined ? Number(breakdown_mesin) || 0 : existing.breakdownMesin);
  const effJenisProblem = jenis_problem !== undefined ? (jenis_problem || null) : existing.jenisProblem;
  assertJenisProblemIfDowntime(effLostTime, effBreakdownMesin, effJenisProblem);

  const data = {};
  if (tanggal !== undefined) data.tanggal = new Date(tanggal);
  if (waktu !== undefined) data.waktu = waktu || null;
  if (shift !== undefined) data.shift = shift;
  // Grup Head cuma boleh edit baris di cluster-nya sendiri (dicek di
  // route lewat canEditCluster) -- jangan biarkan mereka memindahkan baris
  // ke cluster lain lewat body ini juga. Hanya akun privileged yang boleh
  // ganti cluster.
  if (cluster !== undefined && isPrivileged) data.cluster = cluster;
  if (line !== undefined) data.line = line;
  if (grup_head !== undefined) data.grupHead = grup_head || null;
  if (no_lot !== undefined) data.noLot = no_lot || null;
  if (part_name !== undefined) data.partName = part_name;
  if (part_number !== undefined) data.partNumber = part_number || null;
  if (proses !== undefined) data.proses = proses;
  // Mesin SEBISA MUNGKIN dari Tabel Machine (dinormalisasi ke ejaan yang
  // tersimpan di katalog kalau cocok), tapi TIDAK lagi diblokir kalau
  // belum ada di katalog -- baris lama/mesin baru yang belum sempat
  // didaftarkan tetap bisa disimpan apa adanya (indikator "belum
  // terhubung ke Tabel Machine" ditampilkan di frontend, bandingkan
  // langsung ke /machines, tidak perlu ditolak di sini). Line Produksi
  // independen dari Mesin (diisi manual/dari Part Name+Proses di
  // frontend), tidak ditimpa dari Machine.line.
  if (mesin !== undefined) {
    const machine = await prisma.machine.findFirst({ where: { machine: { equals: mesin, mode: 'insensitive' } } });
    data.mesin = machine ? machine.machine : mesin;
  }
  if (man_power !== undefined) data.manPower = man_power || null;
  if (cycle_time !== undefined) data.cycleTime = Number(cycle_time) || 0;
  if (waktu_efektif !== undefined) data.waktuEfektif = Number(waktu_efektif) || 0;
  if (plan !== undefined) data.plan = Number(plan) || 0;
  if (ok1 !== undefined) data.ok1 = Number(ok1) || 0;
  if (ok2 !== undefined) data.ok2 = Number(ok2) || 0;
  if (rwk !== undefined) data.rework = Number(rwk) || 0;
  if (rjct !== undefined) data.reject = Number(rjct) || 0;
  if (breakdown_mesin !== undefined) data.breakdownMesin = Number(breakdown_mesin) || 0;
  // Mesin berubah jadi "Manual" (baru ATAU sudah begitu sejak sebelumnya)
  // -- Breakdown Mesin dipaksa 0, menimpa nilai yang barusan di-set di
  // atas kalau perlu.
  if (isManualMesin(effMesin)) data.breakdownMesin = 0;
  if (jenis_problem !== undefined) data.jenisProblem = jenis_problem || null;
  if (lost_time !== undefined) data.lostTime = Number(lost_time) || 0;
  if (keterangan !== undefined) data.keterangan = keterangan || null;

  let record = await prisma.produksiHarian.update({ where: { id }, data });
  await syncLinkedProblemLog(record);

  // Kalau Part Name baris ini diganti (mis. dibetulkan manual dari Data
  // Produksi ke Part Name Master Data yang benar), dan nama LAMA-nya
  // sekarang sudah 0 dipakai sama sekali (Produksi/Rejection/Problem
  // Log), bersihkan entri Master Data Part Name lama itu (+ baris
  // Proses-nya) kalau memang ada -- supaya panel "Belum Punya Proses
  // Akhir/Finish" tidak numpuk entri mati yang sudah tidak dipakai data
  // apa pun. HANYA jalan kalau referensinya benar-benar nol -- Part Name
  // yang baru dibuat & belum sempat dipakai TIDAK kena ini (baris itu
  // tidak pernah jadi "existing.partName" yang diganti-dari).
  if (data.partName !== undefined && data.partName.toLowerCase().trim() !== existing.partName.toLowerCase().trim()) {
    const oldName = existing.partName;
    const [stillProduksi, stillRejection, stillProblem] = await Promise.all([
      prisma.produksiHarian.count({ where: { partName: { equals: oldName, mode: 'insensitive' } } }),
      prisma.rejectionEntry.count({ where: { partName: { equals: oldName, mode: 'insensitive' } } }),
      prisma.problemLog.count({ where: { partName: { equals: oldName, mode: 'insensitive' } } }),
    ]);
    if (stillProduksi + stillRejection + stillProblem === 0) {
      const staleMasterPart = await prisma.masterPartName.findFirst({ where: { partName: { equals: oldName, mode: 'insensitive' } } });
      if (staleMasterPart) {
        // Cocokkan lewat partNameId ATAU partName teks -- baris Proses
        // lama bisa saja belum sempat ke-backfill partNameId-nya.
        await prisma.masterProses.deleteMany({
          where: { OR: [{ partNameId: staleMasterPart.id }, { partName: { equals: oldName, mode: 'insensitive' } }] },
        });
        await prisma.masterPartName.delete({ where: { id: staleMasterPart.id } });
      }
    }
  }

  // Tambah Mesin (koreksi baris lama yang seharusnya mencakup beberapa
  // Mesin sekaligus, tapi cuma sempat tercatat 1) -- clone baris ini
  // (field produksi SAMA seperti hasil edit di atas, downtime TIDAK ikut
  // disalin, sama prinsip dengan mode multi-Mesin di createProduksiHarian/
  // RC Harian) ke tiap Mesin tambahan yang dipilih admin. Baris BARU,
  // bukan menimpa baris ini -- baris asli (id) tetap representasi Mesin
  // aslinya sendiri.
  const additionalMesinArr = Array.isArray(additional_mesin)
    ? [...new Set(additional_mesin.filter((m) => m && m !== record.mesin))]
    : [];
  const clonedIds = [];
  if (additionalMesinArr.length > 0) {
    // Link EKSPLISIT (batchId) antara baris asli dan clone-nya -- kalau
    // baris ini belum pernah jadi bagian batch apa pun (batchId masih
    // null), buat baru sekarang dan simpan juga ke baris asli (bukan
    // cuma ke clone-nya) supaya tampilan tabel bisa menggabungkan
    // keduanya. Kalau sudah punya batchId (mis. nambah Mesin lagi ke
    // batch yang sudah ada), pakai yang itu saja.
    let batchId = record.batchId;
    if (!batchId) {
      batchId = crypto.randomUUID();
      record = await prisma.produksiHarian.update({ where: { id: record.id }, data: { batchId } });
    }
    for (const m of additionalMesinArr) {
      const clone = await prisma.produksiHarian.create({
        data: {
          tanggal: record.tanggal, waktu: record.waktu, shift: record.shift, cluster: record.cluster,
          line: record.line, grupHead: record.grupHead, noLot: record.noLot,
          partName: record.partName, partNumber: record.partNumber, proses: record.proses, mesin: m,
          manPower: record.manPower, cycleTime: record.cycleTime, waktuEfektif: record.waktuEfektif,
          plan: record.plan, ok1: record.ok1, ok2: record.ok2, rework: record.rework, reject: record.reject,
          breakdownMesin: 0, jenisProblem: null, lostTime: 0, keterangan: null,
          batchId,
        },
      });
      clonedIds.push(clone.id);
    }
  }

  return { id: record.id, clonedIds, ...rowMetrics(record) };
}

async function deleteProduksiHarian(id) {
  await prisma.produksiHarian.delete({ where: { id } });
}

// resolveTotalOkFromProduksi dipakai bareng dengan routes/rejection.routes.js
// (di /rejection-entry & /rejection-entry-update), jadi tetap didefinisikan
// di lib/apiHelpers.js -- di sini cuma dipanggil ulang.
// Rekap semua baris RC Harian Produksi yang punya SALAH SATU dari sinyal
// downtime (Jenis Problem, Loss Time, Breakdown Mesin, Keterangan/
// Problem) -- dipakai menu Downtime Produksi. Baca LANGSUNG dari
// ProduksiHarian (bukan dari tabel Problem Log) supaya baris yang datanya
// belum lengkap (mis. Jenis Problem tanpa durasi, atau sebaliknya) tetap
// kelihatan -- justru itu tujuannya, supaya admin bisa menemukan &
// membetulkan baris yang belum lengkap datanya. `missingFields` dipakai
// frontend buat menandai baris yang belum lengkap.
//
// Loss Time & Breakdown Mesin dianggap SATU sinyal ("durasi downtime"),
// bukan dua syarat terpisah -- baris yang cuma isi salah satu (mis. Loss
// Time tanpa Breakdown Mesin) tetap dianggap lengkap untuk bagian ini.
async function getDowntimeAudit({ start, end, cluster }) {
  const clusterFilter = cluster ? { cluster } : {};
  const rows = await prisma.produksiHarian.findMany({
    where: {
      tanggal: { gte: start, lte: end },
      ...clusterFilter,
      OR: [
        { jenisProblem: { not: null } },
        { lostTime: { gt: 0 } },
        { breakdownMesin: { gt: 0 } },
        { keterangan: { not: null } },
      ],
    },
    orderBy: [{ tanggal: 'desc' }, { id: 'desc' }],
  });

  return rows.map((r) => {
    const missingFields = [];
    if (!r.jenisProblem) missingFields.push('Jenis Problem');
    if (!(r.lostTime > 0) && !(r.breakdownMesin > 0)) missingFields.push('Loss Time / Breakdown Mesin');
    if (!r.keterangan) missingFields.push('Problem/Keterangan');
    return {
      id: r.id,
      tanggal: r.tanggal.toISOString().slice(0, 10),
      cluster: r.cluster,
      line: r.line,
      mesin: r.mesin,
      partName: r.partName,
      proses: r.proses,
      jenisProblem: r.jenisProblem,
      lostTime: r.lostTime,
      breakdownMesin: r.breakdownMesin,
      keterangan: r.keterangan,
      isComplete: missingFields.length === 0,
      missingFields,
    };
  });
}

async function getOkForPart(partName, tanggalDate) {
  return resolveTotalOkFromProduksi(partName, tanggalDate);
}

// Public — dipakai form Input Rejection (/lhp) buat pratinjau Total OK
// otomatis saat Part Name/Tanggal dipilih, sebelum baris Rejection-nya
// benar-benar disimpan.
function mapProduksiRow(r) {
  return {
    id: r.id,
    tanggal: r.tanggal.toISOString().slice(0, 10),
    shift: r.shift,
    cluster: r.cluster,
    line: r.line,
    grupHead: r.grupHead,
    noLot: r.noLot,
    partName: r.partName,
    proses: r.proses,
    mesin: r.mesin,
    manPower: r.manPower,
    cycleTime: r.cycleTime,
    waktuEfektif: r.waktuEfektif,
    plan: r.plan,
    ok1: r.ok1,
    ok2: r.ok2,
    rework: r.rework,
    reject: r.reject,
    breakdownMesin: r.breakdownMesin,
    jenisProblem: r.jenisProblem,
    lostTime: r.lostTime,
    keterangan: r.keterangan,
    batchId: r.batchId,
    ...rowMetrics(r),
  };
}

// Dipaging (page/pageSize) -- dulu narik seluruh baris periode sekaligus,
// makin berat seiring data historis /rmo menumpuk. count & findMany jalan
// paralel supaya total halaman tidak nunggu query baris selesai duluan.
async function listProduksiHarian({ start, end, skip, take }) {
  const where = { tanggal: { gte: start, lte: end } };
  const [total, rows] = await Promise.all([
    prisma.produksiHarian.count({ where }),
    prisma.produksiHarian.findMany({
      where,
      orderBy: [{ tanggal: 'desc' }, { id: 'desc' }],
      skip, take,
    }),
  ]);
  return { total, rows: rows.map(mapProduksiRow) };
}

// Login-gated -- dipakai tab "Data Produksi" di /rmo (halaman publik
// tanpa login) yang sekarang minta login per Grup Head dulu (beda dari
// login admin dashboard utama, tapi akun-nya sama persis -- Grup Head
// memang sudah punya akun Admin masing-masing buat notifikasi Problem
// Log). Username yang login dicocokkan ke kata pertama MasterGroupHead
// buat tahu Cluster-nya, lalu data ProduksiHarian dibatasi ke Cluster
// itu saja -- satu Grup Head cuma bisa lihat Cluster-nya sendiri, tidak
// semua Cluster seperti Data Produksi di dashboard admin (yang memang
// login-gated terpisah, dan tidak lewat endpoint ini). Return null kalau
// username tidak terdaftar sebagai Grup Head.
async function listProduksiHarianMyCluster({ username, start, end, skip, take }) {
  const groupHead = await resolveGroupHeadByUsername(username);
  if (!groupHead) return null;

  const where = { tanggal: { gte: start, lte: end }, cluster: groupHead.cluster };
  const [total, rows] = await Promise.all([
    prisma.produksiHarian.count({ where }),
    prisma.produksiHarian.findMany({
      where,
      orderBy: [{ tanggal: 'desc' }, { id: 'desc' }],
      skip, take,
    }),
  ]);
  return { cluster: groupHead.cluster, total, rows: rows.map(mapProduksiRow) };
}

// Jumlah target jam lembur (MasterOvertimeTarget) buat semua bulan yang
// tercakup dalam rentang [start, end] -- dijumlah kalau rentangnya lebih
// dari satu bulan (mis. period "month" yang mencakup satu tahun penuh).
async function sumOvertimeTargetHours(start, end) {
  const months = [];
  let y = start.getFullYear(), m = start.getMonth();
  const endY = end.getFullYear(), endM = end.getMonth();
  while (y < endY || (y === endY && m <= endM)) {
    months.push({ year: y, month: m + 1 });
    m++;
    if (m > 11) { m = 0; y++; }
  }
  if (months.length === 0) return 0;
  // aggregate() -- dulu findMany semua baris cuma buat dijumlah targetHours
  // manual, padahal jumlah bulan yang match biasanya kecil tapi tetap tidak
  // perlu kirim baris mentah sama sekali kalau cuma butuh total.
  const agg = await prisma.masterOvertimeTarget.aggregate({ where: { OR: months }, _sum: { targetHours: true } });
  return agg._sum.targetHours || 0;
}

// Ringkasan OEE (Availability, Performance, Yield, AR, OEE) diagregasi dari
// semua baris Resume Control Harian Produksi dalam periode terpilih.
async function getSummary({ start, end, cluster }) {
  const clusterFilter = cluster ? { cluster } : {};
  // ProduksiHarian TETAP findMany (bukan aggregate) -- AVB/PERF/YIELD/AR/
  // OEE tiap baris ada clamping (Math.min/Math.max, lihat rowMetrics()),
  // jadi rata-ratanya harus dihitung SETELAH clamping per baris, tidak
  // bisa digantikan SUM/AVG mentah di DB.
  const rows = await prisma.produksiHarian.findMany({
    where: { tanggal: { gte: start, lte: end }, ...clusterFilter },
  });

  // AVB/PERF/YIELD/AR/OEE -- rata-rata polos dari metrik tiap baris
  // (rowMetrics), sama pola dengan footer "PENCAPAIAN RATA-RATA" di
  // tabel Data Produksi, supaya kartu ringkasan dashboard ini selalu
  // sama dengan tabel untuk tanggal/Cluster yang sama.
  const perRow = rows.map(rowMetrics);
  const avgOf = (key) => perRow.length ? perRow.reduce((s, m) => s + m[key], 0) / perRow.length : 0;

  // Rejection sekarang dihitung dari menu Input Rejection (RejectionEntry)
  // -- LMR ÷ OK -- bukan lagi dari kolom Reject di ProduksiHarian.
  // aggregate() -- totalOk/totalLmr kolom mentah tanpa clamping, jadi SUM
  // di DB aman (beda dari ProduksiHarian di atas), tidak perlu findMany.
  const rejAgg = await prisma.rejectionEntry.aggregate({
    where: { tanggal: { gte: start, lte: end }, ...clusterFilter },
    _sum: { totalOk: true, totalLmr: true },
  });
  const sumRejOk = rejAgg._sum.totalOk || 0;
  const sumRejLmr = rejAgg._sum.totalLmr || 0;

  // Overtime (kartu OVERTIME, gantikan Absensi) -- aktual (OvertimeEntry)
  // ÷ target (MasterOvertimeTarget, diset per bulan lewat Master Data).
  // aggregate() -- durasiJam kolom mentah, SUM di DB.
  const overtimeAgg = await prisma.overtimeEntry.aggregate({
    where: { tanggal: { gte: start, lte: end }, ...clusterFilter },
    _sum: { durasiJam: true },
  });
  const sumOvertimeJam = overtimeAgg._sum.durasiJam || 0;
  const overtimeTargetHours = await sumOvertimeTargetHours(start, end);

  const pct = (n, d) => d > 0 ? Math.max(0, Math.min(100, (n / d) * 100)) : 0;

  const availability = avgOf('avb');
  const performance   = avgOf('perf');
  const yieldPct       = avgOf('yield');
  const ar             = avgOf('ar');
  const oee             = avgOf('oee');
  const rejection       = pct(sumRejLmr, sumRejOk);
  const overtime         = pct(sumOvertimeJam, overtimeTargetHours);

  return {
    availability: Number(availability.toFixed(1)),
    performance: Number(performance.toFixed(1)),
    yield: Number(yieldPct.toFixed(1)),
    ar: Number(ar.toFixed(1)),
    rejection: Number(rejection.toFixed(1)),
    oee: Number(oee.toFixed(1)),
    overtime: Number(overtime.toFixed(1)),
    overtimeHours: Number(sumOvertimeJam.toFixed(1)),
    overtimeTargetHours: Number(overtimeTargetHours.toFixed(1)),
    entries: rows.length,
  };
}

// Gabungan /ar-by-cluster + /ar-by-line + /jenis-problem-stats -- ketiganya
// dulu 3 query terpisah ke ProduksiHarian dengan where (tanggal+cluster)
// yang PERSIS SAMA, ditembak bareng dari ARDetail.jsx tiap kali halaman itu
// dibuka/filter diganti. Sekarang satu findMany (select kolom yang dibutuhkan
// saja, bukan seluruh baris) dipakai buat menurunkan ketiga breakdown itu di
// Node, bukan 3x full scan ProduksiHarian buat rentang tanggal yang sama.
async function getArBreakdown({ start, end, cluster }) {
  const clusterFilter = cluster ? { cluster } : {};
  const rows = await prisma.produksiHarian.findMany({
    where: { tanggal: { gte: start, lte: end }, ...clusterFilter },
    select: { cluster: true, line: true, jenisProblem: true, ...ROW_METRICS_SELECT },
  });

  const byCluster = {};
  const byLine = {};
  const jenisCounts = {};
  for (const r of rows) {
    const ar = rowMetrics(r).ar;
    if (!byCluster[r.cluster]) byCluster[r.cluster] = [];
    byCluster[r.cluster].push(ar);
    if (!byLine[r.line]) byLine[r.line] = { cluster: r.cluster, arValues: [] };
    byLine[r.line].arValues.push(ar);
    if (r.jenisProblem) jenisCounts[r.jenisProblem] = (jenisCounts[r.jenisProblem] || 0) + 1;
  }

  const byClusterResult = Object.entries(byCluster).map(([clusterName, arValues]) => ({
    cluster: clusterName,
    ar: Number((arValues.reduce((s, v) => s + v, 0) / arValues.length).toFixed(1)),
  }));
  const byLineResult = Object.entries(byLine).map(([line, v]) => ({
    line,
    cluster: v.cluster,
    ar: Number((v.arValues.reduce((s, x) => s + x, 0) / v.arValues.length).toFixed(1)),
  })).sort((a, b) => b.ar - a.ar);
  const jenisTotal = Object.values(jenisCounts).reduce((a, b) => a + b, 0);
  const jenisProblemResult = Object.entries(jenisCounts).map(([jenis, count]) => ({
    jenis,
    count,
    pct: jenisTotal > 0 ? Number(((count / jenisTotal) * 100).toFixed(1)) : 0,
  })).sort((a, b) => b.count - a.count);

  return { byCluster: byClusterResult, byLine: byLineResult, jenisProblem: jenisProblemResult };
}

// ── Tren AR untuk grafik drill-down AR di dashboard, mengikuti pola
// PeriodPicker:
//   period=today -> per tanggal dalam 1 bulan dari ?date (bukan per jam --
//                   data produksi jarang cukup padat per jam untuk grafik
//                   jam berguna, beda dengan widget snapshot lain yang
//                   memang difilter ke tanggal spesifik lewat getPeriodRange)
//   period=month -> per bulan dalam tahun dari ?date
//   period=year  -> per tahun (semua tahun yang ada datanya)
async function getArTrend({ period, ref, cluster }) {
  const clusterFilter = cluster ? { cluster } : {};

  if (period === 'today') {
    const year = ref.getFullYear(), month = ref.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const rows = await prisma.produksiHarian.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter }, select: { tanggal: true, ...ROW_METRICS_SELECT } });

    const daysInMonth = end.getDate();
    const byDay = Array.from({ length: daysInMonth }, (_, i) => ({ day: String(i + 1).padStart(2, '0'), arValues: [] }));
    for (const r of rows) {
      const idx = r.tanggal.getUTCDate() - 1;
      if (byDay[idx]) byDay[idx].arValues.push(rowMetrics(r).ar);
    }
    return byDay.map((d) => ({ day: d.day, ar: avgArValues(d.arValues) }));
  }

  if (period === 'year') {
    // "Tahunan" -- per tahun, rentang dari tahun data paling lama sampai
    // tahun sekarang (minimal tetap tampil tahun ini kalau belum ada data).
    const agg = await prisma.produksiHarian.aggregate({ _min: { tanggal: true } });
    const earliestYear = agg._min.tanggal ? agg._min.tanggal.getUTCFullYear() : ref.getFullYear();
    const thisYear = new Date().getFullYear();
    const fromYear = Math.min(earliestYear, thisYear);
    const years = [];
    for (let y = fromYear; y <= thisYear; y++) years.push(y);

    const start = new Date(fromYear, 0, 1);
    const end = new Date(thisYear, 11, 31, 23, 59, 59, 999);
    const rows = await prisma.produksiHarian.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter }, select: { tanggal: true, ...ROW_METRICS_SELECT } });

    const byYear = {};
    years.forEach((y) => { byYear[y] = []; });
    for (const r of rows) {
      const y = r.tanggal.getUTCFullYear();
      if (byYear[y]) byYear[y].push(rowMetrics(r).ar);
    }
    return years.map((y) => ({ day: String(y), ar: avgArValues(byYear[y]) }));
  }

  // default: month ("Bulanan") -> per bulan dalam tahun
  const year = ref.getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  const rows = await prisma.produksiHarian.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter }, select: { tanggal: true, ...ROW_METRICS_SELECT } });

  const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const byMonth = MONTHS.map((m) => ({ day: m, arValues: [] }));
  for (const r of rows) {
    const idx = r.tanggal.getUTCMonth();
    byMonth[idx].arValues.push(rowMetrics(r).ar);
  }
  return byMonth.map((d) => ({ day: d.day, ar: avgArValues(d.arValues) }));
}

// Sama seperti getArTrend, tapi sekali panggil buat SEMUA Cluster
// sekaligus -- dipakai Data Produksi yang menampilkan tren AR tiap
// Cluster berdampingan. Sebelumnya frontend nembak /ar-trend 4x paralel
// (satu per Cluster: AD/BC/EF/FI), berarti 4x findMany terpisah ke
// rentang tanggal yang SAMA cuma beda filter Cluster. Di sini narik
// SEKALI (tanpa filter Cluster) lalu bucket per hari/bulan/tahun DAN per
// Cluster sekaligus di Node -- satu round-trip DB buat semua Cluster.
async function getArTrendByCluster({ period, ref }) {
  // Kumpulkan nilai AR per [bucket][cluster], lalu diringkas jadi
  // { cluster: [{day, ar}, ...] } -- pola bucket sama dengan getArTrend,
  // cuma sekarang dua tingkat (bucket lalu Cluster). Cluster yang
  // dikembalikan mengikuti yang benar-benar ada di data (bukan
  // hardcode AD/BC/EF/FI), frontend sudah fallback ke array kosong
  // untuk Cluster yang tidak muncul di response.
  function buildResult(buckets, rows, getIdx) {
    const byBucketCluster = buckets.map(() => ({}));
    for (const r of rows) {
      const idx = getIdx(r);
      if (idx == null || !byBucketCluster[idx]) continue;
      const cl = r.cluster || '';
      if (!byBucketCluster[idx][cl]) byBucketCluster[idx][cl] = [];
      byBucketCluster[idx][cl].push(rowMetrics(r).ar);
    }
    const clusters = new Set();
    byBucketCluster.forEach((m) => Object.keys(m).forEach((c) => clusters.add(c)));
    const result = {};
    clusters.forEach((cl) => {
      result[cl] = buckets.map((day, i) => ({ day, ar: avgArValues(byBucketCluster[i][cl] || []) }));
    });
    return result;
  }

  if (period === 'today') {
    const year = ref.getFullYear(), month = ref.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const rows = await prisma.produksiHarian.findMany({
      where: { tanggal: { gte: start, lte: end } },
      select: { tanggal: true, cluster: true, ...ROW_METRICS_SELECT },
    });
    const daysInMonth = end.getDate();
    const buckets = Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, '0'));
    return buildResult(buckets, rows, (r) => r.tanggal.getUTCDate() - 1);
  }

  if (period === 'year') {
    const agg = await prisma.produksiHarian.aggregate({ _min: { tanggal: true } });
    const earliestYear = agg._min.tanggal ? agg._min.tanggal.getUTCFullYear() : ref.getFullYear();
    const thisYear = new Date().getFullYear();
    const fromYear = Math.min(earliestYear, thisYear);
    const years = [];
    for (let y = fromYear; y <= thisYear; y++) years.push(y);
    const start = new Date(fromYear, 0, 1);
    const end = new Date(thisYear, 11, 31, 23, 59, 59, 999);
    const rows = await prisma.produksiHarian.findMany({
      where: { tanggal: { gte: start, lte: end } },
      select: { tanggal: true, cluster: true, ...ROW_METRICS_SELECT },
    });
    const buckets = years.map(String);
    const yearIdx = new Map(years.map((y, i) => [y, i]));
    return buildResult(buckets, rows, (r) => yearIdx.get(r.tanggal.getUTCFullYear()));
  }

  // default: month ("Bulanan") -> per bulan dalam tahun
  const year = ref.getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  const rows = await prisma.produksiHarian.findMany({
    where: { tanggal: { gte: start, lte: end } },
    select: { tanggal: true, cluster: true, ...ROW_METRICS_SELECT },
  });
  const buckets = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return buildResult(buckets, rows, (r) => r.tanggal.getUTCMonth());
}

// Gabungan /oee-by-cluster + /oee-by-line + bagian OEE dari
// getSummary -- ketiganya dulu 3 findMany terpisah ke ProduksiHarian
// dengan where (tanggal+cluster) yang PERSIS SAMA, ditembak bareng dari
// OEEDetail.jsx. getSummary sendiri sebenarnya juga query
// RejectionEntry/OvertimeEntry/MasterOvertimeTarget buat field
// ar/rejection/overtime -- yang TIDAK dipakai sama sekali oleh OEEDetail
// (cuma butuh availability/performance/yield/oee), jadi query itu terbuang
// percuma tiap OEEDetail dibuka. Function ini satu findMany (select kolom
// yang dibutuhkan saja) buat menurunkan overall + breakdown Cluster + Line
// sekaligus di Node.
async function getOeeBreakdown({ start, end, cluster }) {
  const clusterFilter = cluster ? { cluster } : {};
  const rows = await prisma.produksiHarian.findMany({
    where: { tanggal: { gte: start, lte: end }, ...clusterFilter },
    select: { cluster: true, line: true, ...ROW_METRICS_SELECT },
  });

  const byCluster = {};
  const byLine = {};
  for (const r of rows) {
    if (!byCluster[r.cluster]) byCluster[r.cluster] = [];
    byCluster[r.cluster].push(r);
    if (!byLine[r.line]) byLine[r.line] = { cluster: r.cluster, rows: [] };
    byLine[r.line].rows.push(r);
  }
  const byClusterResult = Object.entries(byCluster).map(([clusterName, clusterRows]) => ({ cluster: clusterName, ...aggregateOee(clusterRows) }));
  const byLineResult = Object.entries(byLine)
    .map(([line, v]) => ({ line, cluster: v.cluster, ...aggregateOee(v.rows) }))
    .sort((a, b) => b.oee - a.oee);

  return { overall: aggregateOee(rows), byCluster: byClusterResult, byLine: byLineResult };
}

// Tren OEE untuk grafik drill-down di Detail OEE, ikut pola PeriodPicker
// yang sama dengan getArTrend (today -> per tanggal, month -> per bulan,
// year -> per tahun).
async function getOeeTrend({ period, ref, cluster }) {
  const clusterFilter = cluster ? { cluster } : {};

  if (period === 'today') {
    const year = ref.getFullYear(), month = ref.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const rows = await prisma.produksiHarian.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter }, select: { tanggal: true, ...ROW_METRICS_SELECT } });

    const daysInMonth = end.getDate();
    const byDay = Array.from({ length: daysInMonth }, () => []);
    for (const r of rows) {
      const idx = r.tanggal.getUTCDate() - 1;
      if (byDay[idx]) byDay[idx].push(r);
    }
    return byDay.map((dayRows, i) => ({ day: String(i + 1).padStart(2, '0'), oee: aggregateOee(dayRows).oee }));
  }

  if (period === 'year') {
    const agg = await prisma.produksiHarian.aggregate({ _min: { tanggal: true } });
    const earliestYear = agg._min.tanggal ? agg._min.tanggal.getUTCFullYear() : ref.getFullYear();
    const thisYear = new Date().getFullYear();
    const fromYear = Math.min(earliestYear, thisYear);
    const years = [];
    for (let y = fromYear; y <= thisYear; y++) years.push(y);

    const start = new Date(fromYear, 0, 1);
    const end = new Date(thisYear, 11, 31, 23, 59, 59, 999);
    const rows = await prisma.produksiHarian.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter }, select: { tanggal: true, ...ROW_METRICS_SELECT } });

    const byYear = {};
    years.forEach((y) => { byYear[y] = []; });
    for (const r of rows) {
      const y = r.tanggal.getUTCFullYear();
      if (byYear[y]) byYear[y].push(r);
    }
    return years.map((y) => ({ day: String(y), oee: aggregateOee(byYear[y]).oee }));
  }

  // default: month ("Bulanan") -> per bulan dalam tahun
  const year = ref.getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  const rows = await prisma.produksiHarian.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter }, select: { tanggal: true, ...ROW_METRICS_SELECT } });

  const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const byMonth = MONTHS.map(() => []);
  for (const r of rows) {
    const idx = r.tanggal.getUTCMonth();
    byMonth[idx].push(r);
  }
  return byMonth.map((monthRows, i) => ({ day: MONTHS[i], oee: aggregateOee(monthRows).oee }));
}

module.exports = {
  createProduksiHarian,
  getProduksiHarianById,
  resolveGroupHeadByUsername,
  canEditCluster,
  updateProduksiHarian,
  deleteProduksiHarian,
  getOkForPart,
  mapProduksiRow,
  listProduksiHarian,
  listProduksiHarianMyCluster,
  getSummary,
  getArBreakdown,
  getArTrend,
  getArTrendByCluster,
  getOeeBreakdown,
  getOeeTrend,
  getDowntimeAudit,
};
