import Combobox from '../../components/Combobox.jsx';
import { FL, Panel, inp, inpErr } from './shared.jsx';

/* ── Tab "Overtime" -- LAPORAN OVERTIME PRODUKSI. State/handler tetap
   di RMOPublic (index.jsx), komponen ini murni presentational. ───── */
export default function OvertimeForm({
  otForm, otErrors, setOt, otManPowerOptionsRich, pickOtManPower,
  otBusy, handleOtCancel, onSubmit,
}) {
  return (
    <div className="rc-form-wrap" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', padding: '20px 40px 16px', maxWidth: 800, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
      <div style={{ flex: 1 }}>
        <div style={{ textAlign: 'center', fontSize: 17, fontWeight: 800, color: '#0e5a52', marginBottom: 16, letterSpacing: '.01em' }}>
          LAPORAN OVERTIME PRODUKSI
        </div>
        <Panel title="Input Overtime" tint="cyan">
          <div>
            <FL>Tanggal *</FL>
            <input type="date" style={inp} value={otForm.tanggal} onChange={(e) => setOt('tanggal', e.target.value)} />
          </div>
          <div>
            <FL>Waktu *</FL>
            <input type="time" style={inp} value={otForm.waktu} onChange={(e) => setOt('waktu', e.target.value)} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <FL>Man Power *</FL>
            <Combobox
              style={otErrors.manPower ? inpErr : inp}
              value={otForm.manPower}
              options={otManPowerOptionsRich}
              onChange={pickOtManPower}
              placeholder="Ketik atau pilih Man Power…"
            />
            {otErrors.manPower && <div style={{ color: '#d9534f', fontSize: 12, marginTop: 5 }}>{otErrors.manPower}</div>}
          </div>

          <div>
            <FL>Durasi Lembur (jam) *</FL>
            <input type="number" style={inp} value={otForm.durasiJam} onChange={(e) => setOt('durasiJam', e.target.value)} />
          </div>
          <div style={{ gridColumn: 'span 3' }}>
            <FL>Keterangan</FL>
            <input type="text" style={inp} value={otForm.keterangan} onChange={(e) => setOt('keterangan', e.target.value)} placeholder="Catatan tambahan (opsional)" />
          </div>
        </Panel>
      </div>

      <div style={{ flexShrink: 0, paddingTop: 16, borderTop: '1px solid #c9d4d4', marginTop: 16, display: 'flex', gap: 12 }}>
        <button
          style={{ flex: '0 0 auto', padding: '13px 28px', fontSize: 15, borderRadius: 8, background: '#eef2f2', border: '1px solid #c9d4d4', cursor: 'pointer', fontWeight: 600 }}
          onClick={handleOtCancel}>
          Batal
        </button>
        <button
          style={{ flex: 1, padding: '13px', fontSize: 15, borderRadius: 8, color: '#fff', background: '#0e5a52', border: 'none', cursor: 'pointer', fontWeight: 700 }}
          disabled={otBusy} onClick={onSubmit}>
          {otBusy ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </div>
  );
}
