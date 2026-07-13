import { useCallback } from 'react';
import * as notificationsService from '../../services/notificationsService';
import useFetch from '../../hooks/useFetch';

const SEVERITY_VARIANT = { high: 'danger', medium: 'warning', low: 'info' };

// Mode terkontrol: parent memberi `alerts` + `onReload` (dipakai Topbar agar badge count ikut sinkron).
// Mode mandiri: tanpa props data, komponen fetch sendiri (dipakai di Dashboard).
export default function NotificationsFeed({ compact = false, alerts: controlledAlerts, onReload }) {
  const isControlled = controlledAlerts !== undefined;

  const fetcher = useCallback(() => notificationsService.list(), []);
  const selfFetch = useFetch(isControlled ? () => Promise.resolve({ data: [] }) : fetcher, [fetcher]);

  const alerts = isControlled ? controlledAlerts : selfFetch.data;
  const loading = isControlled ? false : selfFetch.loading;
  const error = isControlled ? '' : selfFetch.error;
  const reload = isControlled ? onReload : selfFetch.reload;

  const handleMarkRead = async (id) => {
    await notificationsService.markRead(id);
    reload();
  };

  const handleMarkAllRead = async () => {
    await notificationsService.markAllRead();
    reload();
  };

  if (loading) return <div className="empty-state">Memuat notifikasi...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!alerts || alerts.length === 0) return <div className="empty-state">Tidak ada notifikasi</div>;

  const hasUnread = alerts.some((a) => !a.isRead);

  return (
    <div>
      {hasUnread && (
        <div style={{ textAlign: 'right', marginBottom: '0.4rem' }}>
          <button type="button" className="btn btn-sm" onClick={handleMarkAllRead}>
            Tandai semua dibaca
          </button>
        </div>
      )}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {alerts.map((a) => (
          <li
            key={a.notificationId}
            onClick={() => !a.isRead && handleMarkRead(a.notificationId)}
            style={{
              padding: compact ? '0.5rem 0' : '0.75rem 0',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'flex-start',
              opacity: a.isRead ? 0.55 : 1,
              cursor: a.isRead ? 'default' : 'pointer',
            }}
          >
            <span className={`badge badge-${SEVERITY_VARIANT[a.severity] || 'info'}`}>{a.type.replace(/_/g, ' ')}</span>
            <span className="text-sm">{a.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
