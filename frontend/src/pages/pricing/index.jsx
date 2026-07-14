import { useCallback, useState } from 'react';
import * as pricingService from '../../services/pricingService';
import useFetch from '../../hooks/useFetch';
import useAuth from '../../hooks/useAuth';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import { formatCurrency } from '../../utils/format';

const EMPTY_PRODUCT_FORM = {
  key: '',
  name: '',
  pricingMode: 'area',
  baseRate: '',
  minimumArea: '',
  setupFee: '',
  isActive: true,
};

// Editor baris key->value sederhana untuk materialFactors/finishingRates (peta terbuka,
// bisa nambah tier baru kapan saja - bukan enum tetap, jadi tidak dihardcode jadi input tersendiri).
function KeyValueEditor({ label, hint, rows, onChange }) {
  const entries = Object.entries(rows || {});

  const updateEntry = (index, field, value) => {
    const next = [...entries];
    next[index] = field === 'key' ? [value, next[index][1]] : [next[index][0], value];
    onChange(Object.fromEntries(next));
  };

  const removeEntry = (index) => {
    const next = entries.filter((_, i) => i !== index);
    onChange(Object.fromEntries(next));
  };

  const addEntry = () => {
    onChange({ ...rows, ['']: 0 });
  };

  return (
    <div className="form-group full">
      <label>{label}</label>
      {hint && <p style={{ margin: '0 0 0.5rem', color: 'var(--text-muted, #666)', fontSize: '0.85rem' }}>{hint}</p>}
      {entries.map(([k, v], index) => (
        <div key={index} className="btn-group" style={{ marginBottom: '0.4rem' }}>
          <input
            type="text"
            placeholder="kode"
            value={k}
            onChange={(e) => updateEntry(index, 'key', e.target.value)}
            style={{ maxWidth: 140 }}
          />
          <input
            type="number"
            step="0.01"
            placeholder="nilai"
            value={v}
            onChange={(e) => updateEntry(index, 'value', Number(e.target.value))}
            style={{ maxWidth: 120 }}
          />
          <button type="button" className="btn btn-sm" onClick={() => removeEntry(index)}>
            Hapus
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-sm" onClick={addEntry}>
        + Tambah baris
      </button>
    </div>
  );
}

export default function PricingPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole('manager');

  const fetchAll = useCallback(() => pricingService.getAll(), []);
  const { data, loading, error, reload } = useFetch(fetchAll, [fetchAll]);

  const [settingsForm, setSettingsForm] = useState(null);
  const [settingsError, setSettingsError] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const [modalProduct, setModalProduct] = useState(null);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT_FORM);
  const [productError, setProductError] = useState('');
  const [submittingProduct, setSubmittingProduct] = useState(false);

  const settings = settingsForm || data?.settings || { designFee: 0, materialFactors: {}, finishingRates: {} };

  const openSettingsEditor = () => {
    setSettingsForm({
      designFee: data.settings.designFee,
      materialFactors: { ...data.settings.materialFactors },
      finishingRates: { ...data.settings.finishingRates },
    });
    setSettingsError('');
  };

  const cancelSettingsEditor = () => setSettingsForm(null);

  const saveSettings = async (e) => {
    e.preventDefault();
    setSettingsError('');
    setSavingSettings(true);
    try {
      await pricingService.updateSettings(settingsForm);
      setSettingsForm(null);
      reload();
    } catch (err) {
      setSettingsError(err?.response?.data?.message || 'Gagal menyimpan variabel global');
    } finally {
      setSavingSettings(false);
    }
  };

  const openCreateProduct = () => {
    setProductForm(EMPTY_PRODUCT_FORM);
    setProductError('');
    setModalProduct({});
  };

  const openEditProduct = (product) => {
    setProductForm({
      key: product.key,
      name: product.name,
      pricingMode: product.pricingMode,
      baseRate: product.baseRate,
      minimumArea: product.minimumArea,
      setupFee: product.setupFee,
      isActive: product.isActive,
    });
    setProductError('');
    setModalProduct(product);
  };

  const closeProductModal = () => setModalProduct(null);

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    setProductError('');
    setSubmittingProduct(true);
    try {
      const payload = {
        ...productForm,
        baseRate: Number(productForm.baseRate),
        minimumArea: Number(productForm.minimumArea),
        setupFee: Number(productForm.setupFee),
      };
      if (modalProduct?.key) {
        delete payload.key; // key tidak bisa diubah - lihat pricing.service.js
        await pricingService.updateProduct(modalProduct.key, payload);
      } else {
        await pricingService.createProduct(payload);
      }
      closeProductModal();
      reload();
    } catch (err) {
      setProductError(err?.response?.data?.message || 'Gagal menyimpan produk');
    } finally {
      setSubmittingProduct(false);
    }
  };

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`Hapus produk "${product.name}" dari kalkulator website?`)) return;
    await pricingService.deleteProduct(product.key);
    reload();
  };

  const columns = [
    { key: 'isActive', label: 'Aktif', render: (r) => (r.isActive ? '✓' : '—') },
    { key: 'key', label: 'Kode' },
    { key: 'name', label: 'Nama Produk' },
    { key: 'pricingMode', label: 'Mode', render: (r) => (r.pricingMode === 'area' ? 'Per m²' : 'Per pcs') },
    { key: 'baseRate', label: 'Tarif Dasar', render: (r) => formatCurrency(r.baseRate) },
    { key: 'minimumArea', label: 'Minimum Area', render: (r) => r.minimumArea },
    { key: 'setupFee', label: 'Biaya Setup', render: (r) => formatCurrency(r.setupFee) },
    ...(canManage
      ? [
          {
            key: 'actions',
            label: '',
            render: (r) => (
              <div className="btn-group">
                <button type="button" className="btn btn-sm" onClick={() => openEditProduct(r)}>
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

  if (!canManage) {
    return (
      <div>
        <h1>Harga Website (Kalkulator)</h1>
        <div className="alert alert-error">Halaman ini hanya bisa diakses oleh role manager.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Harga Website (Kalkulator)</h1>
      </div>
      <p style={{ marginTop: '-0.5rem', color: 'var(--text-muted, #666)' }}>
        Ini satu-satunya tempat mengedit harga kalkulator publik di cetakpixelso.com. Landing page membaca harga
        dari sini secara otomatis.
      </p>

      <div className="card">
        <div className="card-head">
          <div>
            <h3>Variabel Global</h3>
            <p>Biaya desain, faktor bahan, dan tarif finishing yang dipakai kalkulator.</p>
          </div>
          {!settingsForm && (
            <button type="button" className="btn" onClick={openSettingsEditor}>
              Edit
            </button>
          )}
        </div>

        {!settingsForm ? (
          <div className="grid grid-3">
            <div className="field">
              <label>Biaya bantuan desain</label>
              <p>{formatCurrency(settings.designFee)}</p>
            </div>
            <div className="field">
              <label>Faktor bahan</label>
              <p>{Object.entries(settings.materialFactors || {}).map(([k, v]) => `${k}: ${v}`).join(', ') || '-'}</p>
            </div>
            <div className="field">
              <label>Tarif finishing</label>
              <p>{Object.entries(settings.finishingRates || {}).map(([k, v]) => `${k}: ${v}`).join(', ') || '-'}</p>
            </div>
          </div>
        ) : (
          <form onSubmit={saveSettings}>
            {settingsError && <div className="alert alert-error">{settingsError}</div>}
            <div className="form-grid">
              <div className="form-group full">
                <label>Biaya bantuan desain (Rp)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={settingsForm.designFee}
                  onChange={(e) => setSettingsForm({ ...settingsForm, designFee: e.target.value })}
                />
              </div>
              <KeyValueEditor
                label="Faktor bahan"
                hint="Pengali harga per jenis bahan, mis. standard: 1, premium: 1.22"
                rows={settingsForm.materialFactors}
                onChange={(v) => setSettingsForm({ ...settingsForm, materialFactors: v })}
              />
              <KeyValueEditor
                label="Tarif finishing"
                hint="Persentase tambahan dari biaya produksi, mis. none: 0, basic: 0.08"
                rows={settingsForm.finishingRates}
                onChange={(v) => setSettingsForm({ ...settingsForm, finishingRates: v })}
              />
            </div>
            <div className="btn-group" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={cancelSettingsEditor}>
                Batal
              </button>
              <button type="submit" className="btn btn-primary" disabled={savingSettings}>
                {savingSettings ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h3>Daftar Produk Website</h3>
            <p>Mode "Per m²" memakai ukuran cm dan tarif per m². Mode "Per pcs" memakai tarif per pcs.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={openCreateProduct}>
            + Tambah Produk
          </button>
        </div>
        <DataTable columns={columns} rows={data?.products} loading={loading} error={error} rowKey="key" />
      </div>

      {modalProduct && (
        <Modal title={modalProduct.key ? 'Edit Produk' : 'Tambah Produk'} onClose={closeProductModal}>
          <form onSubmit={handleProductSubmit}>
            {productError && <div className="alert alert-error">{productError}</div>}
            <div className="form-grid">
              <div className="form-group full">
                <label>Kode (key)</label>
                <input
                  type="text"
                  required
                  disabled={!!modalProduct.key}
                  placeholder="mis. banner"
                  value={productForm.key}
                  onChange={(e) => setProductForm({ ...productForm, key: e.target.value })}
                />
                {modalProduct.key && (
                  <small style={{ color: 'var(--text-muted, #666)' }}>Kode tidak bisa diubah setelah dibuat.</small>
                )}
              </div>
              <div className="form-group full">
                <label>Nama Produk</label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Mode Harga</label>
                <select
                  value={productForm.pricingMode}
                  onChange={(e) => setProductForm({ ...productForm, pricingMode: e.target.value })}
                >
                  <option value="area">Per m² (area)</option>
                  <option value="unit">Per pcs (unit)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Aktif</label>
                <select
                  value={productForm.isActive ? '1' : '0'}
                  onChange={(e) => setProductForm({ ...productForm, isActive: e.target.value === '1' })}
                >
                  <option value="1">Ya</option>
                  <option value="0">Tidak</option>
                </select>
              </div>
              <div className="form-group">
                <label>Tarif Dasar (Rp)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={productForm.baseRate}
                  onChange={(e) => setProductForm({ ...productForm, baseRate: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Minimum Area (m²)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.minimumArea}
                  onChange={(e) => setProductForm({ ...productForm, minimumArea: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Biaya Setup (Rp)</label>
                <input
                  type="number"
                  min="0"
                  value={productForm.setupFee}
                  onChange={(e) => setProductForm({ ...productForm, setupFee: e.target.value })}
                />
              </div>
            </div>
            <div className="btn-group" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={closeProductModal}>
                Batal
              </button>
              <button type="submit" className="btn btn-primary" disabled={submittingProduct}>
                {submittingProduct ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
