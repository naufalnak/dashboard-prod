import { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from './AuthContext.jsx';
import { canSeeAllPages, canSeeMachinesPage, RESTRICTED_PAGES } from '../roles.js';

const UIContext = createContext(null);

export function UIProvider({ children }) {
  const { username } = useAuth();
  const canSeeAll = canSeeAllPages(username);
  // Semua perpindahan halaman disaring di sini (satu titik) supaya aturan
  // akses konsisten di mana pun page di-set -- akun 123/PRADANA/SUGENG
  // (privileged) dan akun read-only (lihat roles.js) sama-sama punya akses
  // penuh ke semua menu, akun biasa lain diblokir dari Data
  // Rejection/Master Data. "machines" (Semua Mesin) punya daftar sendiri
  // yang lebih sempit (lihat canSeeMachinesPage) -- dicek terpisah dari
  // canSeeAll karena bukan subset dari privileged/read-only biasa (mis.
  // akun "123" privileged tapi TETAP tidak boleh lihat halaman ini).
  const sanitizePage = useCallback((p) => {
    if (p === 'machines') return canSeeMachinesPage(username) ? p : 'dashboard';
    if (canSeeAll) return p;
    return RESTRICTED_PAGES.includes(p) ? 'dashboard' : p;
  }, [canSeeAll, username]);
  const [page, setPage] = useState('dashboard');
  const [presentMode, setPresentMode] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Desktop app sidebar (icon rail) -- collapsed (icons only) by default,
  // beda dari drawerOpen di atas yang punya sendiri drawer overlay mobile.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [todoOpen, setTodoOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null);
  const [modalPayload, setModalPayload] = useState(null);
  const [detailMachine, setDetailMachine] = useState(null);
  const [detailList, setDetailList] = useState([]);
  const [detailWO, setDetailWO] = useState(null);
  const [maintFilter, setMaintFilter] = useState('');
  const [masterDataTab, setMasterDataTab] = useState('');
  const [dataProduksiQuery, setDataProduksiQuery] = useState('');
  const [partProsesQuery, setPartProsesQuery] = useState('');

  const navigate = useCallback((p) => {
    setPage(sanitizePage(p));
    setDetailMachine(null);
    setDrawerOpen(false);
  }, [sanitizePage]);

  const navigateToMaintenance = useCallback((machineName = '') => {
    setMaintFilter(machineName);
    setPage(sanitizePage('maintenance'));
    setDetailMachine(null);
    setDrawerOpen(false);
  }, [sanitizePage]);

  // Buka Master Data langsung ke tab tertentu -- dipakai tombol "Ke Master
  // Data" di modal Edit Data Produksi supaya langsung menuju tab Part Name
  // & Proses, bukan tab Ringkasan default.
  const navigateToMasterData = useCallback((tab = '') => {
    setMasterDataTab(tab);
    setPage(sanitizePage('masterdata'));
    setDetailMachine(null);
    setDrawerOpen(false);
  }, [sanitizePage]);

  // Buka Data Produksi dengan kotak pencarian sudah terisi -- dipakai dari
  // panel "Part Name Belum Punya Proses Akhir/Finish" & "Part Name Belum
  // Terdaftar di Master Data" di Master Data, supaya admin bisa langsung
  // lompat ke baris RC Harian Produksi mentah yang pakai Part Name itu dan
  // edit manual (tanpa nyari sendiri). DataProduksi.jsx yang baca state ini
  // sekali saat halaman dibuka, lalu reset ke '' lewat setDataProduksiQuery
  // supaya tidak nempel terus di pencarian manual berikutnya.
  const navigateToDataProduksi = useCallback((q = '') => {
    setDataProduksiQuery(q);
    setPage(sanitizePage('dataproduksi'));
    setDetailMachine(null);
    setDrawerOpen(false);
  }, [sanitizePage]);

  // Buka Master Data langsung ke tab Part Name & Proses dengan kotak
  // pencarian sudah terisi -- dipakai dari halaman Validasi Data (panel
  // "Mesin/Line Belum Sesuai Tabel Machine" & "Part Name Belum Punya Proses
  // Akhir/Finish") supaya admin langsung lompat ke baris tabelnya, sama
  // pola dengan navigateToDataProduksi. PartProsesTab.jsx yang baca state
  // ini sekali saat tab dibuka, lalu reset ke '' lewat setPartProsesQuery.
  const navigateToPartProses = useCallback((q = '') => {
    setPartProsesQuery(q);
    setMasterDataTab('partProses');
    setPage(sanitizePage('masterdata'));
    setDetailMachine(null);
    setDrawerOpen(false);
  }, [sanitizePage]);

  const togglePresentMode = useCallback(() => setPresentMode((v) => !v), []);
  const toggleDrawer = useCallback(() => setDrawerOpen((v) => !v), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const toggleNotif = useCallback(() => { setNotifOpen((v) => !v); setTodoOpen(false); }, []);
  const toggleTodo = useCallback(() => { setTodoOpen((v) => !v); setNotifOpen(false); }, []);

  const openModal = useCallback((name, payload = null) => {
    setActiveModal(name);
    setModalPayload(payload);
  }, []);
  const closeModal = useCallback(() => {
    setActiveModal(null);
    setModalPayload(null);
  }, []);

  const showDetail = useCallback((name, list = []) => {
    setDetailMachine(name);
    if (list.length > 0) setDetailList(list);
    setDetailWO(null);
  }, []);
  const closeDetail = useCallback(() => { setDetailMachine(null); setDetailList([]); }, []);

  const showWODetail = useCallback((wo) => {
    setDetailWO(wo);
    setDetailMachine(null);
    setDetailList([]);
  }, []);
  const closeWODetail = useCallback(() => setDetailWO(null), []);

  return (
    <UIContext.Provider value={{
      page, navigate,
      presentMode, togglePresentMode,
      drawerOpen, toggleDrawer, setDrawerOpen,
      sidebarOpen, toggleSidebar,
      notifOpen, toggleNotif, setNotifOpen,
      todoOpen, toggleTodo, setTodoOpen,
      activeModal, modalPayload, openModal, closeModal,
      detailMachine, detailList, showDetail, closeDetail,
      detailWO, showWODetail, closeWODetail,
      maintFilter, setMaintFilter, navigateToMaintenance,
      masterDataTab, setMasterDataTab, navigateToMasterData,
      dataProduksiQuery, setDataProduksiQuery, navigateToDataProduksi,
      partProsesQuery, setPartProsesQuery, navigateToPartProses,
    }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  return useContext(UIContext);
}
