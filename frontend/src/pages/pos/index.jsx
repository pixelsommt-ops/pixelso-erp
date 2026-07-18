import { useCallback, useEffect, useState } from 'react';
import * as posService from '../../services/posService';
import * as productionOrdersService from '../../services/productionOrdersService';
import * as settingsService from '../../services/settingsService';
import useFetch from '../../hooks/useFetch';
import useAuth from '../../hooks/useAuth';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import Receipt from '../../components/common/Receipt';
import { formatCurrency, formatDateTime, waLink } from '../../utils/format';

const EMPTY_FORM = { poId: '', discount: 0, dp: 0, paymentMethod: 'cash' };

// Produk mode area ditagih minimal 1m2 (lihat MIN_BILLABLE_AREA_M2 di pos.service.js) - kalau
// ukuran aslinya lebih kecil, tunjukkan itu supaya kasir/pelanggan tidak bingung kenapa harga
// tidak sesuai perkalian ukuran mentah.
function areaSizeLabel(item) {
  if (item.calcType !== 'area') return `x${item.qty}`;
  const suffix = item.minAreaApplied ? ` (min. 1 m²)` : ` (${item.areaM2?.toFixed(2)} m²)`;
  return `${item.size || ''} x${item.qty}${suffix}`;
}

// Pesan teks nota untuk tombol "Kirim Nota via WhatsApp" - buka wa.me dengan teks siap kirim,
// staf tinggal klik "Kirim" manual (bukan API otomatis, jadi tidak berisiko nomor kena banned).
function notaWhatsappMessage(detail, remaining) {
  const itemLines = (detail.items || [])
    .map((item) => `- ${item.productName} ${areaSizeLabel(item)}: ${formatCurrency(item.lineTotal)}`)
    .join('\n');

  return [
    `*Nota Pesanan ${detail.productionOrder?.poNumber} - Pixelso*`,
    'Terima kasih telah memesan di Pixelso.',
    '',
    itemLines,
    '',
    `*Total: ${formatCurrency(detail.total)}*`,
    `DP dibayar: ${formatCurrency(detail.dp)}`,
    `Sisa: ${formatCurrency(remaining)}`,
  ].join('\n');
}

export default function PosPage() {
  const { hasRole } = useAuth();
  const canCreate = hasRole('cashier', 'manager');
  const canManagePayment = hasRole('cashier', 'manager', 'finance');
  const canVoid = hasRole('manager', 'finance');

  const [paidStatusFilter, setPaidStatusFilter] = useState('');
  // Default rentang tanggal: bulan berjalan - histori migrasi POS lama (2+ tahun) bikin daftar
  // tanpa filter jadi puluhan ribu baris. Bisa dikosongkan manual buat lihat semua histori.
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(startOfMonth);
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [approvedOrders, setApprovedOrders] = useState([]);
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const [detail, setDetail] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'cash' });
  const [actionError, setActionError] = useState('');
  const [actioning, setActioning] = useState(false);
  const [siteSettings, setSiteSettings] = useState(null);

  // Buat header nota cetak (nama/alamat/WA toko) - diambil sekali, dipakai tiap kali "Cetak Nota".
  useEffect(() => {
    settingsService
      .getPublicSettings()
      .then((res) => setSiteSettings(res.data))
      .catch(() => setSiteSettings(null));
  }, []);

  const fetchSales = useCallback(
    () =>
      posService.list({
        paidStatus: paidStatusFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
      }),
    [paidStatusFilter, dateFrom, dateTo, page]
  );
  const { data: listResult, loading, error, reload } = useFetch(fetchSales, [fetchSales]);
  const sales = listResult?.sales;

  useEffect(() => {
    setPage(1);
  }, [paidStatusFilter, dateFrom, dateTo]);

  const openCreate = async () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setQuote(null);
    const res = await productionOrdersService.list({ status: 'approved', pageSize: 200 });
    setApprovedOrders(res.data.orders);
    setCreateOpen(true);
  };
  const closeCreate = () => {
    setCreateOpen(false);
    setQuote(null);
  };

  // Begitu kasir pilih PO di popup Buat Invoice, tarik rincian item + subtotalnya supaya bisa
  // dicek dulu (harga per item, apakah pantas dapat diskon) sebelum invoice benar-benar dibuat.
  useEffect(() => {
    if (!createOpen || !form.poId) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    setQuoteLoading(true);
    posService
      .getQuote(form.poId)
      .then((res) => {
        if (!cancelled) setQuote(res.data);
      })
      .catch(() => {
        if (!cancelled) setQuote(null);
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [createOpen, form.poId]);

  const subtotal = quote?.subtotal ? Number(quote.subtotal) : 0;
  const totalAfterDiscount = Math.max(subtotal - (Number(form.discount) || 0), 0);
  const minDp = Math.ceil(totalAfterDiscount * (quote?.minDpRatio ?? 0.5));
  const dpAmount = Number(form.dp) || 0;
  const dpShortfall = quote && totalAfterDiscount > 0 && dpAmount < minDp;

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
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, margin: 0, whiteSpace: 'nowrap' }}>
          Dari
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, margin: 0, whiteSpace: 'nowrap' }}>
          Sampai
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>
        {(dateFrom || dateTo) && (
          <button type="button" className="btn btn-sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
            Lihat semua histori
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={sales} loading={loading} error={error} rowKey="saleId" onRowClick={openDetail} />

      {listResult && listResult.totalPages > 1 && (
        <div className="btn-group" style={{ marginTop: '0.75rem', justifyContent: 'center', alignItems: 'center' }}>
          <button type="button" className="btn btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            &larr; Sebelumnya
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #666)' }}>
            Halaman {listResult.page} dari {listResult.totalPages} ({listResult.total} sale)
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
              {quoteLoading && <div className="form-group full text-muted text-sm">Memuat rincian invoice...</div>}

              {quote && !quoteLoading && (
                <div className="form-group full">
                  <label>Rincian Invoice</label>
                  <div className="text-sm" style={{ marginBottom: 4 }}>
                    <strong>{quote.customer?.name}</strong>
                    {quote.customer?.segment ? ` (${quote.customer.segment})` : ''}
                    {quote.customer?.phone ? ` - ${quote.customer.phone}` : ''}
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Produk</th>
                          <th>Ukuran/Qty</th>
                          <th>Harga</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quote.items.map((item) => (
                          <tr key={item.poDetailId}>
                            <td>{item.productName}</td>
                            <td>{areaSizeLabel(item)}</td>
                            <td>{formatCurrency(item.lineTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="text-sm" style={{ marginTop: 6 }}>
                    Subtotal: <strong>{formatCurrency(subtotal)}</strong>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Diskon</label>
                <input
                  type="number"
                  min="0"
                  value={form.discount}
                  onChange={(e) => setForm({ ...form, discount: e.target.value })}
                />
              </div>

              {quote && (
                <div className="form-group full text-sm">
                  Total setelah diskon: <strong>{formatCurrency(totalAfterDiscount)}</strong>
                  {' - '}DP minimal 50%: <strong>{formatCurrency(minDp)}</strong>
                </div>
              )}

              <div className="form-group">
                <label>DP (uang muka)</label>
                <input type="number" min="0" value={form.dp} onChange={(e) => setForm({ ...form, dp: e.target.value })} />
              </div>
              {dpShortfall && (
                <div className="form-group full alert alert-error">
                  DP kurang dari 50% total. Minimal {formatCurrency(minDp)}, kurang {formatCurrency(minDp - dpAmount)}.
                  Pelanggan belum bisa melanjutkan transaksi.
                </div>
              )}
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
              <button type="submit" className="btn btn-primary" disabled={submitting || dpShortfall}>
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

          {detail.items && detail.items.length > 0 && (
            <>
              <h3 style={{ fontSize: '0.9rem' }}>Item</h3>
              <div className="table-wrap" style={{ marginBottom: '1rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Produk</th>
                      <th>Ukuran/Qty</th>
                      <th>Harga</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((item) => (
                      <tr key={item.poDetailId}>
                        <td>{item.productName}</td>
                        <td>
                          {item.calcType === 'area'
                            ? `${item.size || ''} x${item.qty} (${item.areaM2?.toFixed(2)} m²)`
                            : `x${item.qty}`}
                        </td>
                        <td>{formatCurrency(item.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

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

          <div className="btn-group">
            <button type="button" className="btn btn-sm" onClick={() => window.print()}>
              Cetak Nota
            </button>
            {detail.productionOrder?.customer?.phone && (
              <a
                className="btn btn-sm"
                href={waLink(detail.productionOrder.customer.phone, notaWhatsappMessage(detail, remaining))}
                target="_blank"
                rel="noreferrer"
              >
                Kirim Nota via WhatsApp
              </a>
            )}
            {detail.paidStatus !== 'void' && canVoid && (
              <button type="button" className="btn btn-danger btn-sm" disabled={actioning} onClick={handleVoid}>
                Void Invoice
              </button>
            )}
          </div>
        </Modal>
      )}

      <Receipt sale={detail} settings={siteSettings} remaining={remaining} />
    </div>
  );
}
