import { apiFetch, apiSend } from '../api.js';

// Service untuk Analytics.jsx dan Settings.jsx.
//
// PERHATIAN -- temuan saat memisahkan file ini: tidak ada route
// GET/POST/PUT untuk /analytics, /analytics-compute, atau /working-calendar
// di manapun pada src/routes/*.js (sudah dicek semua file, termasuk
// index.js sebagai aggregator). Backend cuma punya 8 file route
// (auth, masterData, machines, produksi, rejection, overtime, rework,
// problemLog) dan tidak satupun mendaftarkan endpoint-endpoint ini.
//
// Artinya panggilan-panggilan di bawah ini kemungkinan besar selalu
// gagal (404) di kondisi sekarang -- baik dari halaman Analytics
// (kalender kerja & compute analytics) maupun Settings (kalender kerja).
// Ini di luar cakupan pagination/empty-state/services yang sedang
// dikerjakan, jadi tidak saya buatkan route-nya -- cuma dipusatkan di
// sini biar kelihatan jelas dan gampang dicari kalau mau dibereskan.

export function fetchWorkingCalendar(year, logout) {
  return apiFetch(`/working-calendar?year=${year}`, null, logout);
}

export function saveWorkingCalendarMonth(body, logout) {
  return apiSend('/working-calendar', 'PUT', body, logout);
}

export function fetchAnalytics(logout) {
  return apiFetch('/analytics?limit=200', null, logout);
}

export function computeAnalytics(body, logout) {
  return apiSend('/analytics-compute', 'POST', body, logout);
}
