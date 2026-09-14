// Compat shim -- lokasi baku Prisma client sekarang di src/lib/prisma.js
// (struktur baru). File ini tetap ada supaya scripts/ lama (create-admin.js,
// remove-duplicates.js) yang masih require('../src/db') tidak perlu diubah.
module.exports = require('./lib/prisma');
