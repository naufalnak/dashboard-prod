import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, ArrowRightLeft, ArrowUpRight, Trash2, CheckCircle2 } from 'lucide-react';
import { useUI } from '../contexts/UIContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { useConfirm } from '../contexts/ConfirmContext.jsx';
import { apiFetch, apiSend } from '../api.js';
import { isReadOnlyUser } from '../roles.js';
import Combobox from '../components/Combobox.jsx';
import { Skeleton } from '../components/Skeleton.jsx';
import { CLUSTERS } from './MasterData/shared.jsx';

// Halaman "Validasi Data" -- kumpulan panel data-quality yang dulu numpang
// tampil di atas tabel Master Data > Part Name & Proses (bikin tabel utama
// ketutup kalau masalahnya banyak). Dipindah ke menu sendiri supaya Master
// Data cuma menampilkan tabelnya, sementara tiap jenis masalah dapat
// tabelnya sendiri di sini. Endpoint & logic sama persis dengan yang lama
// (dipindah, bukan ditulis ulang) -- lihat riwayat PartProsesTab.jsx kalau
// perlu bandingkan.

const orphanInp = { width: '100%', padding: '7px 10px', fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--s1)', color: 'var(--text)' };

function EmptyOk({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--green)', fontSize: 12.5, padding: '4px 0' }}>
      <CheckCircle2 size={15} /> {label}
    </div>
  );
}

// Part Name yang muncul di data RC Harian Produksi (Supabase) tapi tidak
// cocok dengan Part Name mana pun yang sekarang ada di Master Data --
// biasanya nama lama/typo dari sebelum katalog dirapikan, atau memang
// sudah diganti namanya belakangan. Panel ini membiarkan nama lama itu
// "disamakan" ke Part Name Master Data yang benar -- backend akan
// menimpa nama di semua baris historis terkait (Produksi, Rejection,
// Problem Log) sekaligus, lihat POST /produksi-rename-partname.
function OrphanPartNamesCard({ orphans, loading, partNameOptions, logout, showToast, onRenamed, readOnly }) {
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

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
        <AlertTriangle size={16} style={{ color: 'var(--yellow)' }} />
        Part Name Belum Terdaftar di Master Data {!loading && `(${orphans.length})`}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12 }}>
        Nama Part di bawah ini ada di data RC Harian Produksi tapi tidak cocok dengan Part Name mana pun yang sekarang ada di Master Data. Kalau cuma beda ejaan/sudah diganti nama: pilih Part Name Master Data yang benar lalu klik Ganti (menyamakan semua data historisnya). Kalau memang Part Name baru yang belum pernah didaftarkan: pilih Cluster lalu klik Buat Baru.
      </div>
      {loading ? (
        <Skeleton height={14} width="60%" />
      ) : orphans.length === 0 ? (
        <EmptyOk label="Semua Part Name di data RC Harian Produksi sudah terdaftar di Master Data." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {orphans.map((o) => (
            <div key={o.partName} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', flexWrap: 'wrap' }}>
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

              {!readOnly && (
                <>
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
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Baris Proses yang Mesin-nya (data lama, diketik manual sebelum Tabel
// Machine dipakai sebagai katalog "Semua Mesin") belum cocok satu pun
// baris di Machine -- Line Produksi baris ini juga ikut tidak akurat
// (dulu ikut ketikan manual, bukan dari Machine.line). Klik baris untuk
// lompat ke tabel Part Name & Proses di Master Data (kotak pencarian
// sudah terisi), lalu klik ikon pensil dan pilih Mesin yang benar dari
// dropdown (sudah tervalidasi ke Tabel Machine) -- koreksi sesungguhnya
// sengaja tetap manual oleh admin, bukan ditebak otomatis.
function MesinMismatchCard({ items, loading }) {
  const { navigateToPartProses } = useUI();
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
        <AlertTriangle size={16} style={{ color: 'var(--blue)' }} />
        Mesin/Line Belum Sesuai Tabel Machine {!loading && `(${items.length})`}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12 }}>
        Baris Proses di bawah ini Mesin-nya masih data lama (belum cocok dengan katalog "Semua Mesin"), jadi Line Produksi-nya juga ikut belum akurat. Klik salah satu untuk membuka Master Data &gt; Part Name &amp; Proses dengan baris ini sudah dicari, lalu klik ikon pensil dan pilih Mesin yang benar dari dropdown.
      </div>
      {loading ? (
        <Skeleton height={14} width="60%" />
      ) : items.length === 0 ? (
        <EmptyOk label="Semua baris Proses sudah pakai Mesin yang cocok dengan Tabel Machine." />
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {items.map((it) => (
            <button
              key={it.id}
              onClick={() => navigateToPartProses(it.partName)}
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
      )}
    </div>
  );
}

// Part Name yang Total OK Input Rejection-nya tidak akan pernah bisa
// terhitung: entah belum punya baris Proses sama sekali, atau sudah ada
// Proses tapi belum ada satu pun yang ditandai Proses Akhir/Finish --
// Total OK butuh itu buat tahu Proses mana yang jadi acuan jumlah OK.
// Klik nama Part Name untuk membuka Master Data (tambahkan Proses/tandai
// Proses Akhir lewat Edit), ATAU kalau ternyata baris ini cuma variasi
// ejaan dari Part Name lain yang sudah benar, gabungkan langsung lewat
// /master-part-name-merge tanpa perlu hapus manual satu-satu.
function MissingFinishCard({ items, loading, partNameOptions, logout, showToast, onMerged, readOnly }) {
  const { navigateToDataProduksi, navigateToPartProses } = useUI();
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

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
        <AlertTriangle size={16} style={{ color: 'var(--red)' }} />
        Part Name Belum Punya Proses Akhir/Finish {!loading && `(${items.length})`}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12 }}>
        Total OK di Input Rejection untuk Part Name di bawah ini akan selalu 0 sampai ini dibereskan. Kalau memang Part Name baru: klik namanya untuk membuka Master Data &gt; Part Name &amp; Proses dengan baris ini sudah dicari, lalu tambahkan Proses (kalau belum ada) atau buka Edit pada Proses yang benar dan centang Proses Akhir/Finish. Kalau ternyata cuma variasi ejaan dari Part Name lain yang sudah benar: pilih Part Name yang benar lalu Gabung.
      </div>
      {loading ? (
        <Skeleton height={14} width="60%" />
      ) : items.length === 0 ? (
        <EmptyOk label="Semua Part Name sudah punya Proses Akhir/Finish." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it) => (
            <div key={it.partName} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigateToPartProses(it.partName)}
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
              {!readOnly && (
                <>
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
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Part Name yang tidak punya Proses sama sekali DAN tidak dipakai data
// historis manapun (ProduksiHarian/Rejection/ProblemLog/Rework) -- sisa
// entri lama yang sudah diganti/dihapus dari data lapangan, bukan Part
// Name baru yang perlu dilengkapi. Beda dari MissingFinishCard yang
// khusus Part Name yang MASIH punya data tapi belum lengkap Proses
// Akhir-nya. Hapus dicek ulang di backend (/master-part-name-delete)
// supaya tidak bisa kehapus kalau ternyata masih ada datanya.
function UnusedPartNamesCard({ items, loading, logout, showToast, onDeleted, readOnly }) {
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

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
        <AlertTriangle size={16} style={{ color: 'var(--muted)' }} />
        Part Name Tidak Terpakai {!loading && `(${items.length})`}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12 }}>
        Part Name di bawah ini tidak punya Proses maupun data historis apa pun (Produksi/Rejection/Problem Log/Rework) -- biasanya sisa nama lama yang sudah diganti/dihapus, bukan bagian dari Data Produksi. Aman dihapus kalau memang bukan Part Name baru yang belum sempat dilengkapi.
      </div>
      {loading ? (
        <Skeleton height={14} width="60%" />
      ) : items.length === 0 ? (
        <EmptyOk label="Tidak ada Part Name yang menganggur." />
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {items.map((it) => (
            <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 6px 6px 10px' }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{it.partName}</span>
              <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>{it.cluster}</span>
              {!readOnly && (
                <button
                  disabled={busyId === it.id}
                  onClick={() => remove(it)}
                  className="btn"
                  style={{ flexShrink: 0, color: 'var(--red)', fontSize: 11.5, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
                  title="Hapus Part Name ini"
                >
                  <Trash2 size={12} /> {busyId === it.id ? 'Menghapus…' : 'Hapus'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DataValidasi() {
  const { logout, username } = useAuth();
  const readOnly = isReadOnlyUser(username);
  const showToast = useToast();

  const [partNames, setPartNames] = useState([]);
  const [orphans, setOrphans] = useState([]);
  const [orphanLoading, setOrphanLoading] = useState(true);
  const [missingFinish, setMissingFinish] = useState([]);
  const [missingFinishLoading, setMissingFinishLoading] = useState(true);
  const [unused, setUnused] = useState([]);
  const [unusedLoading, setUnusedLoading] = useState(true);
  const [mesinMismatch, setMesinMismatch] = useState([]);
  const [mesinMismatchLoading, setMesinMismatchLoading] = useState(true);

  const load = useCallback(() => {
    apiFetch('/master', { partNames: [] }, logout).then((d) => setPartNames(d.partNames || []));
    setOrphanLoading(true);
    apiFetch('/produksi-orphan-partnames', [], logout).then((d) => { setOrphans(d); setOrphanLoading(false); });
    setMissingFinishLoading(true);
    apiFetch('/master-partname-missing-finish', [], logout).then((d) => { setMissingFinish(d); setMissingFinishLoading(false); });
    setUnusedLoading(true);
    apiFetch('/master-partname-unused', [], logout).then((d) => { setUnused(d); setUnusedLoading(false); });
    setMesinMismatchLoading(true);
    apiFetch('/master-proses-mesin-mismatch', [], logout).then((d) => { setMesinMismatch(d); setMesinMismatchLoading(false); });
  }, [logout]);
  useEffect(() => { load(); }, [load]);

  const partNameOptions = partNames.map((p) => p.partName);
  const totalIssues = orphans.length + missingFinish.length + unused.length + mesinMismatch.length;
  const anyLoading = orphanLoading || missingFinishLoading || unusedLoading || mesinMismatchLoading;

  return (
    <div className="page-view active">
      <div className="page-header">
        <div>
          <div className="page-title">Validasi Data</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {anyLoading ? 'Memeriksa data…' : totalIssues === 0 ? 'Tidak ada masalah ditemukan.' : `${totalIssues} hal perlu dibereskan.`}
          </div>
        </div>
      </div>
      {readOnly && (
        <div style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', marginBottom: 16 }}>
          Mode lihat saja — akun ini tidak bisa mengubah data dari halaman ini.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <MesinMismatchCard items={mesinMismatch} loading={mesinMismatchLoading} />
        <MissingFinishCard
          items={missingFinish} loading={missingFinishLoading}
          partNameOptions={partNameOptions} logout={logout} showToast={showToast}
          onMerged={load} readOnly={readOnly}
        />
        <UnusedPartNamesCard
          items={unused} loading={unusedLoading}
          logout={logout} showToast={showToast} onDeleted={load} readOnly={readOnly}
        />
        <OrphanPartNamesCard
          orphans={orphans} loading={orphanLoading}
          partNameOptions={partNameOptions} logout={logout} showToast={showToast}
          onRenamed={load} readOnly={readOnly}
        />
      </div>
    </div>
  );
}
