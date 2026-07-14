import { NavLink } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

// Menu mengikuti modul M01-M12 (PRD 3.2).
// `roles: null` berarti terbuka untuk semua role login. Untuk modul yang backend-nya
// membatasi seluruh router ke role tertentu (Marketing, Users), item disembunyikan
// dari role lain supaya tidak menabrak 403.
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', roles: null },
  { to: '/production-orders', label: 'Production Order (PO)', roles: null },
  { to: '/pos', label: 'POS & Pembayaran', roles: null },
  { to: '/inventory', label: 'Inventory', roles: null },
  { to: '/products', label: 'Master Produk', roles: null },
  { to: '/production', label: 'Produksi', roles: null },
  { to: '/qc-delivery', label: 'QC & Delivery', roles: null },
  { to: '/finance', label: 'Finance & Bonus', roles: null },
  { to: '/marketing', label: 'Marketing Analytics', roles: ['marketing', 'manager'] },
  { to: '/hrd', label: 'HRD Productivity', roles: null },
  { to: '/customers', label: 'Customer & CRM', roles: null },
  { to: '/users', label: 'User & Role', roles: ['manager'] },
  { to: '/pricing', label: 'Harga Website (Kalkulator)', roles: ['manager'] },
];

export default function Sidebar({ open, onClose }) {
  const { role } = useAuth();
  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <nav className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">Pixelso ERP</span>
          <button type="button" className="sidebar-close" onClick={onClose} aria-label="Tutup menu">
            &times;
          </button>
        </div>
        <ul className="sidebar-nav">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                onClick={onClose}
                className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
