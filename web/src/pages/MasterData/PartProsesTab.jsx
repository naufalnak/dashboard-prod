import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Upload, Pencil, X, ArrowRightLeft, ArrowUpRight, AlertTriangle } from 'lucide-react';
import { useUI } from '../../contexts/UIContext.jsx';
import { apiFetch, apiSend } from '../../api.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { useConfirm } from '../../contexts/ConfirmContext.jsx';
import useHorizontalWheelScroll from '../../useHorizontalWheelScroll.js';
import SortTh from '../../components/SortTh.jsx';
import ZoomCell from '../../components/ZoomCell.jsx';
import Combobox from '../../components/Combobox.jsx';
import ProsesRowDrawer from '../../components/ProsesRowDrawer.jsx';
import { useSort } from '../../useSort.js';
import { useColumnWidths, weightsToPercent } from '../../useColumnWidths.js';
import { downloadXlsx } from '../../exportXlsx.js';
import { readXlsxFile } from '../../importXlsx.js';
import { CLUSTERS, Field, SearchBox, matches, th, td, iconBtn, editInp } from './shared.jsx';
import { Skeleton } from '../../components/Skeleton.jsx';

/* ── Tab: Part Name & Proses (digabung — Cycle Time ikut Proses, karena
   satu Part Name bisa punya beberapa Proses dengan Cycle Time beda) ─── */
// Warna latar berselang-seling per kelompok Part Name -- sama teknik
// seperti ProduksiTable, supaya semua Proses milik satu Part Name
// kelihatan sebagai satu kelompok. Hanya berlaku selama tabel belum
// diurutkan manual lewat klik header kolom lain.
const PP_GROUP_BG = ['transparent', 'var(--s2)'];
const PP_AKSI_PCT = 11; // 3 ikon aksi (Edit/Gabung/Hapus) sejak tombol Gabung ditambahkan
const PP_DEFAULT_WIDTHS = weightsToPercent([
  { key: 'partName', weight: 220 },
  { key: 'cluster', weight: 90 },
  { key: 'idCode', weight: 110 },
  { key: 'proses', weight: 190 },
  { key: 'line', weight: 160 },
  { key: 'mesin', weight: 140 },
  { key: 'cycleTime', weight: 100 },
  { key: 'jumlahData', weight: 110 },
], PP_AKSI_PCT);

const orphanInp = { width: '100%', padding: '7px 10px', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--s1)', color: 'var(--text)' };

// Part Name yang muncul di data RC Harian Produksi (Supabase) tapi tidak
// cocok dengan Part Name mana pun yang sekarang ada di Master Data --
// biasanya nama lama/typo dari sebelum katalog dirapikan, atau memang
// sudah diganti namanya belakangan. Panel ini membiarkan nama lama itu
// "disamakan" ke Part Name Master Data yang benar -- backend akan
// menimpa nama di semua baris historis terkait (Produksi, Rejection,
// Problem Log) sekaligus, lihat POST /produksi-rename-partname.
function OrphanPartNamesPanel({ orphans, loading, partNameOptions, logout, showToast, onRenamed }) {
  const { navigateToDataProduksi } = useUI();
  const [target, setTarget] = useState({});
  const [newCluster, setNewCluster] = useState({});
  const [busyName, setBusyName] = useState(null);

  async function rename(orphanName) {
    const to = (target[orphanName] || '').trim();
    if (!to) return;
    setBusyName(orphanName);
    try {
      const r = await apiSend('/produksi-rename-partname', 'POST', { from: orphanName, to }, logout);
      showToast(`${r.total} baris data diganti dari "${orphanName}" ke "${to}"`, 'green');
      setTarget((t) => { const n = { ...t }; delete n[orphanName]; return n; });
      onRenamed();
    } catch (e) { showToast(e.message, 'red'); }
    setBusyName(null);
  }

  // Part Name ini memang belum pernah didaftarkan ke Master Data sama
  // sekali (bukan typo/variasi dari Part Name lain) -- daftarkan
  // langsung pakai nama yang sama persis (idempotent, lihat
  // POST /master-part-name), tanpa perlu rename data historis apa pun
  // karena namanya memang sudah benar dari awal.
  async function createNew(o) {
    const cluster = newCluster[o.partName] || o.cluster;
    if (!cluster) return;
    setBusyName(o.partName);
    try {
      await apiSend('/master-part-name', 'POST', { part_name: o.partName, cluster }, logout);
      showToast(`"${o.partName}" berhasil didaftarkan ke Master Data (Cluster ${cluster}) — lanjutkan dengan menambahkan Proses & Proses Akhir`, 'green');
      setNewCluster((c) => { const n = { ...c }; delete n[o.partName]; return n; });
      onRenamed();
    } catch (e) { showToast(e.message, 'red'); }
    setBusyName(null);
  }

  if (loading || orphans.length === 0) return null;

  return (
    <div style={{ border: '1px solid #e0a30c', background: 'rgba(224,163,12,.08)', borderRadius: 8, padding: 14, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
        <AlertTriangle size={15} style={{ color: '#e0a30c' }} />
        Part Name Belum Terdaftar di Master Data ({orphans.length})
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12 }}>
        Nama Part di bawah ini ada di data RC Harian Produksi tapi tidak cocok dengan Part Name mana pun yang sekarang ada di Master Data. Kalau cuma beda ejaan/sudah diganti nama: pilih Part Name Master Data yang benar lalu klik Ganti (menyamakan semua data historisnya). Kalau memang Part Name baru yang belum pernah didaftarkan: pilih Cluster lalu klik Buat Baru.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
        {orphans.map((o) => (
          <div key={o.partName} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', flexWrap: 'wrap' }}>
            <div style={{ flex: '0 0 220px', minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={o.partName}>{o.partName}</div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{o.count.toLocaleString()} baris data{o.cluster && ` · biasa Cluster ${o.cluster}`}</div>
            </div>
            <button
              onClick={() => navigateToDataProduksi(o.partName)}
              className="btn"
              title="Buka baris RC Harian Produksi yang pakai nama ini, edit manual"
              style={{ flexShrink: 0, fontSize: 11.5, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
            >
              Ke Data Produksi <ArrowUpRight size={12} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 260px', minWidth: 220 }}>
              <ArrowRightLeft size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 140 }}>
                <Combobox
                  style={orphanInp}
                  value={target[o.partName] || ''}
                  options={partNameOptions}
                  onChange={(v) => setTarget((t) => ({ ...t, [o.partName]: v }))}
                  placeholder="Gabung ke Part Name yang benar…"
                />
              </div>
              <button
                disabled={!(target[o.partName] || '').trim() || busyName === o.partName}
                onClick={() => rename(o.partName)}
                className="btn primary"
                style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
              >
                {busyName === o.partName ? 'Mengganti…' : 'Ganti'}
              </button>
            </div>

            <div style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>atau</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <select
                className="form-input"
                style={{ ...orphanInp, width: 84 }}
                value={newCluster[o.partName] ?? o.cluster ?? ''}
                onChange={(e) => setNewCluster((c) => ({ ...c, [o.partName]: e.target.value }))}
              >
                <option value="">Cluster…</option>
                {CLUSTERS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button
                disabled={!(newCluster[o.partName] ?? o.cluster) || busyName === o.partName}
                onClick={() => createNew(o)}
                className="btn"
                title="Daftarkan nama ini apa adanya sebagai Part Name baru di Master Data"
                style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
              >
                {busyName === o.partName ? 'Membuat…' : 'Buat Baru'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Baris Proses yang Mesin-nya (data lama, diketik manual sebelum Tabel
// Machine dipakai sebagai katalog "Semua Mesin") belum cocok satu pun
// baris di Machine -- Line Produksi baris ini juga ikut tidak akurat
// (dulu ikut ketikan manual, bukan dari Machine.line). Klik baris buat
// mencarinya di tabel, lalu klik ikon pensil dan pilih Mesin yang benar
// dari dropdown (sudah tervalidasi ke Tabel Machine) -- koreksi
// sesungguhnya sengaja tetap manual oleh admin, bukan ditebak otomatis.
function MesinMismatchPanel({ items, loading, onFocusPartName }) {
  if (loading || items.length === 0) return null;
  return (
    <div style={{ border: '1px solid #3b82c4', background: 'rgba(59,130,196,.07)', borderRadius: 8, padding: 14, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
        <AlertTriangle size={15} style={{ color: '#3b82c4' }} />
        Mesin/Line Belum Sesuai Tabel Machine ({items.length})
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12 }}>
        Baris Proses di bawah ini Mesin-nya masih data lama (belum cocok dengan katalog "Semua Mesin"), jadi Line Produksi-nya juga ikut belum akurat. Klik salah satu buat mencarinya di tabel, lalu klik ikon pensil dan pilih Mesin yang benar dari dropdown.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => onFocusPartName(it.partName)}
            className="btn"
            style={{ fontSize: 12, padding: '6px 10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, textAlign: 'left' }}
            title={`Mesin saat ini: "${it.mesin || '(kosong)'}", Line: "${it.line || '(kosong)'}"`}
          >
            <span style={{ fontWeight: 700 }}>{it.partName} — {it.proses}</span>
            <span style={{ color: 'var(--muted)', fontSize: 10.5 }}>
              Mesin: {it.mesin || '—'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Part Name yang Total OK Input Rejection-nya tidak akan pernah bisa
// terhitung: entah belum punya baris Proses sama sekali, atau sudah ada
// Proses tapi belum ada satu pun yang ditandai Proses Akhir/Finish --
// Total OK butuh itu buat tahu Proses mana yang jadi acuan jumlah OK.
// Klik nama Part Name buat mencarinya di tabel (tambahkan Proses/tandai
// Proses Akhir lewat Edit), ATAU kalau ternyata baris ini cuma variasi
// ejaan dari Part Name lain yang sudah benar, gabungkan langsung lewat
// /master-part-name-merge tanpa perlu hapus manual satu-satu.
function MissingFinishPanel({ items, loading, onFocusPartName, partNameOptions, logout, showToast, onMerged }) {
  const { navigateToDataProduksi } = useUI();
  const [mergeTarget, setMergeTarget] = useState({});
  const [busyName, setBusyName] = useState(null);

  async function merge(fromName) {
    const to = (mergeTarget[fromName] || '').trim();
    if (!to) return;
    setBusyName(fromName);
    try {
      const r = await apiSend('/master-part-name-merge', 'POST', { from: fromName, to }, logout);
      showToast(`"${fromName}" digabung ke "${r.into}" (${r.total} baris data ikut disamakan)`, 'green');
      setMergeTarget((t) => { const n = { ...t }; delete n[fromName]; return n; });
      onMerged();
    } catch (e) { showToast(e.message, 'red'); }
    setBusyName(null);
  }

  if (loading || items.length === 0) return null;
  return (
    <div style={{ border: '1px solid #c0392b', background: 'rgba(192,57,43,.06)', borderRadius: 8, padding: 14, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
        <AlertTriangle size={15} style={{ color: '#c0392b' }} />
        Part Name Belum Punya Proses Akhir/Finish ({items.length})
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12 }}>
        Total OK di Input Rejection untuk Part Name di bawah ini akan selalu 0 sampai ini dibereskan. Kalau memang Part Name baru: klik namanya untuk mencarinya di tabel, lalu tambahkan Proses (kalau belum ada) atau buka Edit pada Proses yang benar dan centang Proses Akhir/Finish. Kalau ternyata cuma variasi ejaan dari Part Name lain yang sudah benar: pilih Part Name yang benar lalu Gabung.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
        {items.map((it) => (
          <div key={it.partName} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => onFocusPartName(it.partName)}
              className="btn"
              style={{ flex: '0 0 220px', minWidth: 0, fontSize: 12, padding: '6px 10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, textAlign: 'left' }}
              title={it.prosesCount === 0 ? 'Belum ada Proses sama sekali' : `Ada ${it.prosesCount} Proses, belum ada yang ditandai Proses Akhir`}
            >
              <span style={{ fontWeight: 700 }}>{it.partName}</span>
              <span style={{ color: 'var(--muted)', fontSize: 10.5 }}>
                {it.prosesCount === 0 ? 'Belum ada Proses' : `${it.prosesCount} Proses, belum ada Finish`}
              </span>
            </button>
            <button
              onClick={() => navigateToDataProduksi(it.partName)}
              className="btn"
              title="Buka baris RC Harian Produksi yang pakai nama ini, edit manual"
              style={{ flexShrink: 0, fontSize: 11.5, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
            >
              Ke Data Produksi <ArrowUpRight size={12} />
            </button>
            <ArrowRightLeft size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 160 }}>
              <Combobox
                style={orphanInp}
                value={mergeTarget[it.partName] || ''}
                options={partNameOptions.filter((p) => p !== it.partName)}
                onChange={(v) => setMergeTarget((t) => ({ ...t, [it.partName]: v }))}
                placeholder="Gabung ke Part Name yang benar…"
              />
            </div>
            <button
              disabled={!(mergeTarget[it.partName] || '').trim() || busyName === it.partName}
              onClick={() => merge(it.partName)}
              className="btn primary"
              style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            >
              {busyName === it.partName ? 'Menggabung…' : 'Gabung'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Part Name yang tidak punya Proses sama sekali DAN tidak dipakai data
// historis manapun (ProduksiHarian/Rejection/ProblemLog/Rework) -- sisa
// entri lama yang sudah diganti/dihapus dari data lapangan, bukan Part
// Name baru yang perlu dilengkapi. Beda dari MissingFinishPanel yang
// khusus Part Name yang MASIH punya data tapi belum lengkap Proses
// Akhir-nya. Hapus dicek ulang di backend (/master-part-name-delete)
// supaya tidak bisa kehapus kalau ternyata masih ada datanya.
function UnusedPartNamesPanel({ items, loading, logout, showToast, onDeleted }) {
  const confirm = useConfirm();
  const [busyId, setBusyId] = useState(null);

  async function remove(item) {
    if (!(await confirm(`Hapus Part Name "${item.partName}" dari Master Data? Part Name ini tidak punya Proses maupun data historis apa pun.`))) return;
    setBusyId(item.id);
    try {
      await apiSend('/master-part-name-delete', 'POST', { id: item.id }, logout);
      showToast(`"${item.partName}" berhasil dihapus`, 'green');
      onDeleted();
    } catch (e) { showToast(e.message, 'red'); }
    setBusyId(null);
  }

  if (loading || items.length === 0) return null;
  return (
    <div style={{ border: '1px solid var(--border)', background: 'var(--s2)', borderRadius: 8, padding: 14, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
        <AlertTriangle size={15} style={{ color: 'var(--muted)' }} />
        Part Name Tidak Terpakai ({items.length})
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12 }}>
        Part Name di bawah ini tidak punya Proses maupun data historis apa pun (Produksi/Rejection/Problem Log/Rework) -- biasanya sisa nama lama yang sudah diganti/dihapus, bukan bagian dari Data Produksi. Aman dihapus kalau memang bukan Part Name baru yang belum sempat dilengkapi.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
        {items.map((it) => (
          <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--s1)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 6px 6px 10px' }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{it.partName}</span>
            <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>{it.cluster}</span>
            <button
              disabled={busyId === it.id}
              onClick={() => remove(it)}
              className="btn"
              style={{ flexShrink: 0, color: 'var(--red)', fontSize: 11.5, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
              title="Hapus Part Name ini"
            >
              <Trash2 size={12} /> {busyId === it.id ? 'Menghapus…' : 'Hapus'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Daftar input Mesin yang bisa ditambah/dihapus baris ("+ Tambah Mesin") --
// dipakai bersama oleh AddProsesModal dan EditProsesModal supaya kedua
// modal itu tidak duplikat logic (tambah/hapus/ubah baris Mesin sama
// persis di keduanya).
function MesinListField({ mesinList, setMesinList, machinesRich }) {
  function setAt(idx, value) { setMesinList((list) => list.map((m, i) => (i === idx ? value : m))); }
  function addField() { setMesinList((list) => [...list, '']); }
  function removeField(idx) { setMesinList((list) => (list.length <= 1 ? list : list.filter((_, i) => i !== idx))); }
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {mesinList.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <Combobox style={editInp} value={m} options={machinesRich} onChange={(v) => setAt(i, v)} placeholder="Ketik atau pilih Mesin…" />
            </div>
            <button
              type="button" onClick={() => removeField(i)} disabled={mesinList.length <= 1}
              style={{ ...iconBtn, flexShrink: 0, opacity: mesinList.length <= 1 ? .4 : 1 }} title="Hapus baris Mesin ini"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button" onClick={addField} className="btn"
        style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, padding: '6px 10px' }}
      >
        <Plus size={13} /> Tambah Mesin
      </button>
    </>
  );
}

// Edit Part Name & Proses lewat modal di tengah layar -- gantikan baris
// tabel yang dulu berubah jadi input inline (terlalu sempit buat 7 kolom
// sekaligus). Sama pola dengan EditProduksiModal di Data Produksi: klik
// baris tabel buka ProsesRowDrawer (read-only), klik pensil Edit buka
// modal ini (bisa diubah).
//
// `group` di sini bukan satu baris MasterProses lagi, tapi SEMUA baris
// yang Part Name+Proses+Cluster-nya sama (satu grup = satu baris tampilan
// di tabel yang sudah digabung per Mesin, lihat buildGroupedRows) --
// `group.rows` = [{id, mesin}, ...] baris asli di database. Field lain
// (Proses/Line/Cycle Time/Proses Akhir) dianggap satu nilai bersama utk
// seluruh grup; Menyimpan mengirim nilai itu ke SEMUA baris grup.
function EditProsesModal({ group, partNames, legacy, machines, lineOptions = [], logout, onClose, onSaved }) {
  const showToast = useToast();
  const partNameMatch = partNames.find((pn) => pn.partName.toLowerCase() === group.partName.toLowerCase());
  const [form, setForm] = useState({
    partName: group.partName, cluster: group.cluster || '', proses: group.proses,
    line: group.line || '', cycleTime: group.cycleTime, idCode: partNameMatch?.idCode || '',
    isFinishProses: group.isFinishProses || false,
  });
  // Satu slot per baris Mesin yang sudah ada di grup ini + slot tambahan
  // dari "+ Tambah Mesin". Saat Simpan, dicocokkan lewat NILAI Mesin
  // (bukan posisi) ke baris asli grup.rows -- Mesin yang masih ada di
  // daftar = update baris itu, Mesin yang dihapus dari daftar = hapus
  // baris itu, Mesin baru = buat baris baru. Lihat save().
  const [mesinList, setMesinList] = useState(group.rows.map((r) => r.mesin || ''));
  const [busy, setBusy] = useState(false);
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  const partNameOptionsRich = useMemo(
    () => partNames.map((p) => ({ value: p.partName, sub: `Cluster ${p.cluster}` })).sort((a, b) => a.value.localeCompare(b.value)),
    [partNames],
  );
  const machinesRich = useMemo(
    () => machines.map((m) => ({ value: m.machine, sub: m.cluster ? `Cluster ${m.cluster}` : null })),
    [machines],
  );

  // Simpan perubahan Part Name -- tidak pernah memanggil
  // master-part-name-update dengan Cluster (yang akan mengubah baris
  // MasterPartName bersama dan mempengaruhi semua Proses lain yang
  // berbagi Part Name yang sama). Kalau nama Part Name diketik ulang,
  // pakai master-part-name (cari-atau-buat, idempotent) supaya katalog
  // Part Name tetap ada, tanpa mengubah baris lain manapun. ID Code
  // (properti milik Part Name, bukan Proses) disinkron terpisah lewat
  // master-part-name-update dengan id saja (tanpa cluster) supaya Cluster
  // baris lain yang berbagi Part Name yang sama tidak ikut tertimpa.
  async function save() {
    const mesinValues = [...new Set(mesinList.map((m) => m.trim()).filter(Boolean))];
    if (!form.partName.trim() || !form.cluster || !form.proses.trim() || mesinValues.length === 0) {
      showToast('Part Name, Cluster, Proses, dan minimal 1 Mesin wajib diisi', 'red');
      return;
    }
    setBusy(true);
    try {
      if (form.partName !== group.partName) {
        await apiSend('/master-part-name', 'POST', { part_name: form.partName, cluster: form.cluster, id_code: form.idCode }, logout);
      } else {
        const match = partNames.find((pn) => pn.partName.toLowerCase() === form.partName.toLowerCase());
        if (match && form.idCode !== (match.idCode || '')) {
          await apiSend('/master-part-name-update', 'POST', { id: match.id, id_code: form.idCode }, logout);
        }
      }

      const mesinValuesLower = new Set(mesinValues.map((m) => m.toLowerCase()));
      let representativeId = null;
      // Baris lama yang Mesin-nya masih ada di daftar -> update (Proses/
      // Cluster/Line/Cycle Time bisa berubah, dikirim sama ke semua baris
      // grup ini). Baris lama yang Mesin-nya sudah dihapus dari daftar ->
      // hapus baris itu.
      for (const r of group.rows) {
        if (mesinValuesLower.has(r.mesin.toLowerCase())) {
          await apiSend('/master-proses-update', 'POST', {
            id: r.id, proses: form.proses, part_name: form.partName, cluster: form.cluster,
            mesin: r.mesin, line: form.line, cycle_time: form.cycleTime,
          }, logout);
          representativeId = representativeId || r.id;
        } else {
          await apiSend('/master-proses-delete', 'POST', { id: r.id }, logout);
        }
      }
      // Mesin baru (belum ada baris lamanya di grup ini) -> buat baris baru.
      for (const mesin of mesinValues) {
        if (group.rows.some((r) => r.mesin.toLowerCase() === mesin.toLowerCase())) continue;
        const created = await apiSend('/master-proses', 'POST', {
          proses: form.proses, part_name: form.partName, cluster: form.cluster,
          mesin, line: form.line, cycle_time: form.cycleTime,
        }, logout);
        representativeId = representativeId || created.id;
      }
      // Proses Akhir/Finish milik Part Name+Proses (bukan per Mesin) --
      // endpoint /master-proses-set-finish mematikan tanda di baris LAIN
      // yang berbagi Part Name yang sama (cuma boleh satu Proses Akhir per
      // Part Name), jadi cukup dikirim SEKALI ke satu baris wakil grup ini.
      if (form.isFinishProses !== (group.isFinishProses || false) && representativeId) {
        await apiSend('/master-proses-set-finish', 'POST', { id: representativeId, value: form.isFinishProses }, logout);
      }
      showToast('Part Name / Proses berhasil diperbarui', 'green');
      onSaved();
      onClose();
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }

  // createPortal ke document.body -- tabel Part Name & Proses ada di
  // dalam .card, dan .card punya animasi (fadeUp) yang meninggalkan
  // transform aktif permanen setelah animasinya selesai. position:fixed
  // di dalam elemen manapun yang punya transform aktif jadi relatif ke
  // elemen itu, BUKAN ke viewport -- makanya tanpa portal, modal ini
  // ikut posisi scroll tabel/card alih-alih diam di posisi yang sama
  // (sama akar masalah dengan ProsesRowDrawer/ProduksiRowDrawer). Gaya
  // slide-up dari bawah (bukan center) juga dipakai supaya posisinya
  // selalu konsisten & gampang ditemukan, tidak peduli baris mana yang
  // diklik atau posisi scroll tabel.
  return createPortal(
    <div className="overlay show" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560, borderRadius: '14px 14px 0 0' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Edit Part Name &amp; Proses — {group.partName}</div>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Part Name">
              <Combobox style={editInp} value={form.partName} options={partNameOptionsRich} onChange={(v) => set('partName', v)} placeholder="Ketik atau pilih Part Name…" />
            </Field>
          </div>
          <Field label="Cluster">
            <select className="form-input" style={editInp} value={form.cluster} onChange={(e) => set('cluster', e.target.value)}>
              <option value="">Pilih…</option>
              {CLUSTERS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="ID Code">
            <input type="text" className="form-input" style={editInp} value={form.idCode} onChange={(e) => set('idCode', e.target.value)} placeholder="mis. D.FG.00126" />
          </Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Proses">
              <input className="form-input" style={editInp} list="dl-proses" value={form.proses} onChange={(e) => set('proses', e.target.value)} />
            </Field>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Mesin" hint="dari Tabel Machine, bisa lebih dari satu">
              <MesinListField mesinList={mesinList} setMesinList={setMesinList} machinesRich={machinesRich} />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                Hapus Mesin dari daftar utk menghapus baris itu; tambah Mesin baru lewat "+ Tambah Mesin". Proses/Cluster/Line/Cycle Time berlaku sama utk semua Mesin di grup ini.
              </div>
            </Field>
          </div>
          <Field label="Line Produksi">
            <input className="form-input" style={editInp} list="dl-line-edit" value={form.line} onChange={(e) => set('line', e.target.value)} />
            <datalist id="dl-line-edit">{lineOptions.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
          <Field label="Cycle Time (detik/pcs)">
            <input type="number" className="form-input" style={editInp} value={form.cycleTime} onChange={(e) => set('cycleTime', e.target.value)} />
          </Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.isFinishProses} onChange={(e) => set('isFinishProses', e.target.checked)} />
              <span>
                Proses Akhir / Finish
                <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>
                  Dipakai sebagai acuan Total OK di Input Rejection. Cuma boleh satu per Part Name — menyalakan ini otomatis mematikan tanda di Proses lain milik Part Name yang sama.
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
          <button className="btn" onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Tambah Part Name & Proses baru lewat modal (gantikan form inline yang
// dulu ada di atas tabel) -- gaya sama dengan EditProsesModal, tapi Mesin
// bisa lebih dari satu lewat tombol "+ Tambah Mesin". Skema MasterProses
// SUDAH tidak punya @@unique([proses, partName]) lagi (dilepas lewat
// migration 20260813000000_drop_proses_partname_unique justru supaya satu
// Part Name+Proses boleh punya lebih dari satu baris/pilihan Mesin), jadi
// tiap Mesin yang diisi di sini cukup dikirim sebagai baris POST
// /master-proses terpisah -- tidak perlu endpoint atau skema baru sama
// sekali, sama pola dengan ImportProsesModal yang sudah lebih dulu
// memakai pola "satu baris = satu Mesin" ini lewat Excel.
function AddProsesModal({ partNames, legacy, machines, lineOptions = [], logout, onClose, onSaved }) {
  const showToast = useToast();
  const [form, setForm] = useState({ partName: '', cluster: '', proses: '', line: '', cycleTime: '', idCode: '' });
  const [mesinList, setMesinList] = useState(['']);
  const [busy, setBusy] = useState(false);
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  const partNameOptionsRich = useMemo(
    () => partNames.map((p) => ({ value: p.partName, sub: `Cluster ${p.cluster}` })).sort((a, b) => a.value.localeCompare(b.value)),
    [partNames],
  );
  const machinesRich = useMemo(
    () => machines.map((m) => ({ value: m.machine, sub: m.cluster ? `Cluster ${m.cluster}` : null })),
    [machines],
  );

  // Kalau ketik Part Name yang sudah ada, Cluster & ID Code-nya otomatis
  // kekunci ke yang sudah tersimpan -- sama perilaku dengan form inline
  // lama (setPartNameField) dan cascading di /rmo.
  function pickPartName(v) {
    const existing = partNames.find((p) => p.partName === v);
    setForm((f) => ({ ...f, partName: v, cluster: existing ? existing.cluster : f.cluster, idCode: existing ? (existing.idCode || '') : f.idCode }));
  }

  async function save() {
    // Baris Mesin kosong (mis. ditambah lewat "+ Tambah Mesin" tapi tidak
    // jadi diisi) dilewati begitu saja, bukan dianggap error -- dan
    // duplikat (ketik Mesin yang sama dua kali) disaring supaya tidak
    // bikin dua baris Proses identik.
    const mesinValues = [...new Set(mesinList.map((m) => m.trim()).filter(Boolean))];
    if (!form.partName.trim() || !form.cluster || !form.proses.trim() || mesinValues.length === 0) {
      showToast('Part Name, Cluster, Proses, dan minimal 1 Mesin wajib diisi', 'red');
      return;
    }
    setBusy(true);
    try {
      await apiSend('/master-part-name', 'POST', { part_name: form.partName, cluster: form.cluster, id_code: form.idCode }, logout);
      for (const mesin of mesinValues) {
        await apiSend('/master-proses', 'POST', {
          proses: form.proses, part_name: form.partName, cluster: form.cluster,
          mesin, line: form.line, cycle_time: form.cycleTime,
        }, logout);
      }
      showToast(`Part Name / Proses berhasil ditambahkan (${mesinValues.length} pilihan Mesin)`, 'green');
      onSaved();
      onClose();
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }

  return createPortal(
    <div className="overlay show" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560, borderRadius: '14px 14px 0 0' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Tambah Part Name &amp; Proses</div>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Part Name">
              <Combobox style={editInp} value={form.partName} options={partNameOptionsRich} onChange={pickPartName} placeholder="Ketik atau pilih Part Name…" />
              <datalist id="dl-part-names-add">{legacy.partNames.map((s) => <option key={s} value={s} />)}</datalist>
            </Field>
          </div>
          <Field label="Cluster">
            <select className="form-input" style={editInp} value={form.cluster} onChange={(e) => set('cluster', e.target.value)}>
              <option value="">Pilih…</option>
              {CLUSTERS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="ID Code">
            <input type="text" className="form-input" style={editInp} value={form.idCode} onChange={(e) => set('idCode', e.target.value)} placeholder="mis. D.FG.00126" />
          </Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Proses">
              <input className="form-input" style={editInp} list="dl-proses-add" value={form.proses} onChange={(e) => set('proses', e.target.value)} />
              <datalist id="dl-proses-add">{legacy.proses.map((s) => <option key={s} value={s} />)}</datalist>
            </Field>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Mesin" hint="dari Tabel Machine, bisa lebih dari satu">
              <MesinListField mesinList={mesinList} setMesinList={setMesinList} machinesRich={machinesRich} />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                Tiap Mesin dibuat sebagai baris Proses terpisah (Part Name/Proses/Cluster/Line/Cycle Time sama, Mesin beda).
              </div>
            </Field>
          </div>
          <Field label="Line Produksi">
            <input className="form-input" style={editInp} list="dl-line-add" value={form.line} onChange={(e) => set('line', e.target.value)} />
            <datalist id="dl-line-add">{lineOptions.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
          <Field label="Cycle Time (detik/pcs)">
            <input type="number" className="form-input" style={editInp} value={form.cycleTime} onChange={(e) => set('cycleTime', e.target.value)} />
          </Field>
        </div>

        <div className="modal-footer">
          <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
          <button className="btn" onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Gabungkan grup Part Name+Proses ini (bisa beberapa baris Mesin) ke grup
// lain -- dipakai kalau baris ini ternyata duplikat/typo dari baris lain
// yang sudah benar (mis. beda ejaan Part Name atau nama Proses, lihat
// screenshot berisi "SEAT VALVE SPG 14777-K0J-N000" vs "SEAT VALVE SPRING
// KZR"). Semua data historis RC Harian Produksi ikut pindah ke tujuan
// (lihat mergeProses di backend), baris Mesin milik grup ini dihapus dari
// Master Data -- jadi "Jumlah Data"-nya otomatis jadi 0.
function MergeProsesModal({ group, partNames, proses, logout, onClose, onMerged }) {
  const showToast = useToast();
  const [toPartName, setToPartName] = useState('');
  const [toProses, setToProses] = useState('');
  const [busy, setBusy] = useState(false);

  const partNameOptionsRich = useMemo(
    () => partNames.map((p) => ({ value: p.partName, sub: `Cluster ${p.cluster}` })).sort((a, b) => a.value.localeCompare(b.value)),
    [partNames],
  );
  // Opsi Proses disaring ke Proses yang sudah ada milik Part Name tujuan
  // yang dipilih -- supaya gampang pilih Proses yang benar-benar sudah
  // ada, tapi tetap bisa ketik nama baru (Combobox selalu bisa diketik
  // bebas).
  const prosesOptions = useMemo(() => {
    if (!toPartName) return [];
    return [...new Set(proses.filter((p) => p.partName.toLowerCase() === toPartName.toLowerCase()).map((p) => p.proses))]
      .sort((a, b) => a.localeCompare(b));
  }, [proses, toPartName]);

  function pickToPartName(v) {
    setToPartName(v);
    setToProses('');
  }

  async function submit() {
    if (!toPartName.trim() || !toProses.trim()) {
      showToast('Part Name dan Proses tujuan wajib diisi', 'red');
      return;
    }
    setBusy(true);
    try {
      const r = await apiSend('/master-proses-merge', 'POST', {
        from_ids: group.rows.map((row) => row.id),
        to_part_name: toPartName, to_proses: toProses,
      }, logout);
      showToast(`${r.produksi} baris data dipindahkan ke "${r.into.partName}" / "${r.into.proses}"`, 'green');
      onMerged();
      onClose();
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }

  return createPortal(
    <div className="overlay show" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480, borderRadius: '14px 14px 0 0' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Gabung Part Name &amp; Proses</div>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>
          Semua data historis <strong>{group.partName}</strong> / <strong>{group.proses}</strong> ({group.rows.length} pilihan Mesin) akan dipindahkan ke Part Name &amp; Proses tujuan di bawah, lalu baris ini dihapus dari Master Data (Jumlah Data-nya jadi 0).
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Part Name Tujuan">
            <Combobox style={editInp} value={toPartName} options={partNameOptionsRich} onChange={pickToPartName} placeholder="Ketik atau pilih Part Name…" />
          </Field>
          <Field label="Proses Tujuan" hint={toPartName ? undefined : 'pilih Part Name dulu'}>
            <Combobox style={editInp} value={toProses} options={prosesOptions} onChange={setToProses} disabled={!toPartName} placeholder="Ketik atau pilih Proses…" />
          </Field>
        </div>

        <div className="modal-footer">
          <button className="btn primary" disabled={busy || !toPartName.trim() || !toProses.trim()} onClick={submit}>
            {busy ? 'Menggabungkan…' : 'Gabungkan'}
          </button>
          <button className="btn" onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Kolom yang dibaca/ditulis fitur Import & template contohnya -- header di
// file yang diupload dicocokkan ke label ini (case-insensitive, urutan
// kolom bebas), lihat mapImportRow.
const IMPORT_COLUMNS = [
  { key: 'part_name', label: 'Part Name' },
  { key: 'cluster', label: 'Cluster' },
  { key: 'id_code', label: 'ID Code' },
  { key: 'proses', label: 'Proses' },
  { key: 'mesin', label: 'Mesin' },
  { key: 'line', label: 'Line Produksi' },
  { key: 'cycle_time', label: 'Cycle Time' },
];

function mapImportRow(raw) {
  const normalized = {};
  for (const [k, v] of Object.entries(raw)) normalized[String(k).trim().toLowerCase()] = v;
  const get = (label) => normalized[label.toLowerCase()];
  return {
    part_name: String(get('Part Name') ?? '').trim(),
    cluster: String(get('Cluster') ?? '').trim(),
    id_code: String(get('ID Code') ?? '').trim(),
    proses: String(get('Proses') ?? '').trim(),
    mesin: String(get('Mesin') ?? '').trim(),
    line: String(get('Line Produksi') ?? '').trim(),
    cycle_time: get('Cycle Time') ?? '',
  };
}

// Import massal Part Name & Proses dari file Excel -- di-parse penuh di
// browser (lihat web/src/importXlsx.js), dikirim sebagai array biasa ke
// /master-proses-import. Satu baris file SELALU jadi satu baris Proses
// baru (tidak digabung ke baris yang sudah ada, sama seperti Add form
// sekarang -- lihat catatan di /master-proses backend), jadi cocok juga
// dipakai berulang buat menambah pilihan Mesin lain ke Part Name+Proses
// yang sama.
function ImportProsesModal({ logout, onClose, onImported }) {
  const showToast = useToast();
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  function downloadTemplate() {
    downloadXlsx('template-import-part-name-proses.xlsx', 'Template', IMPORT_COLUMNS, [
      { part_name: 'CONTOH PART NAME', cluster: 'AD', id_code: 'D.FG.00126', proses: 'Assy', mesin: 'ROBOT WELDING PANASONIC', line: 'Suzuki', cycle_time: 120 },
    ]);
  }

  async function handleFile(file) {
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    try {
      const raw = await readXlsxFile(file);
      setRows(raw.map(mapImportRow).filter((r) => r.part_name || r.proses));
    } catch (e) {
      showToast('Gagal membaca file: ' + e.message, 'red');
      setRows([]);
    }
  }

  async function doImport() {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      const r = await apiSend('/master-proses-import', 'POST', { rows }, logout);
      setResult(r);
      if (r.imported > 0) {
        showToast(`${r.imported} baris berhasil diimport${r.errors.length ? `, ${r.errors.length} dilewati` : ''}`, r.errors.length ? 'yellow' : 'green');
        onImported();
      } else {
        showToast('Tidak ada baris yang berhasil diimport, cek daftar error di bawah', 'red');
      }
    } catch (e) { showToast(e.message, 'red'); }
    setBusy(false);
  }

  return createPortal(
    <div className="overlay show" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560, borderRadius: '14px 14px 0 0' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Import Part Name &amp; Proses</div>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>
          Kolom yang dibaca: <strong>Part Name, Cluster, ID Code, Proses, Mesin, Line Produksi, Cycle Time</strong> (Part Name/Cluster/Proses/Mesin wajib diisi, urutan kolom bebas). Satu baris file = satu baris Proses baru — kalau Part Name+Proses yang sama sudah ada, tetap dibuat baris baru (tidak digabung/dianggap 1).
        </div>

        <button className="btn" onClick={downloadTemplate} style={{ marginBottom: 12 }}>Download Template</button>

        <input
          type="file" accept=".xlsx,.xls"
          style={{ display: 'block', marginBottom: 12, fontSize: 12.5, color: 'var(--text)' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />

        {rows.length > 0 && !result && (
          <div style={{ fontSize: 12.5, marginBottom: 12 }}>
            <strong>{fileName}</strong> — {rows.length} baris terbaca.
          </div>
        )}

        {result && (
          <div style={{ fontSize: 12, marginBottom: 12, maxHeight: 180, overflowY: 'auto', background: 'var(--s2)', borderRadius: 8, padding: 10 }}>
            <div style={{ color: 'var(--green)', fontWeight: 700 }}>{result.imported} dari {result.total} baris berhasil diimport.</div>
            {result.unmatchedMesin > 0 && (
              <div style={{ color: '#e0a30c', marginTop: 4 }}>
                {result.unmatchedMesin} di antaranya Mesin-nya belum cocok Tabel Machine — cek panel "Mesin/Line Belum Sesuai Tabel Machine" di atas untuk mengoreksinya satu per satu.
              </div>
            )}
            {result.errors.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div style={{ color: 'var(--red)', fontWeight: 700 }}>{result.errors.length} baris dilewati:</div>
                {result.errors.map((e, i) => (
                  <div key={i} style={{ color: 'var(--muted)' }}>Baris {e.row}: {e.reason}</div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="modal-footer">
          <button className="btn primary" disabled={rows.length === 0 || busy} onClick={doImport}>
            {busy ? 'Mengimport…' : `Import${rows.length ? ` (${rows.length} baris)` : ''}`}
          </button>
          <button className="btn" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function PartProsesTab({ proses, partNames, loading, onChanged, logout, legacy = { proses: [], mesin: [], manPower: [], partNames: [] }, readOnly = false }) {
  const showToast = useToast();
  const confirm = useConfirm();
  // Klik baris (bukan tombol Edit/Hapus/bintang) buka drawer detail
  // read-only, sama pola dengan ProduksiRowDrawer di Data Produksi. Klik
  // pensil Edit buka EditProsesModal (bisa diubah, kotak di tengah layar)
  // -- bukan lagi baris tabel yang berubah jadi input inline. Tambah baru
  // juga lewat modal (AddProsesModal), bukan lagi form inline di atas tabel.
  const [detailRow, setDetailRow] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [mergeRow, setMergeRow] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [query, setQuery] = useState('');
  const scrollRef = useHorizontalWheelScroll();
  const { widths, startResize } = useColumnWidths(PP_DEFAULT_WIDTHS, scrollRef);

  // Jumlah baris RC Harian Produksi per Part Name+Proses -- kolom "Jumlah
  // Data" di tabel, dan daftar Part Name yang muncul di data produksi
  // historis tapi tidak (lagi) cocok dengan Part Name mana pun di Master
  // Data -- biasanya nama lama/typo sebelum katalog dirapikan, atau nama
  // Part Name-nya sudah diganti belakangan di Master Data.
  const [counts, setCounts] = useState([]);
  const [orphans, setOrphans] = useState([]);
  const [orphanLoading, setOrphanLoading] = useState(true);
  const [missingFinish, setMissingFinish] = useState([]);
  const [missingFinishLoading, setMissingFinishLoading] = useState(true);
  // Part Name yang tidak punya Proses sama sekali DAN tidak dipakai data
  // historis manapun -- sisa entri lama, tidak termasuk Data Produksi
  // (beda dari missingFinish yang MASIH punya data tapi belum lengkap).
  const [unused, setUnused] = useState([]);
  const [unusedLoading, setUnusedLoading] = useState(true);
  // Baris Proses yang Mesin-nya (data lama, sebelum Tabel Machine dipakai
  // sebagai katalog) belum cocok satu pun baris di Machine -- perlu
  // dikoreksi manual oleh admin (lihat MesinMismatchPanel).
  const [mesinMismatch, setMesinMismatch] = useState([]);
  const [mesinMismatchLoading, setMesinMismatchLoading] = useState(true);
  // Katalog Mesin (tabel Machine, shared dgn Dashboard-MTN) -- Mesin di
  // form Proses WAJIB pilih dari sini (bukan ketik bebas lagi). Line
  // Produksi TIDAK lagi ikut otomatis dari Machine.line -- diisi manual
  // (datalist berisi Line yang sudah ada di baris Proses lain, sekadar
  // saran, bukan validasi).
  const [machines, setMachines] = useState([]);
  const loadCounts = useCallback(() => {
    apiFetch('/produksi-partname-counts', [], logout).then(setCounts);
    apiFetch('/machines', [], logout).then(setMachines);
    setOrphanLoading(true);
    apiFetch('/produksi-orphan-partnames', [], logout).then((d) => { setOrphans(d); setOrphanLoading(false); });
    setMissingFinishLoading(true);
    apiFetch('/master-partname-missing-finish', [], logout).then((d) => { setMissingFinish(d); setMissingFinishLoading(false); });
    setUnusedLoading(true);
    apiFetch('/master-partname-unused', [], logout).then((d) => { setUnused(d); setUnusedLoading(false); });
    setMesinMismatchLoading(true);
    apiFetch('/master-proses-mesin-mismatch', [], logout).then((d) => { setMesinMismatch(d); setMesinMismatchLoading(false); });
  }, [logout]);
  useEffect(() => { loadCounts(); }, [loadCounts]);
  // Ketik-utk-cari (Combobox), TIDAK difilter per Cluster -- data Cluster
  // di Tabel Machine belum dirapikan (banyak masih "Cell AD" dkk, bukan
  // "AD" polos seperti dipakai di sini), jadi filter cluster-exact-match
  // pernah bikin hampir semua Mesin hilang dari pilihan. Cluster tetap
  // ditampilkan sebagai sub-teks (kalau ada) buat konteks, bukan filter.
  const machinesRich = useMemo(
    () => machines.map((m) => ({ value: m.machine, sub: m.cluster ? `Cluster ${m.cluster}` : null })),
    [machines],
  );
  // Saran Line Produksi (datalist) -- daftar Line yang sudah pernah
  // dipakai di baris Proses lain, sekadar bantu konsistensi penamaan,
  // bukan validasi (Line diisi manual, tidak lagi tergantung Mesin).
  const lineOptions = useMemo(
    () => [...new Set(proses.map((r) => r.line).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [proses],
  );
  const countMap = useMemo(() => {
    const map = new Map();
    counts.forEach((c) => map.set(`${c.partName.toLowerCase().trim()}|${c.proses.toLowerCase().trim()}`, c.count));
    return map;
  }, [counts]);

  // Hapus SEMUA baris Mesin milik satu grup (Part Name+Proses+Cluster) --
  // ids berisi lebih dari satu id kalau grup ini punya beberapa pilihan
  // Mesin (lihat buildGroupedRows). Untuk hapus satu Mesin saja tanpa
  // menghapus semua, pakai Edit lalu keluarkan Mesin itu dari daftar.
  async function remove(ids) {
    const label = ids.length > 1 ? `Hapus baris Proses ini beserta ${ids.length} pilihan Mesin-nya?` : 'Hapus baris Proses ini?';
    if (!(await confirm(label))) return;
    try {
      for (const id of ids) await apiSend('/master-proses-delete', 'POST', { id }, logout);
      showToast('Baris Proses berhasil dihapus', 'green');
      onChanged(); loadCounts();
    } catch (e) { showToast(e.message, 'red'); }
  }
  // Cluster dibaca langsung dari baris Proses-nya sendiri (bukan join ke
  // MasterPartName) -- lihat komentar di schema.prisma MasterProses.cluster.
  const rows = proses;
  const filtered = useMemo(
    () => rows.filter((r) => matches(query, r.partName, r.cluster, r.proses, r.line, r.mesin)),
    [rows, query],
  );
  // Gabungkan baris yang Part Name+Proses+Cluster-nya sama jadi satu baris
  // tampilan, Mesin digabung koma -- baris asli di database TETAP terpisah
  // per Mesin (lihat catatan skema di AddProsesModal), ini murni supaya
  // tabel tidak menampilkan baris yang keliatan duplikat cuma beda Mesin.
  // `rows` (array {id, mesin}) dibawa serta supaya Edit/Hapus tahu semua
  // baris asli milik grup ini.
  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      const key = `${r.partName.toLowerCase().trim()}|${r.proses.toLowerCase().trim()}|${r.cluster}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key, partName: r.partName, cluster: r.cluster, proses: r.proses,
          line: r.line, cycleTime: r.cycleTime, isFinishProses: r.isFinishProses, manPower: r.manPower,
          rows: [{ id: r.id, mesin: r.mesin }],
        });
      } else {
        existing.rows.push({ id: r.id, mesin: r.mesin });
        if (r.isFinishProses) existing.isFinishProses = true;
      }
    }
    return [...map.values()].map((g) => ({ ...g, mesin: g.rows.map((r) => r.mesin).join(',') }));
  }, [filtered]);
  // Default: urutkan berdasarkan Part Name, lalu Proses di dalamnya --
  // supaya semua Proses milik Part Name yang sama berurutan dan mudah
  // dicari. Klik header kolom untuk mengurutkan manual sesuai kolom itu.
  const defaultSorted = useMemo(
    () => [...grouped].sort((a, b) => a.partName.localeCompare(b.partName) || a.proses.localeCompare(b.proses)),
    [grouped],
  );
  const { sorted: shown, sortKey, sortDir, toggleSort } = useSort(defaultSorted);

  return (
    <div className="card">
      {!readOnly && (
        <>
          <MesinMismatchPanel
            items={mesinMismatch}
            loading={mesinMismatchLoading}
            onFocusPartName={setQuery}
          />

          <MissingFinishPanel
            items={missingFinish}
            loading={missingFinishLoading}
            onFocusPartName={setQuery}
            partNameOptions={partNames.map((p) => p.partName)}
            logout={logout}
            showToast={showToast}
            onMerged={loadCounts}
          />

          <UnusedPartNamesPanel
            items={unused}
            loading={unusedLoading}
            logout={logout}
            showToast={showToast}
            onDeleted={loadCounts}
          />

          <OrphanPartNamesPanel
            orphans={orphans}
            loading={orphanLoading}
            partNameOptions={partNames.map((p) => p.partName)}
            logout={logout}
            showToast={showToast}
            onRenamed={loadCounts}
          />

        </>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <SearchBox value={query} onChange={setQuery} placeholder="Cari Part Name / Proses / Line / Mesin…" />
        </div>
        {!readOnly && (
          <>
            <button
              onClick={() => setShowAdd(true)}
              style={{ background: 'var(--green)', borderColor: 'var(--green)', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, border: '1px solid', borderRadius: 7, padding: '7px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
            >
              <Plus size={14} /> Part Name & Proses
            </button>
            <button className="btn" onClick={() => setShowImport(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <Upload size={14} /> Import
            </button>
          </>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 10 }}>
        Baris berlabel <strong>Finish</strong> = Proses Akhir (dipakai sebagai Total OK di Input Rejection). Tandai lewat tombol Edit pada baris Proses yang benar — cuma boleh satu per Part Name.
      </div>

      <div ref={scrollRef} style={{ overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: `${widths.partName}%` }} />
            <col style={{ width: `${widths.cluster}%` }} />
            <col style={{ width: `${widths.idCode}%` }} />
            <col style={{ width: `${widths.proses}%` }} />
            <col style={{ width: `${widths.line}%` }} />
            <col style={{ width: `${widths.mesin}%` }} />
            <col style={{ width: `${widths.cycleTime}%` }} />
            <col style={{ width: `${widths.jumlahData}%` }} />
            <col style={{ width: `${PP_AKSI_PCT}%` }} />
          </colgroup>
          <thead>
            <tr>
              <SortTh sortKeyName="partName" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th} onResizeStart={startResize('partName')}>Part Name</SortTh>
              <SortTh sortKeyName="cluster" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th} onResizeStart={startResize('cluster')}>Cluster</SortTh>
              <th style={th}>ID Code</th>
              <SortTh sortKeyName="proses" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th} onResizeStart={startResize('proses')}>Proses</SortTh>
              <SortTh sortKeyName="line" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th} onResizeStart={startResize('line')}>Line Produksi</SortTh>
              <SortTh sortKeyName="mesin" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th} onResizeStart={startResize('mesin')}>Mesin</SortTh>
              <SortTh sortKeyName="cycleTime" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} style={th} onResizeStart={startResize('cycleTime')}>Cycle Time</SortTh>
              <th style={th} title="Jumlah baris RC Harian Produksi yang pakai kombinasi Part Name + Proses ini">Jumlah Data</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              let groupIdx = -1;
              let prevPartName = null;
              if (loading && rows.length === 0) return <tr><td colSpan={9} style={td}><Skeleton height={12} width="60%" /></td></tr>;
              if (shown.length === 0) return <tr><td colSpan={9} style={td}>{rows.length === 0 ? 'Belum ada data.' : 'Tidak ada yang cocok.'}</td></tr>;
              return shown.map((p) => {
                if (p.partName !== prevPartName) { groupIdx++; prevPartName = p.partName; }
                const groupBg = PP_GROUP_BG[groupIdx % PP_GROUP_BG.length];
                const partNameMatch = partNames.find((pn) => pn.partName.toLowerCase() === p.partName.toLowerCase());
                const dataCount = countMap.get(`${p.partName.toLowerCase().trim()}|${p.proses.toLowerCase().trim()}`) || 0;
                return (
                  <tr
                    key={p.key}
                    style={{ background: groupBg, cursor: 'pointer' }}
                    onClick={() => setDetailRow({ ...p, idCode: partNameMatch?.idCode, dataCount })}
                  >
                    <td style={td}><ZoomCell label="Part Name">{p.partName}</ZoomCell></td>
                    <td style={td}>{p.cluster}</td>
                    <td style={td}>{partNameMatch?.idCode || '—'}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <ZoomCell label="Proses" style={{ flex: 1, minWidth: 0 }}>{p.proses}</ZoomCell>
                        {p.isFinishProses && (
                          <span
                            title="Proses Akhir/Finish -- dipakai sebagai Total OK Input Rejection"
                            style={{
                              flexShrink: 0, fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em',
                              color: '#e0a30c', border: '1px solid #e0a30c', borderRadius: 4, padding: '1px 5px',
                            }}
                          >
                            Finish
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={td}>{p.line}</td>
                    <td style={td}>{p.mesin}</td>
                    <td style={td}>{p.cycleTime}</td>
                    <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: dataCount === 0 ? 'var(--muted)' : 'var(--text)' }}>{dataCount}</td>
                    <td style={td}>
                      {!readOnly && (
                        <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => setEditRow(p)} style={iconBtn} title="Edit"><Pencil size={13} /></button>
                          <button onClick={() => setMergeRow(p)} style={iconBtn} title="Gabung ke Part Name & Proses lain"><ArrowRightLeft size={13} /></button>
                          <button onClick={() => remove(p.rows.map((r) => r.id))} style={{ ...iconBtn, color: 'var(--red)' }} title="Hapus"><Trash2 size={13} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </div>

      <ProsesRowDrawer row={detailRow} onClose={() => setDetailRow(null)} />
      {editRow && (
        <EditProsesModal
          group={editRow}
          partNames={partNames}
          legacy={legacy}
          machines={machines}
          lineOptions={lineOptions}
          logout={logout}
          onClose={() => setEditRow(null)}
          onSaved={() => { onChanged(); loadCounts(); }}
        />
      )}
      {showImport && (
        <ImportProsesModal
          logout={logout}
          onClose={() => setShowImport(false)}
          onImported={() => { onChanged(); loadCounts(); }}
        />
      )}
      {showAdd && (
        <AddProsesModal
          partNames={partNames}
          legacy={legacy}
          machines={machines}
          lineOptions={lineOptions}
          logout={logout}
          onClose={() => setShowAdd(false)}
          onSaved={() => { onChanged(); loadCounts(); }}
        />
      )}
      {mergeRow && (
        <MergeProsesModal
          group={mergeRow}
          partNames={partNames}
          proses={proses}
          logout={logout}
          onClose={() => setMergeRow(null)}
          onMerged={() => { onChanged(); loadCounts(); }}
        />
      )}
    </div>
  );
}
