import { apiFetch, apiSend } from '../api.js';

// Service untuk domain Data Produksi + metrik turunannya (AR, OEE) --
// lihat backend: src/routes/produksi.routes.js.

export function fetchProduksiHarian(qs, fallback, logout, onError) {
  // Dipakai DataProduksi.jsx (halaman admin). Route ini publik di backend
  // (tidak ada requireAuth -- dipakai juga oleh RMOPublic.jsx), tapi tetap
  // dilewatkan lewat apiFetch di sini supaya dapat timeout + penanganan
  // error yang konsisten dengan halaman admin lain (sebelumnya pakai raw
  // fetch() tanpa timeout/onError).
  return apiFetch(`/produksi-harian?${qs}`, fallback, logout, onError);
}

export function updateProduksiHarian(body, logout) {
  return apiSend('/produksi-harian-update', 'POST', body, logout);
}

export function deleteProduksiHarian(id, logout) {
  return apiSend('/produksi-harian-delete', 'POST', { id }, logout);
}

export function fetchProduksiHarianSummary(qs, fallback, logout) {
  return apiFetch(`/produksi-harian-summary?${qs}`, fallback, logout);
}

export function fetchArBreakdown(qs, fallback, logout) {
  return apiFetch(`/ar-breakdown?${qs}`, fallback, logout);
}

export function fetchArTrend(qs, fallback, logout) {
  return apiFetch(`/ar-trend?${qs}`, fallback, logout);
}

export function fetchArTrendByCluster(qs, fallback, logout) {
  return apiFetch(`/ar-trend-by-cluster?${qs}`, fallback, logout);
}

export function fetchOeeBreakdown(qs, fallback, logout) {
  return apiFetch(`/oee-breakdown?${qs}`, fallback, logout);
}

export function fetchOeeTrend(qs, fallback, logout) {
  return apiFetch(`/oee-trend?${qs}`, fallback, logout);
}

export function fetchDowntimeAudit(qs, fallback, logout) {
  return apiFetch(`/downtime-audit?${qs}`, fallback, logout);
}
