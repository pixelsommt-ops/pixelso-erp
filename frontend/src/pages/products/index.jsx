import { useCallback, useState } from 'react';
import * as productsService from '../../services/productsService';
import * as categoryService from '../../services/categoryService';
import * as pricingModeService from '../../services/pricingModeService';
import useFetch from '../../hooks/useFetch';
import useAuth from '../../hooks/useAuth';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import { formatCurrency } from '../../utils/format';

const EMPTY_FORM = { name: '', categoryId: '', unit: '', basePrice: '' };
const EMPTY_CATEGORY_FORM = { name: '' };
const EMPTY_MODE_FORM = { key: '', label: '', calcType: 'scalar', unitLabel: '', inputLabel: '', sortOrder: 0 };
const CALC_TYPE_LABELS = { area: 'Luas (Lebar x Tinggi)', scalar: 'Angka Tunggal (jumlah/durasi/berat, dst)' };

export default function ProductsPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole('manager', 'inventory');

  const [search, setSearch] = useState('');
  const [modalProduct, setModalProduct] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [modalCategory, setModalCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY_FORM);
  const [categoryError, setCategoryError] = useState('');
  const [submittingCategory, setSubmittingCategory] = useState(false);

  const [modalMode, setModalMode] = useState(null);
  const [modeForm, setModeForm] = useState(EMPTY_MODE_FORM);
  const [modeError, setModeError] = useState('');
  const [submittingMode, setSubmittingMode] = useState(false);

  const fetchProducts = useCallback(() => productsService.list({ search: search || undefined }), [search]);
  const { data: products, loading, error, reload } = useFetch(fetchProducts, [fetchProducts]);

  const fetchCategories = useCallback(() => categoryService.list(), []);
  const { data: categories, loading: loadingCategories, error: categoriesError, reload: reloadCategories } =
    useFetch(fetchCategories, [fetchCategories]);

  const fetchPricingModes = useCallback(() => pricingModeService.list(), []);
  const { data: pricingModes, loading: loadingModes, error: modesError, reload: reloadModes } =
    useFetch(fetchPricingModes, [fetchPricingModes]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setModalProduct({});
  };

  const openEdit = (product) => {
    setForm({
      name: product.name,
      categoryId: product.categoryId || '',
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

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Hapus produk "${product.name}"?`)) return;
    try {
      await productsService.deleteProduct(product.productId);
      reload();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Gagal menghapus produk');
    }
  };

  const openCreateCategory = () => {
    setCategoryForm(EMPTY_CATEGORY_FORM);
    setCategoryError('');
    setModalCategory({});
  };

  const openEditCategory = (category) => {
    setCategoryForm({ name: category.name });
    setCategoryError('');
    setModalCategory(category);
  };

  const closeCategoryModal = () => setModalCategory(null);

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    setCategoryError('');
    setSubmittingCategory(true);
    try {
      if (modalCategory?.categoryId) {
        await categoryService.update(modalCategory.categoryId, categoryForm);
      } else {
        await categoryService.create(categoryForm);
      }
      closeCategoryModal();
      reloadCategories();
    } catch (err) {
      setCategoryError(err?.response?.data?.message || 'Gagal menyimpan kategori');
    } finally {
      setSubmittingCategory(false);
    }
  };

  const handleDeleteCategory = async (category) => {
    if (!window.confirm(`Hapus kategori "${category.name}"?`)) return;
    try {
      await categoryService.deleteCategory(category.categoryId);
      reloadCategories();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Gagal menghapus kategori');
    }
  };

  const openCreateMode = () => {
    setModeForm(EMPTY_MODE_FORM);
    setModeError('');
    setModalMode({});
  };

  const openEditMode = (mode) => {
    setModeForm({
      key: mode.key,
      label: mode.label,
      calcType: mode.calcType,
      unitLabel: mode.unitLabel,
      inputLabel: mode.inputLabel,
      sortOrder: mode.sortOrder,
    });
    setModeError('');
    setModalMode(mode);
  };

  const closeModeModal = () => setModalMode(null);

  const handleModeSubmit = async (e) => {
    e.preventDefault();
    setModeError('');
    setSubmittingMode(true);
    try {
      const payload = { ...modeForm, sortOrder: Number(modeForm.sortOrder || 0) };
      if (modalMode?.modeId) {
        await pricingModeService.update(modalMode.key, payload);
      } else {
        await pricingModeService.create(payload);
      }
      closeModeModal();
      reloadModes();
    } catch (err) {
      setModeError(err?.response?.data?.message || 'Gagal menyimpan mode harga');
    } finally {
      setSubmittingMode(false);
    }
  };

  const handleDeleteMode = async (mode) => {
    if (!window.confirm(`Hapus mode harga "${mode.label}"?`)) return;
    try {
      await pricingModeService.deleteMode(mode.key);
      reloadModes();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Gagal menghapus mode harga');
    }
  };

  const categoryColumns = [
    { key: 'name', label: 'Nama Kategori' },
    ...(canManage
      ? [
          {
            key: 'actions',
            label: '',
            render: (r) => (
              <div className="btn-group">
                <button type="button" className="btn btn-sm" onClick={() => openEditCategory(r)}>
                  Edit
                </button>
                <button type="button" className="btn btn-sm" onClick={() => handleDeleteCategory(r)}>
                  Hapus
                </button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const modeColumns = [
    { key: 'key', label: 'Key' },
    { key: 'label', label: 'Label' },
    { key: 'calcType', label: 'Tipe Kalkulasi', render: (r) => CALC_TYPE_LABELS[r.calcType] || r.calcType },
    { key: 'unitLabel', label: 'Satuan' },
    { key: 'isActive', label: 'Aktif', render: (r) => (r.isActive ? '✓' : '—') },
    ...(canManage
      ? [
          {
            key: 'actions',
            label: '',
            render: (r) => (
              <div className="btn-group">
                <button type="button" className="btn btn-sm" onClick={() => openEditMode(r)}>
                  Edit
                </button>
                <button type="button" className="btn btn-sm" onClick={() => handleDeleteMode(r)}>
                  Hapus
                </button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const columns = [
    { key: 'name', label: 'Nama Produk' },
    { key: 'category', label: 'Kategori', render: (r) => r.category?.name || '-' },
    { key: 'unit', label: 'Satuan', render: (r) => r.unit || '-' },
    { key: 'basePrice', label: 'Harga Dasar', render: (r) => formatCurrency(r.basePrice) },
    ...(canManage
      ? [
          {
            key: 'actions',
            label: '',
            render: (r) => (
              <div className="btn-group">
                <button type="button" className="btn btn-sm" onClick={() => openEdit(r)}>
                  Edit
                </button>
                <button type="button" className="btn btn-sm" onClick={() => handleDeleteProduct(r)}>
                  Hapus
                </button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Master Kategori</h1>
        {canManage && (
          <button type="button" className="btn btn-primary" onClick={openCreateCategory}>
            + Tambah Kategori
          </button>
        )}
      </div>
      <DataTable
        columns={categoryColumns}
        rows={categories}
        loading={loadingCategories}
        error={categoriesError}
        rowKey="categoryId"
      />

      <div className="page-header" style={{ marginTop: '2rem' }}>
        <h1>Master Mode Harga</h1>
        {canManage && (
          <button type="button" className="btn btn-primary" onClick={openCreateMode}>
            + Tambah Mode
          </button>
        )}
      </div>
      <p style={{ margin: '0 0 0.75rem', color: 'var(--text-muted, #666)', fontSize: '0.85rem' }}>
        Daftar mode kalkulasi harga yang bisa dipilih di halaman Harga Website. Mode "Luas" butuh
        ukuran Lebar x Tinggi (mis. Per m²); mode "Angka Tunggal" butuh satu angka saja
        (mis. Per Pcs, Per Menit, Per Gram).
      </p>
      <DataTable
        columns={modeColumns}
        rows={pricingModes}
        loading={loadingModes}
        error={modesError}
        rowKey="modeId"
      />

      <div className="page-header" style={{ marginTop: '2rem' }}>
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

      {modalCategory && (
        <Modal title={modalCategory.categoryId ? 'Edit Kategori' : 'Tambah Kategori'} onClose={closeCategoryModal}>
          <form onSubmit={handleCategorySubmit}>
            {categoryError && <div className="alert alert-error">{categoryError}</div>}
            <div className="form-grid">
              <div className="form-group full">
                <label>Nama Kategori</label>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                />
              </div>
            </div>
            <div className="btn-group" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={closeCategoryModal}>
                Batal
              </button>
              <button type="submit" className="btn btn-primary" disabled={submittingCategory}>
                {submittingCategory ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modalMode && (
        <Modal title={modalMode.modeId ? 'Edit Mode Harga' : 'Tambah Mode Harga'} onClose={closeModeModal}>
          <form onSubmit={handleModeSubmit}>
            {modeError && <div className="alert alert-error">{modeError}</div>}
            <div className="form-grid">
              <div className="form-group">
                <label>Key</label>
                <input
                  type="text"
                  required
                  placeholder="mis. menit"
                  disabled={Boolean(modalMode.modeId)}
                  value={modeForm.key}
                  onChange={(e) => setModeForm({ ...modeForm, key: e.target.value })}
                />
                {modalMode.modeId && (
                  <small style={{ color: 'var(--text-muted, #666)' }}>Key tidak bisa diubah setelah dibuat.</small>
                )}
              </div>
              <div className="form-group">
                <label>Label</label>
                <input
                  type="text"
                  required
                  placeholder="mis. Per Menit"
                  value={modeForm.label}
                  onChange={(e) => setModeForm({ ...modeForm, label: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Tipe Kalkulasi</label>
                <select
                  value={modeForm.calcType}
                  onChange={(e) => setModeForm({ ...modeForm, calcType: e.target.value })}
                >
                  {Object.entries(CALC_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Satuan (tampilan singkat)</label>
                <input
                  type="text"
                  required
                  placeholder="mis. menit"
                  value={modeForm.unitLabel}
                  onChange={(e) => setModeForm({ ...modeForm, unitLabel: e.target.value })}
                />
              </div>
              <div className="form-group full">
                <label>Label Input di Form Order Storefront</label>
                <input
                  type="text"
                  required
                  placeholder="mis. Durasi (menit)"
                  value={modeForm.inputLabel}
                  onChange={(e) => setModeForm({ ...modeForm, inputLabel: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Urutan Tampil</label>
                <input
                  type="number"
                  value={modeForm.sortOrder}
                  onChange={(e) => setModeForm({ ...modeForm, sortOrder: e.target.value })}
                />
              </div>
            </div>
            <div className="btn-group" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={closeModeModal}>
                Batal
              </button>
              <button type="submit" className="btn btn-primary" disabled={submittingMode}>
                {submittingMode ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </Modal>
      )}

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
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                >
                  <option value="">Tanpa kategori</option>
                  {categories?.map((c) => (
                    <option key={c.categoryId} value={c.categoryId}>{c.name}</option>
                  ))}
                </select>
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
