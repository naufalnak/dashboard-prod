import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext.jsx';
import { apiFetch, apiSend } from '../api.js';

const AppContext = createContext(null);

// machines/breakdowns tetap ada sebagai array kosong statis -- beberapa
// komponen shell (Topbar, TodoPanel, WOPanel, DetailPanel) masih membaca
// nilai ini, sisa dari fitur Maintenance yang tidak dipakai lagi di
// Dashboard-PROD. Tidak di-fetch lagi supaya tidak ada request percuma
// tiap 30 detik ke endpoint yang sudah dihapus.
const EMPTY = [];

export function AppProvider({ children }) {
  const { username, logout } = useAuth();
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState('—');
  const [isLoading, setIsLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const requestIdRef = useRef(0);

  // Notifikasi persisten dari server (mis. "Problem sudah Closed" ke user
  // Grup Head tertentu) -- bukan lagi cuma state lokal di browser, supaya
  // tetap muncul lintas sesi/perangkat buat user yang dituju.
  const loadNotifications = useCallback(async () => {
    if (!username) return;
    const rows = await apiFetch(`/notifications?username=${encodeURIComponent(username)}`, [], logout);
    setNotifications(rows.map((r) => ({
      id: r.id, text: r.message, color: 'blue', time: new Date(r.createdAt), unread: r.unread, link: r.link,
    })));
  }, [username, logout]);

  // addNotif tetap ada buat notifikasi ephemeral lokal (mis. hasil import
  // CSV) yang tidak perlu disimpan ke server/ditujukan ke user tertentu.
  const addNotif = useCallback((text, color = 'yellow') => {
    setNotifications((n) => [{ text, color, time: new Date(), unread: true, id: `local-${Math.random()}` }, ...n]);
  }, []);

  const markRead = useCallback(async (notif) => {
    if (!username || typeof notif.id !== 'number') return;
    setNotifications((n) => n.map((x) => (x.id === notif.id ? { ...x, unread: false } : x)));
    try { await apiSend('/notifications-read', 'POST', { id: notif.id, username }, logout); } catch {}
  }, [username, logout]);

  const markAllRead = useCallback(async () => {
    setNotifications((n) => n.map((x) => ({ ...x, unread: false })));
    if (!username) return;
    try { await apiSend('/notifications-read-all', 'POST', { username }, logout); } catch {}
  }, [username, logout]);

  const clearNotifs = useCallback(() => setNotifications([]), []);

  // Heartbeat ringan buat indikator "Live/Offline" di Topbar, sekalian
  // narik notifikasi terbaru tiap kali dipanggil (Shell memanggil ini
  // tiap 30 detik).
  const loadAll = useCallback(async () => {
    const myId = ++requestIdRef.current;
    setIsLoading(true);
    const ok = await fetch('/api/health').then((r) => r.ok).catch(() => false);
    if (myId !== requestIdRef.current) return;
    setConnected(ok);
    setLastUpdate('Updated ' + new Date().toLocaleTimeString());
    setIsLoading(false);
    loadNotifications();
  }, [loadNotifications]);

  return (
    <AppContext.Provider value={{
      machines: EMPTY, breakdowns: EMPTY,
      connected, lastUpdate, isLoading, setIsLoading, loadAll,
      notifications, addNotif, markRead, markAllRead, clearNotifs, loadNotifications,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
