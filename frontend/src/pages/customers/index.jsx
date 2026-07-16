import { useCallback, useEffect, useState } from 'react';
import * as customersService from '../../services/customersService';
import useFetch from '../../hooks/useFetch';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate } from '../../utils/format';

const EMPTY_FORM = { name: '', phone: '', segment: '', source: '' };

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalCustomer, setModalCustomer] = useState(null); // create/edit form
  const [detailCustomer, setDetailCustomer] = useState(null); // read-only detail + order history
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchCustomers = useCallback(() => customersService.list({ search: search || undefined, page }), [search, page]);
  const { data: listResult, loading, error, reload } = useFetch(fetchCustomers, [fetchCustomers]);
  const customers = listResult?.customers;

  useEffect(() => {
    setPage(1);
  }, [search]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setModalCustomer({});
  };

  const openEdit = (customer, e) => {
    e.stopPropagation();
    setForm({
      name: customer.name,
      phone: customer.phone || '',
      segment: customer.segment || '',
      source: customer.source || '',
    });
    setFormError('');
    setModalCustomer(customer);
  };

  const openDetail = async (customer) => {
    const { data } = await customersService.getById(customer.customerId);
    setDetailCustomer(data);
  };

  const closeModal = () => setModalCustomer(null);
  const closeDetail = () => setDetailCustomer(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      if (modalCustomer?.customerId) {
        await customersService.update(modalCustomer.customerId, form);
      } else {
        await customersService.create(form);
      }
      closeModal();
      reload();
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Gagal menyimpan customer');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Nama' },
    { key: 'phone', label: 'No. HP', render: (r) => r.phone || '-' },
    { key: 'segment', label: 'Segmen', render: (r) => (r.segment ? <StatusBadge status={r.segment} /> : '-') },
    { key: 'source', label: 'Sumber', render: (r) => r.source || '-' },
    { key: 'orderCount', label: 'Total Order' },
    {
      key: 'isRepeatCustomer',
      label: 'Repeat',
      render: (r) => (r.isRepeatCustomer ? <span className="badge badge-success">repeat</span> : '-'),
    },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <button type="button" className="btn btn-sm" onClick={(e) => openEdit(r, e)}>
          Edit
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Customer & CRM</h1>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          + Tambah Customer
        </button>
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="Cari nama/no. HP..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <DataTable
        columns={columns}
        rows={customers}
        loading={loading}
        error={error}
        rowKey="customerId"
        onRowClick={openDetail}
      />

      {listResult && listResult.totalPages > 1 && (
        <div className="btn-group" style={{ marginTop: '0.75rem', justifyContent: 'center', alignItems: 'center' }}>
          <button type="button" className="btn btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            &larr; Sebelumnya
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #666)' }}>
            Halaman {listResult.page} dari {listResult.totalPages} ({listResult.total} customer)
          </span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setPage((p) => Math.min(listResult.totalPages, p + 1))}
            disabled={page >= listResult.totalPages}
          >
            Selanjutnya &rarr;
          </button>
        </div>
      )}

      {modalCustomer && (
        <Modal title={modalCustomer.customerId ? 'Edit Customer' : 'Tambah Customer'} onClose={closeModal}>
          <form onSubmit={handleSubmit}>
            {formError && <div className="alert alert-error">{formError}</div>}
            <div className="form-grid">
              <div className="form-group full">
                <label>Nama</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>No. HP</label>
                <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Segmen</label>
                <input
                  type="text"
                  placeholder="retail / korporat / dst"
                  value={form.segment}
                  onChange={(e) => setForm({ ...form, segment: e.target.value })}
                />
              </div>
              <div className="form-group full">
                <label>Sumber</label>
                <input
                  type="text"
                  placeholder="whatsapp / walk-in / instagram / dst"
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                />
              </div>
            </div>
            <div className="btn-group" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={closeModal}>
                Batal
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {detailCustomer && (
        <Modal title={detailCustomer.name} onClose={closeDetail}>
          <div className="text-sm text-muted" style={{ marginBottom: '0.75rem' }}>
            {detailCustomer.phone || '-'} &middot; {detailCustomer.segment || 'tanpa segmen'} &middot;{' '}
            {detailCustomer.source || 'tanpa sumber'}
            {detailCustomer.isRepeatCustomer && (
              <span className="badge badge-success" style={{ marginLeft: '0.5rem' }}>
                repeat customer
              </span>
            )}
          </div>
          <h3 style={{ fontSize: '0.95rem' }}>Riwayat Order ({detailCustomer.orderCount})</h3>
          {detailCustomer.orderHistory.length === 0 ? (
            <div className="empty-state">Belum ada order</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>No. PO</th>
                    <th>Status</th>
                    <th>Dibuat</th>
                    <th>Deadline</th>
                  </tr>
                </thead>
                <tbody>
                  {detailCustomer.orderHistory.map((o) => (
                    <tr key={o.poId}>
                      <td>{o.poNumber}</td>
                      <td>
                        <StatusBadge status={o.status} />
                      </td>
                      <td>{formatDate(o.createdAt)}</td>
                      <td>{formatDate(o.dueAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
