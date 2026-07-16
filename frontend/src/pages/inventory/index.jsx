import { useCallback, useEffect, useState } from 'react';
import * as inventoryService from '../../services/inventoryService';
import * as productionOrdersService from '../../services/productionOrdersService';
import useFetch from '../../hooks/useFetch';
import useAuth from '../../hooks/useAuth';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import { formatDateTime } from '../../utils/format';

const EMPTY_FORM = { name: '', unit: '', stockQty: 0, minStock: 0, avgCost: 0 };
const EMPTY_MOVEMENT = { type: 'in', qty: '', poId: '' };

export default function InventoryPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole('inventory', 'manager');

  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [detail, setDetail] = useState(null);
  const [movement, setMovement] = useState(EMPTY_MOVEMENT);
  const [movementError, setMovementError] = useState('');
  const [movementSubmitting, setMovementSubmitting] = useState(false);
  const [orders, setOrders] = useState([]);

  const fetchMaterials = useCallback(
    () => inventoryService.list({ search: search || undefined, lowStock: lowStockOnly ? 'true' : undefined }),
    [search, lowStockOnly]
  );
  const { data: materials, loading, error, reload } = useFetch(fetchMaterials, [fetchMaterials]);

  useEffect(() => {
    // pageSize dibatasi - daftar ini cuma buat dropdown "reserve ke PO", tidak perlu semua histori.
    productionOrdersService.list({ pageSize: 200 }).then((res) => setOrders(res.data.orders));
  }, []);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setCreateOpen(true);
  };
  const closeCreate = () => setCreateOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await inventoryService.create({
        ...form,
        stockQty: Number(form.stockQty) || 0,
        minStock: Number(form.minStock) || 0,
        avgCost: Number(form.avgCost) || 0,
      });
      closeCreate();
      reload();
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Gagal menambah material');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (material) => {
    const { data } = await inventoryService.getById(material.materialId);
    setDetail(data);
    setMovement(EMPTY_MOVEMENT);
    setMovementError('');
  };
  const closeDetail = () => setDetail(null);

  const submitMovement = async (e) => {
    e.preventDefault();
    setMovementError('');
    setMovementSubmitting(true);
    try {
      const payload = { type: movement.type, qty: Number(movement.qty) };
      if (movement.poId) payload.poId = Number(movement.poId);
      await inventoryService.recordMovement(detail.materialId, payload);
      const refreshed = await inventoryService.getById(detail.materialId);
      setDetail(refreshed.data);
      setMovement(EMPTY_MOVEMENT);
      reload();
    } catch (err) {
      setMovementError(err?.response?.data?.message || 'Gagal mencatat mutasi');
    } finally {
      setMovementSubmitting(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Material' },
    { key: 'unit', label: 'Satuan' },
    {
      key: 'stockQty',
      label: 'Stok',
      render: (r) => (
        <span className={Number(r.stockQty) <= Number(r.minStock) ? 'badge badge-danger' : ''}>
          {r.stockQty} {r.unit}
        </span>
      ),
    },
    { key: 'minStock', label: 'Stok Minimum' },
    { key: 'avgCost', label: 'Avg Cost', render: (r) => r.avgCost },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Inventory</h1>
        {canManage && (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            + Tambah Material
          </button>
        )}
      </div>

      <div className="filters">
        <input type="text" placeholder="Cari material..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
          Stok kritis saja
        </label>
      </div>

      <DataTable
        columns={columns}
        rows={materials}
        loading={loading}
        error={error}
        rowKey="materialId"
        onRowClick={openDetail}
      />

      {createOpen && (
        <Modal title="Tambah Material" onClose={closeCreate}>
          <form onSubmit={handleSubmit}>
            {formError && <div className="alert alert-error">{formError}</div>}
            <div className="form-grid">
              <div className="form-group full">
                <label>Nama Material</label>
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Satuan</label>
                <input type="text" required value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Stok Awal</label>
                <input
                  type="number"
                  min="0"
                  value={form.stockQty}
                  onChange={(e) => setForm({ ...form, stockQty: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Stok Minimum</label>
                <input
                  type="number"
                  min="0"
                  value={form.minStock}
                  onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Avg Cost</label>
                <input
                  type="number"
                  min="0"
                  value={form.avgCost}
                  onChange={(e) => setForm({ ...form, avgCost: e.target.value })}
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

      {detail && (
        <Modal title={detail.name} onClose={closeDetail}>
          <div className="grid grid-cols-2" style={{ marginBottom: '1rem' }}>
            <div>
              <div className="text-muted text-sm">Stok Saat Ini</div>
              <div>
                {detail.stockQty} {detail.unit}
              </div>
            </div>
            <div>
              <div className="text-muted text-sm">Stok Minimum</div>
              <div>{detail.minStock}</div>
            </div>
          </div>

          <h3 style={{ fontSize: '0.9rem' }}>Riwayat Mutasi</h3>
          <div className="table-wrap" style={{ marginBottom: '1rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Tipe</th>
                  <th>Qty</th>
                  <th>PO</th>
                  <th>Waktu</th>
                </tr>
              </thead>
              <tbody>
                {detail.stockMovements?.map((m) => (
                  <tr key={m.moveId}>
                    <td>{m.type}</td>
                    <td>{m.qty}</td>
                    <td>{m.productionOrder?.poNumber || '-'}</td>
                    <td>{formatDateTime(m.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canManage && (
            <>
              {movementError && <div className="alert alert-error">{movementError}</div>}
              <form onSubmit={submitMovement} className="form-grid">
                <div className="form-group">
                  <label>Tipe Mutasi</label>
                  <select value={movement.type} onChange={(e) => setMovement({ ...movement, type: e.target.value })}>
                    <option value="in">in (tambah stok)</option>
                    <option value="out">out (keluar)</option>
                    <option value="reserve">reserve (untuk PO)</option>
                    <option value="adjustment">adjustment (stock opname)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Qty {movement.type === 'adjustment' && <span className="text-muted">(boleh negatif)</span>}</label>
                  <input
                    type="number"
                    required
                    value={movement.qty}
                    onChange={(e) => setMovement({ ...movement, qty: e.target.value })}
                  />
                </div>
                {movement.type === 'reserve' && (
                  <div className="form-group full">
                    <label>Production Order</label>
                    <select value={movement.poId} onChange={(e) => setMovement({ ...movement, poId: e.target.value })}>
                      <option value="">- pilih PO (opsional) -</option>
                      {orders.map((o) => (
                        <option key={o.poId} value={o.poId}>
                          {o.poNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="form-group full">
                  <button type="submit" className="btn btn-primary btn-sm" disabled={movementSubmitting}>
                    Catat Mutasi
                  </button>
                </div>
              </form>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
