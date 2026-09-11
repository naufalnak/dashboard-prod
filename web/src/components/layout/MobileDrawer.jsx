import { X } from 'lucide-react';
import { useUI } from '../../contexts/UIContext.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { canSeeAllPages, canSeeMachinesPage, RESTRICTED_PAGES } from '../../roles.js';
import { NAV_ITEMS } from './Topbar.jsx';

// Sidebar menu -- default tersembunyi, dibuka lewat tombol hamburger di
// Topbar. Overlay penuh (position:fixed) supaya tidak menggeser tata
// letak halaman di belakangnya saat dibuka/ditutup (beda dari nav-links
// lama yang inline di Topbar, yang makin lebar tiap kali ada menu baru
// sampai mendesak ikon kanan atas keluar frame). Log Out sengaja TIDAK ada
// di sini -- sudah ada di avatar menu Topbar (kanan atas), tetap terlihat
// di mobile juga, jadi tidak diulang di drawer ini.
export default function MobileDrawer() {
  const { drawerOpen, setDrawerOpen, page, navigate } = useUI();
  const { username } = useAuth();
  const canSeeAll = canSeeAllPages(username);
  const visibleNavItems = NAV_ITEMS.filter((n) => {
    if (n.page === 'machines') return canSeeMachinesPage(username);
    return !n.page || canSeeAll || !RESTRICTED_PAGES.includes(n.page);
  });

  function go(n) {
    if (n.href) window.open(n.href, '_blank');
    else navigate(n.page);
    setDrawerOpen(false);
  }

  return (
    <div className={'mobile-drawer' + (drawerOpen ? ' show' : '')}>
      <div className="mobile-overlay" onClick={() => setDrawerOpen(false)}></div>
      <div className="mobile-sidebar">
        <div className="drawer-header">
          <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <img src="/logo-dharma.png" alt="" style={{ height: 22, width: 'auto', flexShrink: 0 }} />
            Produksi<span> - DPA</span>
          </div>
          <button className="modal-close" onClick={() => setDrawerOpen(false)}><X size={20} /></button>
        </div>

        <div className="sb-section">Menu</div>
        {visibleNavItems.map((n) => (
          <div
            key={n.page || n.href}
            className={'sb-item' + (n.page && page === n.page ? ' active' : '')}
            onClick={() => go(n)}
          >
            {n.label}
          </div>
        ))}
      </div>
    </div>
  );
}
