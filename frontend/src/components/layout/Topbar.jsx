import { useCallback, useState } from 'react';
import useAuthStore from '../../store/authStore';
import useFetch from '../../hooks/useFetch';
import * as notificationsService from '../../services/notificationsService';
import NotificationsFeed from '../common/NotificationsFeed';

export default function Topbar({ onMenuClick }) {
  const { user, logout } = useAuthStore();
  const [bellOpen, setBellOpen] = useState(false);

  const fetchAlerts = useCallback(() => notificationsService.list(), []);
  const { data: alerts, reload } = useFetch(fetchAlerts, [fetchAlerts]);
  const count = alerts?.filter((a) => !a.isRead).length || 0;

  return (
    <header className="topbar">
      <button type="button" className="hamburger-btn" onClick={onMenuClick} aria-label="Buka menu">
        <span />
        <span />
        <span />
      </button>

      <div className="topbar-spacer" />

      <div style={{ position: 'relative' }}>
        <button type="button" className="btn btn-sm" onClick={() => setBellOpen((v) => !v)}>
          Notifikasi{count > 0 ? ` (${count})` : ''}
        </button>
        {bellOpen && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 40 }}
              onClick={() => setBellOpen(false)}
            />
            <div className="card notif-dropdown">
              <NotificationsFeed compact alerts={alerts} onReload={reload} />
            </div>
          </>
        )}
      </div>
      <span className="text-sm topbar-user">
        {user?.name || 'Guest'} <span className="text-muted">({user?.role})</span>
      </span>
      <button type="button" className="btn btn-sm" onClick={logout}>
        Logout
      </button>
    </header>
  );
}
