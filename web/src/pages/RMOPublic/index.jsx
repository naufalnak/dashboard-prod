import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AlertTriangle, Maximize2, Minimize2, Table2, PencilLine, Menu, X, Clock, Wrench } from 'lucide-react';
import { formatDateTimeIDParts } from '../../dateFmt.js';
import {
  API, SHIFTS, todayStr, num, nowTimeStr, defaultWaktuEfektifFor,
  EMPTY_FORM, EMPTY_MASTER, EMPTY_REJ_FORM, EMPTY_OT_FORM, EMPTY_RW_FORM,
  DP_AUTH_KEY, loadDpAuth,
} from './shared.jsx';
import SuccessView from './SuccessView.jsx';
import CancelModal from './CancelModal.jsx';
import RejSuccessView from './RejSuccessView.jsx';
import OtSuccessView from './OtSuccessView.jsx';
import RwSuccessView from './RwSuccessView.jsx';
import DataProduksiLogin from './DataProduksiLogin.jsx';
import DataProduksiView from './DataProduksiView.jsx';
import RMOForm from './RMOForm.jsx';
import RejectionForm from './RejectionForm.jsx';
import OvertimeForm from './OvertimeForm.jsx';
import ReworkForm from './ReworkForm.jsx';

/* ── Halaman utama ──────────────────────────────────── */
export default function RMOPublic() {
  const [tab, setTab]                   = useState('input'); // input | table
  const [master, setMaster]             = useState(EMPTY_MASTER);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [busy, setBusy]                 = useState(false);
  const [errors, setErrors]             = useState({});
  const [done, setDone]                 = useState(null);
  const [doneMetrics, setDoneMetrics]   = useState(null);
  const [cancelWarn, setCancelWarn]     = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dpAuth, setDpAuth]             = useState(() => loadDpAuth());
  const [rejForm, setRejForm]           = useState(EMPTY_REJ_FORM);
  const [rejErrors, setRejErrors]       = useState({});
  const [rejBusy, setRejBusy]           = useState(false);
  const [rejDone, setRejDone]           = useState(null);
  const [otForm, setOtForm]             = useState(EMPTY_OT_FORM);
  const [otErrors, setOtErrors]         = useState({});
  const [otBusy, setOtBusy]             = useState(false);
  const [otDone, setOtDone]             = useState(null);
  const [rwForm, setRwForm]             = useState(EMPTY_RW_FORM);
  const [rwErrors, setRwErrors]         = useState({});
  const [rwBusy, setRwBusy]             = useState(false);
  const [rwDone, setRwDone]             = useState(null);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [clock, setClock]               = useState(() => formatDateTimeIDParts(new Date()));
  const formRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setClock(formatDateTimeIDParts(new Date())), 1000);
    return () => clearInterval(t);
  }, []);

  // Enter pindah ke input berikutnya (urutan tab index di DOM) supaya
  // pengisian cepat bisa full keyboard, tidak wajib klik kursor ke tiap
  // kolom satu-satu -- meniru kebiasaan form entri cepat/scanner barcode.
  function handleFormKeyDown(e) {
    if (e.key !== 'Enter') return;
    if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    e.preventDefault();
    const root = formRef.current;
    if (!root) return;
    const focusables = Array.from(root.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled])'));
    const idx = focusables.indexOf(e.target);
    const next = focusables[idx + 1];
    if (next) { next.focus(); if (next.select) next.select(); }
  }

  /* Tab title + force light theme */
  useEffect(() => {
    document.title = 'INPUT LHP PROD';
    const prev = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', 'light');
    return () => {
      document.title = 'PROD-DPA Monitoring';
      if (prev) document.documentElement.setAttribute('data-theme', prev);
      else document.documentElement.removeAttribute('data-theme');
    };
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }, []);

  const loadMaster = useCallback(() => {
    fetch(`${API}/master`).then((r) => r.json()).then(setMaster).catch(() => {});
  }, []);
  useEffect(() => { loadMaster(); }, [loadMaster]);

  // Begitu daftar default Waktu Efektif per Shift datang dari server,
  // langsung isi field-nya untuk Shift yang sudah terpilih dari awal
  // (Shift 1) -- tidak perlu user klik ulang dropdown Shift dulu supaya
  // Waktu Efektif-nya muncul. Cuma jalan kalau form masih di kondisi
  // awal (belum diisi/diubah) supaya tidak menimpa input user.
  useEffect(() => {
    if (master.shiftHours.length === 0) return;
    setForm((f) => (f.shift === SHIFTS[0] && f.waktuEfektif === ''
      ? { ...f, waktuEfektif: defaultWaktuEfektifFor(f.shift, master.shiftHours) }
      : f));
  }, [master.shiftHours]);

  // Sesi login tab "Data Produksi" (per Grup Head) disimpan di
  // localStorage supaya tetap login walau di-refresh, tapi dicek ulang
  // tiap kali dipakai (DataProduksiView akan logout otomatis kalau
  // token-nya sudah kedaluwarsa/ditolak server).
  function handleDpLogin(auth) {
    localStorage.setItem(DP_AUTH_KEY, JSON.stringify(auth));
    setDpAuth(auth);
  }
  function handleDpLogout() {
    localStorage.removeItem(DP_AUTH_KEY);
    setDpAuth(null);
  }

  function set(key, value) { setForm((f) => ({ ...f, [key]: value })); }

  // Mesin "Manual" = Proses ini memang tidak pakai mesin (dikerjakan
  // tangan) -- Breakdown Mesin jadi tidak relevan (tidak ada mesin yang
  // bisa breakdown), dikunci ke 0 begitu Mesin-nya berubah jadi Manual.
  // Loss Time tetap bisa diisi (delay proses tetap bisa terjadi meski
  // manual). Dicek lagi di backend (produksi.service.js), bukan cuma di
  // sini -- lihat catatan isManualMesin.
  // Mode multi-Mesin: yang relevan buat cek "Manual" adalah Mesin
  // Bermasalah (problemMesin), bukan field `mesin` tunggal (kosong di
  // mode ini).
  const isManualMesin = (form.mesinList.length > 0 ? form.problemMesin : form.mesin).trim().toLowerCase() === 'manual';
  useEffect(() => {
    if (isManualMesin && Number(form.breakdownMesin) !== 0) {
      setForm((f) => ({ ...f, breakdownMesin: 0 }));
    }
  }, [isManualMesin]);

  /* Live-computed Total OK / Total Proses */
  const totalOk = useMemo(() => num(form.qtyOk), [form.qtyOk]);
  const totalProses = useMemo(() => totalOk + num(form.rwk) + num(form.rjct), [totalOk, form.rwk, form.rjct]);

  // Plan = ROUND((3600 x Waktu Efektif x 0.9) / Cycle Time; -1) -- kapasitas
  // teoretis dalam jam efektif terpilih pada efisiensi 90%, dibulatkan ke
  // puluhan terdekat (sama seperti ROUND(...; -1) di Excel). Tidak lagi
  // diisi manual -- otomatis dari Cycle Time & Waktu Efektif.
  const plan = useMemo(() => {
    const ct = num(form.cycleTime);
    const we = num(form.waktuEfektif);
    if (!ct || !we) return 0;
    return Math.round(((3600 * we * 0.9) / ct) / 10) * 10;
  }, [form.cycleTime, form.waktuEfektif]);

/* Cascading: Grup Head -> Cluster -> Part Name -> Proses (+Cycle Time,
     Line Produksi, Mesin, Man Power) -- semuanya isian kombinasi pilih-atau-
     ketik (datalist), auto-terisi dari cascading tapi tetap bisa dikoreksi
     manual. Cycle Time ikut Proses, bukan Part Name -- satu Part Name bisa
     punya beberapa Proses beda Cycle Time. */
  // Opsi Part Name untuk Cluster terpilih diturunkan dari baris Proses
  // (bukan dari field MasterPartName.cluster) -- satu Part Name bisa
  // punya Proses di lebih dari satu Cluster (mis. "BOSS DRIVEN FACE..."
  // ada di Cluster AD dan FI sekaligus), sedangkan MasterPartName.cluster
  // cuma nyimpan satu nilai per Part Name (nilai terakhir yang tersimpan).
  // Kalau difilter dari MasterPartName.cluster, Part Name yang valid buat
  // Cluster ini jadi hilang dari pilihan padahal datanya ada. Part Name
  // tanpa Proses sama sekali juga otomatis tidak ikut muncul karena
  // sumbernya memang dari Proses.
  // Part Name TIDAK lagi difilter per Cluster -- satu Part Name bisa punya
  // Proses di lebih dari satu Cluster, dan sekarang semua nama Part Name
  // sengaja dimunculkan apa adanya (bukan cuma yang match Cluster Grup
  // Head yang login) supaya lebih gampang dicari.
  const partNameOptions = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const p of master.proses) {
      const key = p.partName.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ partName: p.partName, cluster: p.cluster });
    }
    // Semua opsi pilihan (Part Name, Proses, Line, Mesin, Man Power) selalu
    // ditampilkan berurutan abjad, bukan urutan insert/sumber data -- lebih
    // gampang dicari pas daftarnya panjang.
    result.sort((a, b) => a.partName.localeCompare(b.partName));
    return result;
  }, [master.proses]);
  // Proses ikut Part Name yang dipilih saja (bukan lagi ikut Cluster juga)
  // -- konsisten dengan Part Name yang sekarang lintas-Cluster.
  //
  // Satu Proses di Master Data sekarang boleh punya lebih dari satu
  // pilihan Mesin (baris MasterProses terpisah per Mesin, lihat Master
  // Data -> Part Name & Proses) -- sebelum ini, dropdown Proses di sini
  // menampilkan SATU ENTRI PER MESIN, jadi "Profil" misalnya muncul
  // berulang 5x dengan sub-teks Mesin beda-beda, seolah-olah 5 Proses
  // berbeda padahal sebenarnya cuma 1 Proses dengan 5 pilihan Mesin.
  // Sekarang di-dedupe jadi SATU entri per Proses -- daftar Mesin
  // kandidatnya dipakai buat mengisi field Mesin secara otomatis (lihat
  // pickProses & mesinOptionsForProses di bawah).
  const prosesOptions = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const p of master.proses) {
      if (p.partName !== form.partName) continue;
      const key = p.proses.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(p);
    }
    return result.sort((a, b) => a.proses.localeCompare(b.proses));
  }, [master.proses, form.partName]);
  // Semua baris Master Data (bisa lebih dari satu Mesin) untuk Proses yang
  // lagi dipilih -- sumber daftar Mesin kandidat.
  const prosesRowsForSelected = useMemo(
    () => master.proses.filter((p) => p.partName === form.partName && p.proses === form.proses),
    [master.proses, form.partName, form.proses],
  );
  const lineOptions = useMemo(
    () => [...new Set(master.proses.map((p) => p.line).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [master.proses],
  );
  const mesinOptions = useMemo(
    () => [...new Set(master.proses.map((p) => p.mesin).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [master.proses],
  );
  // Man Power sekarang murni mengikuti roster Grup Head (menu Master Data
  // "Grup Head & Man Power") -- tidak lagi jatuh balik ke nama Man Power
  // lama yang tersimpan di Proses, dan tidak lagi ikut auto-terisi saat
  // memilih Part Name/Proses (dua hal itu sudah tidak berkaitan).
  const manPowerOptions = useMemo(
    () => master.manPower.filter((m) => m.groupHead === form.grupHead).map((m) => m.name).sort((a, b) => a.localeCompare(b)),
    [master.manPower, form.grupHead],
  );

  // Versi "kaya" (dengan sub-teks) dari opsi di atas, buat ditampilkan di
  // Combobox -- supaya tiap baris pilihan kelihatan konteksnya (cluster/
  // line/mesin) sekilas, bukan cuma nama polos.
  const grupHeadOptionsRich = useMemo(
    () => master.groupHeads.map((g) => ({ value: g.name, sub: `Cluster ${g.cluster}` })).sort((a, b) => a.value.localeCompare(b.value)),
    [master.groupHeads],
  );
  const partNameOptionsRich = useMemo(
    () => partNameOptions.map((p) => ({ value: p.partName, sub: `Cluster ${p.cluster}` })),
    [partNameOptions],
  );
  const prosesOptionsRich = useMemo(() => prosesOptions.map((p) => {
    const mesinCount = master.proses.filter((r) => r.partName === p.partName && r.proses === p.proses && r.mesin).length;
    const sub = [p.line && `Line ${p.line}`, mesinCount > 0 && `${mesinCount} Mesin`].filter(Boolean).join(' · ');
    return { value: p.proses, sub: sub || null };
  }), [prosesOptions, master.proses]);
  // Kandidat Mesin buat Proses yang lagi dipilih -- kalau > 1, field Mesin
  // di bawah jadi dropdown TERBATAS ke pilihan ini (bukan seluruh katalog
  // Mesin) supaya operator tinggal pilih, bukan cari-cari lagi dari nol.
  const mesinOptionsForProses = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const p of prosesRowsForSelected) {
      if (!p.mesin || seen.has(p.mesin.toLowerCase())) continue;
      seen.add(p.mesin.toLowerCase());
      result.push({ value: p.mesin, sub: p.line ? `Line ${p.line}` : null });
    }
    return result.sort((a, b) => a.value.localeCompare(b.value));
  }, [prosesRowsForSelected]);
  // Mesin difilter per Cluster (Cluster Grup Head yang login) -- beda
  // dari Master Data/Data Produksi yang sumbernya Tabel Machine (Cluster
  // di sana masih kotor, mis. "Cell AD"), di sini sumbernya MasterProses
  // yang Cluster-nya sudah bersih (AD/BC/EF/FI polos), jadi exact-match
  // aman dipakai.
  const mesinOptionsRich = useMemo(() => {
    const byMesin = {};
    master.proses.forEach((p) => {
      if (!p.mesin || p.cluster !== form.cluster) return;
      if (!byMesin[p.mesin]) byMesin[p.mesin] = new Set();
      if (p.line) byMesin[p.mesin].add(p.line);
    });
    return Object.entries(byMesin)
      .map(([mesin, lines]) => ({ value: mesin, sub: lines.size ? `Line ${[...lines].join(', ')}` : null }))
      .sort((a, b) => a.value.localeCompare(b.value));
  }, [master.proses, form.cluster]);

  // Pilih Shift -> Waktu Efektif otomatis terisi dari default Shift itu
  // (diatur di Master Data), tapi field-nya tetap input biasa yang bisa
  // diketik ulang manual -- nilai akhir yang tersimpan adalah apa pun
  // yang ada di field saat disimpan, bukan dipaksa balik ke default.
  function pickShift(shift) {
    const match = master.shiftHours.find((s) => s.shift === shift);
    setForm((f) => ({ ...f, shift, waktuEfektif: match ? String(match.defaultHours) : f.waktuEfektif }));
  }

  function pickGroupHead(name) {
    const match = master.groupHeads.find((g) => g.name === name);
    setForm((f) => ({
      ...f, grupHead: name, cluster: match?.cluster || '',
      partName: '', cycleTime: '', proses: '', line: '', mesin: '', mesinList: [], problemMesin: '', manPower: '',
    }));
  }
  function pickPartName(partName) {
    setForm((f) => ({
      ...f, partName, cycleTime: '',
      proses: '', line: '', mesin: '', mesinList: [], problemMesin: '',
    }));
  }
  function pickProses(prosesName) {
    // Man Power sengaja tidak diikutkan di sini -- sekarang murni dipilih
    // dari roster Grup Head, tidak lagi auto-terisi dari data Proses.
    const rows = master.proses.filter((p) => p.proses === prosesName && p.partName === form.partName);
    const match = rows[0];
    // Mesin candidates yang tercatat di Proses ini -- 1 pilihan langsung
    // terisi otomatis (sama seperti sebelumnya). Lebih dari 1: semua
    // tercentang otomatis di mesinList (operator boleh uncheck yang
    // tidak jalan), field Mesin tunggal dikosongkan/tidak dipakai.
    const mesinCandidates = [...new Set(rows.map((r) => r.mesin).filter(Boolean))];
    setForm((f) => ({
      ...f, proses: prosesName, cycleTime: match?.cycleTime ?? '',
      line: match?.line || '',
      mesin: mesinCandidates.length === 1 ? mesinCandidates[0] : '',
      mesinList: mesinCandidates.length > 1 ? mesinCandidates : [],
      problemMesin: '',
    }));
  }
  function toggleMesinInList(mesinName) {
    setForm((f) => ({
      ...f,
      mesinList: f.mesinList.includes(mesinName) ? f.mesinList.filter((m) => m !== mesinName) : [...f.mesinList, mesinName],
      // Mesin Bermasalah ikut hilang kalau Mesin itu di-uncheck dari daftar.
      problemMesin: f.problemMesin === mesinName && f.mesinList.includes(mesinName) ? '' : f.problemMesin,
    }));
  }

  // Array.isArray check khusus buat mesinList -- [] truthy di JS meski
  // kosong, jadi tanpa ini hasInput selalu true walau belum ada Mesin
  // dicentang sama sekali.
  const hasInput = Object.entries(form).some(([k, v]) => !['tanggal', 'waktu', 'shift'].includes(k) && (Array.isArray(v) ? v.length > 0 : !!v));

  function handleCancel() { if (hasInput) setCancelWarn(true); else reset(); }
  function reset() {
    setForm({ ...EMPTY_FORM, waktuEfektif: defaultWaktuEfektifFor(EMPTY_FORM.shift, master.shiftHours) });
    setErrors({});
    setDone(null);
    setDoneMetrics(null);
    setCancelWarn(false);
  }

  async function submit() {
    const nextErrors = {};
    if (!form.grupHead.trim()) nextErrors.grupHead = 'Wajib diisi';
    if (!form.cluster) nextErrors.cluster = 'Wajib dipilih';
    if (!form.line.trim()) nextErrors.line = 'Wajib diisi';
    if (!form.partName) nextErrors.partName = 'Wajib dipilih';
    if (!form.proses) nextErrors.proses = 'Wajib dipilih';
    // Mode multi-Mesin (mesinList terisi) atau mode Mesin tunggal (field
    // `mesin`) -- salah satu wajib ada isinya, tidak keduanya.
    const usingMesinList = form.mesinList.length > 0;
    if (!usingMesinList && !form.mesin) nextErrors.mesin = 'Wajib dipilih';
    // Downtime & Problem (opsional) sekarang satu grup all-or-nothing:
    // begitu SALAH SATU dari Loss Time/Breakdown Mesin (dianggap satu
    // sinyal, isi salah satu tidak apa-apa)/Jenis Problem/Problem diisi,
    // SEMUANYA (termasuk Due Date) jadi wajib -- supaya begitu operator
    // mulai mencatat downtime, catatannya selalu lengkap (Jenis Problem
    // buat kategori, Problem buat deskripsi, Due Date buat tindak lanjut
    // di Problem Produksi). Due Date SENGAJA tidak ikut jadi "pemicu"
    // (cuma jadi salah satu yang WAJIB kalau grup ini kepicu) -- Due Date
    // sudah default ke hari ini (lihat EMPTY_FORM di shared.jsx), jadi
    // kalau ikut jadi pemicu juga, grup ini akan SELALU terpicu dari awal
    // (Due Date tidak pernah kosong), memaksa Jenis Problem/Loss
    // Time/Problem wajib diisi di SETIAP submit walau memang tidak ada
    // downtime sama sekali -- merusak sifat "opsional" panel ini.
    const hasDowntime = (Number(form.lossTime) || 0) > 0 || (Number(form.breakdownMesin) || 0) > 0;
    const hasJenisProblem = !!form.jenisProblem.trim();
    const hasProblemText = !!form.problem.trim();
    const downtimeGroupTriggered = hasDowntime || hasJenisProblem || hasProblemText;
    if (downtimeGroupTriggered) {
      if (!hasDowntime) {
        // "Isi salah satu" (bukan "Wajib diisi" di kedua field) -- Loss
        // Time & Breakdown Mesin cukup salah satu, bukan wajib dua-duanya.
        nextErrors.lossTime = 'Isi salah satu';
        nextErrors.breakdownMesin = 'Isi salah satu';
      }
      if (!hasJenisProblem) nextErrors.jenisProblem = 'Wajib diisi';
      if (!hasProblemText) nextErrors.problem = 'Wajib diisi';
      if (!form.dueDate) nextErrors.dueDate = 'Wajib diisi';
      // Baris ini mencakup >1 Mesin (mesinList) -- downtime cuma boleh
      // nempel ke SATU Mesin spesifik (bukan ke semuanya sekaligus),
      // supaya tetap ter-trace per Mesin (termasuk oleh Dashboard-MTN).
      if (usingMesinList && form.mesinList.length > 1 && !form.problemMesin) {
        nextErrors.problemMesin = 'Wajib dipilih';
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    try {
      // Kalau Loss Time/Breakdown Mesin diisi (WAJIB disertai Jenis
      // Problem, dicek di atas), backend otomatis membuat/menyinkron baris
      // Problem Produksi yang terhubung ke baris ini -- lihat
      // syncLinkedProblemLog di src/routes/api.js. `problem` (teks Problem
      // di bawah, kalau diisi) ikut dikirim sebagai deskripsinya; tidak
      // perlu request terpisah ke /problem-log lagi seperti sebelumnya.
      //
      // mesin_list (kalau mode multi-Mesin aktif): backend fan-out jadi
      // satu baris ProduksiHarian per Mesin, Total OK/Rework/Reject SAMA
      // di tiap baris (bukan dibagi rata -- lihat createProduksi), Jenis
      // Problem/Loss Time/Breakdown Mesin/Keterangan cuma nempel ke baris
      // Mesin yang dipilih di problem_mesin (Mesin lain di grup itu tetap
      // tercatat "tidak ada problem").
      const r = await fetch(`${API}/produksi-harian`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tanggal: form.tanggal, waktu: form.waktu, shift: form.shift, grup_head: form.grupHead,
          cluster: form.cluster, line: form.line,
          no_lot: form.noLot, part_name: form.partName, proses: form.proses,
          mesin: form.mesin, mesin_list: usingMesinList ? form.mesinList : undefined,
          problem_mesin: usingMesinList ? form.problemMesin : undefined,
          man_power: form.manPower, cycle_time: form.cycleTime,
          waktu_efektif: form.waktuEfektif, plan,
          ok1: form.qtyOk, ok2: 0, rwk: form.rwk, rjct: form.rjct,
          breakdown_mesin: form.breakdownMesin, jenis_problem: form.jenisProblem, lost_time: form.lossTime,
          keterangan: form.problem, problem: form.problem, due_date: form.dueDate || null,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Gagal mengirim');

      setDoneMetrics(data);
      setDone({ ...form });
    } catch (e) { alert(e.message); }
    setBusy(false);
  }

  /* ── Input Rejection ─────────────────────────────── */
  function setRej(key, value) { setRejForm((f) => ({ ...f, [key]: value })); }
  const rejPartNameOptionsRich = useMemo(
    () => master.partNames.map((p) => ({ value: p.partName, sub: `Cluster ${p.cluster}` })).sort((a, b) => a.value.localeCompare(b.value)),
    [master.partNames],
  );
  const rejPartMatch = useMemo(
    () => master.partNames.find((p) => p.partName === rejForm.partName),
    [master.partNames, rejForm.partName],
  );
  const rejCluster = rejPartMatch?.cluster || '';
  // Total OK bukan lagi diketik manual -- diambil otomatis dari RC Harian
  // Produksi (ProduksiHarian) pada Proses Akhir/Finish Part Name ini
  // (ditandai lewat Master Data), untuk tanggal yang sama. Di-fetch ulang
  // tiap kali Part Name/Tanggal berubah.
  const [rejAutoOk, setRejAutoOk] = useState({ totalOk: 0, hasFinishProses: false });
  useEffect(() => {
    if (!rejForm.partName || !rejForm.tanggal) { setRejAutoOk({ totalOk: 0, hasFinishProses: false }); return; }
    let cancelled = false;
    fetch(`${API}/produksi-ok-for-part?part_name=${encodeURIComponent(rejForm.partName)}&tanggal=${rejForm.tanggal}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setRejAutoOk(d); })
      .catch(() => { if (!cancelled) setRejAutoOk({ totalOk: 0, hasFinishProses: false }); });
    return () => { cancelled = true; };
  }, [rejForm.partName, rejForm.tanggal]);
  const rejTotalOk = rejAutoOk.totalOk;
  const rejTotalLmr = useMemo(() => num(rejForm.totalLmr), [rejForm.totalLmr]);
  const rejTotalProses = useMemo(() => rejTotalOk + rejTotalLmr, [rejTotalOk, rejTotalLmr]);
  const rejRatio = useMemo(() => rejTotalOk > 0 ? ((rejTotalLmr / rejTotalOk) * 100).toFixed(1) : '0.0', [rejTotalOk, rejTotalLmr]);

  function pickRejPartName(partName) { setRejForm((f) => ({ ...f, partName })); }

  const hasRejInput = Object.entries(rejForm).some(([k, v]) => !['tanggal', 'waktu'].includes(k) && !!v);
  function handleRejCancel() { if (hasRejInput) setCancelWarn(true); else resetRej(); }
  function resetRej() {
    setRejForm(EMPTY_REJ_FORM);
    setRejErrors({});
    setRejDone(null);
    setCancelWarn(false);
  }

  async function submitRej() {
    const nextErrors = {};
    if (!rejForm.partName) nextErrors.partName = 'Wajib dipilih';
    setRejErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setRejBusy(true);
    try {
      const r = await fetch(`${API}/rejection-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tanggal: rejForm.tanggal, waktu: rejForm.waktu, part_name: rejForm.partName,
          total_lmr: rejForm.totalLmr,
          kriteria_ng: rejForm.kriteriaNg, keterangan: rejForm.keterangan,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Gagal mengirim');
      setRejDone({ ...rejForm, cluster: rejCluster, totalOk: rejTotalOk });
    } catch (e) { alert(e.message); }
    setRejBusy(false);
  }

  /* ── Input Overtime ─────────────────────────────── */
  function setOt(key, value) { setOtForm((f) => ({ ...f, [key]: value })); }
  const otManPowerOptionsRich = useMemo(
    () => master.manPower.map((m) => ({ value: m.name, sub: m.groupHead ? `Grup Head ${m.groupHead}` : null })).sort((a, b) => a.value.localeCompare(b.value)),
    [master.manPower],
  );

  function pickOtManPower(name) { setOtForm((f) => ({ ...f, manPower: name })); }

  const hasOtInput = Object.entries(otForm).some(([k, v]) => !['tanggal', 'waktu'].includes(k) && !!v);
  function handleOtCancel() { if (hasOtInput) setCancelWarn(true); else resetOt(); }
  function resetOt() {
    setOtForm(EMPTY_OT_FORM);
    setOtErrors({});
    setOtDone(null);
    setCancelWarn(false);
  }

  async function submitOt() {
    const nextErrors = {};
    if (!otForm.manPower) nextErrors.manPower = 'Wajib dipilih';
    setOtErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setOtBusy(true);
    try {
      const r = await fetch(`${API}/overtime-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tanggal: otForm.tanggal, waktu: otForm.waktu, man_power: otForm.manPower,
          durasi_jam: otForm.durasiJam, keterangan: otForm.keterangan,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Gagal mengirim');
      setOtDone({ ...otForm });
    } catch (e) { alert(e.message); }
    setOtBusy(false);
  }

  /* ── Data Pengerjaan Part Rework ────────────────────── */
  function setRw(key, value) { setRwForm((f) => ({ ...f, [key]: value })); }
  const rwPartNameOptionsRich = useMemo(
    () => master.partNames.map((p) => ({ value: p.partName, sub: `Cluster ${p.cluster}` })).sort((a, b) => a.value.localeCompare(b.value)),
    [master.partNames],
  );
  function pickRwPartName(partName) { setRwForm((f) => ({ ...f, partName })); }

  const rwGroupHeadOptionsRich = useMemo(
    () => master.groupHeads.map((g) => ({ value: g.name, sub: `Cluster ${g.cluster}` })).sort((a, b) => a.value.localeCompare(b.value)),
    [master.groupHeads],
  );
  function pickRwGroupHead(name) { setRwForm((f) => ({ ...f, grupHead: name })); }
  const rwCluster = useMemo(
    () => master.groupHeads.find((g) => g.name === rwForm.grupHead)?.cluster || '',
    [master.groupHeads, rwForm.grupHead],
  );

  const hasRwInput = Object.entries(rwForm).some(([k, v]) => !['tanggalDitemukan', 'tanggalRepair'].includes(k) && !!v);
  function handleRwCancel() { if (hasRwInput) setCancelWarn(true); else resetRw(); }
  function resetRw() {
    setRwForm(EMPTY_RW_FORM);
    setRwErrors({});
    setRwDone(null);
    setCancelWarn(false);
  }

  async function submitRw() {
    const nextErrors = {};
    if (!rwForm.partName) nextErrors.partName = 'Wajib dipilih';
    if (!rwForm.grupHead) nextErrors.grupHead = 'Wajib dipilih';
    setRwErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setRwBusy(true);
    try {
      const r = await fetch(`${API}/part-rework`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tanggal_ditemukan: rwForm.tanggalDitemukan, no_lot_original: rwForm.noLotOriginal,
          tanggal_repair: rwForm.tanggalRepair, part_name: rwForm.partName,
          kriteria_rework: rwForm.kriteriaRework, metode_rework: rwForm.metodeRework,
          mesin: rwForm.mesin, pic_rework: rwForm.picRework, grup_head: rwForm.grupHead,
          total_rework: rwForm.totalRework, total_ok: rwForm.totalOk, total_reject: rwForm.totalReject,
          metode_check: rwForm.metodeCheck, tanggal_check: rwForm.tanggalCheck || null, pic_check: rwForm.picCheck,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Gagal mengirim');
      setRwDone({ ...rwForm });
    } catch (e) { alert(e.message); }
    setRwBusy(false);
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#eef3f3', color: '#1c2b2b', overflow: 'hidden' }}>

      {/* ── Header teal ───────────────────────────────── */}
      <div className="rc-header" style={{ background: 'linear-gradient(135deg, #0e5a52, #14746a)', padding: '16px 32px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div className="rc-header-side" style={{ width: 170, flexShrink: 0, display: 'flex' }}>
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ width: 36, height: 36, flexShrink: 0, background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.4)', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
            title="Menu"
          >
            <Menu size={18} />
          </button>
        </div>
        <div className="rc-header-title" style={{ flex: 1, minWidth: 0, fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '.01em', textAlign: 'center', whiteSpace: 'nowrap' }}>
          Resume Control Harian Produksi
        </div>
        <div className="rc-header-side" style={{ width: 170, flexShrink: 0, textAlign: 'right', paddingRight: 6, boxSizing: 'border-box', color: 'rgba(255,255,255,.9)', fontFamily: 'var(--mono, monospace)' }}>
          <div className="rc-header-clock">
            <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{clock.dateLine}</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{clock.timeLine}</div>
          </div>
        </div>
      </div>

      {sidebarOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 998, background: 'rgba(0,0,0,.4)' }} onClick={() => setSidebarOpen(false)}>
          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 260, background: '#fff', boxShadow: '4px 0 24px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column', padding: '18px 14px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#0e5a52' }}>Menu</span>
              <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5a6b73', display: 'flex' }}><X size={20} /></button>
            </div>
            {[
              { key: 'input', label: 'Input', icon: PencilLine },
              { key: 'table', label: 'Data Produksi', icon: Table2 },
              { key: 'rejection', label: 'Input Rejection', icon: AlertTriangle },
              { key: 'overtime', label: 'Overtime', icon: Clock },
              { key: 'rework', label: 'Rework', icon: Wrench },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => { setTab(key); setSidebarOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', marginBottom: 4,
                  borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 700, textAlign: 'left',
                  background: tab === key ? '#e0f2f0' : 'transparent', color: tab === key ? '#0e5a52' : '#3d4b4b',
                }}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Konten ────────────────────────────────────── */}
      {tab === 'table' ? (
        dpAuth ? (
          <DataProduksiView auth={dpAuth} onLogout={handleDpLogout} shiftOptions={master.shiftHours} master={master} />
        ) : (
          <DataProduksiLogin onSuccess={handleDpLogin} />
        )
      ) : tab === 'rejection' ? (
        rejDone ? (
          <RejSuccessView data={rejDone} onReset={resetRej} />
        ) : (
          <RejectionForm
            rejForm={rejForm} rejErrors={rejErrors} setRej={setRej} pickRejPartName={pickRejPartName}
            rejPartNameOptionsRich={rejPartNameOptionsRich} rejCluster={rejCluster} rejTotalOk={rejTotalOk}
            rejAutoOk={rejAutoOk} rejTotalProses={rejTotalProses} rejRatio={rejRatio} master={master}
            rejBusy={rejBusy} handleRejCancel={handleRejCancel} onSubmit={submitRej}
          />
        )
      ) : tab === 'overtime' ? (
        otDone ? (
          <OtSuccessView data={otDone} onReset={resetOt} />
        ) : (
          <OvertimeForm
            otForm={otForm} otErrors={otErrors} setOt={setOt} otManPowerOptionsRich={otManPowerOptionsRich}
            pickOtManPower={pickOtManPower} otBusy={otBusy} handleOtCancel={handleOtCancel} onSubmit={submitOt}
          />
        )
      ) : tab === 'rework' ? (
        rwDone ? (
          <RwSuccessView data={rwDone} onReset={resetRw} />
        ) : (
          <ReworkForm
            rwForm={rwForm} rwErrors={rwErrors} setRw={setRw} rwPartNameOptionsRich={rwPartNameOptionsRich}
            pickRwPartName={pickRwPartName} rwGroupHeadOptionsRich={rwGroupHeadOptionsRich} pickRwGroupHead={pickRwGroupHead}
            rwCluster={rwCluster} mesinOptionsRich={mesinOptionsRich}
            rwBusy={rwBusy} handleRwCancel={handleRwCancel} onSubmit={submitRw}
          />
        )
      ) : done ? (
        <SuccessView data={done} metrics={doneMetrics} onReset={reset} />
      ) : (
        <RMOForm
          form={form} errors={errors} set={set} pickGroupHead={pickGroupHead} pickPartName={pickPartName}
          pickProses={pickProses} pickShift={pickShift} toggleMesinInList={toggleMesinInList}
          grupHeadOptionsRich={grupHeadOptionsRich} partNameOptionsRich={partNameOptionsRich}
          prosesOptionsRich={prosesOptionsRich} lineOptions={lineOptions} mesinOptionsRich={mesinOptionsRich}
          mesinOptionsForProses={mesinOptionsForProses}
          manPowerOptions={manPowerOptions} master={master} plan={plan} totalOk={totalOk} totalProses={totalProses}
          isManualMesin={isManualMesin}
          handleFormKeyDown={handleFormKeyDown} formRef={formRef} busy={busy} handleCancel={handleCancel} onSubmit={submit}
        />
      )}

      {/* ── Tombol fullscreen ─────────────────────────── */}
      <button onClick={toggleFullscreen}
        title={isFullscreen ? 'Keluar layar penuh' : 'Layar penuh'}
        style={{ position: 'fixed', bottom: 14, right: 14, width: 34, height: 34, borderRadius: 8, background: '#fff', border: '1px solid #c9d4d4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0e5a52' }}>
        {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
      </button>

      {cancelWarn && <CancelModal onConfirm={tab === 'rejection' ? resetRej : tab === 'overtime' ? resetOt : tab === 'rework' ? resetRw : reset} onDismiss={() => setCancelWarn(false)} />}

    </div>
  );
}
