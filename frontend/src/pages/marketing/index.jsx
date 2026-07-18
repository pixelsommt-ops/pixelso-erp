import { useCallback, useMemo, useState } from 'react';
import * as marketingService from '../../services/marketingService';
import useFetch from '../../hooks/useFetch';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import { formatCurrency, formatDate, firstDayOfMonthISO, todayISODate } from '../../utils/format';

function filterRows(rows, search) {
  if (!search.trim()) return rows;
  const q = search.trim().toLowerCase();
  return (rows || []).filter((row) => Object.values(row).some((v) => v != null && String(v).toLowerCase().includes(q)));
}

const TABS = [
  { key: 'campaigns', label: 'Campaign' },
  { key: 'top-products', label: 'Produk Terlaris' },
  { key: 'channels', label: 'Channel' },
  { key: 'repeat-customers', label: 'Repeat Customer' },
  { key: 'cohort', label: 'Cohort' },
];

export default function MarketingPage() {
  const [tab, setTab] = useState('campaigns');
  const [from, setFrom] = useState(firstDayOfMonthISO());
  const [to, setTo] = useState(todayISODate());

  return (
    <div>
      <div className="page-header">
        <h1>Marketing Analytics</h1>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {(tab === 'top-products' || tab === 'channels') && (
        <div className="filters">
          <div className="form-group">
            <label>Dari</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Sampai</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      )}

      {tab === 'campaigns' && <CampaignsView />}
      {tab === 'top-products' && <TopProductsView from={from} to={to} />}
      {tab === 'channels' && <ChannelsView from={from} to={to} />}
      {tab === 'repeat-customers' && <RepeatCustomersView />}
      {tab === 'cohort' && <CohortView />}
    </div>
  );
}

const CAMPAIGN_STATUSES = ['planned', 'active', 'completed', 'cancelled'];
const EMPTY_CAMPAIGN_FORM = { name: '', channel: '', startDate: '', endDate: '', budget: 0, status: 'planned', notes: '' };

function CampaignsView() {
  const [statusFilter, setStatusFilter] = useState('');
  const [modalCampaign, setModalCampaign] = useState(null);
  const [form, setForm] = useState(EMPTY_CAMPAIGN_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetcher = useCallback(() => marketingService.list({ status: statusFilter || undefined }), [statusFilter]);
  const { data: campaigns, loading, error, reload } = useFetch(fetcher, [fetcher]);

  const openCreate = () => {
    setForm(EMPTY_CAMPAIGN_FORM);
    setFormError('');
    setModalCampaign({});
  };

  const openEdit = (campaign) => {
    setForm({
      name: campaign.name,
      channel: campaign.channel || '',
      startDate: campaign.startDate ? campaign.startDate.slice(0, 10) : '',
      endDate: campaign.endDate ? campaign.endDate.slice(0, 10) : '',
      budget: campaign.budget,
      status: campaign.status,
      notes: campaign.notes || '',
    });
    setFormError('');
    setModalCampaign(campaign);
  };

  const closeModal = () => setModalCampaign(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const payload = { ...form, budget: Number(form.budget) || 0 };
      if (modalCampaign?.campaignId) {
        await marketingService.update(modalCampaign.campaignId, payload);
      } else {
        await marketingService.create(payload);
      }
      closeModal();
      reload();
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Gagal menyimpan campaign');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Nama Campaign' },
    { key: 'channel', label: 'Channel', render: (r) => r.channel || '-' },
    { key: 'startDate', label: 'Mulai', render: (r) => formatDate(r.startDate) },
    { key: 'endDate', label: 'Selesai', render: (r) => formatDate(r.endDate) },
    { key: 'budget', label: 'Budget', render: (r) => formatCurrency(r.budget) },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <button type="button" className="btn btn-sm" onClick={() => openEdit(r)}>
          Edit
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="filters" style={{ marginBottom: 0 }}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Semua status</option>
            {CAMPAIGN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          + Tambah Campaign
        </button>
      </div>

      <DataTable columns={columns} rows={campaigns} loading={loading} error={error} rowKey="campaignId" />

      {modalCampaign && (
        <Modal title={modalCampaign.campaignId ? 'Edit Campaign' : 'Tambah Campaign'} onClose={closeModal}>
          <form onSubmit={handleSubmit}>
            {formError && <div className="alert alert-error">{formError}</div>}
            <div className="form-grid">
              <div className="form-group full">
                <label>Nama Campaign</label>
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Channel</label>
                <input
                  type="text"
                  placeholder="instagram / whatsapp / dst"
                  value={form.channel}
                  onChange={(e) => setForm({ ...form, channel: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {CAMPAIGN_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Tanggal Mulai</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Tanggal Selesai</label>
                <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
              <div className="form-group full">
                <label>Budget</label>
                <input type="number" min="0" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
              </div>
              <div className="form-group full">
                <label>Catatan</label>
                <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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

function TopProductsView({ from, to }) {
  const [search, setSearch] = useState('');
  const fetcher = useCallback(() => marketingService.getTopProducts({ from, to }), [from, to]);
  const { data, loading, error } = useFetch(fetcher, [fetcher]);
  const rows = useMemo(() => filterRows(data, search), [data, search]);

  const columns = [
    { key: 'name', label: 'Produk' },
    { key: 'category', label: 'Kategori', render: (r) => r.category || '-' },
    { key: 'totalQty', label: 'Total Qty' },
    { key: 'orderCount', label: 'Jumlah Order' },
  ];

  return (
    <div>
      <div className="filters">
        <input type="text" placeholder="Cari produk/kategori..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <DataTable columns={columns} rows={rows} loading={loading} error={error} rowKey="productId" />
    </div>
  );
}

function ChannelsView({ from, to }) {
  const [search, setSearch] = useState('');
  const fetcher = useCallback(() => marketingService.getChannels({ from, to }), [from, to]);
  const { data, loading, error } = useFetch(fetcher, [fetcher]);
  const rows = useMemo(() => filterRows(data, search), [data, search]);

  const columns = [
    { key: 'channel', label: 'Channel' },
    { key: 'orderCount', label: 'Jumlah Order' },
    { key: 'totalQty', label: 'Total Qty' },
  ];

  return (
    <div>
      <div className="filters">
        <input type="text" placeholder="Cari channel..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <DataTable columns={columns} rows={rows} loading={loading} error={error} rowKey="channel" />
    </div>
  );
}

function RepeatCustomersView() {
  const [minOrders, setMinOrders] = useState(2);
  const [search, setSearch] = useState('');
  const fetcher = useCallback(() => marketingService.getRepeatCustomers({ minOrders }), [minOrders]);
  const { data, loading, error } = useFetch(fetcher, [fetcher]);
  const rows = useMemo(() => filterRows(data, search), [data, search]);

  const columns = [
    { key: 'name', label: 'Customer' },
    { key: 'phone', label: 'No. HP', render: (r) => r.phone || '-' },
    { key: 'source', label: 'Channel', render: (r) => r.source || '-' },
    { key: 'orderCount', label: 'Jumlah Order' },
  ];

  return (
    <div>
      <div className="filters">
        <input type="text" placeholder="Cari nama/no. HP..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="form-group">
          <label>Minimum Order</label>
          <input type="number" min="1" value={minOrders} onChange={(e) => setMinOrders(Number(e.target.value))} />
        </div>
      </div>
      <DataTable columns={columns} rows={rows} loading={loading} error={error} rowKey="customerId" />
    </div>
  );
}

function CohortView() {
  const [search, setSearch] = useState('');
  const fetcher = useCallback(() => marketingService.getCohort(), []);
  const { data, loading, error } = useFetch(fetcher, [fetcher]);
  const rows = useMemo(() => filterRows(data, search), [data, search]);

  const columns = [
    { key: 'cohortMonth', label: 'Bulan Akuisisi' },
    { key: 'totalCustomers', label: 'Total Customer' },
    { key: 'repeatCustomers', label: 'Repeat Customer' },
    { key: 'repeatRate', label: 'Repeat Rate', render: (r) => `${(r.repeatRate * 100).toFixed(0)}%` },
  ];

  return (
    <div>
      <div className="filters">
        <input type="text" placeholder="Cari bulan akuisisi..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <DataTable columns={columns} rows={rows} loading={loading} error={error} rowKey="cohortMonth" />
    </div>
  );
}
