// Akun-akun ini dikecualikan dari pembatasan RESTRICTED_PAGES -- tetap
// punya akses penuh ke semua menu (Dashboard, Data Produksi, dst) SEKALIGUS
// Data Rejection & Master Data, termasuk semua tombol tambah/edit/hapus.
// Semua akun lain diblokir dari RESTRICTED_PAGES. Dicocokkan
// case-insensitive karena username disimpan apa adanya saat login (tidak
// dinormalisasi).
const PRIVILEGED_USERNAMES = ['123', 'pradana', 'sugeng', 'djk'];

// Akun-akun ini boleh MELIHAT semua menu sama seperti akun privileged
// (termasuk Data Rejection & Master Data), tapi tidak boleh
// menambah/mengubah/menghapus apa pun di mana pun -- semua tombol
// tambah/edit/hapus/import/dsb harus disembunyikan untuk akun ini di
// tiap halaman. Diblokir juga di backend (lihat src/lib/auth.js) sebagai
// penegakan sesungguhnya -- pembatasan di sini cuma soal tampilan supaya
// tidak menampilkan tombol yang toh akan ditolak server.
const READ_ONLY_USERNAMES = ['aris', 'supri', 'fido'];

export const RESTRICTED_PAGES = ['datarejection', 'masterdata', 'datavalidasi'];

// Halaman "Semua Mesin" (Machines.jsx) dibatasi ke akun-akun ini secara
// spesifik -- BUKAN sama dengan PRIVILEGED_USERNAMES (mis. akun "123" ada
// di privileged tapi TIDAK boleh lihat menu ini), jadi butuh daftar &
// helper sendiri, bukan numpang canSeeAllPages/isPrivilegedUser.
const MACHINES_PAGE_USERNAMES = ['pradana', 'sugeng', 'sabiqun', 'djk'];

export function canSeeMachinesPage(username) {
  return MACHINES_PAGE_USERNAMES.includes(String(username || '').toLowerCase());
}

export function isPrivilegedUser(username) {
  return PRIVILEGED_USERNAMES.includes(String(username || '').toLowerCase());
}

export function isReadOnlyUser(username) {
  return READ_ONLY_USERNAMES.includes(String(username || '').toLowerCase());
}

// Boleh melihat semua menu (termasuk RESTRICTED_PAGES) -- privileged
// karena memang boleh mengubah semua, read-only karena boleh melihat
// semua walau tidak boleh mengubah apa pun.
export function canSeeAllPages(username) {
  return isPrivilegedUser(username) || isReadOnlyUser(username);
}
