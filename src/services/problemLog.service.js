// Business logic & query Prisma untuk domain Problem Produksi (ProblemLog)
// + Notifikasi terkait -- dipindah dari routes/problemLog.routes.js.
const prisma = require('../lib/prisma');
const { getPeriodRange } = require('../lib/period');
const { toDateOnly, upper } = require('../utils/formatters');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const STATUS_PRIORITY = { open: 0, in_progress: 1, closed: 2 };

function mapProblemLogRow(r) {
  return {
    id: r.id,
    tanggal: r.tanggal ? toDateOnly(r.tanggal) : null,
    line: r.line,
    mesin: r.mesin,
    partName: r.partName,
    problem: r.problem,
    jenisProblem: r.jenisProblem,
    rootCause: r.rootCause,
    temporaryAction: r.temporaryAction,
    permanentAction: r.permanentAction,
    dueDate: r.dueDate ? toDateOnly(r.dueDate) : null,
    status: r.status,
    notes: r.notes,
    lostTime: r.lostTime,
    breakdownMesin: r.breakdownMesin,
    totalLossTime: r.lostTime + r.breakdownMesin,
    closedAt: r.closedAt ? r.closedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}

// Public — daftar problem/root-cause log, untuk tabel di halaman Problem
// Produksi & panel ringkas di ARDetail. `period` cuma diterapkan kalau
// eksplisit dikirim -- ProblemLogPage (menu penuh) dan panel ringkas di
// ARDetail sama-sama sengaja tidak mengirim period sama sekali, supaya
// problem yang masih Open tidak "hilang" dari daftar cuma karena
// tanggalnya di luar filter tanggal yang lagi dipakai widget lain.
async function listProblemLog(query) {
  const where = {};
  if (query.period) {
    const { start, end } = getPeriodRange(query.period, query.date, query.start, query.end);
    where.tanggal = { gte: start, lte: end };
  }
  // Prioritas utama: status Open duluan (baru Closed) supaya isu yang
  // masih perlu ditindaklanjuti selalu di atas -- baru di antara status
  // yang sama, tanggal (tanggal produksi saat problem terjadi) terbaru
  // duluan, id cuma tiebreaker terakhir.
  const rows = await prisma.problemLog.findMany({ where, orderBy: [{ tanggal: 'desc' }, { id: 'desc' }] });
  rows.sort((a, b) => {
    const sa = STATUS_PRIORITY[a.status] ?? 3;
    const sb = STATUS_PRIORITY[b.status] ?? 3;
    if (sa !== sb) return sa - sb;
    const ta = a.tanggal ? a.tanggal.getTime() : 0;
    const tb = b.tanggal ? b.tanggal.getTime() : 0;
    if (tb !== ta) return tb - ta;
    return b.id - a.id;
  });
  return rows.map(mapProblemLogRow);
}

// Public — tambah baris problem/root-cause log baru. Dikirim juga dari
// form /rmo saat isi Resume Control Harian (ikut tanggal/line/part yang
// lagi diisi) supaya problem-nya jelas terkait line & part yang mana.
async function createProblemLog(body) {
  const { tanggal, line, mesin, part_name, problem, jenis_problem, root_cause, temporary_action, permanent_action, due_date, status } = body;
  if (!problem) throw httpError(400, 'problem wajib diisi');
  const record = await prisma.problemLog.create({
    data: {
      tanggal: tanggal ? new Date(tanggal) : null,
      line: upper(line) || null,
      mesin: mesin || null,
      partName: upper(part_name) || null,
      problem,
      jenisProblem: jenis_problem || null,
      rootCause: root_cause || null,
      temporaryAction: temporary_action || null,
      permanentAction: permanent_action || null,
      dueDate: due_date ? new Date(due_date) : null,
      status: status || 'open',
    },
  });
  return { id: record.id };
}

// User Grup Head yang dapat notifikasi tiap kali sebuah Problem ditutup
// (status -> closed) -- dicocokkan case-insensitive terhadap username
// login.
const GROUP_HEAD_NOTIFY_USERS = ['AGUNG', 'PRIYANTO', 'CLARA', 'HENDRA', 'WIYONO', 'MUSTOFA'];

// Edit field problem log. Status open/in_progress/closed independen dari
// Notes -- keduanya bisa dikirim terpisah, tidak saling mensyaratkan.
async function updateProblemLog(id, body) {
  const existing = await prisma.problemLog.findUnique({ where: { id } });
  if (!existing) throw httpError(404, 'Not found');
  const { tanggal, line, mesin, part_name, problem, jenis_problem, root_cause, temporary_action, permanent_action, due_date, status, notes, lost_time } = body;
  const data = {};
  if (tanggal !== undefined) data.tanggal = tanggal ? new Date(tanggal) : null;
  if (line !== undefined) data.line = upper(line) || null;
  if (mesin !== undefined) data.mesin = mesin || null;
  if (part_name !== undefined) data.partName = upper(part_name) || null;
  if (problem !== undefined) data.problem = problem;
  if (jenis_problem !== undefined) data.jenisProblem = jenis_problem || null;
  if (root_cause !== undefined) data.rootCause = root_cause || null;
  if (temporary_action !== undefined) data.temporaryAction = temporary_action || null;
  if (permanent_action !== undefined) data.permanentAction = permanent_action || null;
  if (due_date !== undefined) data.dueDate = due_date ? new Date(due_date) : null;
  if (notes !== undefined) data.notes = notes || null;
  if (lost_time !== undefined) data.lostTime = Number(lost_time) || 0;
  if (status !== undefined) {
    data.status = status;
    data.closedAt = status === 'closed' ? new Date() : null;
  }
  const record = await prisma.problemLog.update({ where: { id }, data });

  // Loss Time diedit dari menu Problem Produksi -- kalau baris ini
  // otomatis tersinkron dari satu baris RC Harian Produksi
  // (produksiHarianId), baris ProduksiHarian.lost_time ikut disamakan
  // supaya Downtime Produksi & dashboard lain tetap konsisten (tidak
  // "kembali" ke nilai lama kalau baris ini disinkron ulang nanti).
  if (lost_time !== undefined && existing.produksiHarianId) {
    await prisma.produksiHarian.update({
      where: { id: existing.produksiHarianId },
      data: { lostTime: data.lostTime },
    });
  }

  // Baru ditutup sekarang (bukan sudah closed sebelumnya) -- kirim
  // notifikasi ke user Grup Head yang ditentukan, isinya Notes terbaru
  // dan link balik ke menu Problem Log.
  if (status === 'closed' && existing.status !== 'closed') {
    const notesText = (record.notes || '').trim();
    const subject = record.problem || record.partName || record.line || 'Problem';
    await prisma.notification.create({
      data: {
        usernames: GROUP_HEAD_NOTIFY_USERS.join(','),
        message: `"${subject}" sudah Closed.${notesText ? ` Catatan: ${notesText}` : ''}`,
        link: 'problemlog',
      },
    });
  }
  return record;
}

async function deleteProblemLog(id) {
  await prisma.problemLog.delete({ where: { id } });
}

// Login-gated -- notifikasi yang ditujukan ke username yang sedang login
// (dicocokkan case-insensitive terhadap daftar usernames per baris).
async function listNotifications(username) {
  const target = String(username || '').trim().toLowerCase();
  if (!target) return [];
  const rows = await prisma.notification.findMany({ orderBy: { id: 'desc' }, take: 50 });
  const mine = rows.filter((r) => r.usernames.toLowerCase().split(',').map((s) => s.trim()).includes(target));
  return mine.map((r) => ({
    id: r.id,
    message: r.message,
    link: r.link,
    unread: !r.readBy.toLowerCase().split(',').map((s) => s.trim()).includes(target),
    createdAt: r.createdAt.toISOString(),
  }));
}

// Tandai satu notifikasi sudah dibaca -- per-user (readBy), bukan global,
// supaya status "sudah dibaca" satu user tidak mempengaruhi user lain
// yang sama-sama jadi target notifikasi itu.
async function markNotificationRead(id, username) {
  if (!id || !username) throw httpError(400, 'id dan username wajib diisi');
  const row = await prisma.notification.findUnique({ where: { id } });
  if (!row) throw httpError(404, 'Not found');
  const readSet = new Set(row.readBy.split(',').map((s) => s.trim()).filter(Boolean));
  readSet.add(username);
  await prisma.notification.update({ where: { id }, data: { readBy: [...readSet].join(',') } });
}

async function markAllNotificationsRead(username) {
  if (!username) throw httpError(400, 'username wajib diisi');
  const usernameLower = username.toLowerCase();
  const rows = await prisma.notification.findMany({ where: { usernames: { contains: username, mode: 'insensitive' } } });
  const mine = rows.filter((r) => r.usernames.toLowerCase().split(',').map((s) => s.trim()).includes(usernameLower));
  await Promise.all(mine.map((r) => {
    const readSet = new Set(r.readBy.split(',').map((s) => s.trim()).filter(Boolean));
    readSet.add(username);
    return prisma.notification.update({ where: { id: r.id }, data: { readBy: [...readSet].join(',') } });
  }));
}

module.exports = {
  listProblemLog,
  createProblemLog,
  updateProblemLog,
  deleteProblemLog,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
