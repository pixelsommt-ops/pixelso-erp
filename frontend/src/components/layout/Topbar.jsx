import { useCallback, useState } from 'react';
import useAuthStore from '../../store/authStore';
import useFetch from '../../hooks/useFetch';
import * as notificationsService from '../../services/notificationsService';
import NotificationsFeed from '../common/NotificationsFeed';

export default function Topbar() {
  const { user, logout } = useAuthStore();
  const [bellOpen, setBellOpen] = useState(false);

  const fetchAlerts = useCallback(() => notificationsService.list(), []);
  const { data: alerts, reload } = useFetch(fetchAlerts, [fetchAlerts]);
  const count = alerts?.filter((a) => !a.isRead).length || 0;

  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: '1rem',
        padding: '0.75rem 1.5rem',
        borderBottom: '1px solid var(--color-border)',
        background: '#fff',
        position: 'relative',
      }}
    >
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
            <div
              className="card"
              style={{
                position: 'absolute',
                right: 0,
                top: '2.4rem',
                width: 340,
                maxHeight: 400,
                overflowY: 'auto',
                zIndex: 50,
              }}
            >
              <NotificationsFeed compact alerts={alerts} onReload={reload} />
            </div>
          </>
        )}
      </div>
      <span className="text-sm">
        {user?.name || 'Guest'} <span className="text-muted">({user?.role})</span>
      </span>
      <button type="button" className="btn btn-sm" onClick={logout}>
        Logout
      </button>
    </header>
  );
}
