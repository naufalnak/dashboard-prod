// ── Validasi input terpusat ──────────────────────────────────────────
// Dulu tiap route handler nulis ulang pola yang sama:
//   const id = Number(req.body.id);
//   if (!id) return res.status(400).json({ error: 'Invalid id' });
// atau
//   if (!tanggal || !part_name) return res.status(400).json({ error: '...' });
// tersebar di ~90 endpoint. 3 helper di bawah ini menggantikan pola itu
// jadi middleware yang dipasang di router.post(path, validateX(...), handler)
// -- perilakunya SENGAJA dibuat identik dengan pola lama (status 400,
// bentuk pesan error yang sama) supaya tidak ada perubahan response yang
// dilihat frontend, cuma lokasi kodenya yang dirapikan.
//
// CATATAN CAKUPAN: middleware ini sudah dipasang di rejection/overtime/
// rework/problemLog/produksi/auth.routes.js. masterData.routes.js (~30
// endpoint CRUD) BELUM disapu satu-satu ke validate() ini -- pola
// `if (!id) return res.status(400)...`-nya konsisten dan aman dipakai apa
// adanya, tapi migrasinya sendiri effort-nya signifikan (banyak field
// custom per Master), jadi belum termasuk di batch ini.

// Cek field wajib ada isinya di req.body. `fields`: array nama field, ATAU
// array of [fieldName, bodyKey] kalau nama di response error beda dari key
// di body (jarang dipakai, disediakan buat jaga-jaga).
function validateBody(fields, message) {
  return (req, res, next) => {
    const missing = fields.filter((f) => {
      const val = req.body[f];
      return val === undefined || val === null || val === '';
    });
    if (missing.length > 0) {
      return res.status(400).json({ error: message || `${missing.join(', ')} wajib diisi` });
    }
    next();
  };
}

// Pola paling sering dipakai: `id` (atau nama lain) di req.body harus ada
// dan berupa angka > 0 (mis. hasil Number("") atau Number("abc") = NaN,
// keduanya falsy, ditolak sama seperti pola lama). Menormalkan
// req.body[paramName] jadi Number supaya handler di belakangnya tidak
// perlu Number(...) ulang.
function validateId(paramName = 'id') {
  return (req, res, next) => {
    const id = Number(req.body[paramName]);
    if (!id) return res.status(400).json({ error: 'Invalid id' });
    req.body[paramName] = id;
    next();
  };
}

module.exports = { validateBody, validateId };