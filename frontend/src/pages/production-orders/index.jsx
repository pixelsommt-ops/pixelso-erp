import { useCallback, useEffect, useMemo, useState } from 'react';
import * as productionOrdersService from '../../services/productionOrdersService';
import * as customersService from '../../services/customersService';
import * as productsService from '../../services/productsService';
import * as pricingModeService from '../../services/pricingModeService';
import * as usersService from '../../services/usersService';
import useFetch from '../../hooks/useFetch';
import useAuth from '../../hooks/useAuth';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import SearchableSelect from '../../components/common/SearchableSelect';
import StatusBadge from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../utils/format';
import { PO_STATUS_OPTIONS, PO_STATUS_TRANSITIONS } from '../../utils/poStatusFlow';

const EMPTY_ITEM = { productId: '', qty: 1, widthCm: '', heightCm: '', specNote: '' };
const EMPTY_FORM = { customerId: '', designerId: '', priority: 0, dueAt: '', notes: '', poDetails: [{ ...EMPTY_ITEM }] };

// Ukuran di bawah ini kemungkinan besar salah ketik (mis. "100" ketulis "1") - bukan batas keras,
// cuma dikonfirmasi ulang ke staf karena produk mode area (DTF dsb) kadang memang kecil.
const SMALL_DIMENSION_WARNING_CM = 10;

export default function ProductionOrdersPage() {
  const { hasRole, role } = useAuth();
  const canCreate = hasRole('designer', 'manager');

  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
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

  const [detail, setDetail] = useState(null);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState('');

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [designers, setDesigners] = useState([]);
  const [pricingModes, setPricingModes] = useState([]);

  const fetchOrders = useCallback(
    () =>
      productionOrdersService.list({
        status: statusFilter || undefined,
        search: search || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
      }),
    [statusFilter, search, dateFrom, dateTo, page]
  );
  const { data: listResult, loading, error, reload } = useFetch(fetchOrders, [fetchOrders]);
  const orders = listResult?.orders;

  // Ganti filter/tanggal -> balik ke halaman 1 (kalau tidak, bisa nyangkut di halaman yang
  // sekarang kosong kalau hasil filter baru lebih sedikit dari sebelumnya).
  useEffect(() => {
    setPage(1);
  }, [statusFilter, search, dateFrom, dateTo]);

  useEffect(() => {
    // pageSize besar - dropdown pilih customer butuh akses ke semua (bukan cuma 1 halaman list).
    customersService.list({ pageSize: 10000 }).then((res) => setCustomers(res.data.customers));
    productsService.list().then((res) => setProducts(res.data));
    pricingModeService.list().then((res) => setPricingModes(res.data));
    if (role === 'manager') {
      usersService.listRoles().then(async (res) => {
        const designerRole = res.data.find((r) => r.roleName === 'designer');
        if (designerRole) {
          const usersRes = await usersService.list({ roleId: designerRole.roleId });
          setDesigners(usersRes.data);
        }
      });
    }
  }, [role]);

  const productMap = useMemo(() => Object.fromEntries(products.map((p) => [p.productId, p])), [products]);
  const calcTypeByModeKey = useMemo(() => new Map(pricingModes.map((m) => [m.key, m.calcType])), [pricingModes]);
  const isAreaProduct = (productId) => {
    const product = productMap[productId];
    return product && calcTypeByModeKey.get(product.pricingMode) === 'area';
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setCreateOpen(true);
  };
  const closeCreate = () => setCreateOpen(false);

  const updateItem = (index, field, value) => {
    const items = [...form.poDetails];
    items[index] = { ...items[index], [field]: value };
    setForm({ ...form, poDetails: items });
  };
  const addItem = () => setForm({ ...form, poDetails: [...form.poDetails, { ...EMPTY_ITEM }] });
  const removeItem = (index) => setForm({ ...form, poDetails: form.poDetails.filter((_, i) => i !== index) });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const suspiciouslySmall = form.poDetails.filter((item) => {
      if (!isAreaProduct(item.productId)) return false;
      const width = Number(item.widthCm);
      const height = Number(item.heightCm);
      return (width > 0 && width < SMALL_DIMENSION_WARNING_CM) || (height > 0 && height < SMALL_DIMENSION_WARNING_CM);
    });
    if (suspiciouslySmall.length > 0) {
      const lines = suspiciouslySmall
        .map((item) => `- ${productMap[item.productId]?.name}: ${item.widthCm} x ${item.heightCm} cm`)
        .join('\n');
      const confirmed = window.confirm(
        `Ukuran berikut terlihat sangat kecil, kemungkinan salah ketik (mis. "100" tertulis "1"):\n\n${lines}\n\nLanjutkan simpan PO dengan ukuran ini?`
      );
      if (!confirmed) return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customerId: Number(form.customerId),
        priority: Number(form.priority) || 0,
        dueAt: form.dueAt || undefined,
        notes: form.notes || undefined,
        poDetails: form.poDetails.map((item) => ({
          productId: Number(item.productId),
          qty: Number(item.qty),
          ...(isAreaProduct(item.productId)
            ? { widthCm: Number(item.widthCm), heightCm: Number(item.heightCm) }
            : {}),
          specNote: item.specNote || undefined,
        })),
      };
      if (role === 'manager') {
        payload.designerId = Number(form.designerId);
      }
      await productionOrdersService.create(payload);
      closeCreate();
      reload();
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Gagal membuat PO');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (order) => {
    const { data } = await productionOrdersService.getById(order.poId);
    setDetail(data);
    setTransitionError('');
  };
  const closeDetail = () => setDetail(null);

  const transitionTo = async (status) => {
    setTransitioning(true);
    setTransitionError('');
    try {
      const { data } = await productionOrdersService.update(detail.poId, { status });
      setDetail(data);
      reload();
    } catch (err) {
      setTransitionError(err?.response?.data?.message || 'Gagal mengubah status');
    } finally {
      setTransitioning(false);
    }
  };

  const columns = [
    { key: 'poNumber', label: 'No. PO' },
    { key: 'customer', label: 'Customer', render: (r) => r.customer?.name },
    { key: 'designer', label: 'Desainer', render: (r) => r.designer?.name },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'itemCount', label: 'Item' },
    { key: 'dueAt', label: 'Deadline', render: (r) => formatDate(r.dueAt) },
    { key: 'createdAt', label: 'Dibuat', render: (r) => formatDate(r.createdAt) },
  ];

  const nextStatuses = detail ? PO_STATUS_TRANSITIONS[detail.status] || [] : [];

  return (
    <div>
      <div className="page-header">
        <h1>Production Order (PO)</h1>
        {canCreate && (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            + Buat PO
          </button>
        )}
      </div>

      <div className="filters">
        <input type="text" placeholder="Cari no. PO..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Semua status</option>
          {PO_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
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

      <DataTable columns={columns} rows={orders} loading={loading} error={error} rowKey="poId" onRowClick={openDetail} />

      {listResult && listResult.totalPages > 1 && (
        <div className="btn-group" style={{ marginTop: '0.75rem', justifyContent: 'center', alignItems: 'center' }}>
          <button type="button" className="btn btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            &larr; Sebelumnya
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #666)' }}>
            Halaman {listResult.page} dari {listResult.totalPages} ({listResult.total} PO)
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
        <Modal title="Buat Production Order" onClose={closeCreate} width={680}>
          <form onSubmit={handleSubmit}>
            {formError && <div className="alert alert-error">{formError}</div>}
            <div className="form-grid">
              <div className="form-group">
                <label>Customer</label>
                <SearchableSelect
                  required
                  placeholder="Ketik nama customer..."
                  value={form.customerId}
                  onChange={(customerId) => setForm({ ...form, customerId })}
                  options={customers.map((c) => ({
                    value: c.customerId,
                    label: c.phone ? `${c.name} — ${c.phone}` : c.name,
                  }))}
                />
              </div>
              {role === 'manager' && (
                <div className="form-group">
                  <label>Desainer</label>
                  <select
                    required
                    value={form.designerId}
                    onChange={(e) => setForm({ ...form, designerId: e.target.value })}
                  >
                    <option value="" disabled>
                      Pilih desainer
                    </option>
                    {designers.map((d) => (
                      <option key={d.userId} value={d.userId}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Prioritas</label>
                <input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Deadline</label>
                <input type="date" value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
              </div>
              <div className="form-group full">
                <label>Catatan</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>

            <h3 style={{ fontSize: '0.95rem', marginTop: '1.25rem' }}>Item Pesanan</h3>
            {form.poDetails.map((item, index) => (
              <div
                key={index}
                className="form-grid"
                style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem', marginTop: '0.75rem' }}
              >
                <div className="form-group">
                  <label>Produk</label>
                  <select
                    required
                    value={item.productId}
                    onChange={(e) => updateItem(index, 'productId', e.target.value)}
                  >
                    <option value="" disabled>
                      Pilih produk
                    </option>
                    {products.map((p) => (
                      <option key={p.productId} value={p.productId}>
                        {p.name} ({formatCurrency(p.basePrice)}/{p.unit})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Qty</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={item.qty}
                    onChange={(e) => updateItem(index, 'qty', e.target.value)}
                  />
                </div>
                {isAreaProduct(item.productId) && (
                  <>
                    <div className="form-group">
                      <label>Lebar (cm)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={item.widthCm}
                        onChange={(e) => updateItem(index, 'widthCm', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Tinggi (cm)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={item.heightCm}
                        onChange={(e) => updateItem(index, 'heightCm', e.target.value)}
                      />
                    </div>
                  </>
                )}
                <div className="form-group">
                  <label>Catatan Item</label>
                  <input
                    type="text"
                    value={item.specNote}
                    onChange={(e) => updateItem(index, 'specNote', e.target.value)}
                  />
                </div>
                {form.poDetails.length > 1 && (
                  <div className="form-group full">
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => removeItem(index)}>
                      Hapus item
                    </button>
                  </div>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-sm" style={{ marginTop: '0.75rem' }} onClick={addItem}>
              + Tambah Item
            </button>

            <div className="btn-group" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={closeCreate}>
                Batal
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Menyimpan...' : 'Simpan PO'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {detail && (
        <Modal title={`PO ${detail.poNumber}`} onClose={closeDetail} width={640}>
          <div className="grid grid-cols-2" style={{ marginBottom: '1rem' }}>
            <div>
              <div className="text-muted text-sm">Customer</div>
              <div>{detail.customer?.name}</div>
            </div>
            <div>
              <div className="text-muted text-sm">Desainer</div>
              <div>{detail.designer?.name}</div>
            </div>
            <div>
              <div className="text-muted text-sm">Status</div>
              <StatusBadge status={detail.status} />
            </div>
            <div>
              <div className="text-muted text-sm">Deadline</div>
              <div>{formatDate(detail.dueAt)}</div>
            </div>
          </div>
          {detail.notes && (
            <div style={{ marginBottom: '1rem' }}>
              <div className="text-muted text-sm">Catatan</div>
              <div>{detail.notes}</div>
            </div>
          )}

          <h3 style={{ fontSize: '0.9rem' }}>Item</h3>
          <div className="table-wrap" style={{ marginBottom: '1rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Qty</th>
                  <th>Ukuran</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {detail.poDetails.map((d) => (
                  <tr key={d.poDetailId}>
                    <td>{d.product?.name || productMap[d.productId]?.name}</td>
                    <td>{d.qty}</td>
                    <td>{d.size || '-'}</td>
                    <td>{d.specNote || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {transitionError && <div className="alert alert-error">{transitionError}</div>}
          {nextStatuses.length > 0 && (
            <div>
              <div className="text-muted text-sm" style={{ marginBottom: '0.4rem' }}>
                Ubah status ke:
              </div>
              <div className="btn-group">
                {nextStatuses.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="btn btn-sm"
                    disabled={transitioning}
                    onClick={() => transitionTo(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
