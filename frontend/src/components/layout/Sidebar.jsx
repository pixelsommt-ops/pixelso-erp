import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

// Menu mengikuti modul M01-M12 (PRD 3.2).
// `roles: null` berarti terbuka untuk semua role login. Untuk modul yang backend-nya
// membatasi seluruh router ke role tertentu (Marketing, Users), item disembunyikan
// dari role lain supaya tidak menabrak 403.
// Item boleh punya `children` (submenu grup, mis. "HRM & Payroll") sebagai ganti `to` langsung.
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
  {
    label: 'HRM & Payroll',
    roles: null,
    children: [
      { to: '/hrm/positions', label: 'Jabatan & Hierarki' },
      { to: '/hrm/contracts', label: 'Kontrak Kerja' },
      { to: '/hrm/attendance', label: 'Kehadiran' },
      { to: '/hrm/shifts', label: 'Manajemen Shift' },
    ],
  },
  { to: '/customers', label: 'Customer & CRM', roles: null },
  { to: '/users', label: 'User & Role', roles: ['manager'] },
  { to: '/pricing', label: 'Harga Website (Kalkulator)', roles: ['manager'] },
  { to: '/settings', label: 'Halaman Depan (Website)', roles: ['manager'] },
  { to: '/promo', label: 'Promo', roles: ['manager'] },
  { to: '/theme', label: 'Tema Website', roles: ['manager'] },
];

export default function Sidebar({ open, onClose }) {
  const { role } = useAuth();
  const location = useLocation();
  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

  // Grup auto-expand kalau route aktif ada di dalam salah satu child-nya.
  const [openGroups, setOpenGroups] = useState(() => {
    const initial = {};
    items.forEach((item) => {
      if (item.children?.some((child) => location.pathname.startsWith(child.to))) {
        initial[item.label] = true;
      }
    });
    return initial;
  });

  const toggleGroup = (label) => setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

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
          {items.map((item) =>
            item.children ? (
              <li key={item.label}>
                <button type="button" className="sidebar-group-toggle" onClick={() => toggleGroup(item.label)}>
                  <span>{item.label}</span>
                  <span className={`sidebar-group-chevron ${openGroups[item.label] ? 'sidebar-group-chevron-open' : ''}`}>
                    &#9656;
                  </span>
                </button>
                {openGroups[item.label] && (
                  <ul className="sidebar-submenu">
                    {item.children.map((child) => (
                      <li key={child.to}>
                        <NavLink
                          to={child.to}
                          onClick={onClose}
                          className={({ isActive }) => `sidebar-submenu-link ${isActive ? 'sidebar-submenu-link-active' : ''}`}
                        >
                          {child.label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ) : (
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
            )
          )}
        </ul>
      </nav>
    </>
  );
}
