import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';

// Layout dashboard utama (manajer/kasir/admin) - PRD 11 Blueprint Implementasi Teknis
export default function MainLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="app-main">
        <Topbar onMenuClick={() => setMenuOpen(true)} />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
