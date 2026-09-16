import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Upload } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useUI } from '../../contexts/UIContext.jsx';
import { isReadOnlyUser, canAccessPartProses } from '../../roles.js';
import { apiFetch, apiSendForm } from '../../api.js';
import { useToast } from '../../contexts/ToastContext.jsx';
import { CLUSTERS } from './shared.jsx';
import RingkasanTab from './RingkasanTab.jsx';
import GroupHeadTab from './GroupHeadTab.jsx';
import PartProsesTab from './PartProsesTab.jsx';
import PartProsesLock from './PartProsesLock.jsx';
import KriteriaNgTab from './KriteriaNgTab.jsx';
import OvertimeTargetTab from './OvertimeTargetTab.jsx';
import ShiftHoursTab from './ShiftHoursTab.jsx';

const TABS = [
  { key: 'ringkasan', label: 'Ringkasan' },
  { key: 'groupHeadManPower', label: 'Grup Head & Man Power' },
  { key: 'partProses', label: 'Part Name & Proses' },
  { key: 'kriteriaNg', label: 'Kriteria NG' },
  { key: 'overtimeTarget', label: 'Target Overtime' },
  { key: 'shiftHours', label: 'Shift' },
];

export default function MasterData() {
  const { logout, username } = useAuth();
  const readOnly = isReadOnlyUser(username);
  const canPartProses = canAccessPartProses(username);
  // Tetap terkunci sampai password login berhasil diverifikasi ulang lewat
  // POST /unlock-part-proses (lihat PartProsesLock.jsx) -- reset tiap
  // halaman ini dimuat ulang (state React biasa, sengaja TIDAK disimpan
  // ke localStorage/sessionStorage supaya kuncinya benar-benar berarti).
  const [partProsesUnlocked, setPartProsesUnlocked] = useState(false);
  // Tab ini disembunyikan sama sekali dari akun di luar
  // PART_PROSES_USERNAMES (lihat roles.js) -- bukan cuma dikunci.
  const visibleTabs = useMemo(() => TABS.filter((t) => t.key !== 'partProses' || canPartProses), [canPartProses]);
  const { masterDataTab, setMasterDataTab } = useUI();
  const showToast = useToast();
  const [tab, setTab] = useState('ringkasan');

  // Navigasi dari halaman lain (mis. tombol "Ke Master Data" di modal Edit
  // Data Produksi) bisa langsung menuju tab tertentu lewat UIContext,
  // bukan selalu jatuh ke tab Ringkasan default.
  useEffect(() => {
    if (!masterDataTab) return;
    setTab(masterDataTab);
    setMasterDataTab('');
  }, [masterDataTab, setMasterDataTab]);
  const [master, setMaster] = useState({ clusters: CLUSTERS, groupHeads: [], partNames: [], proses: [], manPower: [], kriteriaNg: [], overtimeTargets: [], shiftHours: [] });
  const [legacy, setLegacy] = useState({ manPower: [], mesin: [], proses: [], partNames: [] });
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch('/master', { clusters: CLUSTERS, groupHeads: [], partNames: [], proses: [], manPower: [], kriteriaNg: [], overtimeTargets: [], shiftHours: [] }, logout)
      .then((d) => { setMaster(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [logout]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    apiFetch('/legacy-lookups', { manPower: [], mesin: [], proses: [], partNames: [] }, logout).then(setLegacy);
  }, [logout]);

  // Gabungan Group Head -> Cluster -> Part Name -> Proses (+Cycle Time,
  // Line/Mesin) jadi satu tabel, tanpa mengubah cara data disimpan (tetap
  // 3 tabel terpisah supaya edit satu tempat tidak perlu ubah banyak baris
  // berulang). Baris terkecil = tiap Proses; join ke atas by
  // cluster/partName. Man Power sengaja tidak ikut di sini -- sekarang
  // dikelola lewat roster Grup Head, bukan per baris Proses lagi.
  const ringkasanRows = useMemo(() => {
    return master.proses.map((p) => {
      // Cluster dibaca dari baris Proses-nya sendiri (bukan join ke
      // MasterPartName) supaya konsisten dengan tab Part Name & Proses --
      // tiap baris Proses independen, bisa beda Cluster dari Part Name
      // lain yang kebetulan namanya sama.
      const cluster = p.cluster || '';
      const groupHeads = master.groupHeads.filter((g) => g.cluster === cluster).map((g) => g.name);
      return {
        key: p.id,
        groupHead: groupHeads.join(', ') || '—',
        cluster: cluster || '—',
        partName: p.partName,
        cycleTime: p.cycleTime,
        proses: p.proses,
        line: p.line,
        mesin: p.mesin,
      };
    });
  }, [master]);

  async function handleImport(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await apiSendForm('/master-import', fd, logout);
      showToast(`Import selesai: ${data.groupHeads} grup head, ${data.partNames} part, ${data.proses} proses (${data.skipped} dilewati)`, 'green');
      load();
    } catch (err) { showToast(err.message, 'red'); }
  }

  return (
    <div className="page-view active">
      <div className="page-header">
        <div>
          <div className="page-title">Master Data</div>
        </div>
        {!readOnly && (
          <div className="header-actions">
            <button className="btn" onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} /> Import CSV
            </button>
            <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
          </div>
        )}
      </div>
      {readOnly && (
        <div style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--s2)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', marginBottom: 16 }}>
          Mode lihat saja — akun ini tidak bisa menambah, mengubah, atau menghapus data Master Data.
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {visibleTabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '9px 16px', fontSize: 13, fontWeight: tab === t.key ? 700 : 400,
              background: 'none', border: 'none', cursor: 'pointer',
              color: tab === t.key ? 'var(--accent)' : 'var(--muted)',
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ringkasan' && <RingkasanTab rows={ringkasanRows} loading={loading} />}
      {tab === 'groupHeadManPower' && (
        <GroupHeadTab
          data={master.groupHeads} manPower={master.manPower}
          loading={loading} onChanged={load} logout={logout} readOnly={readOnly}
        />
      )}
      {tab === 'partProses' && (
        !canPartProses ? (
          // Bisa kejangkau lewat navigateToPartProses dari halaman Validasi
          // Data (akun apa pun boleh buka Validasi Data) -- akun yang bukan
          // PART_PROSES_USERNAMES ditahan di sini, bukan cuma disembunyikan
          // tombol tabnya.
          <div className="card" style={{ fontSize: 12.5, color: 'var(--muted)' }}>
            Akun ini tidak punya akses ke Part Name & Proses.
          </div>
        ) : !partProsesUnlocked ? (
          <PartProsesLock onUnlocked={() => setPartProsesUnlocked(true)} />
        ) : (
          <PartProsesTab
            proses={master.proses} partNames={master.partNames}
            loading={loading} onChanged={load} logout={logout} legacy={legacy} readOnly={readOnly}
          />
        )
      )}
      {tab === 'kriteriaNg' && (
        <KriteriaNgTab data={master.kriteriaNg} loading={loading} onChanged={load} logout={logout} readOnly={readOnly} />
      )}
      {tab === 'overtimeTarget' && (
        <OvertimeTargetTab data={master.overtimeTargets} loading={loading} onChanged={load} logout={logout} readOnly={readOnly} />
      )}
      {tab === 'shiftHours' && (
        <ShiftHoursTab data={master.shiftHours} loading={loading} onChanged={load} logout={logout} readOnly={readOnly} />
      )}
    </div>
  );
}
