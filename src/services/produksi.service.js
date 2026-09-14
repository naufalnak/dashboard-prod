// Business logic & query Prisma untuk domain Resume Control Harian
// Produksi (ProduksiHarian) -- dipindah dari routes/produksi.routes.js
// supaya route handler tinggal parse request & format response. Fungsi
// di sini melempar Error dengan `.status` buat kondisi HTTP non-200
// (400/403/404) -- ditangkap balik oleh errorHandler lewat next(err) di
// route, lihat middlewares/errorHandler.js.
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { getPeriodRange } = require('../lib/period');
const { buildTrendBuckets } = require('../utils/dateRange');
const { toDateOnly, roundTo, upper } = require('../utils/formatters');
const { isPrivilegedUsername } = require('../lib/auth');
const {
  rowMetrics, aggregateOee, avgArValues, pct, resolveTotalOkFromProduksi, sumOvertimeTargetHours,
} = require('./produksiMetrics.service');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Proses yang Mesin-nya diketik literal "Manual" (case-insensitive) --
// dikerjakan tangan, tidak pakai mesin sama sekali. Breakdown Mesin
// dipaksa 0 untuk baris begini (tidak ada mesin yang bisa breakdown),
// ditegakkan di sini (server-side) supaya konsisten walau field
// Breakdown Mesin di form frontend sudah dikunci juga. Loss Time tetap
// boleh diisi (delay proses tetap bisa terjadi meski manual).
function isManualMesin(mesin) {
  return String(mesin || '').trim().toLowerCase() === 'manual';
}

// Sinkron baris ProblemLog yang terhubung ke satu baris ProduksiHarian
// lewat produksiHarianId (@unique) -- dipanggil dari createProduksi dan
// updateProduksi supaya Loss Time/Breakdown Mesin (yang WAJIB disertai
// Jenis Problem, lihat validasi di kedua fungsi itu) selalu muncul di
// menu Problem Produksi, termasuk data yang dikoreksi lewat Data Produksi
// (bukan cuma input awal RC Harian Produksi). `explicitProblem` (teks
// bebas dari field Problem di RC Harian) dan `dueDate` dipakai HANYA saat
// baris ProblemLog dibuat pertama kali -- update berikutnya sengaja tidak
// menimpa `problem`/status/notes/dueDate, supaya elaborasi manual admin
// lewat menu Problem Produksi tidak hilang begitu baris produksinya
// diedit lagi. Tidak melakukan apa-apa kalau tidak ada sinyal apa pun
// (Loss Time/Breakdown Mesin/teks Problem) -- baris produksi biasa tanpa
// downtime tidak perlu ada ProblemLog terhubung sama sekali.
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

// Akun privileged (123/pradana/sugeng) boleh mengubah/menghapus data
// cluster mana pun. Akun lain (Grup Head login lewat /rmo maupun dashboard
// utama) cuma boleh mengubah/menghapus baris di cluster mereka sendiri --
// dicocokkan lewat resolveGroupHeadByUsername, sama seperti
// listMyClusterProduksi. Grup Head yang tidak dikenali (bukan akun
// privileged & tidak match Master Grup Head manapun) ditolak.
async function assertClusterAccess(username, rowCluster) {
  if (isPrivilegedUsername(username)) return;
  const groupHead = await resolveGroupHeadByUsername(username);
  if (!groupHead || groupHead.cluster !== rowCluster) {
    throw httpError(403, 'Tidak punya akses untuk mengubah data cluster ini');
  }
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

// Jenis Problem <-> Loss Time/Breakdown Mesin sekarang wajib DUA ARAH,
// ditegakkan di sini (server-side, bukan cuma validasi UI di form) supaya
// berlaku juga lewat Data Produksi/Downtime Produksi, tidak cuma RC
// Harian Produksi (/lhp):
//  1. Ada Loss Time/Breakdown Mesin tanpa Jenis Problem -- data downtime
//     jadi tidak jelas kategorinya di Problem Produksi maupun
//     Dashboard-MTN (yang filter berdasarkan Jenis Problem).
//  2. Jenis Problem terisi tanpa Loss Time/Breakdown Mesin sama sekali --
//     baris begini TIDAK PERNAH punya baris Problem Produksi terhubung
//     (lihat syncLinkedProblemLog, syaratnya ada durasi downtime), tapi
//     dulu tetap ikut kehitung di pie chart Jenis Problem (Detail AR/
//     Downtime Produksi), bikin jumlahnya lebih besar dari yang kelihatan
//     di Problem Produksi -- lihat fix getJenisProblemStats di bawah.
function assertJenisProblemIfDowntime(lostTime, breakdownMesin, jenisProblem) {
  const hasDowntime = lostTime > 0 || breakdownMesin > 0;
  if (hasDowntime && !jenisProblem) {
    throw httpError(400, 'Jenis Problem wajib diisi kalau ada Loss Time / Breakdown Mesin');
  }
  if (jenisProblem && !hasDowntime) {
    throw httpError(400, 'Loss Time atau Breakdown Mesin wajib diisi kalau Jenis Problem dipilih');
  }
}

// ── POST /api/produksi-harian ─────────────────────────
// Public — submit satu baris Resume Control Harian Produksi (Part + Proses +
// Mesin) dari halaman /rmo (tanpa login).
//
// Mode multi-Mesin (mesin_list terisi -- Proses dengan >1 Mesin tercatat
// di Master Data, mis. "jalan 5 mesin bareng"): satu submit fan-out jadi
// SATU BARIS ProduksiHarian PER MESIN, bukan satu baris dengan Mesin
// gabungan -- sengaja, supaya kolom `mesin` tetap satu nilai per baris
// (Dashboard-MTN mencocokkan baris lewat day+mesin+line persis, gabungan
// teks kayak "M/C 1, M/C 2" tidak akan pernah cocok apa pun di
// katalognya). Total OK/Rework/Reject/Cycle Time/dll SAMA di tiap baris
// (bukan dibagi rata -- keputusan eksplisit, angka yang diisi dianggap
// representasi grup itu sendiri). Downtime (Jenis Problem/Loss
// Time/Breakdown Mesin/Keterangan) CUMA nempel ke baris Mesin yang
// ditunjuk `problem_mesin` -- Mesin lain di grup itu tetap tercatat
// "tidak ada problem", supaya downtime tetap ter-trace ke SATU Mesin
// spesifik (bukan ke semua Mesin di grup), termasuk buat Dashboard-MTN.
async function createProduksi(body) {
  const {
    tanggal, waktu, shift, cluster, line, grup_head,
    no_lot, part_name, part_number, proses, mesin, mesin_list, problem_mesin, man_power, cycle_time,
    waktu_efektif, plan, ok1, ok2, rwk, rjct,
    breakdown_mesin, jenis_problem, lost_time, keterangan, problem, due_date,
  } = body;

  const mesinArray = Array.isArray(mesin_list) && mesin_list.length > 0
    ? [...new Set(mesin_list.filter(Boolean))]
    : [mesin];

  if (!tanggal || !shift || !cluster || !line || !part_name || !proses || !mesinArray[0]) {
    throw httpError(400, 'tanggal, shift, cluster, line, part, proses, dan mesin wajib diisi');
  }
  const lostTimeInput = lost_time ? Number(lost_time) : 0;
  const breakdownMesinInput = breakdown_mesin ? Number(breakdown_mesin) : 0;
  const hasDowntimeInput = lostTimeInput > 0 || breakdownMesinInput > 0 || !!jenis_problem;
  if (mesinArray.length > 1 && hasDowntimeInput && !mesinArray.includes(problem_mesin)) {
    throw httpError(400, 'Mesin Bermasalah wajib dipilih (salah satu dari Mesin yang dicentang) kalau ada Jenis Problem/Loss Time/Breakdown Mesin');
  }

  // batchId: link EKSPLISIT antar baris satu submit ini -- cuma diisi
  // kalau memang >1 Mesin (baris tunggal tidak perlu batch apa pun).
  // Dipakai ProduksiTable buat menggabungkan tampilan tanpa menebak dari
  // kecocokan field (lihat catatan di schema.prisma).
  const batchId = mesinArray.length > 1 ? crypto.randomUUID() : null;

  const records = [];
  for (const m of mesinArray) {
    const isProblemMesin = mesinArray.length === 1 || m === problem_mesin;
    const lostTime = isProblemMesin ? lostTimeInput : 0;
    const breakdownMesin = isProblemMesin && !isManualMesin(m) ? breakdownMesinInput : 0;
    const jenisProblem = isProblemMesin ? (jenis_problem || null) : null;
    assertJenisProblemIfDowntime(lostTime, breakdownMesin, jenisProblem);

    const record = await prisma.produksiHarian.create({
      data: {
        tanggal: new Date(tanggal),
        waktu: waktu || null,
        shift, cluster, line: upper(line),
        grupHead: grup_head || null,
        noLot: no_lot || null,
        partName: upper(part_name),
        partNumber: part_number || null,
        proses, mesin: m,
        manPower: man_power || null,
        cycleTime: cycle_time ? Number(cycle_time) : 0,
        waktuEfektif: waktu_efektif ? Number(waktu_efektif) : 0,
        plan: plan ? Number(plan) : 0,
        ok1: ok1 ? Number(ok1) : 0,
        ok2: ok2 ? Number(ok2) : 0,
        rework: rwk ? Number(rwk) : 0,
        reject: rjct ? Number(rjct) : 0,
        breakdownMesin,
        jenisProblem,
        lostTime,
        keterangan: isProblemMesin ? (keterangan || null) : null,
        batchId,
      },
    });
    if (isProblemMesin) await syncLinkedProblemLog(record, problem, due_date);
    records.push(record);
  }

  const primary = records.find((r) => r.mesin === problem_mesin) || records[0];
  return { id: primary.id, ids: records.map((r) => r.id), ...rowMetrics(primary) };
}

// ── POST /api/produksi-harian-update ───────────────────
// Login-gated — admin/Grup Head mengedit baris Resume Control Harian
// Produksi yang sudah tersimpan (mis. salah input Plan/OK/Reject).
async function updateProduksi(id, body, username) {
  const existing = await prisma.produksiHarian.findUnique({ where: { id } });
  if (!existing) throw httpError(404, 'Data tidak ditemukan');
  await assertClusterAccess(username, existing.cluster);

  const {
    tanggal, waktu, shift, cluster, line, grup_head,
    no_lot, part_name, part_number, proses, mesin, man_power, cycle_time,
    waktu_efektif, plan, ok1, ok2, rwk, rjct,
    breakdown_mesin, jenis_problem, lost_time, keterangan, additional_mesin,
  } = body;

  // Loss Time/Breakdown Mesin dicek pakai nilai EFEKTIF (yang baru
  // dikirim kalau ada, jatuh balik ke nilai lama) supaya validasi tetap
  // tertegak walau field yang diedit cuma sebagian (mis. cuma ganti
  // Total OK, Loss Time lama tetap terbawa).
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
  // atas) -- jangan biarkan mereka memindahkan baris ke cluster lain
  // lewat body ini juga. Hanya akun privileged yang boleh ganti cluster.
  if (cluster !== undefined && isPrivilegedUsername(username)) data.cluster = cluster;
  if (line !== undefined) data.line = upper(line);
  if (grup_head !== undefined) data.grupHead = grup_head || null;
  if (no_lot !== undefined) data.noLot = no_lot || null;
  if (part_name !== undefined) data.partName = upper(part_name);
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
  // disalin, sama prinsip dengan mode multi-Mesin di createProduksi/RC
  // Harian) ke tiap Mesin tambahan yang dipilih admin. Baris BARU, bukan
  // menimpa baris ini -- baris asli (id) tetap representasi Mesin
  // aslinya sendiri.
  const additionalMesinArr = Array.isArray(additional_mesin)
    ? [...new Set(additional_mesin.filter((m) => m && m !== record.mesin))]
    : [];
  const clonedIds = [];
  if (additionalMesinArr.length > 0) {
    // Link EKSPLISIT (batchId) antara baris asli dan clone-nya -- kalau
    // baris ini belum pernah jadi bagian batch apa pun (batchId masih
    // null), buat baru sekarang dan simpan juga ke baris asli (bukan
    // cuma ke clone-nya) supaya ProduksiTable bisa menggabungkan
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

// ── POST /api/produksi-harian-delete ───────────────────
async function deleteProduksi(id, username) {
  const existing = await prisma.produksiHarian.findUnique({ where: { id } });
  if (!existing) throw httpError(404, 'Data tidak ditemukan');
  await assertClusterAccess(username, existing.cluster);
  await prisma.produksiHarian.delete({ where: { id } });
}

// ── GET /api/produksi-harian ───────────────────────────
// Public — daftar seluruh baris Resume Control Harian Produksi dalam
// periode terpilih, dengan metrik AR/AVB/PERF/YIELD/OEE per baris.
async function listProduksi(query) {
  const { start, end } = getPeriodRange(query.period, query.date, query.start, query.end);
  const rows = await prisma.produksiHarian.findMany({
    where: { tanggal: { gte: start, lte: end } },
    orderBy: [{ tanggal: 'desc' }, { id: 'desc' }],
  });
  return rows.map(mapProduksiRow);
}

// ── GET /api/produksi-harian-my-cluster ─────────────────
// Login-gated -- dipakai tab "Data Produksi" di /rmo (halaman publik
// tanpa login) yang sekarang minta login per Grup Head dulu (beda dari
// login admin dashboard utama, tapi akun-nya sama persis -- Grup Head
// memang sudah punya akun Admin masing-masing buat notifikasi Problem
// Log). Username yang login dicocokkan ke kata pertama MasterGroupHead
// buat tahu Cluster-nya, lalu data ProduksiHarian dibatasi ke Cluster
// itu saja -- satu Grup Head cuma bisa lihat Cluster-nya sendiri.
async function listMyClusterProduksi(username, query) {
  const groupHead = await resolveGroupHeadByUsername(username);
  if (!groupHead) throw httpError(403, 'Akun ini tidak terdaftar sebagai Grup Head');
  const { start, end } = getPeriodRange(query.period, query.date, query.start, query.end);
  const rows = await prisma.produksiHarian.findMany({
    where: { tanggal: { gte: start, lte: end }, cluster: groupHead.cluster },
    orderBy: [{ tanggal: 'desc' }, { id: 'desc' }],
  });
  return { cluster: groupHead.cluster, rows: rows.map(mapProduksiRow) };
}

// Public — dipakai form Input Rejection (/lhp) buat pratinjau Total OK
// otomatis saat Part Name/Tanggal dipilih.
async function getOkForPart(partName, tanggalStr) {
  if (!partName || !tanggalStr) return { totalOk: 0, hasFinishProses: false };
  return resolveTotalOkFromProduksi(partName, new Date(tanggalStr));
}

async function getSummary(query) {
  const { start, end } = getPeriodRange(query.period, query.date, query.start, query.end);
  // Cluster opsional -- kalau tidak dikirim, semua Cluster (dipakai Dashboard).
  const clusterFilter = query.cluster ? { cluster: query.cluster } : {};
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
  const rejectionRows = await prisma.rejectionEntry.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter } });
  const sumRejOk = rejectionRows.reduce((s, r) => s + r.totalOk, 0);
  const sumRejLmr = rejectionRows.reduce((s, r) => s + r.totalLmr, 0);

  // Overtime (kartu OVERTIME, gantikan Absensi) -- aktual (OvertimeEntry)
  // ÷ target (MasterOvertimeTarget, diset per bulan lewat Master Data).
  const overtimeRows = await prisma.overtimeEntry.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter } });
  const sumOvertimeJam = overtimeRows.reduce((s, r) => s + r.durasiJam, 0);
  const overtimeTargetHours = await sumOvertimeTargetHours(start, end);

  return {
    availability: roundTo(avgOf('avb')),
    performance: roundTo(avgOf('perf')),
    yield: roundTo(avgOf('yield')),
    ar: roundTo(avgOf('ar')),
    rejection: roundTo(pct(sumRejLmr, sumRejOk)),
    oee: roundTo(avgOf('oee')),
    overtime: roundTo(pct(sumOvertimeJam, overtimeTargetHours)),
    overtimeHours: roundTo(sumOvertimeJam),
    overtimeTargetHours: roundTo(overtimeTargetHours),
    entries: rows.length,
  };
}

// AR rata-rata per Cluster (AD/BC/EF/FI) dalam periode terpilih -- untuk
// pie chart drill-down AR di dashboard. Rata-rata polos dari AR tiap
// baris, sama pola dengan footer "PENCAPAIAN RATA-RATA" di tabel Data
// Produksi. `volume` (total Ok+Rework+Reject Cluster itu) ikut
// dikembalikan supaya ukuran slice pie chart di frontend bisa
// proporsional ke kontribusi produksi Cluster itu -- AR sendiri persen
// per Cluster (tidak otomatis jadi 100% kalau dijumlah semua Cluster),
// jadi tidak bisa langsung dipakai sebagai ukuran slice.
async function getArByCluster(query) {
  const { start, end } = getPeriodRange(query.period, query.date, query.start, query.end);
  const clusterFilter = query.cluster ? { cluster: query.cluster } : {};
  const shiftFilter = query.shift ? { shift: query.shift } : {};
  const rows = await prisma.produksiHarian.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter, ...shiftFilter } });

  const byCluster = {};
  for (const r of rows) {
    if (!byCluster[r.cluster]) byCluster[r.cluster] = { arValues: [], volume: 0 };
    byCluster[r.cluster].arValues.push(rowMetrics(r).ar);
    byCluster[r.cluster].volume += rowMetrics(r).totalProses;
  }
  return Object.entries(byCluster).map(([cluster, v]) => ({
    cluster,
    ar: roundTo(v.arValues.reduce((s, x) => s + x, 0) / v.arValues.length),
    volume: v.volume,
  }));
}

// AR rata-rata per Shift dalam satu Cluster (atau semua Cluster kalau
// tidak dikirim) -- dipakai popup drill-down saat slice Cluster di pie
// chart AR diklik (lihat getArByCluster). Sama pola perhitungan, cuma
// dikelompokkan per Shift (Master Data > Shift) bukan per Cluster.
async function getArByShift(query) {
  const { start, end } = getPeriodRange(query.period, query.date, query.start, query.end);
  const clusterFilter = query.cluster ? { cluster: query.cluster } : {};
  const rows = await prisma.produksiHarian.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter } });

  const byShift = {};
  for (const r of rows) {
    const key = r.shift || '—';
    if (!byShift[key]) byShift[key] = [];
    byShift[key].push(rowMetrics(r).ar);
  }
  return Object.entries(byShift).map(([shift, arValues]) => ({
    shift,
    ar: roundTo(arValues.reduce((s, v) => s + v, 0) / arValues.length),
    entries: arValues.length,
  })).sort((a, b) => a.shift.localeCompare(b.shift));
}

// AR rata-rata per Line Produksi -- untuk ranking 5 Line AR
// tertinggi/terendah di halaman detail AR.
async function getArByLine(query) {
  const { start, end } = getPeriodRange(query.period, query.date, query.start, query.end);
  const clusterFilter = query.cluster ? { cluster: query.cluster } : {};
  const shiftFilter = query.shift ? { shift: query.shift } : {};
  const rows = await prisma.produksiHarian.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter, ...shiftFilter } });

  const byLine = {};
  for (const r of rows) {
    if (!byLine[r.line]) byLine[r.line] = { cluster: r.cluster, arValues: [] };
    byLine[r.line].arValues.push(rowMetrics(r).ar);
  }
  return Object.entries(byLine).map(([line, v]) => ({
    line,
    cluster: v.cluster,
    ar: roundTo(v.arValues.reduce((s, x) => s + x, 0) / v.arValues.length),
  })).sort((a, b) => b.ar - a.ar);
}

// Persentase Jenis Problem (Machine/Material/Method/Man/Setting & Tool --
// "Environment" dihapus dari pilihan input, tapi data lama yang masih
// pakai nilai itu tetap terhitung apa adanya, tidak di-backfill) yang
// diakumulasi dari kolom ProduksiHarian.jenis_problem -- dipakai untuk
// pie/bar chart di Detail AR & Downtime Produksi.
//
// Sinyal downtime-nya: lostTime>0 ATAU breakdownMesin>0 ATAU keterangan
// terisi (dikembalikan ke sini setelah sempat diketatkan ke "wajib
// durasi" -- lihat riwayat commit 03d36f8 -- karena rekonsiliasi dengan
// Dashboard-MTN's Machine count tidak stabil ke arah yang diharapkan:
// setelah diketatkan PROD malah jadi LEBIH KECIL dari MTN, bukan lebih
// dekat/sama. Kedua sistem sama-sama masih terus berubah (data diedit
// live oleh operator/maintenance), jadi selisihnya kemungkinan besar
// bukan cuma soal syarat durasi ini -- lihat juga catatan duplikat
// ProblemLog per insiden yang sama, yang bisa bikin hitungan MTN (per
// baris ProblemLog) melebihi jumlah baris ProduksiHarian unik).
async function getJenisProblemStats(query) {
  const { start, end } = getPeriodRange(query.period, query.date, query.start, query.end);
  const clusterFilter = query.cluster ? { cluster: query.cluster } : {};
  const shiftFilter = query.shift ? { shift: query.shift } : {};
  const rows = await prisma.produksiHarian.findMany({
    where: {
      tanggal: { gte: start, lte: end }, jenisProblem: { not: null }, ...clusterFilter, ...shiftFilter,
      OR: [{ lostTime: { gt: 0 } }, { breakdownMesin: { gt: 0 } }, { keterangan: { not: null } }],
    },
    select: { jenisProblem: true },
  });

  const counts = {};
  for (const r of rows) {
    const k = r.jenisProblem;
    if (!k) continue;
    counts[k] = (counts[k] || 0) + 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return Object.entries(counts).map(([jenis, count]) => ({
    jenis, count, pct: total > 0 ? roundTo((count / total) * 100) : 0,
  })).sort((a, b) => b.count - a.count);
}

// Rekap semua baris RC Harian Produksi yang punya SALAH SATU dari sinyal
// downtime (Jenis Problem, Loss Time, Breakdown Mesin, Keterangan/
// Problem) -- dipakai menu Downtime Produksi. Beda dari /problem-log
// (berbasis tabel ProblemLog, yang baris barunya cuma dibuat kalau ada
// Loss Time/Breakdown Mesin/teks problem -- lihat syncLinkedProblemLog,
// TIDAK dibuat kalau cuma Jenis Problem sendirian yang diisi): endpoint
// ini baca LANGSUNG dari ProduksiHarian supaya baris yang datanya belum
// lengkap (mis. Jenis Problem tanpa durasi, atau sebaliknya) tetap
// kelihatan -- justru itu tujuannya, supaya admin bisa menemukan &
// membetulkan baris yang belum lengkap datanya. `missingFields` dipakai
// frontend buat menandai baris yang belum lengkap.
//
// Loss Time & Breakdown Mesin dianggap SATU sinyal ("durasi downtime"),
// bukan dua syarat terpisah -- baris yang cuma isi salah satu (mis. Loss
// Time tanpa Breakdown Mesin) tetap dianggap lengkap untuk bagian ini,
// karena keduanya memang jarang terjadi bersamaan (kalau bukan breakdown
// mesin, ya tidak ada menit Breakdown Mesin-nya).
async function getDowntimeAudit(query) {
  const { start, end } = getPeriodRange(query.period, query.date, query.start, query.end);
  const clusterFilter = query.cluster ? { cluster: query.cluster } : {};
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
      tanggal: toDateOnly(r.tanggal),
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

async function findEarliestProduksiYear() {
  const agg = await prisma.produksiHarian.aggregate({ _min: { tanggal: true } });
  return agg._min.tanggal ? agg._min.tanggal.getUTCFullYear() : null;
}

// Tren AR untuk grafik drill-down AR di dashboard, mengikuti pola
// PeriodPicker (today -> per tanggal, month -> per bulan, year -> per
// tahun).
async function getArTrend(query) {
  const period = query.period || 'today';
  const ref = query.date ? new Date(query.date) : new Date();
  const clusterFilter = query.cluster ? { cluster: query.cluster } : {};
  const shiftFilter = query.shift ? { shift: query.shift } : {};
  const { start, end, labels, keyOf } = await buildTrendBuckets(period, ref, findEarliestProduksiYear);
  const rows = await prisma.produksiHarian.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter, ...shiftFilter } });

  const buckets = labels.map(() => []);
  for (const r of rows) {
    const idx = keyOf(r.tanggal);
    if (buckets[idx]) buckets[idx].push(rowMetrics(r).ar);
  }
  return labels.map((day, i) => ({ day, ar: avgArValues(buckets[i]) }));
}

// OEE (+ komponen AVB/PERF/YIELD) per Cluster dalam periode terpilih --
// untuk halaman Detail OEE, sama pola dengan getArByCluster.
async function getOeeByCluster(query) {
  const { start, end } = getPeriodRange(query.period, query.date, query.start, query.end);
  const clusterFilter = query.cluster ? { cluster: query.cluster } : {};
  const rows = await prisma.produksiHarian.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter } });

  const byCluster = {};
  for (const r of rows) {
    if (!byCluster[r.cluster]) byCluster[r.cluster] = [];
    byCluster[r.cluster].push(r);
  }
  return Object.entries(byCluster).map(([cluster, clusterRows]) => ({ cluster, ...aggregateOee(clusterRows) }));
}

// OEE rata-rata (tertimbang) per Line Produksi -- untuk ranking 5 Line
// OEE tertinggi/terendah di halaman Detail OEE.
async function getOeeByLine(query) {
  const { start, end } = getPeriodRange(query.period, query.date, query.start, query.end);
  const clusterFilter = query.cluster ? { cluster: query.cluster } : {};
  const rows = await prisma.produksiHarian.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter } });

  const byLine = {};
  for (const r of rows) {
    if (!byLine[r.line]) byLine[r.line] = { cluster: r.cluster, rows: [] };
    byLine[r.line].rows.push(r);
  }
  return Object.entries(byLine)
    .map(([line, v]) => ({ line, cluster: v.cluster, ...aggregateOee(v.rows) }))
    .sort((a, b) => b.oee - a.oee);
}

// Tren OEE untuk grafik drill-down di Detail OEE, ikut pola PeriodPicker
// yang sama dengan getArTrend.
async function getOeeTrend(query) {
  const period = query.period || 'today';
  const ref = query.date ? new Date(query.date) : new Date();
  const clusterFilter = query.cluster ? { cluster: query.cluster } : {};
  const { start, end, labels, keyOf } = await buildTrendBuckets(period, ref, findEarliestProduksiYear);
  const rows = await prisma.produksiHarian.findMany({ where: { tanggal: { gte: start, lte: end }, ...clusterFilter } });

  const buckets = labels.map(() => []);
  for (const r of rows) {
    const idx = keyOf(r.tanggal);
    if (buckets[idx]) buckets[idx].push(r);
  }
  return labels.map((day, i) => ({ day, oee: aggregateOee(buckets[i]).oee }));
}

module.exports = {
  createProduksi,
  updateProduksi,
  deleteProduksi,
  listProduksi,
  listMyClusterProduksi,
  getOkForPart,
  getSummary,
  getArByCluster,
  getArByShift,
  getArByLine,
  getJenisProblemStats,
  getDowntimeAudit,
  getArTrend,
  getOeeByCluster,
  getOeeByLine,
  getOeeTrend,
  resolveGroupHeadByUsername,
};
