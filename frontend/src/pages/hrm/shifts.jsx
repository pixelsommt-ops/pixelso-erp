import { useCallback, useEffect, useState } from 'react';
import * as shiftService from '../../services/shiftService';
import * as usersService from '../../services/usersService';
import useFetch from '../../hooks/useFetch';
import useAuth from '../../hooks/useAuth';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import { formatDate, todayISODate } from '../../utils/format';

const EMPTY_SHIFT_FORM = { name: '', startTime: '', endTime: '' };
const EMPTY_ASSIGNMENT_FORM = { userId: '', shiftId: '', date: todayISODate() };

export default function ShiftsPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole('hrd', 'manager');

  const [users, setUsers] = useState([]);
  const [modalShift, setModalShift] = useState(null);
  const [shiftForm, setShiftForm] = useState(EMPTY_SHIFT_FORM);
  const [shiftError, setShiftError] = useState('');
  const [submittingShift, setSubmittingShift] = useState(false);

  const [modalAssignment, setModalAssignment] = useState(null);
  const [assignmentForm, setAssignmentForm] = useState(EMPTY_ASSIGNMENT_FORM);
  const [assignmentError, setAssignmentError] = useState('');
  const [submittingAssignment, setSubmittingAssignment] = useState(false);
  const [assignmentDateFrom, setAssignmentDateFrom] = useState(todayISODate());
  const [assignmentDateTo, setAssignmentDateTo] = useState('');

  useEffect(() => {
    usersService.list().then((res) => setUsers(res.data));
  }, []);

  const fetchShifts = useCallback(() => shiftService.listShifts(), []);
  const { data: shifts, loading: loadingShifts, error: shiftsError, reload: reloadShifts } =
    useFetch(fetchShifts, [fetchShifts]);

  const fetchAssignments = useCallback(
    () => shiftService.listAssignments({ dateFrom: assignmentDateFrom || undefined, dateTo: assignmentDateTo || undefined }),
    [assignmentDateFrom, assignmentDateTo]
  );
  const { data: assignments, loading: loadingAssignments, error: assignmentsError, reload: reloadAssignments } =
    useFetch(fetchAssignments, [fetchAssignments]);

  const openCreateShift = () => {
    setShiftForm(EMPTY_SHIFT_FORM);
    setShiftError('');
    setModalShift({});
  };
  const openEditShift = (shift) => {
    setShiftForm({ name: shift.name, startTime: shift.startTime, endTime: shift.endTime });
    setShiftError('');
    setModalShift(shift);
  };
  const closeShiftModal = () => setModalShift(null);

  const handleShiftSubmit = async (e) => {
    e.preventDefault();
    setShiftError('');
    setSubmittingShift(true);
    try {
      if (modalShift?.shiftId) {
        await shiftService.updateShift(modalShift.shiftId, shiftForm);
      } else {
        await shiftService.createShift(shiftForm);
      }
      closeShiftModal();
      reloadShifts();
    } catch (err) {
      setShiftError(err?.response?.data?.message || 'Gagal menyimpan shift');
    } finally {
      setSubmittingShift(false);
    }
  };

  const handleDeleteShift = async (shift) => {
    if (!window.confirm(`Hapus shift "${shift.name}"?`)) return;
    try {
      await shiftService.deleteShift(shift.shiftId);
      reloadShifts();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Gagal menghapus shift');
    }
  };

  const openCreateAssignment = () => {
    setAssignmentForm(EMPTY_ASSIGNMENT_FORM);
    setAssignmentError('');
    setModalAssignment({});
  };
  const closeAssignmentModal = () => setModalAssignment(null);

  const handleAssignmentSubmit = async (e) => {
    e.preventDefault();
    setAssignmentError('');
    setSubmittingAssignment(true);
    try {
      await shiftService.createAssignment({
        userId: Number(assignmentForm.userId),
        shiftId: Number(assignmentForm.shiftId),
        date: assignmentForm.date,
      });
      closeAssignmentModal();
      reloadAssignments();
    } catch (err) {
      setAssignmentError(err?.response?.data?.message || 'Gagal menugaskan shift');
    } finally {
      setSubmittingAssignment(false);
    }
  };

  const handleDeleteAssignment = async (assignment) => {
    if (!window.confirm(`Batalkan penugasan shift ${assignment.user?.name} tanggal ${formatDate(assignment.date)}?`)) return;
    try {
      await shiftService.deleteAssignment(assignment.assignmentId);
      reloadAssignments();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Gagal membatalkan penugasan');
    }
  };

  const shiftColumns = [
    { key: 'name', label: 'Nama Shift' },
    { key: 'startTime', label: 'Mulai' },
    { key: 'endTime', label: 'Selesai' },
    ...(canManage
      ? [
          {
            key: 'actions',
            label: '',
            render: (r) => (
              <div className="btn-group">
                <button type="button" className="btn btn-sm" onClick={() => openEditShift(r)}>Edit</button>
                <button type="button" className="btn btn-sm" onClick={() => handleDeleteShift(r)}>Hapus</button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const assignmentColumns = [
    { key: 'date', label: 'Tanggal', render: (r) => formatDate(r.date) },
    { key: 'user', label: 'Karyawan', render: (r) => r.user?.name },
    { key: 'shift', label: 'Shift', render: (r) => `${r.shift?.name} (${r.shift?.startTime}-${r.shift?.endTime})` },
    ...(canManage
      ? [
          {
            key: 'actions',
            label: '',
            render: (r) => (
              <button type="button" className="btn btn-sm" onClick={() => handleDeleteAssignment(r)}>Batalkan</button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Manajemen Shift</h1>
        {canManage && (
          <button type="button" className="btn btn-primary" onClick={openCreateShift}>
            + Tambah Shift
          </button>
        )}
      </div>
      <DataTable columns={shiftColumns} rows={shifts} loading={loadingShifts} error={shiftsError} rowKey="shiftId" />

      <div className="page-header" style={{ marginTop: '2rem' }}>
        <h1 style={{ fontSize: '1rem' }}>Penugasan Shift</h1>
        {canManage && (
          <button type="button" className="btn btn-primary" onClick={openCreateAssignment}>
            + Tugaskan Shift
          </button>
        )}
      </div>
      <div className="filters">
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, margin: 0 }}>
          Dari
          <input type="date" value={assignmentDateFrom} onChange={(e) => setAssignmentDateFrom(e.target.value)} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, margin: 0 }}>
          Sampai
          <input type="date" value={assignmentDateTo} onChange={(e) => setAssignmentDateTo(e.target.value)} />
        </label>
      </div>
      <DataTable
        columns={assignmentColumns}
        rows={assignments}
        loading={loadingAssignments}
        error={assignmentsError}
        rowKey="assignmentId"
      />

      {modalShift && (
        <Modal title={modalShift.shiftId ? 'Edit Shift' : 'Tambah Shift'} onClose={closeShiftModal}>
          <form onSubmit={handleShiftSubmit}>
            {shiftError && <div className="alert alert-error">{shiftError}</div>}
            <div className="form-grid">
              <div className="form-group full">
                <label>Nama Shift</label>
                <input type="text" required placeholder="mis. Shift Pagi" value={shiftForm.name} onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Jam Mulai</label>
                <input type="time" required value={shiftForm.startTime} onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Jam Selesai</label>
                <input type="time" required value={shiftForm.endTime} onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })} />
              </div>
            </div>
            <div className="btn-group" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={closeShiftModal}>Batal</button>
              <button type="submit" className="btn btn-primary" disabled={submittingShift}>
                {submittingShift ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modalAssignment && (
        <Modal title="Tugaskan Shift" onClose={closeAssignmentModal}>
          <form onSubmit={handleAssignmentSubmit}>
            {assignmentError && <div className="alert alert-error">{assignmentError}</div>}
            <div className="form-grid">
              <div className="form-group full">
                <label>Karyawan</label>
                <select required value={assignmentForm.userId} onChange={(e) => setAssignmentForm({ ...assignmentForm, userId: e.target.value })}>
                  <option value="" disabled>Pilih karyawan</option>
                  {users.map((u) => (
                    <option key={u.userId} value={u.userId}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group full">
                <label>Shift</label>
                <select required value={assignmentForm.shiftId} onChange={(e) => setAssignmentForm({ ...assignmentForm, shiftId: e.target.value })}>
                  <option value="" disabled>Pilih shift</option>
                  {(shifts || []).map((s) => (
                    <option key={s.shiftId} value={s.shiftId}>{s.name} ({s.startTime}-{s.endTime})</option>
                  ))}
                </select>
              </div>
              <div className="form-group full">
                <label>Tanggal</label>
                <input type="date" required value={assignmentForm.date} onChange={(e) => setAssignmentForm({ ...assignmentForm, date: e.target.value })} />
              </div>
            </div>
            <div className="btn-group" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={closeAssignmentModal}>Batal</button>
              <button type="submit" className="btn btn-primary" disabled={submittingAssignment}>
                {submittingAssignment ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
