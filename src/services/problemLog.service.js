const prisma = require('../lib/prisma');
const { getPeriodRange } = require('../lib/period');

// User Grup Head yang dapat notifikasi tiap kali sebuah Problem ditutup
// (status -> closed) -- dicocokkan case-insensitive terhadap username
// login.
const GROUP_HEAD_NOTIFY_USERS = ['AGUNG', 'PRIYANTO', 'CLARA', 'HENDRA', 'WIYONO', 'MUSTOFA'];

function serializeProblemLogRow(r) {
  return {
    id: r.id,
    tanggal: r.tanggal ? r.tanggal.toISOString().slice(0, 10) : null,
    line: r.line,
    mesin: r.mesin,
    partName: r.partName,
    problem: r.problem,
    jenisProblem: r.jenisProblem,
    rootCause: r.rootCause,
    temporaryAction: r.temporaryAction,
    permanentAction: r.permanentAction,
    dueDate: r.dueDate ? r.dueDate.toISOString().slice(0, 10) : null,
    status: r.status,
    notes: r.notes,
    closedAt: r.closedAt ? r.closedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}

// period cuma diterapkan kalau eksplisit dikirim -- ProblemLogPage (menu
// Problem & Root Cause penuh) dan panel ringkas di ARDetail sama-sama
// sengaja tidak mengirim period sama sekali, supaya problem yang masih
// Open tidak "hilang" dari daftar cuma karena tanggalnya di luar filter
// tanggal yang lagi dipakai widget lain.
//
// Prioritas utama: status "Open" duluan (lalu In Progress, lalu Closed)
// supaya isu yang masih perlu ditindaklanjuti selalu di atas -- baru di
// antara status yang sama, tanggal (tanggal produksi saat problem
// terjadi) terbaru duluan, id cuma tiebreaker terakhir. Ini TIDAK bisa
// dinyatakan lewat Prisma `orderBy` biasa (bukan sort per kolom,
// melainkan per prioritas status), jadi tetap disortir manual di JS
// setelah query -- konsekuensinya skip/take pagination di bawah HARUS
// jalan setelah sort ini (bukan lewat Prisma skip/take di findMany),
// supaya urutan per halaman tetap benar. DB query-nya jadi tetap
// full-scan `where` ini (tidak berkurang dari sebelumnya), tapi payload
// yang dikirim ke browser tetap kecil (cuma satu halaman) -- itu tujuan
// utama pagination ini. Kalau nanti volume ProblemLog jadi sangat besar,
// prioritas status ini sebaiknya dipindah jadi kolom int pre-computed
// supaya bisa di-orderBy+skip/take langsung di DB.
async function listProblemLog({ period, date, start: qsStart, end: qsEnd, page, pageSize, skip, take }) {
  const where = {};
  if (period) {
    const { start, end } = getPeriodRange(period, date, qsStart, qsEnd);
    where.tanggal = { gte: start, lte: end };
  }
  const allRows = await prisma.problemLog.findMany({ where, orderBy: [{ tanggal: 'desc' }, { id: 'desc' }] });
  const STATUS_PRIORITY = { open: 0, in_progress: 1, closed: 2 };
  allRows.sort((a, b) => {
    const sa = STATUS_PRIORITY[a.status] ?? 3;
    const sb = STATUS_PRIORITY[b.status] ?? 3;
    if (sa !== sb) return sa - sb;
    const ta = a.tanggal ? a.tanggal.getTime() : 0;
    const tb = b.tanggal ? b.tanggal.getTime() : 0;
    if (tb !== ta) return tb - ta;
    return b.id - a.id;
  });
  const total = allRows.length;
  const rows = allRows.slice(skip, skip + take);
  return {
    rows: rows.map(serializeProblemLogRow),
    page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// Tambah baris problem/root-cause log baru. Dikirim juga dari form /rmo
// saat isi Resume Control Harian (ikut tanggal/line/part yang lagi diisi)
// supaya problem-nya jelas terkait line & part yang mana.
async function createProblemLog(body) {
  const { tanggal, line, mesin, part_name, problem, jenis_problem, root_cause, temporary_action, permanent_action, due_date, status } = body;
  const record = await prisma.problemLog.create({
    data: {
      tanggal: tanggal ? new Date(tanggal) : null,
      line: line || null,
      mesin: mesin || null,
      partName: part_name || null,
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

// Status open/closed adalah toggle independen dari Notes -- keduanya bisa
// dikirim terpisah, tidak saling mensyaratkan. Baru ditutup sekarang
// (bukan sudah closed sebelumnya) -- kirim notifikasi ke user Grup Head
// yang ditentukan, isinya Notes terbaru dan link balik ke menu Problem
// Log.
async function updateProblemLog(id, body) {
  const existing = await prisma.problemLog.findUnique({ where: { id } });
  if (!existing) return null;

  const { tanggal, line, mesin, part_name, problem, jenis_problem, root_cause, temporary_action, permanent_action, due_date, status, notes } = body;
  const data = {};
  if (tanggal !== undefined) data.tanggal = tanggal ? new Date(tanggal) : null;
  if (line !== undefined) data.line = line || null;
  if (mesin !== undefined) data.mesin = mesin || null;
  if (part_name !== undefined) data.partName = part_name || null;
  if (problem !== undefined) data.problem = problem;
  if (jenis_problem !== undefined) data.jenisProblem = jenis_problem || null;
  if (root_cause !== undefined) data.rootCause = root_cause || null;
  if (temporary_action !== undefined) data.temporaryAction = temporary_action || null;
  if (permanent_action !== undefined) data.permanentAction = permanent_action || null;
  if (due_date !== undefined) data.dueDate = due_date ? new Date(due_date) : null;
  if (notes !== undefined) data.notes = notes || null;
  if (status !== undefined) {
    data.status = status;
    data.closedAt = status === 'closed' ? new Date() : null;
  }
  const record = await prisma.problemLog.update({ where: { id }, data });

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

// Notifikasi yang ditujukan ke username yang sedang login (dicocokkan
// case-insensitive terhadap daftar usernames per baris).
async function listNotificationsForUser(username) {
  const uname = String(username || '').trim().toLowerCase();
  if (!uname) return [];
  const rows = await prisma.notification.findMany({ orderBy: { id: 'desc' }, take: 50 });
  const mine = rows.filter((r) => r.usernames.toLowerCase().split(',').map((s) => s.trim()).includes(uname));
  return mine.map((r) => ({
    id: r.id,
    message: r.message,
    link: r.link,
    unread: !r.readBy.toLowerCase().split(',').map((s) => s.trim()).includes(uname),
    createdAt: r.createdAt.toISOString(),
  }));
}

// Tandai satu notifikasi sudah dibaca -- per-user (readBy), bukan global,
// supaya status "sudah dibaca" satu user tidak mempengaruhi user lain yang
// sama-sama jadi target notifikasi itu.
async function markNotificationRead(id, username) {
  const row = await prisma.notification.findUnique({ where: { id } });
  if (!row) return { status: 'not_found' };
  const readSet = new Set(row.readBy.split(',').map((s) => s.trim()).filter(Boolean));
  readSet.add(username);
  await prisma.notification.update({ where: { id }, data: { readBy: [...readSet].join(',') } });
  return { status: 'ok' };
}

async function markAllNotificationsRead(username) {
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
  listNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
};
