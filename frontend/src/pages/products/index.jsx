import { useCallback, useState } from 'react';
import * as productsService from '../../services/productsService';
import useFetch from '../../hooks/useFetch';
import useAuth from '../../hooks/useAuth';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import { formatCurrency } from '../../utils/format';

const EMPTY_FORM = { name: '', category: '', unit: '', basePrice: '' };

export default function ProductsPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole('manager', 'inventory');

  const [search, setSearch] = useState('');
  const [modalProduct, setModalProduct] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchProducts = useCallback(() => productsService.list({ search: search || undefined }), [search]);
  const { data: products, loading, error, reload } = useFetch(fetchProducts, [fetchProducts]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setModalProduct({});
  };

  const openEdit = (product) => {
    setForm({
      name: product.name,
      category: product.category || '',
      unit: product.unit || '',
      basePrice: product.basePrice,
    });
    setFormError('');
    setModalProduct(product);
  };

  const closeModal = () => setModalProduct(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const payload = { ...form, basePrice: Number(form.basePrice) };
      if (modalProduct?.productId) {
        await productsService.update(modalProduct.productId, payload);
      } else {
        await productsService.create(payload);
      }
      closeModal();
      reload();
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Gagal menyimpan produk');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Nama Produk' },
    { key: 'category', label: 'Kategori', render: (r) => r.category || '-' },
    { key: 'unit', label: 'Satuan', render: (r) => r.unit || '-' },
    { key: 'basePrice', label: 'Harga Dasar', render: (r) => formatCurrency(r.basePrice) },
    ...(canManage
      ? [
          {
            key: 'actions',
            label: '',
            render: (r) => (
              <button type="button" className="btn btn-sm" onClick={() => openEdit(r)}>
                Edit
              </button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Master Produk</h1>
        {canManage && (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            + Tambah Produk
          </button>
        )}
      </div>

      <div className="filters">
        <input
          type="text"
          placeholder="Cari nama produk..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <DataTable columns={columns} rows={products} loading={loading} error={error} rowKey="productId" />

      {modalProduct && (
        <Modal title={modalProduct.productId ? 'Edit Produk' : 'Tambah Produk'} onClose={closeModal}>
          <form onSubmit={handleSubmit}>
            {formError && <div className="alert alert-error">{formError}</div>}
            <div className="form-grid">
              <div className="form-group full">
                <label>Nama Produk</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Kategori</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Satuan</label>
                <input
                  type="text"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                />
              </div>
              <div className="form-group full">
                <label>Harga Dasar</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={form.basePrice}
                  onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
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
