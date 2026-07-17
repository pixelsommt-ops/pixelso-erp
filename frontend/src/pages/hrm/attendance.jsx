import { useCallback, useState } from 'react';
import * as attendanceService from '../../services/attendanceService';
import useFetch from '../../hooks/useFetch';
import useAuth from '../../hooks/useAuth';
import DataTable from '../../components/common/DataTable';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate } from '../../utils/format';

// Ambil koordinat GPS browser (opsional) - gagal diam-diam kalau ditolak/tidak didukung, tetap
// lanjut absen tanpa koordinat. Timeout pendek supaya tidak menggantung tombol absen lama-lama.
function getCoords() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({}),
      { timeout: 4000 }
    );
  });
}

export default function AttendancePage() {
  const { hasRole } = useAuth();
  const canSeeAll = hasRole('hrd', 'manager');

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const fetchAttendance = useCallback(
    () => attendanceService.list({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
    [dateFrom, dateTo]
  );
  const { data: records, loading, error, reload } = useFetch(fetchAttendance, [fetchAttendance]);

  const handleCheckIn = async () => {
    setActionError('');
    setActionLoading('in');
    try {
      const coords = await getCoords();
      await attendanceService.checkIn(coords);
      reload();
    } catch (err) {
      setActionError(err?.response?.data?.message || 'Gagal absen masuk');
    } finally {
      setActionLoading('');
    }
  };

  const handleCheckOut = async () => {
    setActionError('');
    setActionLoading('out');
    try {
      const coords = await getCoords();
      await attendanceService.checkOut(coords);
      reload();
    } catch (err) {
      setActionError(err?.response?.data?.message || 'Gagal absen pulang');
    } finally {
      setActionLoading('');
    }
  };

  const columns = [
    ...(canSeeAll ? [{ key: 'user', label: 'Karyawan', render: (r) => r.user?.name }] : []),
    { key: 'date', label: 'Tanggal', render: (r) => formatDate(r.date) },
    { key: 'checkInAt', label: 'Masuk', render: (r) => (r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-') },
    { key: 'checkOutAt', label: 'Pulang', render: (r) => (r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-') },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'source', label: 'Sumber' },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Kehadiran</h1>
      </div>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        {actionError && <div className="alert alert-error">{actionError}</div>}
        <div className="btn-group">
          <button type="button" className="btn btn-primary" disabled={actionLoading !== ''} onClick={handleCheckIn}>
            {actionLoading === 'in' ? 'Memproses...' : 'Absen Masuk'}
          </button>
          <button type="button" className="btn" disabled={actionLoading !== ''} onClick={handleCheckOut}>
            {actionLoading === 'out' ? 'Memproses...' : 'Absen Pulang'}
          </button>
        </div>
        <small style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-muted, #666)' }}>
          Lokasi GPS diambil otomatis kalau browser mengizinkan - tidak wajib, absen tetap tercatat tanpa lokasi.
        </small>
      </div>

      <div className="filters">
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, margin: 0 }}>
          Dari
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, margin: 0 }}>
          Sampai
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>
      </div>

      <DataTable columns={columns} rows={records} loading={loading} error={error} rowKey="attendanceId" />
    </div>
  );
}
