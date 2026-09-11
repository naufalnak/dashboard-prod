import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../contexts/AppContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { fetchProduksiHarianSummary } from '../services/produksiService.js';

const EMPTY_SUMMARY = {
  availability: 0,
  performance: 0,
  yield: 0,
  ar: 0,
  rejection: 0,
  oee: 0,
  overtime: 0,
  overtimeHours: 0,
  overtimeTargetHours: 0,
  entries: 0,
};

const todayStr = () => new Date().toISOString().slice(0, 10);

export function useDashboard() {
  const { setIsLoading } = useApp();
  const { logout } = useAuth();

  const [period, setPeriod] = useState('today');
  const [refDate, setRefDate] = useState(todayStr());
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);

  const reqIdRef = useRef(0);

  const reload = useCallback(async () => {
    const requestId = ++reqIdRef.current;

    setLoading(true);
    setIsLoading(true);

    try {
      const query = `period=${period}&date=${refDate}`;

      const data = await fetchProduksiHarianSummary(
        query,
        EMPTY_SUMMARY,
        logout
      );

      // Hindari data lama menimpa request terbaru
      if (requestId !== reqIdRef.current) return;

      setSummary(data);
    } catch (err) {
      console.error('Gagal memuat dashboard:', err);

      if (requestId === reqIdRef.current) {
        setSummary(EMPTY_SUMMARY);
      }
    } finally {
      if (requestId === reqIdRef.current) {
        setLoading(false);
        setIsLoading(false);
      }
    }
  }, [period, refDate, logout, setIsLoading]);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    period,
    setPeriod,
    refDate,
    setRefDate,
    summary,
    loading,
    reload,
  };
}