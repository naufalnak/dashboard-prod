import { useEffect } from 'react';
import { Minimize2 } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { ToastProvider } from './contexts/ToastContext.jsx';
import { ConfirmProvider } from './contexts/ConfirmContext.jsx';
import { AppProvider, useApp } from './contexts/AppContext.jsx';
import { UIProvider, useUI } from './contexts/UIContext.jsx';
import { TargetsProvider } from './contexts/TargetsContext.jsx';
import TargetsModal from './components/TargetsModal.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Machines from './pages/Machines.jsx';
import DataProduksi from './pages/DataProduksi.jsx';
import DataRejection from './pages/DataRejection.jsx';
import DataOvertime from './pages/DataOvertime.jsx';
import DataRework from './pages/DataRework.jsx';
import ARDetail from './pages/ARDetail.jsx';
import OEEDetail from './pages/OEEDetail.jsx';
import RejectionDetail from './pages/RejectionDetail.jsx';
import OvertimeDetail from './pages/OvertimeDetail.jsx';
import Reports from './pages/Reports.jsx';
import MasterData from './pages/MasterData/index.jsx';
import ProblemLogPage from './pages/ProblemLogPage.jsx';
import DowntimeProduksi from './pages/DowntimeProduksi.jsx';
import Topbar from './components/layout/Topbar.jsx';
import AppSidebar from './components/layout/AppSidebar.jsx';
import MobileDrawer from './components/layout/MobileDrawer.jsx';
import BottomNav from './components/layout/BottomNav.jsx';
import NotifPanel from './components/NotifPanel.jsx';
import TodoPanel from './components/TodoPanel.jsx';
import DetailPanel from './components/DetailPanel.jsx';
import WOPanel from './components/WOPanel.jsx';
import ModalRoot from './components/ModalRoot.jsx';

const PAGES = { dashboard: Dashboard, machines: Machines, dataproduksi: DataProduksi, datarejection: DataRejection, dataovertime: DataOvertime, datarework: DataRework, ardetail: ARDetail, oeedetail: OEEDetail, rejectiondetail: RejectionDetail, overtimedetail: OvertimeDetail, reports: Reports, masterdata: MasterData, problemlog: ProblemLogPage, downtimeproduksi: DowntimeProduksi };

function Shell() {
  const { page, closeModal, setNotifOpen, closeDetail, closeWODetail, presentMode, togglePresentMode, detailWO, sidebarOpen } = useUI();
  const { loadAll } = useApp();
  const PageComponent = PAGES[page] || Dashboard;

  useEffect(() => {
    const t = setInterval(() => loadAll(), 30000);
    return () => clearInterval(t);
  }, [loadAll]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') { closeModal(); setNotifOpen(false); closeDetail(); closeWODetail(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeModal, setNotifOpen, closeDetail]);

  return (
    <>
      <div className={`shell${presentMode ? ' pres-mode' : ''}${detailWO ? ' wo-open' : ''}${sidebarOpen ? ' sidebar-open' : ''}`}>
        <Topbar />
        <AppSidebar />
        <main className="content">
          <PageComponent />
          <footer className="app-footer">Copyright © 2026 PT Dharma Precision Parts. All Rights Reserved.</footer>
        </main>
      </div>
      <BottomNav />
      <MobileDrawer />
      <NotifPanel />
      <TodoPanel />
      <DetailPanel />
      <WOPanel />
      <ModalRoot />
      <TargetsModal />
      {presentMode && (
        <button className="pres-fab" onClick={togglePresentMode} title="Keluar mode layar penuh">
          <Minimize2 size={14} /> Keluar
        </button>
      )}
    </>
  );
}

function AuthGate() {
  const { token } = useAuth();
  if (!token) return <Login />;
  return (
    <AppProvider>
      <UIProvider>
        <Shell />
      </UIProvider>
    </AppProvider>
  );
}

export default function App() {
  return (
    <TargetsProvider>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <ConfirmProvider>
              <AuthGate />
            </ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </TargetsProvider>
  );
}
