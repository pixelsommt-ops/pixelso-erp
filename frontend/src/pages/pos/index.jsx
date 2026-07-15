import { useCallback, useEffect, useState } from 'react';
import * as posService from '../../services/posService';
import * as productionOrdersService from '../../services/productionOrdersService';
import useFetch from '../../hooks/useFetch';
import useAuth from '../../hooks/useAuth';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import { formatCurrency, formatDateTime } from '../../utils/format';

const EMPTY_FORM = { poId: '', discount: 0, dp: 0, paymentMethod: 'cash' };

export default function PosPage() {
  const { hasRole } = useAuth();
  const canCreate = hasRole('cashier', 'manager');
  const canManagePayment = hasRole('cashier', 'manager', 'finance');
  const canVoid = hasRole('manager', 'finance');

  const [paidStatusFilter, setPaidStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [approvedOrders, setApprovedOrders] = useState([]);

  const [detail, setDetail] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'cash' });
  const [actionError, setActionError] = useState('');
  const [actioning, setActioning] = useState(false);

  const fetchSales = useCallback(
    () => posService.list({ paidStatus: paidStatusFilter || undefined }),
    [paidStatusFilter]
  );
  const { data: sales, loading, error, reload } = useFetch(fetchSales, [fetchSales]);

  const openCreate = async () => {
    setForm(EMPTY_FORM);
    setFormError('');
    const res = await productionOrdersService.list({ status: 'approved' });
    setApprovedOrders(res.data);
    setCreateOpen(true);
  };
  const closeCreate = () => setCreateOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const payload = {
        poId: Number(form.poId),
        discount: Number(form.discount) || 0,
        dp: Number(form.dp) || 0,
      };
      if (payload.dp > 0) payload.paymentMethod = form.paymentMethod;
      await posService.create(payload);
      closeCreate();
      reload();
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Gagal membuat invoice');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (sale) => {
    const { data } = await posService.getById(sale.saleId);
    setDetail(data);
    setPaymentForm({ amount: '', method: 'cash' });
    setActionError('');
  };
  const closeDetail = () => setDetail(null);

  // Payment yang masih pending (bukti transfer storefront belum diverifikasi) tidak dihitung
  // sebagai sudah dibayar - konsisten dengan pos.service.js#update() di backend.
  const remaining = detail
    ? Number(detail.total) -
      detail.payments.filter((p) => p.status === 'confirmed').reduce((sum, p) => sum + Number(p.amount), 0)
    : 0;

  const submitPayment = async (e) => {
    e.preventDefault();
    setActionError('');
    setActioning(true);
    try {
      const { data } = await posService.addPayment(detail.saleId, {
        amount: Number(paymentForm.amount),
        method: paymentForm.method,
      });
      setDetail(data);
      setPaymentForm({ amount: '', method: 'cash' });
      reload();
    } catch (err) {
      setActionError(err?.response?.data?.message || 'Gagal menambah pembayaran');
    } finally {
      setActioning(false);
    }
  };

  const handleConfirmPayment = async (paymentId, action) => {
    setActionError('');
    setActioning(true);
    try {
      const { data } = await posService.confirmPayment(detail.saleId, paymentId, action);
      setDetail(data);
      reload();
    } catch (err) {
      setActionError(err?.response?.data?.message || 'Gagal memproses konfirmasi pembayaran');
    } finally {
      setActioning(false);
    }
  };

  const handleVoid = async () => {
    setActionError('');
    setActioning(true);
    try {
      const { data } = await posService.voidSale(detail.saleId);
      setDetail(data);
      reload();
    } catch (err) {
      setActionError(err?.response?.data?.message || 'Gagal void invoice');
    } finally {
      setActioning(false);
    }
  };

  const columns = [
    { key: 'poNumber', label: 'No. PO', render: (r) => r.productionOrder?.poNumber },
    { key: 'customer', label: 'Customer', render: (r) => r.productionOrder?.customer?.name },
    { key: 'total', label: 'Total', render: (r) => formatCurrency(r.total) },
    { key: 'dp', label: 'DP', render: (r) => formatCurrency(r.dp) },
    { key: 'paidStatus', label: 'Status Bayar', render: (r) => <StatusBadge status={r.paidStatus} /> },
    { key: 'cashier', label: 'Kasir', render: (r) => r.cashier?.name },
    { key: 'createdAt', label: 'Tanggal', render: (r) => formatDateTime(r.createdAt) },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>POS & Pembayaran</h1>
        {canCreate && (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            + Buat Invoice
          </button>
        )}
      </div>

      <div className="filters">
        <select value={paidStatusFilter} onChange={(e) => setPaidStatusFilter(e.target.value)}>
          <option value="">Semua status bayar</option>
          <option value="unpaid">unpaid</option>
          <option value="partial">partial</option>
          <option value="paid">paid</option>
          <option value="void">void</option>
        </select>
      </div>

      <DataTable columns={columns} rows={sales} loading={loading} error={error} rowKey="saleId" onRowClick={openDetail} />

      {createOpen && (
        <Modal title="Buat Invoice" onClose={closeCreate}>
          <form onSubmit={handleSubmit}>
            {formError && <div className="alert alert-error">{formError}</div>}
            {approvedOrders.length === 0 && (
              <div className="alert alert-error">Tidak ada PO berstatus &quot;approved&quot; yang siap di-invoice.</div>
            )}
            <div className="form-grid">
              <div className="form-group full">
                <label>Production Order</label>
                <select required value={form.poId} onChange={(e) => setForm({ ...form, poId: e.target.value })}>
                  <option value="" disabled>
                    Pilih PO
                  </option>
                  {approvedOrders.map((o) => (
                    <option key={o.poId} value={o.poId}>
                      {o.poNumber} - {o.customer?.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Diskon</label>
                <input
                  type="number"
                  min="0"
                  value={form.discount}
                  onChange={(e) => setForm({ ...form, discount: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>DP (uang muka)</label>
                <input type="number" min="0" value={form.dp} onChange={(e) => setForm({ ...form, dp: e.target.value })} />
              </div>
              {Number(form.dp) > 0 && (
                <div className="form-group full">
                  <label>Metode Pembayaran DP</label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                  >
                    <option value="cash">cash</option>
                    <option value="transfer">transfer</option>
                    <option value="qris">qris</option>
                    <option value="debit">debit</option>
                  </select>
                </div>
              )}
            </div>
            <div className="btn-group" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={closeCreate}>
                Batal
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Menyimpan...' : 'Buat Invoice'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {detail && (
        <Modal title={`Invoice PO ${detail.productionOrder?.poNumber}`} onClose={closeDetail}>
          <div className="grid grid-cols-2" style={{ marginBottom: '1rem' }}>
            <div>
              <div className="text-muted text-sm">Customer</div>
              <div>{detail.productionOrder?.customer?.name}</div>
            </div>
            <div>
              <div className="text-muted text-sm">Status Bayar</div>
              <StatusBadge status={detail.paidStatus} />
            </div>
            <div>
              <div className="text-muted text-sm">Total</div>
              <div>{formatCurrency(detail.total)}</div>
            </div>
            <div>
              <div className="text-muted text-sm">Sisa</div>
              <div>{formatCurrency(remaining)}</div>
            </div>
          </div>

          <h3 style={{ fontSize: '0.9rem' }}>Riwayat Pembayaran</h3>
          <div className="table-wrap" style={{ marginBottom: '1rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Metode</th>
                  <th>Jumlah</th>
                  <th>Status</th>
                  <th>Bukti</th>
                  <th>Waktu</th>
                  {canManagePayment && <th></th>}
                </tr>
              </thead>
              <tbody>
                {detail.payments.map((p) => (
                  <tr key={p.paymentId}>
                    <td>{p.method}</td>
                    <td>{formatCurrency(p.amount)}</td>
                    <td>
                      <StatusBadge status={p.status || 'confirmed'} />
                    </td>
                    <td>
                      {p.proofUrl ? (
                        <a href={p.proofUrl} target="_blank" rel="noreferrer">
                          <img
                            src={p.proofUrl}
                            alt="Bukti transfer"
                            style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }}
                          />
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>{formatDateTime(p.paidAt)}</td>
                    {canManagePayment && (
                      <td>
                        {p.status === 'pending' && (
                          <div className="btn-group">
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={actioning}
                              onClick={() => handleConfirmPayment(p.paymentId, 'confirm')}
                            >
                              Konfirmasi
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              disabled={actioning}
                              onClick={() => handleConfirmPayment(p.paymentId, 'reject')}
                            >
                              Tolak
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {actionError && <div className="alert alert-error">{actionError}</div>}

          {detail.paidStatus !== 'void' && detail.paidStatus !== 'paid' && canManagePayment && (
            <form onSubmit={submitPayment} className="form-grid" style={{ marginBottom: '1rem' }}>
              <div className="form-group">
                <label>Jumlah Bayar</label>
                <input
                  type="number"
                  min="1"
                  max={remaining}
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Metode</label>
                <select
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                >
                  <option value="cash">cash</option>
                  <option value="transfer">transfer</option>
                  <option value="qris">qris</option>
                  <option value="debit">debit</option>
                </select>
              </div>
              <div className="form-group full">
                <button type="submit" className="btn btn-primary btn-sm" disabled={actioning}>
                  Tambah Pembayaran
                </button>
              </div>
            </form>
          )}

          {detail.paidStatus !== 'void' && canVoid && (
            <button type="button" className="btn btn-danger btn-sm" disabled={actioning} onClick={handleVoid}>
              Void Invoice
            </button>
          )}
        </Modal>
      )}
    </div>
  );
}
