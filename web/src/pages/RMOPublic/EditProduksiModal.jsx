import { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import Combobox from '../../components/Combobox.jsx';
import { API, FL, EDIT_INP, EDIT_INP_LOCKED } from './shared.jsx';

/* ── Edit baris Data Produksi langsung dari /rmo -- Grup Head yang login
   cuma boleh mengedit baris cluster-nya sendiri (dipaksa juga di backend,
   lihat assertClusterAccess di src/routes/api.js). Field & rumus (Plan,
   Cycle Time ikut Master Data) sama seperti EditProduksiModal di menu
   Data Produksi dashboard utama, tapi berdiri sendiri (fetch pakai token
   Bearer manual) karena RMOPublic tidak punya AuthContext/ToastContext. */
export default function EditProduksiModal({ row, master, token, onClose, onSaved }) {
  const [form, setForm] = useState({
    tanggal: row.tanggal, shift: row.shift, noLot: row.noLot || '',
    manPower: row.manPower || '',
    partName: row.partName, proses: row.proses, line: row.line, mesin: row.mesin,
    waktuEfektif: row.waktuEfektif,
    totalOk: row.ok1 + row.ok2, rework: row.rework, reject: row.reject,
    breakdownMesin: row.breakdownMesin, lostTime: row.lostTime, keterangan: row.keterangan || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  const partNameOptions = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const p of master.proses) {
      if (p.cluster !== row.cluster) continue;
      const key = p.partName.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(p.partName);
    }
    return result.sort((a, b) => a.localeCompare(b));
  }, [master.proses, row.cluster]);

  // Satu Proses boleh punya lebih dari satu baris Master Data (satu per
  // pilihan Mesin) -- dedupe ke satu entri per nama Proses supaya
  // dropdown-nya tidak menampilkan nama yang sama berulang kali (dulu
  // "Profil" misalnya bisa muncul 5x, satu per Mesin, tanpa ada beda
  // yang kelihatan karena opsi di sini teks polos bukan objek rich).
  const prosesRowsForPartName = useMemo(
    () => master.proses.filter((p) => p.partName === form.partName && p.cluster === row.cluster),
    [master.proses, form.partName, row.cluster],
  );
  const prosesOptions = useMemo(
    () => [...new Set(prosesRowsForPartName.map((p) => p.proses))].sort((a, b) => a.localeCompare(b)),
    [prosesRowsForPartName],
  );
  const prosesRowsForSelected = useMemo(
    () => prosesRowsForPartName.filter((p) => p.proses === form.proses),
    [prosesRowsForPartName, form.proses],
  );
  const prosesMatch = prosesRowsForSelected[0];
  const cycleTime = prosesMatch ? prosesMatch.cycleTime : row.cycleTime;
  // Kandidat Mesin buat Proses yang lagi dipilih -- kalau > 1, field
  // Mesin di bawah jadi dropdown terbatas ke pilihan ini saja.
  const mesinOptionsForProses = useMemo(
    () => [...new Set(prosesRowsForSelected.map((p) => p.mesin).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [prosesRowsForSelected],
  );

  function pickPartName(partName) { setForm((f) => ({ ...f, partName, proses: '', line: '', mesin: '' })); }
  function pickProses(prosesName) {
    const rows = prosesRowsForPartName.filter((p) => p.proses === prosesName);
    const match = rows[0];
    const mesinCandidates = [...new Set(rows.map((r) => r.mesin).filter(Boolean))];
    setForm((f) => ({ ...f, proses: prosesName, line: match?.line || f.line, mesin: mesinCandidates.length === 1 ? mesinCandidates[0] : '' }));
  }

  const lineOptions = useMemo(
    () => [...new Set(master.proses.map((p) => p.line).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [master.proses],
  );
  const mesinOptions = useMemo(
    () => [...new Set(master.proses.map((p) => p.mesin).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [master.proses],
  );

  const plan = useMemo(() => {
    const ct = Number(cycleTime) || 0;
    const we = Number(form.waktuEfektif) || 0;
    if (!ct || !we) return 0;
    return Math.round(((3600 * we * 0.9) / ct) / 10) * 10;
  }, [cycleTime, form.waktuEfektif]);

  const manPowerOptions = useMemo(
    () => master.manPower.filter((m) => m.groupHead === row.grupHead).map((m) => m.name).sort((a, b) => a.localeCompare(b)),
    [master.manPower, row.grupHead],
  );

  // Mesin "Manual" = Proses tidak pakai mesin -- Breakdown Mesin dikunci
  // 0, sama pola dengan RMOForm.jsx (form Input) & EditProduksiModal di
  // Data Produksi dashboard utama.
  const isManualMesin = form.mesin.trim().toLowerCase() === 'manual';

  async function save() {
    if (!form.partName.trim() || !form.proses.trim() || !form.line.trim() || !form.mesin.trim()) {
      setError('Part Name, Proses, Line, dan Mesin wajib diisi');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await fetch(`${API}/produksi-harian-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          id: row.id,
          tanggal: form.tanggal, shift: form.shift, no_lot: form.noLot,
          part_name: form.partName, proses: form.proses, line: form.line, mesin: form.mesin,
          man_power: form.manPower,
          cycle_time: cycleTime, waktu_efektif: form.waktuEfektif,
          plan, ok1: form.totalOk, ok2: 0, rwk: form.rework, rjct: form.reject,
          breakdown_mesin: form.breakdownMesin, lost_time: form.lostTime, keterangan: form.keterangan,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Gagal menyimpan');
      onSaved();
      onClose();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: '#fff', border: '1px solid #d7e0e0', borderRadius: 12, padding: '24px 22px', maxWidth: 560, width: '100%', maxHeight: '90vh', overflow: 'auto', boxSizing: 'border-box' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#1c2b2b' }}>Edit — {row.partName}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5a6b73', display: 'flex' }}><X size={20} /></button>
        </div>
        <div style={{ fontSize: 12, color: '#5a6b73', marginBottom: 16 }}>
          Cluster <strong>{row.cluster}</strong> — Part Name/Proses belum ada di daftar? Hubungi admin untuk ditambahkan lewat Master Data.
        </div>

        {error && <div style={{ color: '#d9534f', fontSize: 12.5, marginBottom: 14 }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <FL>Tanggal</FL>
            <input type="date" style={EDIT_INP} value={form.tanggal} onChange={(e) => set('tanggal', e.target.value)} />
          </div>
          <div>
            <FL>Shift</FL>
            <select style={EDIT_INP} value={form.shift} onChange={(e) => set('shift', e.target.value)}>
              {master.shiftHours.map((s) => <option key={s.shift} value={s.shift}>{s.shift}</option>)}
            </select>
          </div>
          <div>
            <FL>No Lot</FL>
            <input style={EDIT_INP} value={form.noLot} onChange={(e) => set('noLot', e.target.value)} />
          </div>
          <div>
            <FL>Man Power</FL>
            <Combobox style={EDIT_INP} value={form.manPower} options={manPowerOptions} onChange={(v) => set('manPower', v)} placeholder="Pilih Man Power…" />
          </div>
          <div>
            <FL>Part Name</FL>
            <Combobox style={EDIT_INP} value={form.partName} options={partNameOptions} onChange={pickPartName} placeholder="Pilih Part Name…" />
          </div>
          <div>
            <FL>Proses</FL>
            <Combobox style={EDIT_INP} value={form.proses} options={prosesOptions} onChange={pickProses} placeholder={form.partName ? 'Pilih Proses…' : 'Pilih Part Name dulu'} />
          </div>
          <div>
            <FL>Line Produksi</FL>
            <Combobox style={EDIT_INP} value={form.line} options={lineOptions} onChange={(v) => set('line', v)} placeholder="Ketik atau pilih Line…" />
          </div>
          <div>
            <FL>Mesin</FL>
            <Combobox
              style={EDIT_INP}
              value={form.mesin}
              options={mesinOptionsForProses.length > 0 ? mesinOptionsForProses : mesinOptions}
              onChange={(v) => set('mesin', v)}
              placeholder="Ketik atau pilih Mesin…"
            />
          </div>
          <div>
            <FL>Cycle Time</FL>
            <input type="number" style={EDIT_INP_LOCKED} value={cycleTime} disabled title="Cycle Time otomatis ikut Master Data untuk Proses yang dipilih" />
          </div>
          <div>
            <FL>Waktu Efektif</FL>
            <input type="number" style={EDIT_INP} value={form.waktuEfektif} onChange={(e) => set('waktuEfektif', e.target.value)} />
          </div>
          <div>
            <FL>Plan</FL>
            <input type="number" style={EDIT_INP_LOCKED} value={plan} disabled title="Plan otomatis dari Cycle Time × Waktu Efektif" />
          </div>
          <div>
            <FL>Total OK</FL>
            <input type="number" style={EDIT_INP} value={form.totalOk} onChange={(e) => set('totalOk', e.target.value)} />
          </div>
          <div>
            <FL>Rework</FL>
            <input type="number" style={EDIT_INP} value={form.rework} onChange={(e) => set('rework', e.target.value)} />
          </div>
          <div>
            <FL>Reject</FL>
            <input type="number" style={EDIT_INP} value={form.reject} onChange={(e) => set('reject', e.target.value)} />
          </div>
          <div>
            <FL>Breakdown Mesin (menit)</FL>
            <input
              type="number"
              style={isManualMesin ? { ...EDIT_INP, opacity: .6, cursor: 'not-allowed' } : EDIT_INP}
              value={isManualMesin ? 0 : form.breakdownMesin}
              disabled={isManualMesin}
              onChange={(e) => set('breakdownMesin', e.target.value)}
            />
            {isManualMesin && (
              <div style={{ color: '#5a6b73', fontSize: 11, marginTop: 4 }}>Mesin "Manual" — Breakdown Mesin tidak berlaku.</div>
            )}
          </div>
          <div>
            <FL>Lost Time (menit)</FL>
            <input type="number" style={EDIT_INP} value={form.lostTime} onChange={(e) => set('lostTime', e.target.value)} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <FL>Keterangan</FL>
            <textarea style={{ ...EDIT_INP, minHeight: 60, resize: 'vertical' }} value={form.keterangan} onChange={(e) => set('keterangan', e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button disabled={busy} onClick={save} style={{ flex: 1, padding: '11px', fontSize: 14, background: '#0e5a52', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 600 }}>
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', fontSize: 14, background: '#eef2f2', border: '1px solid #c9d4d4', borderRadius: 7, cursor: 'pointer', fontWeight: 600 }}>
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
