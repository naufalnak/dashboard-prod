import { apiFetch, apiSend } from '../api.js';

// Service untuk domain Problem Log -- lihat backend:
// src/routes/problemLog.routes.js.
// NOTE: /problem-log juga dipakai ARDetail.jsx (tanpa page/pageSize, cuma
// ambil daftar penuh) untuk menghitung status open/closed.

export function fetchProblemLog(qs, fallback, logout, onError) {
  const suffix = qs ? `?${qs}` : '';
  return apiFetch(`/problem-log${suffix}`, fallback, logout, onError);
}

export function createProblemLog(body, logout) {
  return apiSend('/problem-log', 'POST', body, logout);
}

export function updateProblemLog(body, logout) {
  return apiSend('/problem-log-update', 'POST', body, logout);
}

export function deleteProblemLog(id, logout) {
  return apiSend('/problem-log-delete', 'POST', { id }, logout);
}
