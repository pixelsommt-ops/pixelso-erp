import { useCallback, useState } from 'react';
import * as qcDeliveryService from '../../services/qcDeliveryService';
import * as productionService from '../../services/productionService';
import * as productionOrdersService from '../../services/productionOrdersService';
import useFetch from '../../hooks/useFetch';
import useAuth from '../../hooks/useAuth';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDateTime } from '../../utils/format';

export default function QcDeliveryPage() {
  const [tab, setTab] = useState('qc');

  return (
    <div>
      <div className="page-header">
        <h1>QC & Delivery</h1>
      </div>
      <div className="tabs">
        <button type="button" className={`tab ${tab === 'qc' ? 'active' : ''}`} onClick={() => setTab('qc')}>
          QC Checklist
        </button>
        <button type="button" className={`tab ${tab === 'delivery' ? 'active' : ''}`} onClick={() => setTab('delivery')}>
          Delivery
        </button>
      </div>
      {tab === 'qc' ? <QcTab /> : <DeliveryTab />}
    </div>
  );
}

const EMPTY_QC_FORM = { taskId: '', result: 'pass', issueType: '', photoUrl: '' };

function QcTab() {
  const { hasRole } = useAuth();
  const canCreate = hasRole('production', 'manager');

  const [resultFilter, setResultFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_QC_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [doneTasks, setDoneTasks] = useState([]);

  const fetchChecks = useCallback(() => qcDeliveryService.list({ result: resultFilter || undefined }), [resultFilter]);
  const { data: checks, loading, error, reload } = useFetch(fetchChecks, [fetchChecks]);

  const openCreate = async () => {
    setForm(EMPTY_QC_FORM);
    setFormError('');
    const res = await productionService.list({ status: 'done' });
    setDoneTasks(res.data);
    setCreateOpen(true);
  };
  const closeCreate = () => setCreateOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const payload = { taskId: Number(form.taskId), result: form.result };
      if (form.result === 'fail') payload.issueType = form.issueType;
      if (form.photoUrl) payload.photoUrl = form.photoUrl;
      await qcDeliveryService.create(payload);
      closeCreate();
      reload();
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Gagal menyimpan QC check');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { key: 'po', label: 'No. PO', render: (r) => r.task?.poDetail?.productionOrder?.poNumber },
    { key: 'product', label: 'Produk', render: (r) => r.task?.poDetail?.product?.name },
    { key: 'result', label: 'Hasil', render: (r) => <StatusBadge status={r.result} /> },
    { key: 'issueType', label: 'Alasan Reject', render: (r) => r.issueType || '-' },
    { key: 'qcBy', label: 'Diperiksa oleh', render: (r) => r.qcBy_user?.name },
    { key: 'createdAt', label: 'Waktu', render: (r) => formatDateTime(r.createdAt) },
    {
      key: 'photoUrl',
      label: 'Foto',
      render: (r) =>
        r.photoUrl ? (
          <a href={r.photoUrl} target="_blank" rel="noreferrer">
            lihat
          </a>
        ) : (
          '-'
        ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="filters" style={{ marginBottom: 0 }}>
          <select value={resultFilter} onChange={(e) => setResultFilter(e.target.value)}>
            <option value="">Semua hasil</option>
            <option value="pass">pass</option>
            <option value="fail">fail</option>
          </select>
        </div>
        {canCreate && (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            + Checklist QC
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={checks} loading={loading} error={error} rowKey="qcId" />

      {createOpen && (
        <Modal title="Checklist QC" onClose={closeCreate}>
          <form onSubmit={handleSubmit}>
            {formError && <div className="alert alert-error">{formError}</div>}
            {doneTasks.length === 0 && (
              <div className="alert alert-error">Tidak ada task berstatus &quot;done&quot; yang siap di-QC.</div>
            )}
            <div className="form-grid">
              <div className="form-group full">
                <label>Task</label>
                <select required value={form.taskId} onChange={(e) => setForm({ ...form, taskId: e.target.value })}>
                  <option value="" disabled>
                    Pilih task
                  </option>
                  {doneTasks.map((t) => (
                    <option key={t.taskId} value={t.taskId}>
                      {t.poDetail?.productionOrder?.poNumber} - {t.poDetail?.product?.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Hasil</label>
                <select value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })}>
                  <option value="pass">pass</option>
                  <option value="fail">fail</option>
                </select>
              </div>
              {form.result === 'fail' && (
                <div className="form-group">
                  <label>Alasan Reject</label>
                  <input
                    type="text"
                    required
                    value={form.issueType}
                    onChange={(e) => setForm({ ...form, issueType: e.target.value })}
                  />
                </div>
              )}
              <div className="form-group full">
                <label>URL Foto Bukti (opsional)</label>
                <input
                  type="text"
                  value={form.photoUrl}
                  onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
                />
              </div>
            </div>
            <div className="btn-group" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={closeCreate}>
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

const EMPTY_DELIVERY_FORM = { poId: '', method: 'pickup', receiver: '' };

function DeliveryTab() {
  const { hasRole } = useAuth();
  const canCreate = hasRole('production', 'manager');

  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_DELIVERY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [readyOrders, setReadyOrders] = useState([]);

  const [completingId, setCompletingId] = useState(null);
  const [receiverInput, setReceiverInput] = useState('');
  const [completeError, setCompleteError] = useState('');

  const fetchDeliveries = useCallback(
    () => qcDeliveryService.listDeliveries({ status: statusFilter || undefined }),
    [statusFilter]
  );
  const { data: deliveries, loading, error, reload } = useFetch(fetchDeliveries, [fetchDeliveries]);

  const openCreate = async () => {
    setForm(EMPTY_DELIVERY_FORM);
    setFormError('');
    const res = await productionOrdersService.list({ status: 'ready' });
    setReadyOrders(res.data);
    setCreateOpen(true);
  };
  const closeCreate = () => setCreateOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const payload = { poId: Number(form.poId), method: form.method };
      if (form.receiver) payload.receiver = form.receiver;
      await qcDeliveryService.createDelivery(payload);
      closeCreate();
      reload();
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Gagal membuat delivery');
    } finally {
      setSubmitting(false);
    }
  };

  const openComplete = (delivery) => {
    setCompletingId(delivery.deliveryId);
    setReceiverInput(delivery.receiver || '');
    setCompleteError('');
  };

  const submitComplete = async (e) => {
    e.preventDefault();
    setCompleteError('');
    try {
      await qcDeliveryService.updateDelivery(completingId, { status: 'completed', receiver: receiverInput });
      setCompletingId(null);
      reload();
    } catch (err) {
      setCompleteError(err?.response?.data?.message || 'Gagal menyelesaikan delivery');
    }
  };

  const columns = [
    { key: 'po', label: 'No. PO', render: (r) => r.productionOrder?.poNumber },
    { key: 'customer', label: 'Customer', render: (r) => r.productionOrder?.customer?.name },
    { key: 'method', label: 'Metode', render: (r) => <StatusBadge status={r.method} /> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'receiver', label: 'Penerima', render: (r) => r.receiver || '-' },
    { key: 'createdAt', label: 'Dibuat', render: (r) => formatDateTime(r.createdAt) },
    {
      key: 'actions',
      label: '',
      render: (r) =>
        r.status === 'pending' && canCreate ? (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => openComplete(r)}>
            Selesaikan
          </button>
        ) : null,
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="filters" style={{ marginBottom: 0 }}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Semua status</option>
            <option value="pending">pending</option>
            <option value="completed">completed</option>
            <option value="cancelled">cancelled</option>
          </select>
        </div>
        {canCreate && (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            + Jadwalkan Delivery
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={deliveries} loading={loading} error={error} rowKey="deliveryId" />

      {createOpen && (
        <Modal title="Jadwalkan Delivery" onClose={closeCreate}>
          <form onSubmit={handleSubmit}>
            {formError && <div className="alert alert-error">{formError}</div>}
            {readyOrders.length === 0 && (
              <div className="alert alert-error">Tidak ada PO berstatus &quot;ready&quot; saat ini.</div>
            )}
            <div className="form-grid">
              <div className="form-group full">
                <label>Production Order</label>
                <select required value={form.poId} onChange={(e) => setForm({ ...form, poId: e.target.value })}>
                  <option value="" disabled>
                    Pilih PO
                  </option>
                  {readyOrders.map((o) => (
                    <option key={o.poId} value={o.poId}>
                      {o.poNumber} - {o.customer?.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group full">
                <label>Metode</label>
                <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                  <option value="pickup">pickup</option>
                  <option value="delivery">delivery</option>
                </select>
              </div>
            </div>
            <div className="btn-group" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={closeCreate}>
                Batal
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {completingId && (
        <Modal title="Tanda Terima" onClose={() => setCompletingId(null)}>
          <form onSubmit={submitComplete}>
            {completeError && <div className="alert alert-error">{completeError}</div>}
            <div className="form-group full">
              <label>Nama Penerima</label>
              <input type="text" required value={receiverInput} onChange={(e) => setReceiverInput(e.target.value)} />
            </div>
            <div className="btn-group" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setCompletingId(null)}>
                Batal
              </button>
              <button type="submit" className="btn btn-primary">
                Selesaikan
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
