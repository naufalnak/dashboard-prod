import { apiFetch, apiSend, apiSendForm, apiDownload } from '../api.js';

// Service bersama untuk data master/referensi yang dipakai lintas banyak
// halaman (MasterData, DataRejection, DataOvertime, DataRework, DataProduksi,
// Machines, RMO, Reports) -- lihat backend: src/routes/masterData.routes.js
// dan src/routes/machines.routes.js.

// ── Reads ──────────────────────────────────────────────────────────────
export function fetchMaster(fallback, logout) {
  return apiFetch('/master', fallback, logout);
}

export function fetchLegacyLookups(fallback, logout) {
  return apiFetch('/legacy-lookups', fallback, logout);
}

export function fetchMachines(logout) {
  return apiFetch('/machines', [], logout);
}

export function fetchPartnameCounts(logout) {
  return apiFetch('/produksi-partname-counts', [], logout);
}

export function fetchOrphanPartnames(logout) {
  return apiFetch('/produksi-orphan-partnames', [], logout);
}

export function fetchPartnameMissingFinish(logout) {
  return apiFetch('/master-partname-missing-finish', [], logout);
}

export function fetchPartnameUnused(logout) {
  return apiFetch('/master-partname-unused', [], logout);
}

export function fetchProsesMesinMismatch(logout) {
  return apiFetch('/master-proses-mesin-mismatch', [], logout);
}

// ── Import ────────────────────────────────────────────────────────────
export function importMasterFile(formData, logout) {
  return apiSendForm('/master-import', formData, logout);
}

export function importMasterProses(rows, logout) {
  return apiSend('/master-proses-import', 'POST', { rows }, logout);
}

// ── Group Head ────────────────────────────────────────────────────────
export function createGroupHead(body, logout) {
  return apiSend('/master-group-head', 'POST', body, logout);
}
export function updateGroupHead(body, logout) {
  return apiSend('/master-group-head-update', 'POST', body, logout);
}
export function deleteGroupHead(id, logout) {
  return apiSend('/master-group-head-delete', 'POST', { id }, logout);
}

// ── Man Power ─────────────────────────────────────────────────────────
export function createManPower(body, logout) {
  return apiSend('/master-man-power', 'POST', body, logout);
}
export function updateManPower(body, logout) {
  return apiSend('/master-man-power-update', 'POST', body, logout);
}
export function deleteManPower(id, logout) {
  return apiSend('/master-man-power-delete', 'POST', { id }, logout);
}

// ── Part Name ─────────────────────────────────────────────────────────
export function renamePartname(from, to, logout) {
  return apiSend('/produksi-rename-partname', 'POST', { from, to }, logout);
}
export function createPartName(body, logout) {
  return apiSend('/master-part-name', 'POST', body, logout);
}
export function updatePartName(body, logout) {
  return apiSend('/master-part-name-update', 'POST', body, logout);
}
export function mergePartName(from, to, logout) {
  return apiSend('/master-part-name-merge', 'POST', { from, to }, logout);
}
export function deletePartName(id, logout) {
  return apiSend('/master-part-name-delete', 'POST', { id }, logout);
}

// ── Proses ────────────────────────────────────────────────────────────
export function createProses(body, logout) {
  return apiSend('/master-proses', 'POST', body, logout);
}
export function updateProses(body, logout) {
  return apiSend('/master-proses-update', 'POST', body, logout);
}
export function deleteProses(id, logout) {
  return apiSend('/master-proses-delete', 'POST', { id }, logout);
}
export function mergeProses(fromId, toPartName, toProses, logout) {
  return apiSend('/master-proses-merge', 'POST', { from_id: fromId, to_part_name: toPartName, to_proses: toProses }, logout);
}
export function setProsesFinish(id, value, logout) {
  return apiSend('/master-proses-set-finish', 'POST', { id, value }, logout);
}

// ── Kriteria NG ───────────────────────────────────────────────────────
export function createKriteriaNg(nama, logout) {
  return apiSend('/master-kriteria-ng', 'POST', { nama }, logout);
}
export function updateKriteriaNg(id, nama, logout) {
  return apiSend('/master-kriteria-ng-update', 'POST', { id, nama }, logout);
}
export function deleteKriteriaNg(id, logout) {
  return apiSend('/master-kriteria-ng-delete', 'POST', { id }, logout);
}

// ── Overtime Target ───────────────────────────────────────────────────
export function createOvertimeTarget(body, logout) {
  return apiSend('/master-overtime-target', 'POST', body, logout);
}
export function updateOvertimeTarget(id, targetHours, logout) {
  return apiSend('/master-overtime-target-update', 'POST', { id, target_hours: targetHours }, logout);
}
export function deleteOvertimeTarget(id, logout) {
  return apiSend('/master-overtime-target-delete', 'POST', { id }, logout);
}

// ── Shift Hours ───────────────────────────────────────────────────────
export function createShiftHours(shift, hours, logout) {
  return apiSend('/master-shift-hours', 'POST', { shift, default_hours: hours }, logout);
}
export function updateShiftHours(id, hours, logout) {
  return apiSend('/master-shift-hours-update', 'POST', { id, default_hours: hours }, logout);
}
export function deleteShiftHours(id, logout) {
  return apiSend('/master-shift-hours-delete', 'POST', { id }, logout);
}

// ── Machines / Breakdown (halaman Machines, RMO, Reports) ───────────────
export function reportBreakdown(body, logout) {
  // NOTE: backend belum punya route POST /api/breakdown (tidak ditemukan
  // di src/routes/*.js manapun) -- panggilan ini akan gagal (404) sampai
  // route-nya dibuat. Tetap dipusatkan di sini supaya kelihatan jelas.
  return apiSend('/breakdown', 'POST', body, logout);
}

export function exportMachinesCsv(filename, logout) {
  // NOTE: backend belum punya route GET /api/export-machines -- sama
  // seperti reportBreakdown, akan gagal sampai route-nya dibuat.
  return apiDownload('/export-machines', filename, logout);
}
