import { apiFetch, apiSend } from '../api.js';

// Service untuk domain Data Rework -- lihat backend:
// src/routes/rework.routes.js.

export function fetchPartReworkEntries(qs, fallback, logout, onError) {
  return apiFetch(`/part-rework-entries?${qs}`, fallback, logout, onError);
}

export function updatePartRework(body, logout) {
  return apiSend('/part-rework-update', 'POST', body, logout);
}

export function deletePartRework(id, logout) {
  return apiSend('/part-rework-delete', 'POST', { id }, logout);
}
