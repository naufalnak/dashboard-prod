import Combobox from '../../components/Combobox.jsx';
import { FL, Panel, ComputedField, previewNoLotRework, inp, inpErr, inpRework, inpReject } from './shared.jsx';

/* ── Tab "Rework" -- DATA PENGERJAAN PART REWORK. State/handler tetap
   di RMOPublic (index.jsx), komponen ini murni presentational. ───── */
export default function ReworkForm({
  rwForm, rwErrors, setRw, rwPartNameOptionsRich, pickRwPartName,
  rwGroupHeadOptionsRich, pickRwGroupHead, rwCluster, mesinOptionsRich,
  rwBusy, handleRwCancel, onSubmit,
}) {
  return (
    <div className="rc-form-wrap" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', padding: '20px 40px 16px', maxWidth: 800, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
      <div style={{ flex: 1 }}>
        <div style={{ textAlign: 'center', fontSize: 17, fontWeight: 800, color: '#0e5a52', marginBottom: 16, letterSpacing: '.01em' }}>
          DATA PENGERJAAN PART REWORK
        </div>
        <Panel title="Pengerjaan Rework" tint="peach">
          <div>
            <FL>Tanggal Ditemukan *</FL>
            <input type="date" style={inp} value={rwForm.tanggalDitemukan} onChange={(e) => setRw('tanggalDitemukan', e.target.value)} />
          </div>
          <div>
            <FL>No Lot Original</FL>
            <input type="text" style={inp} value={rwForm.noLotOriginal} onChange={(e) => setRw('noLotOriginal', e.target.value)} />
          </div>
          <div>
            <FL>Tanggal Repair *</FL>
            <input type="date" style={inp} value={rwForm.tanggalRepair} onChange={(e) => setRw('tanggalRepair', e.target.value)} />
          </div>
          <ComputedField label="No Lot Rework" value={previewNoLotRework(rwForm.tanggalRepair)} />

          <div style={{ gridColumn: 'span 2' }}>
            <FL>Nama Part *</FL>
            <Combobox
              style={rwErrors.partName ? inpErr : inp}
              value={rwForm.partName}
              options={rwPartNameOptionsRich}
              onChange={pickRwPartName}
              placeholder="Ketik atau pilih Part Name…"
            />
            {rwErrors.partName && <div style={{ color: '#d9534f', fontSize: 12, marginTop: 5 }}>{rwErrors.partName}</div>}
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <FL>Grup Head *</FL>
            <Combobox
              style={rwErrors.grupHead ? inpErr : inp}
              value={rwForm.grupHead}
              options={rwGroupHeadOptionsRich}
              onChange={pickRwGroupHead}
              placeholder="Ketik atau pilih Grup Head…"
            />
            {rwErrors.grupHead && <div style={{ color: '#d9534f', fontSize: 12, marginTop: 5 }}>{rwErrors.grupHead}</div>}
          </div>
          <ComputedField label="Cluster" value={rwCluster || '—'} />
          <div />

          <div>
            <FL>Kriteria Rework</FL>
            <input type="text" style={inp} value={rwForm.kriteriaRework} onChange={(e) => setRw('kriteriaRework', e.target.value)} />
          </div>
          <div>
            <FL>Metode Rework</FL>
            <input type="text" style={inp} value={rwForm.metodeRework} onChange={(e) => setRw('metodeRework', e.target.value)} />
          </div>
          <div>
            <FL>Mesin</FL>
            <Combobox style={inp} value={rwForm.mesin} options={mesinOptionsRich} onChange={(v) => setRw('mesin', v)} placeholder="Ketik atau pilih Mesin…" />
          </div>
          <div>
            <FL>PIC Rework</FL>
            <input type="text" style={inp} value={rwForm.picRework} onChange={(e) => setRw('picRework', e.target.value)} />
          </div>

          <div>
            <FL>Total Rework (pcs)</FL>
            <input type="number" style={inpRework} value={rwForm.totalRework} onChange={(e) => setRw('totalRework', e.target.value)} />
          </div>
          <div>
            <FL>Total OK (pcs)</FL>
            <input type="number" style={inp} value={rwForm.totalOk} onChange={(e) => setRw('totalOk', e.target.value)} />
          </div>
          <div>
            <FL>Total Reject (pcs)</FL>
            <input type="number" style={inpReject} value={rwForm.totalReject} onChange={(e) => setRw('totalReject', e.target.value)} />
          </div>
          <div />
        </Panel>

        <Panel title="Hasil Pemeriksaan" tint="gray">
          <div>
            <FL>Metode Check</FL>
            <input type="text" style={inp} value={rwForm.metodeCheck} onChange={(e) => setRw('metodeCheck', e.target.value)} />
          </div>
          <div>
            <FL>Tanggal Check</FL>
            <input type="date" style={inp} value={rwForm.tanggalCheck} onChange={(e) => setRw('tanggalCheck', e.target.value)} />
          </div>
          <div>
            <FL>PIC Check</FL>
            <input type="text" style={inp} value={rwForm.picCheck} onChange={(e) => setRw('picCheck', e.target.value)} />
          </div>
        </Panel>
      </div>

      <div style={{ flexShrink: 0, paddingTop: 16, borderTop: '1px solid #c9d4d4', marginTop: 16, display: 'flex', gap: 12 }}>
        <button
          style={{ flex: '0 0 auto', padding: '13px 28px', fontSize: 15, borderRadius: 8, background: '#eef2f2', border: '1px solid #c9d4d4', cursor: 'pointer', fontWeight: 600 }}
          onClick={handleRwCancel}>
          Batal
        </button>
        <button
          style={{ flex: 1, padding: '13px', fontSize: 15, borderRadius: 8, color: '#fff', background: '#0e5a52', border: 'none', cursor: 'pointer', fontWeight: 700 }}
          disabled={rwBusy} onClick={onSubmit}>
          {rwBusy ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </div>
  );
}
