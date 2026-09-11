import { apiFetch, apiSend } from '../api.js';

// Service untuk domain Data Rejection -- lihat backend:
// src/routes/rejection.routes.js.

export function fetchRejectionEntries(qs, fallback, logout, onError) {
  return apiFetch(`/rejection-entries?${qs}`, fallback, logout, onError);
}

export function updateRejectionEntry(body, logout) {
  return apiSend('/rejection-entry-update', 'POST', body, logout);
}

export function deleteRejectionEntry(id, logout) {
  return apiSend('/rejection-entry-delete', 'POST', { id }, logout);
}

export function fetchRejectionBreakdown(qs, fallback, logout) {
  return apiFetch(`/rejection-breakdown?${qs}`, fallback, logout);
}

export function fetchRejectionTrend(qs, fallback, logout) {
  return apiFetch(`/rejection-trend?${qs}`, fallback, logout);
}
