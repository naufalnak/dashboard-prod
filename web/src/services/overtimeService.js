import { apiFetch, apiSend } from '../api.js';

// Service untuk domain Data Overtime -- lihat backend:
// src/routes/overtime.routes.js.

export function fetchOvertimeEntries(qs, fallback, logout, onError) {
  return apiFetch(`/overtime-entries?${qs}`, fallback, logout, onError);
}

export function updateOvertimeEntry(body, logout) {
  return apiSend('/overtime-entry-update', 'POST', body, logout);
}

export function deleteOvertimeEntry(id, logout) {
  return apiSend('/overtime-entry-delete', 'POST', { id }, logout);
}

export function fetchOvertimeBreakdown(qs, fallback, logout) {
  return apiFetch(`/overtime-breakdown?${qs}`, fallback, logout);
}

export function fetchOvertimeTrend(qs, fallback, logout) {
  return apiFetch(`/overtime-trend?${qs}`, fallback, logout);
}
