import { useEffect } from "react";
import { Minimize2 } from "lucide-react";

import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastProvider } from "./contexts/ToastContext";
import { ConfirmProvider } from "./contexts/ConfirmContext";
import { AppProvider, useApp } from "./contexts/AppContext";
import { UIProvider, useUI } from "./contexts/UIContext";
import { TargetsProvider } from "./contexts/TargetsContext";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Machines from "./pages/Machines";
import DataProduksi from "./pages/DataProduksi";
import DataRejection from "./pages/DataRejection";
import DataOvertime from "./pages/DataOvertime";
import DataRework from "./pages/DataRework";
import ARDetail from "./pages/ARDetail";
import OEEDetail from "./pages/OEEDetail";
import RejectionDetail from "./pages/RejectionDetail";
import OvertimeDetail from "./pages/OvertimeDetail";
import Reports from "./pages/Reports";
import MasterData from "./pages/MasterData";
import ProblemLogPage from "./pages/ProblemLogPage";
import DowntimeProduksi from "./pages/DowntimeProduksi";

import Topbar from "./components/layout/Topbar";
import AppSidebar from "./components/layout/AppSidebar";
import BottomNav from "./components/layout/BottomNav";
import MobileDrawer from "./components/layout/MobileDrawer";

import NotifPanel from "./components/dashboard/NotifPanel";
import TodoPanel from "./components/dashboard/TodoPanel";
import DetailPanel from "./components/dashboard/DetailPanel";
import WOPanel from "./components/dashboard/WOPanel";

import ModalRoot from "./components/ui/ModalRoot";
import TargetsModal from "./components/modals/TargetsModal";

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
