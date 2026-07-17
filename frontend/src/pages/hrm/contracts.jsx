import { useCallback, useEffect, useState } from 'react';
import * as contractService from '../../services/contractService';
import * as usersService from '../../services/usersService';
import useFetch from '../../hooks/useFetch';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/format';

const CONTRACT_TYPES = ['PKWT', 'PKWTT', 'Magang', 'Harian Lepas'];
const STATUSES = ['active', 'expired', 'terminated'];
const EMPTY_FORM = { userId: '', contractType: 'PKWT', startDate: '', endDate: '', baseSalary: '', status: 'active', notes: '' };

export default function ContractsPage() {
  const [userFilter, setUserFilter] = useState('');
  const [users, setUsers] = useState([]);
  const [modalContract, setModalContract] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    usersService.list().then((res) => setUsers(res.data));
  }, []);

  const fetchContracts = useCallback(
    () => contractService.list({ userId: userFilter || undefined }),
    [userFilter]
  );
  const { data: contracts, loading, error, reload } = useFetch(fetchContracts, [fetchContracts]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setModalContract({});
  };

  const openEdit = (contract) => {
    setForm({
      userId: contract.userId,
      contractType: contract.contractType,
      startDate: contract.startDate.slice(0, 10),
      endDate: contract.endDate ? contract.endDate.slice(0, 10) : '',
      baseSalary: contract.baseSalary,
      status: contract.status,
      notes: contract.notes || '',
    });
    setFormError('');
    setModalContract(contract);
  };

  const closeModal = () => setModalContract(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        userId: Number(form.userId),
        baseSalary: Number(form.baseSalary),
        endDate: form.endDate || undefined,
      };
      if (modalContract?.contractId) {
        await contractService.update(modalContract.contractId, payload);
      } else {
        await contractService.create(payload);
      }
      closeModal();
      reload();
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Gagal menyimpan kontrak');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (contract) => {
    if (!window.confirm(`Hapus kontrak ${contract.user?.name} (${contract.contractType})?`)) return;
    try {
      await contractService.deleteContract(contract.contractId);
      reload();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Gagal menghapus kontrak');
    }
  };

  const columns = [
    { key: 'user', label: 'Karyawan', render: (r) => r.user?.name },
    { key: 'contractType', label: 'Tipe Kontrak' },
    { key: 'startDate', label: 'Mulai', render: (r) => formatDate(r.startDate) },
    { key: 'endDate', label: 'Selesai', render: (r) => (r.endDate ? formatDate(r.endDate) : '-') },
    { key: 'baseSalary', label: 'Gaji Pokok', render: (r) => formatCurrency(r.baseSalary) },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="btn-group">
          <button type="button" className="btn btn-sm" onClick={() => openEdit(r)}>Edit</button>
          <button type="button" className="btn btn-sm" onClick={() => handleDelete(r)}>Hapus</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Kontrak Kerja</h1>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          + Tambah Kontrak
        </button>
      </div>

      <div className="filters">
        <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
          <option value="">Semua karyawan</option>
          {users.map((u) => (
            <option key={u.userId} value={u.userId}>{u.name}</option>
          ))}
        </select>
      </div>

      <DataTable columns={columns} rows={contracts} loading={loading} error={error} rowKey="contractId" />

      {modalContract && (
        <Modal title={modalContract.contractId ? 'Edit Kontrak' : 'Tambah Kontrak'} onClose={closeModal} width={560}>
          <form onSubmit={handleSubmit}>
            {formError && <div className="alert alert-error">{formError}</div>}
            <div className="form-grid">
              <div className="form-group full">
                <label>Karyawan</label>
                <select required value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
                  <option value="" disabled>Pilih karyawan</option>
                  {users.map((u) => (
                    <option key={u.userId} value={u.userId}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Tipe Kontrak</label>
                <select value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value })}>
                  {CONTRACT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Tanggal Mulai</label>
                <input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Tanggal Selesai (kosongkan untuk PKWTT)</label>
                <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
              <div className="form-group full">
                <label>Gaji Pokok</label>
                <input type="number" min="0" required value={form.baseSalary} onChange={(e) => setForm({ ...form, baseSalary: e.target.value })} />
              </div>
              <div className="form-group full">
                <label>Catatan</label>
                <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="btn-group" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={closeModal}>Batal</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
