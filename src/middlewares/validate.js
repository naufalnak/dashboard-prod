// Validasi input terpusat -- sebelumnya tiap route nulis ulang pola
// `if (!field) return res.status(400).json({ error: '...' })` sendiri-
// sendiri, dengan pesan yang formatnya kadang beda-beda antar endpoint.
//
// SENGAJA OPSIONAL -- endpoint lama TIDAK wajib diganti ke ini sekaligus
// (77 endpoint, riskan diubah serentak tanpa test coverage penuh). Pakai
// di endpoint baru, atau saat sedang menyentuh endpoint lama untuk alasan
// lain, supaya polanya makin konsisten secara bertahap.
//
// Usage:
//   router.post('/foo', requireAuth, requireFields(['name', 'cluster']), async (req, res) => { ... })
//   router.post('/foo-update', requireAuth, requireId(), async (req, res) => {
//     const id = req.validatedId; // sudah dipastikan angka & truthy
//   })
function requireFields(fields, source = 'body') {
  return (req, res, next) => {
    const data = req[source] || {};
    const missing = fields.filter((f) => data[f] === undefined || data[f] === null || data[f] === '');
    if (missing.length > 0) {
      return res.status(400).json({ error: `${missing.join(', ')} wajib diisi` });
    }
    next();
  };
}

function requireId(source = 'body') {
  return (req, res, next) => {
    const id = Number((req[source] || {}).id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    req.validatedId = id;
    next();
  };
}

module.exports = { requireFields, requireId };
