import Combobox from '../../components/Combobox.jsx';
import { FL, Panel, ComputedField, inp, inpErr, inpReject } from './shared.jsx';

/* ── Tab "Input Rejection" -- LAPORAN LMR. State/handler tetap di
   RMOPublic (index.jsx), komponen ini murni presentational. ──────── */
export default function RejectionForm({
  rejForm, rejErrors, setRej, pickRejPartName, rejPartNameOptionsRich,
  rejCluster, rejTotalOk, rejAutoOk, rejTotalProses, rejRatio, master,
  rejBusy, handleRejCancel, onSubmit,
}) {
  return (
    <div className="rc-form-wrap" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', padding: '20px 40px 16px', maxWidth: 800, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
      <div style={{ flex: 1 }}>
        <div style={{ textAlign: 'center', fontSize: 17, fontWeight: 800, color: '#0e5a52', marginBottom: 16, letterSpacing: '.01em' }}>
          LAPORAN LMR
        </div>
        <Panel title="Input Rejection" tint="peach">
          <div>
            <FL>Tanggal *</FL>
            <input type="date" style={inp} value={rejForm.tanggal} onChange={(e) => setRej('tanggal', e.target.value)} />
          </div>
          <div>
            <FL>Waktu *</FL>
            <input type="time" style={inp} value={rejForm.waktu} onChange={(e) => setRej('waktu', e.target.value)} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <FL>Part Name *</FL>
            <Combobox
              style={rejErrors.partName ? inpErr : inp}
              value={rejForm.partName}
              options={rejPartNameOptionsRich}
              onChange={pickRejPartName}
              placeholder="Ketik atau pilih Part Name…"
            />
            {rejErrors.partName && <div style={{ color: '#d9534f', fontSize: 12, marginTop: 5 }}>{rejErrors.partName}</div>}
          </div>

          <ComputedField label="Cluster" value={rejCluster || '—'} />
          <div>
            <ComputedField label="Total OK (pcs)" value={rejTotalOk.toLocaleString()} />
            {rejForm.partName && !rejAutoOk.hasFinishProses && (
              <div style={{ color: '#c07c00', fontSize: 11, marginTop: 5 }}>
                Part Name ini belum punya Proses Akhir di Master Data — Total OK akan 0.
              </div>
            )}
          </div>
          <div />
          <div />

          <div>
            <FL>Total LMR (pcs)</FL>
            <input type="number" style={inpReject} value={rejForm.totalLmr} onChange={(e) => setRej('totalLmr', e.target.value)} />
          </div>
          <ComputedField label="Total Proses" value={rejTotalProses.toLocaleString()} />
          <ComputedField label="Reject Ratio" value={`${rejRatio}%`} />
          <div />

          <div>
            <FL>Kriteria NG</FL>
            <Combobox style={inp} value={rejForm.kriteriaNg} options={master.kriteriaNg.map((k) => k.nama)} onChange={(v) => setRej('kriteriaNg', v)} placeholder="Ketik atau pilih Kriteria NG…" />
          </div>
          <div style={{ gridColumn: 'span 3' }}>
            <FL>Keterangan</FL>
            <input type="text" style={inp} value={rejForm.keterangan} onChange={(e) => setRej('keterangan', e.target.value)} placeholder="Catatan tambahan (opsional)" />
          </div>
        </Panel>
      </div>

      <div style={{ flexShrink: 0, paddingTop: 16, borderTop: '1px solid #c9d4d4', marginTop: 16, display: 'flex', gap: 12 }}>
        <button
          style={{ flex: '0 0 auto', padding: '13px 28px', fontSize: 15, borderRadius: 8, background: '#eef2f2', border: '1px solid #c9d4d4', cursor: 'pointer', fontWeight: 600 }}
          onClick={handleRejCancel}>
          Batal
        </button>
        <button
          style={{ flex: 1, padding: '13px', fontSize: 15, borderRadius: 8, color: '#fff', background: '#0e5a52', border: 'none', cursor: 'pointer', fontWeight: 700 }}
          disabled={rejBusy} onClick={onSubmit}>
          {rejBusy ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </div>
  );
}
