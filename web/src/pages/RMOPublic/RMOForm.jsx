import Combobox from '../../components/Combobox.jsx';
import { FL, Panel, ComputedField, JENIS_PROBLEM_OPTS, inp, inpErr, inpRework, inpReject } from './shared.jsx';

/* ── Tab "Input" -- Laporan Harian Produksi (Grup Head/Input Produksi,
   Aktual Produksi, Downtime & Problem). Semua state/handler tetap di
   RMOPublic (index.jsx) -- komponen ini murni presentational. ────── */
export default function RMOForm({
  form, errors, set, pickGroupHead, pickPartName, pickProses, pickShift, toggleMesinInList,
  grupHeadOptionsRich, partNameOptionsRich, prosesOptionsRich, lineOptions, mesinOptionsRich, mesinOptionsForProses, manPowerOptions,
  master, plan, totalOk, totalProses, isManualMesin,
  handleFormKeyDown, formRef, busy, handleCancel, onSubmit,
}) {
  return (
    <div className="rc-form-wrap" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', padding: '14px 24px 12px', maxWidth: 1400, width: '100%', margin: '0 auto', boxSizing: 'border-box' }} onKeyDown={handleFormKeyDown}>

      <div style={{ flex: 1 }} ref={formRef}>

        <div style={{ textAlign: 'center', fontSize: 15, fontWeight: 800, color: '#0e5a52', marginBottom: 10, letterSpacing: '.01em' }}>
          LAPORAN HARIAN PRODUKSI
        </div>

        <div className="rc-2col">
          {/* ── Grup Head + Input Produksi (tanggal/waktu/shift) -- kiri-atas desktop, urutan pertama di HP ── */}
          <div className="rc-2col-grouphead group-box" style={{ marginTop: 0 }}>
            <span className="group-box-title">Grup Head &amp; Input Produksi</span>
            <div className="rc-grouphead-grid" style={{ display: 'grid', gap: '10px 20px' }}>
              <div>
                <FL>Nama Grup Head *</FL>
                <Combobox
                  style={errors.grupHead ? inpErr : inp}
                  value={form.grupHead}
                  options={grupHeadOptionsRich}
                  onChange={pickGroupHead}
                  placeholder="Ketik atau pilih Grup Head…"
                />
                {errors.grupHead && <div style={{ color: '#d9534f', fontSize: 12, marginTop: 5 }}>{errors.grupHead}</div>}
              </div>
              <ComputedField label="Cluster" value={form.cluster || '—'} />
              <div style={{ gridColumn: 'span 2' }}>
                <FL>Tanggal *</FL>
                <input type="date" style={inp} value={form.tanggal} onChange={(e) => set('tanggal', e.target.value)} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <FL>Waktu *</FL>
                <input type="time" style={inp} value={form.waktu} onChange={(e) => set('waktu', e.target.value)} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <FL>Shift *</FL>
                <select style={inp} value={form.shift} onChange={(e) => pickShift(e.target.value)}>
                  {master.shiftHours.map((s) => <option key={s.shift} value={s.shift}>{s.shift}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── Aktual Produksi (Part Name..Total Proses) -- kanan desktop (span 2 baris), urutan kedua di HP ── */}
          <Panel title="Aktual Produksi" tint="peach" gridClassName="rc-panel-grid-2" className="rc-2col-aktual">
            <div style={{ gridColumn: 'span 2' }}>
              <FL>No Lot</FL>
              <input type="text" style={inp} value={form.noLot} onChange={(e) => set('noLot', e.target.value)} />
            </div>

            <div>
              <FL>Part Name *</FL>
              <Combobox
                style={errors.partName ? inpErr : inp}
                value={form.partName}
                disabled={!form.cluster}
                options={partNameOptionsRich}
                onChange={pickPartName}
                placeholder={form.cluster ? 'Ketik atau pilih Part Name…' : 'Pilih Grup Head dulu'}
              />
            </div>
            <div>
              <FL>Proses *</FL>
              <Combobox
                style={errors.proses ? inpErr : inp}
                value={form.proses}
                disabled={!form.partName}
                options={prosesOptionsRich}
                onChange={pickProses}
                placeholder="Ketik atau pilih Proses…"
              />
            </div>
            <div>
              <FL>Line Produksi *</FL>
              <Combobox style={errors.line ? inpErr : inp} value={form.line} options={lineOptions} onChange={(v) => set('line', v)} placeholder="Ketik atau pilih Line…" />
            </div>
            <div>
              <FL
                error={errors.mesin}
                sub={mesinOptionsForProses.length > 1 ? `${mesinOptionsForProses.length} Mesin tercatat -- centang yang jalan` : undefined}
              >
                Mesin *
              </FL>
              {mesinOptionsForProses.length > 1 ? (
                // Proses ini punya lebih dari 1 Mesin tercatat di Master
                // Data -- semua tercentang otomatis (default: semua jalan
                // bareng), operator tinggal uncheck yang tidak jalan.
                // Submit akan fan-out jadi satu baris ProduksiHarian per
                // Mesin tercentang (lihat submit() di index.jsx).
                <div style={{ ...inp, height: 'auto', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 130, overflowY: 'auto', padding: '8px 10px' }}>
                  {mesinOptionsForProses.map((m) => (
                    <label key={m.value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.mesinList.includes(m.value)} onChange={() => toggleMesinInList(m.value)} />
                      {m.value}
                    </label>
                  ))}
                </div>
              ) : (
                // 0 atau 1 kandidat -- Combobox biasa. Kalau ada 1 kandidat
                // dari Proses ini, dropdown-nya dipersempit ke situ saja;
                // kalau tidak ada, jatuh balik ke katalog Mesin lengkap.
                <Combobox
                  style={errors.mesin ? inpErr : inp}
                  value={form.mesin}
                  options={mesinOptionsForProses.length > 0 ? mesinOptionsForProses : mesinOptionsRich}
                  onChange={(v) => set('mesin', v)}
                  placeholder="Ketik atau pilih Mesin…"
                />
              )}
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <FL>Man Power</FL>
              <Combobox style={inp} value={form.manPower} options={manPowerOptions} onChange={(v) => set('manPower', v)} placeholder="Ketik atau pilih Man Power…" />
            </div>
            <div>
              <FL>Cycle Time</FL>
              <input type="number" style={inp} value={form.cycleTime} onChange={(e) => set('cycleTime', e.target.value)} />
            </div>
            <div>
              <FL>Waktu Efektif</FL>
              <input type="number" style={inp} value={form.waktuEfektif} onChange={(e) => set('waktuEfektif', e.target.value)} />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <ComputedField label="Plan" value={plan.toLocaleString()} />
            </div>
            <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 20px' }}>
              <div>
                <FL>QTY Produksi OK</FL>
                <input type="number" style={inp} value={form.qtyOk} onChange={(e) => set('qtyOk', e.target.value)} />
              </div>
              <div>
                <FL>Rework</FL>
                <input type="number" style={inpRework} value={form.rwk} onChange={(e) => set('rwk', e.target.value)} />
              </div>
              <div>
                <FL>Reject</FL>
                <input type="number" style={inpReject} value={form.rjct} onChange={(e) => set('rjct', e.target.value)} />
              </div>
            </div>

            <ComputedField label="Total OK" value={totalOk.toLocaleString()} />
            <ComputedField label="Total Proses" value={totalProses.toLocaleString()} />
          </Panel>

          {/* ── Downtime & Problem -- kiri-bawah desktop, urutan ketiga (terakhir) di HP.
                 Root Cause sengaja tidak ada di sini -- diisi lewat menu Problem Produksi
                 sendiri (ProblemLogPage.jsx), bukan di form input harian ini. ── */}
          <Panel title="Downtime & Problem (opsional)" tint="gray" gridClassName="rc-panel-grid-3" className="rc-2col-problem" stretch>
            {/* Slot baris ini WAJIB selalu dirender (biar row-track grid
                stabil di 3 baris, lihat .rc-panel-grid-fill di index.css)
                -- isinya kosong/invisible kalau mode multi-Mesin tidak
                aktif, bukan di-skip total (kalau di-skip, item sesudahnya
                naik satu row lewat CSS Grid auto-flow, dan row 1fr yang
                harusnya buat Problem malah kepakai baris Jenis Problem/
                Loss Time/Breakdown Mesin -- baris itu jadi melar dengan
                ruang kosong ganjil di dalamnya). */}
            {form.mesinList.length > 1 ? (
              <div style={{ gridColumn: 'span 3' }}>
                <FL error={errors.problemMesin}>Mesin Problem</FL>
                <Combobox
                  style={errors.problemMesin ? inpErr : inp}
                  value={form.problemMesin}
                  options={form.mesinList}
                  onChange={(v) => set('problemMesin', v)}
                  placeholder="Pilih Mesin yang mengalami problem…"
                />
              </div>
            ) : (
              <div style={{ gridColumn: 'span 3', height: 0, overflow: 'hidden' }} aria-hidden="true" />
            )}
            <div>
              <FL error={errors.jenisProblem}>Jenis Problem</FL>
              <Combobox style={errors.jenisProblem ? inpErr : inp} value={form.jenisProblem} options={JENIS_PROBLEM_OPTS} onChange={(v) => set('jenisProblem', v)} placeholder="Ketik atau pilih Jenis Problem…" />
            </div>
            <div>
              <FL error={errors.lossTime}>Loss Time (menit)</FL>
              <input
                type="number"
                style={errors.lossTime ? inpErr : inp}
                value={form.lossTime}
                onChange={(e) => set('lossTime', e.target.value)}
                title={errors.lossTime ? 'Wajib diisi (atau isi Breakdown Mesin) begitu salah satu isian Downtime & Problem lain diisi' : undefined}
              />
            </div>
            <div>
              <FL error={!isManualMesin ? errors.breakdownMesin : undefined}>Breakdown Mesin (menit)</FL>
              <input
                type="number"
                style={isManualMesin ? { ...inp, opacity: .6, cursor: 'not-allowed' } : (errors.breakdownMesin ? inpErr : inp)}
                value={isManualMesin ? 0 : form.breakdownMesin}
                disabled={isManualMesin}
                onChange={(e) => set('breakdownMesin', e.target.value)}
                title={errors.breakdownMesin ? 'Wajib diisi (atau isi Loss Time) begitu salah satu isian Downtime & Problem lain diisi' : undefined}
              />
              {isManualMesin && (
                <div style={{ color: '#5a6b73', fontSize: 11, marginTop: 4 }}>Mesin "Manual" — Breakdown Mesin tidak berlaku.</div>
              )}
            </div>
            {/* justifyContent di-override flex-start juga (sama seperti sel
                Problem di sampingnya) -- kalau dibiarkan flex-end bawaan
                .rc-panel-grid-3 > div, label+input ini akan "mengambang" di
                bagian bawah sel yang sekarang tinggi (row 1fr, ikut
                Problem), nyisa jarak kosong aneh di atasnya. */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', height: '100%' }}>
              <FL error={errors.dueDate}>Due Date</FL>
              <input type="date" style={errors.dueDate ? inpErr : inp} value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
            </div>
            {/* justifyContent di-override flex-start (bukan flex-end bawaan
                .rc-panel-grid-3 > div) supaya label tetap di atas dan
                textarea-nya yang tumbuh mengisi sisa tinggi ke bawah. */}
            <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', height: '100%' }}>
              <FL error={errors.problem}>Problem</FL>
              <textarea style={{ ...inp, flex: 1, minHeight: 70, resize: 'vertical', ...(errors.problem ? { borderColor: '#d9534f' } : {}) }} value={form.problem} onChange={(e) => set('problem', e.target.value)} placeholder="Isi jika ada masalah" />
            </div>
          </Panel>
        </div>

      </div>

      {/* ── Footer ──────────────────────────────────── */}
      <div style={{ flexShrink: 0, paddingTop: 16, borderTop: '1px solid #c9d4d4', marginTop: 16, display: 'flex', gap: 12 }}>
        <button
          style={{ flex: '0 0 auto', padding: '13px 28px', fontSize: 15, borderRadius: 8, background: '#eef2f2', border: '1px solid #c9d4d4', cursor: 'pointer', fontWeight: 600 }}
          onClick={handleCancel}>
          Batal
        </button>
        <button
          style={{ flex: 1, padding: '13px', fontSize: 15, borderRadius: 8, color: '#fff', background: '#0e5a52', border: 'none', cursor: 'pointer', fontWeight: 700 }}
          disabled={busy} onClick={() => onSubmit()}>
          {busy ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>

    </div>
  );
}
