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
];

export default function Sidebar() {
  const { role } = useAuth();
  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <nav style={{ width: 220, borderRight: '1px solid var(--color-border)', padding: '1rem', background: '#fff' }}>
      <div style={{ fontWeight: 700, marginBottom: '1rem' }}>Pixelso ERP</div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((item) => (
          <li key={item.to} style={{ marginBottom: '0.25rem' }}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              style={({ isActive }) => ({
                display: 'block',
                padding: '0.5rem 0.6rem',
                borderRadius: 6,
                textDecoration: 'none',
                color: isActive ? '#fff' : 'var(--color-text)',
                background: isActive ? 'var(--color-primary)' : 'transparent',
                fontSize: '0.88rem',
              })}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
