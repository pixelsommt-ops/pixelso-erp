import { useCallback, useEffect, useState } from 'react';
import * as customersService from '../../services/customersService';
import useFetch from '../../hooks/useFetch';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate, todayISODate, waLink } from '../../utils/format';

const EMPTY_FORM = { name: '', phone: '', segment: '', source: '' };

const SEGMENT_OPTIONS = [
  { value: '', label: 'Semua segmen' },
  { value: 'retail', label: 'Retail' },
  { value: 'Grosir 1', label: 'Grosir 1' },
  { value: 'Grosir 2', label: 'Grosir 2' },
];

const DORMANT_DAY_OPTIONS = [10, 20, 30, 40, 50, 60];

function daysSince(date) {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

function WhatsappIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.07c-.24.68-1.4 1.3-1.94 1.38-.5.08-1.12.11-1.81-.11-.42-.13-.95-.31-1.64-.6-2.88-1.24-4.76-4.14-4.9-4.33-.14-.19-1.17-1.56-1.17-2.98 0-1.42.74-2.11 1-2.4.26-.29.57-.36.76-.36.19 0 .38 0 .55.01.18.01.41-.07.64.49.24.58.81 1.99.88 2.13.07.14.12.31.02.5-.1.19-.15.31-.29.48-.14.17-.3.37-.43.5-.14.14-.29.29-.12.57.17.29.75 1.24 1.62 2 1.11.99 2.05 1.3 2.34 1.44.29.14.46.12.63-.07.17-.19.72-.84.92-1.13.19-.29.39-.24.65-.14.26.1 1.66.78 1.95.93.29.14.48.21.55.34.07.12.07.7-.17 1.38Z" />
    </svg>
  );
}

export default function CustomersPage() {
  const [tab, setTab] = useState('list');
  const [detailCustomer, setDetailCustomer] = useState(null); // read-only detail + order history, dipakai kedua tab

  const openDetail = async (customer) => {
    const { data } = await customersService.getById(customer.customerId);
    setDetailCustomer(data);
  };
  const closeDetail = () => setDetailCustomer(null);

  return (
    <div>
      <div className="page-header">
        <h1>Customer & CRM</h1>
      </div>

      <div className="tabs">
        <button type="button" className={`tab ${tab === 'list' ? 'active' : ''}`} onClick={() => setTab('list')}>
          Daftar Customer
        </button>
        <button type="button" className={`tab ${tab === 'dormant' ? 'active' : ''}`} onClick={() => setTab('dormant')}>
          Customer Tidak Aktif
        </button>
      </div>

      {tab === 'list' && <CustomerListTab openDetail={openDetail} />}
      {tab === 'dormant' && <DormantCustomersTab openDetail={openDetail} />}

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

function CustomerListTab({ openDetail }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalCustomer, setModalCustomer] = useState(null); // create/edit form
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

  const closeModal = () => setModalCustomer(null);

  const handleDelete = async (customer, e) => {
    e.stopPropagation();
    if (!window.confirm(`Hapus customer "${customer.name}"?`)) return;
    try {
      await customersService.deleteCustomer(customer.customerId);
      reload();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Gagal menghapus customer');
    }
  };

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
        <div className="btn-group">
          <button type="button" className="btn btn-sm" onClick={(e) => openEdit(r, e)}>
            Edit
          </button>
          <button type="button" className="btn btn-sm" onClick={(e) => handleDelete(r, e)}>
            Hapus
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div />
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
    </div>
  );
}

function DormantCustomersTab({ openDetail }) {
  const [days, setDays] = useState(30);
  const [segment, setSegment] = useState('');
  const [search, setSearch] = useState('');

  const fetchDormant = useCallback(() => customersService.getDormant({ days, segment: segment || undefined }), [days, segment]);
  const { data, loading, error } = useFetch(fetchDormant, [fetchDormant]);

  const rows = (data || []).filter((c) => !search.trim() || c.name.toLowerCase().includes(search.trim().toLowerCase()));

  const exportToExcel = async () => {
    const XLSX = await import('xlsx');
    const sheetRows = rows.map((r) => ({
      Nama: r.name,
      'No. HP': r.phone || '-',
      Segmen: r.segment || '-',
      'Order Terakhir': formatDate(r.lastOrderAt),
      'Tidak Order (hari)': daysSince(r.lastOrderAt),
      'Total Order': r.orderCount,
    }));
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customer Tidak Aktif');
    const segmentSlug = (segment || 'semua-segmen').replace(/\s+/g, '-');
    XLSX.writeFile(wb, `customer-tidak-aktif-${days}hari-${segmentSlug}-${todayISODate()}.xlsx`);
  };

  const columns = [
    {
      key: 'name',
      label: 'Nama',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {r.phone && (
            <a
              href={waLink(r.phone, `Halo ${r.name}, apa kabar? Sudah ${daysSince(r.lastOrderAt)} hari nih sejak order terakhir di Pixelso. Ada yang bisa kami bantu untuk pesanan berikutnya?`)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Hubungi via WhatsApp"
              style={{ display: 'inline-flex', flexShrink: 0 }}
            >
              <WhatsappIcon />
            </a>
          )}
          <span>{r.name}</span>
        </div>
      ),
      sortValue: (r) => r.name,
    },
    { key: 'phone', label: 'No. HP', render: (r) => r.phone || '-' },
    { key: 'segment', label: 'Segmen', render: (r) => (r.segment ? <StatusBadge status={r.segment} /> : '-') },
    { key: 'lastOrderAt', label: 'Order Terakhir', render: (r) => formatDate(r.lastOrderAt) },
    { key: 'idleDays', label: 'Tidak Order', render: (r) => `${daysSince(r.lastOrderAt)} hari`, sortValue: (r) => daysSince(r.lastOrderAt) },
    { key: 'orderCount', label: 'Total Order' },
  ];

  return (
    <div>
      <div className="filters">
        <input
          type="text"
          placeholder="Cari nama..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {DORMANT_DAY_OPTIONS.map((d) => (
            <option key={d} value={d}>
              Lebih dari {d} hari
            </option>
          ))}
        </select>
        <select value={segment} onChange={(e) => setSegment(e.target.value)}>
          {SEGMENT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-sm" onClick={exportToExcel} disabled={rows.length === 0}>
          Export ke Excel
        </button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        rowKey="customerId"
        onRowClick={openDetail}
        emptyLabel="Tidak ada customer yang tidak order dalam rentang ini"
      />
    </div>
  );
}
