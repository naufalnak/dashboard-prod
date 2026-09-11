import { ChevronLeft, ChevronRight, LayoutDashboard, Factory, Table2, ShieldAlert, Clock, Wrench, AlertTriangle, AlertOctagon, Database, ClipboardList } from 'lucide-react';
import { useUI } from '../../contexts/UIContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { canSeeAllPages, canSeeMachinesPage, RESTRICTED_PAGES } from '../../roles.js';
import { NAV_ITEMS } from './Topbar.jsx';

const NAV_ICONS = {
  dashboard: LayoutDashboard,
  machines: Factory,
  dataproduksi: Table2,
  datarejection: ShieldAlert,
  dataovertime: Clock,
  datarework: Wrench,
  problemlog: AlertTriangle,
  downtimeproduksi: AlertOctagon,
  masterdata: Database,
};

// Sidebar utama desktop -- rail ikon saja secara default (kolom sempit di
// .shell), melebar + menampilkan label saat tombol chevron di dalam rail
// dipencet (toggleSidebar, lihat UIContext). Beda dari MobileDrawer yang
// tetap dipakai apa adanya untuk layar mobile (disembunyikan lewat CSS di
// breakpoint ≤767px, lihat index.css).
// Tombol Log Out & toggle ciutkan/lebarkan sengaja TIDAK dobel dengan yang
// lain: Log Out sudah ada di avatar menu Topbar (kanan atas) untuk semua
// user, jadi tidak diulang lagi di sini. Toggle chevron ditaruh di baris
// paling bawah rail (bukan atas) sesuai permintaan.
export default function AppSidebar() {
  const { sidebarOpen, toggleSidebar, page, navigate } = useUI();
  const { username } = useAuth();
  const canSeeAll = canSeeAllPages(username);
  const visibleNavItems = NAV_ITEMS.filter((n) => {
    if (n.page === 'machines') return canSeeMachinesPage(username);
    return !n.page || canSeeAll || !RESTRICTED_PAGES.includes(n.page);
  });

  function go(n) {
    if (n.href) window.open(n.href, '_blank');
    else navigate(n.page);
  }

  return (
    <div className="app-sidebar">
      <div className="asb-section">Menu</div>
      {visibleNavItems.map((n) => {
        const Icon = NAV_ICONS[n.page] || ClipboardList;
        return (
          <div
            key={n.page || n.href}
            className={'asb-item' + (n.page && page === n.page ? ' active' : '')}
            onClick={() => go(n)}
            title={n.label}
          >
            <span className="asb-icon"><Icon size={16} /></span>
            <span className="asb-label">{n.label}</span>
          </div>
        );
      })}

      <button className="asb-toggle" onClick={toggleSidebar} title={sidebarOpen ? 'Ciutkan menu' : 'Lebarkan menu'}>
        {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>
    </div>
  );
}
