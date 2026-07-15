import { useCallback, useState } from 'react';
import * as pricingService from '../../services/pricingService';
import * as categoryService from '../../services/categoryService';
import useFetch from '../../hooks/useFetch';
import useAuth from '../../hooks/useAuth';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import RichTextEditor from '../../components/common/RichTextEditor';
import { formatCurrency } from '../../utils/format';
import { compressImage } from '../../utils/compressImage';

const MAX_PRODUCT_IMAGES = 4;
const PRICE_MODE_LABELS = { replace_base: 'Ganti Harga Dasar', multiplier: 'Kali Faktor', add: 'Tambahan Rp' };
const EMPTY_CHOICE = { label: '', priceMode: 'add', priceValue: 0, perUnit: false, isDefault: false };

const EMPTY_PRODUCT_FORM = {
  key: '',
  name: '',
  pricingMode: 'area',
  categoryId: '',
  baseRate: '',
  minimumArea: '',
  setupFee: '',
  isActive: true,
  images: [],
  videoUrl: '',
  description: '',
  specs: [],
  optionGroups: [],
};

// Editor daftar poin spesifikasi bebas (array string), mis. "Bahan flexi Korea 280gsm".
function SpecsEditor({ rows, onChange }) {
  const updateEntry = (index, value) => {
    const next = [...rows];
    next[index] = value;
    onChange(next);
  };
  const removeEntry = (index) => onChange(rows.filter((_, i) => i !== index));
  const addEntry = () => onChange([...rows, '']);

  return (
    <div className="form-group full">
      <label>Spesifikasi (poin-poin)</label>
      {rows.map((value, index) => (
        <div key={index} className="btn-group" style={{ marginBottom: '0.4rem' }}>
          <input
            type="text"
            placeholder="mis. Bahan flexi Korea 280gsm"
            value={value}
            onChange={(e) => updateEntry(index, e.target.value)}
          />
          <button type="button" className="btn btn-sm" onClick={() => removeEntry(index)}>
            Hapus
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-sm" onClick={addEntry}>
        + Tambah poin
      </button>
    </div>
  );
}

// Editor grup opsi Form Order per produk (mis. Bahan, Laminasi, Finishing) - tiap grup punya
// beberapa pilihan, tiap pilihan bisa ganti harga dasar / kali faktor / tambah Rp flat.
// State lokal murni, di-onChange ke productForm.optionGroups, dikirim sekali saat submit
// (pola sama seperti SpecsEditor - ganti seluruh array, bukan CRUD granular per baris).
function OptionGroupsEditor({ groups, onChange }) {
  const updateGroup = (groupIndex, patch) => {
    const next = [...groups];
    next[groupIndex] = { ...next[groupIndex], ...patch };
    onChange(next);
  };
  const removeGroup = (groupIndex) => onChange(groups.filter((_, i) => i !== groupIndex));
  const addGroup = () => onChange([...groups, { label: '', required: true, choices: [] }]);
  const moveGroup = (groupIndex, dir) => {
    const target = groupIndex + dir;
    if (target < 0 || target >= groups.length) return;
    const next = [...groups];
    [next[groupIndex], next[target]] = [next[target], next[groupIndex]];
    onChange(next);
  };

  const updateChoice = (groupIndex, choiceIndex, patch) => {
    const choices = groups[groupIndex].choices.map((c, i) => {
      if (i === choiceIndex) return { ...c, ...patch };
      // Default cuma boleh satu per grup.
      return patch.isDefault ? { ...c, isDefault: false } : c;
    });
    updateGroup(groupIndex, { choices });
  };
  const removeChoice = (groupIndex, choiceIndex) => {
    updateGroup(groupIndex, { choices: groups[groupIndex].choices.filter((_, i) => i !== choiceIndex) });
  };
  const addChoice = (groupIndex) => {
    updateGroup(groupIndex, { choices: [...groups[groupIndex].choices, { ...EMPTY_CHOICE }] });
  };
  const moveChoice = (groupIndex, choiceIndex, dir) => {
    const choices = groups[groupIndex].choices;
    const target = choiceIndex + dir;
    if (target < 0 || target >= choices.length) return;
    const next = [...choices];
    [next[choiceIndex], next[target]] = [next[target], next[choiceIndex]];
    updateGroup(groupIndex, { choices: next });
  };

  return (
    <div className="form-group full">
      <label>Form Order - Grup Opsi Produk</label>
      <p style={{ margin: '0 0 0.5rem', color: 'var(--text-muted, #666)', fontSize: '0.85rem' }}>
        Tiap produk bisa punya grup opsi sendiri (mis. Bahan, Laminasi, Finishing) yang tampil
        jadi pilihan di halaman produk storefront dan mempengaruhi harga.
      </p>
      {groups.map((group, groupIndex) => (
        <div key={groupIndex} className="card card-sm" style={{ marginBottom: '0.75rem' }}>
          <div className="btn-group" style={{ marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Nama grup, mis. Bahan"
              value={group.label}
              onChange={(e) => updateGroup(groupIndex, { label: e.target.value })}
              style={{ flex: 1, minWidth: 140 }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, margin: 0, whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={group.required}
                onChange={(e) => updateGroup(groupIndex, { required: e.target.checked })}
              />
              Wajib
            </label>
            <button type="button" className="btn btn-sm" onClick={() => moveGroup(groupIndex, -1)} disabled={groupIndex === 0}>↑</button>
            <button type="button" className="btn btn-sm" onClick={() => moveGroup(groupIndex, 1)} disabled={groupIndex === groups.length - 1}>↓</button>
            <button type="button" className="btn btn-sm" onClick={() => removeGroup(groupIndex)}>Hapus Grup</button>
          </div>

          {group.choices.map((choice, choiceIndex) => (
            <div key={choiceIndex} className="btn-group" style={{ marginBottom: '0.4rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Nama pilihan"
                value={choice.label}
                onChange={(e) => updateChoice(groupIndex, choiceIndex, { label: e.target.value })}
                style={{ flex: 1, minWidth: 120 }}
              />
              <select
                value={choice.priceMode}
                onChange={(e) => updateChoice(groupIndex, choiceIndex, { priceMode: e.target.value })}
              >
                {Object.entries(PRICE_MODE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                placeholder="Nilai"
                value={choice.priceValue}
                onChange={(e) => updateChoice(groupIndex, choiceIndex, { priceValue: Number(e.target.value) })}
                style={{ maxWidth: 110 }}
              />
              {choice.priceMode === 'add' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, margin: 0, whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    style={{ width: 'auto' }}
                    checked={choice.perUnit}
                    onChange={(e) => updateChoice(groupIndex, choiceIndex, { perUnit: e.target.checked })}
                  />
                  per pcs
                </label>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, margin: 0, whiteSpace: 'nowrap' }}>
                <input
                  type="radio"
                  name={`default-choice-${groupIndex}`}
                  style={{ width: 'auto' }}
                  checked={choice.isDefault}
                  onChange={() => updateChoice(groupIndex, choiceIndex, { isDefault: true })}
                />
                Default
              </label>
              <button type="button" className="btn btn-sm" onClick={() => moveChoice(groupIndex, choiceIndex, -1)} disabled={choiceIndex === 0}>↑</button>
              <button type="button" className="btn btn-sm" onClick={() => moveChoice(groupIndex, choiceIndex, 1)} disabled={choiceIndex === group.choices.length - 1}>↓</button>
              <button type="button" className="btn btn-sm" onClick={() => removeChoice(groupIndex, choiceIndex)}>Hapus</button>
            </div>
          ))}
          <button type="button" className="btn btn-sm" onClick={() => addChoice(groupIndex)}>+ Tambah pilihan</button>
        </div>
      ))}
      <button type="button" className="btn btn-sm" onClick={addGroup}>+ Tambah grup opsi</button>
    </div>
  );
}

export default function PricingPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole('manager');

  const fetchAll = useCallback(() => pricingService.getAll(), []);
  const { data, loading, error, reload } = useFetch(fetchAll, [fetchAll]);

  const fetchCategories = useCallback(() => categoryService.list(), []);
  const { data: categories } = useFetch(fetchCategories, [fetchCategories]);

  const [settingsForm, setSettingsForm] = useState(null);
  const [settingsError, setSettingsError] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const [modalProduct, setModalProduct] = useState(null);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT_FORM);
  const [productError, setProductError] = useState('');
  const [submittingProduct, setSubmittingProduct] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');

  const settings = settingsForm || data?.settings || { designFee: 0 };

  const openSettingsEditor = () => {
    setSettingsForm({ designFee: data.settings.designFee });
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
    setPhotoError('');
    setModalProduct({});
  };

  const openEditProduct = (product) => {
    setProductForm({
      key: product.key,
      name: product.name,
      pricingMode: product.pricingMode,
      categoryId: product.categoryId || '',
      baseRate: product.baseRate,
      minimumArea: product.minimumArea,
      setupFee: product.setupFee,
      isActive: product.isActive,
      images: Array.isArray(product.images) ? product.images : (product.imageUrl ? [product.imageUrl] : []),
      videoUrl: product.videoUrl || '',
      description: product.description || '',
      specs: Array.isArray(product.specs) ? product.specs : [],
      optionGroups: Array.isArray(product.optionGroups)
        ? product.optionGroups.map((g) => ({
            label: g.label,
            required: g.required,
            choices: (g.choices || []).map((c) => ({
              label: c.label,
              priceMode: c.priceMode,
              priceValue: c.priceValue,
              perUnit: c.perUnit,
              isDefault: c.isDefault,
            })),
          }))
        : [],
    });
    setProductError('');
    setPhotoError('');
    setModalProduct(product);
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError('');
    setUploadingPhoto(true);
    try {
      const { dataUrl } = await compressImage(file);
      const { data } = await pricingService.uploadPhoto(dataUrl, file.name);
      setProductForm((prev) => ({ ...prev, images: [...prev.images, data.url] }));
    } catch (err) {
      setPhotoError(err?.response?.data?.message || err?.message || 'Gagal mengunggah foto');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const removeProductImage = (index) => {
    setProductForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  };

  const makeProductImagePrimary = (index) => {
    setProductForm((prev) => {
      const images = [...prev.images];
      const [chosen] = images.splice(index, 1);
      images.unshift(chosen);
      return { ...prev, images };
    });
  };

  const closeProductModal = () => setModalProduct(null);

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    setProductError('');
    // Cegah simpan sebelum upload foto selesai - kalau tidak, foto yang baru dipilih belum
    // sempat masuk ke form dan yang tersimpan jadi data lama (kelihatan seperti "tidak tersimpan").
    if (uploadingPhoto) {
      setProductError('Tunggu proses upload foto selesai dulu sebelum menyimpan.');
      return;
    }
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
    try {
      await pricingService.deleteProduct(product.key);
      reload();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Gagal menghapus produk');
    }
  };

  const columns = [
    {
      key: 'imageUrl',
      label: 'Foto',
      render: (r) =>
        r.imageUrl ? (
          <img src={r.imageUrl} alt={r.name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
        ) : (
          <span style={{ color: 'var(--text-muted, #666)' }}>-</span>
        ),
    },
    { key: 'isActive', label: 'Aktif', render: (r) => (r.isActive ? '✓' : '—') },
    { key: 'key', label: 'Kode' },
    { key: 'name', label: 'Nama Produk' },
    { key: 'pricingMode', label: 'Mode', render: (r) => (r.pricingMode === 'area' ? 'Per m²' : 'Per pcs') },
    { key: 'category', label: 'Kategori', render: (r) => r.category?.name || '-' },
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
            <p>Biaya bantuan desain yang dipakai kalkulator (checkbox "butuh bantuan desain").</p>
          </div>
          {!settingsForm && (
            <button type="button" className="btn" onClick={openSettingsEditor}>
              Edit
            </button>
          )}
        </div>

        {!settingsForm ? (
          <div className="field">
            <label>Biaya bantuan desain</label>
            <p>{formatCurrency(settings.designFee)}</p>
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
                <label>Kategori</label>
                <select
                  value={productForm.categoryId}
                  onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                >
                  <option value="">Tanpa kategori</option>
                  {categories?.map((c) => (
                    <option key={c.categoryId} value={c.categoryId}>{c.name}</option>
                  ))}
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

              <div className="form-group full">
                <label>Foto Produk (maks. {MAX_PRODUCT_IMAGES}, foto pertama jadi thumbnail utama)</label>
                {productForm.images.length > 0 && (
                  <div className="grid grid-cols-3" style={{ marginBottom: '0.6rem' }}>
                    {productForm.images.map((url, index) => (
                      <div key={url} className="card" style={{ padding: '0.5rem' }}>
                        <div style={{ position: 'relative' }}>
                          <img
                            src={url}
                            alt={`Foto ${index + 1}`}
                            style={{ width: '100%', height: 96, objectFit: 'cover', borderRadius: 6, marginBottom: '0.4rem' }}
                          />
                          {index === 0 && (
                            <span
                              className="badge badge-info"
                              style={{ position: 'absolute', top: 4, left: 4, fontSize: '0.7rem' }}
                            >
                              Utama
                            </span>
                          )}
                        </div>
                        <div className="btn-group">
                          {index !== 0 && (
                            <button type="button" className="btn btn-sm" onClick={() => makeProductImagePrimary(index)}>
                              Jadikan Utama
                            </button>
                          )}
                          <button type="button" className="btn btn-sm" onClick={() => removeProductImage(index)}>
                            Hapus
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {productForm.images.length < MAX_PRODUCT_IMAGES ? (
                  <>
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoChange} disabled={uploadingPhoto} />
                    <small style={{ display: 'block', color: 'var(--text-muted, #666)' }}>
                      Otomatis dikecilkan maks. 1600x1200px sebelum diupload (target &lt;700KB). File asli boleh sampai 5MB.
                    </small>
                  </>
                ) : (
                  <small style={{ display: 'block', color: 'var(--text-muted, #666)' }}>
                    Sudah {MAX_PRODUCT_IMAGES} foto (maksimal). Hapus salah satu dulu untuk menambah foto lain.
                  </small>
                )}
                {uploadingPhoto && <small style={{ color: 'var(--text-muted, #666)' }}>Mengunggah...</small>}
                {photoError && <div className="alert alert-error" style={{ marginTop: '0.5rem' }}>{photoError}</div>}
              </div>

              <div className="form-group full">
                <label>Link Video Produk (opsional)</label>
                <input
                  type="url"
                  placeholder="https://youtube.com/... atau link Instagram/TikTok"
                  value={productForm.videoUrl}
                  onChange={(e) => setProductForm({ ...productForm, videoUrl: e.target.value })}
                />
                <small style={{ color: 'var(--text-muted, #666)' }}>
                  Tempel link video yang sudah diupload ke YouTube/Instagram/TikTok - tidak diupload ke server ini.
                </small>
              </div>

              <div className="form-group full">
                <label>Deskripsi Singkat</label>
                <RichTextEditor
                  placeholder="Mis. Banner outdoor tahan air, cocok untuk promosi luar ruang."
                  value={productForm.description}
                  onChange={(html) => setProductForm({ ...productForm, description: html })}
                />
              </div>

              <SpecsEditor
                rows={productForm.specs}
                onChange={(v) => setProductForm({ ...productForm, specs: v })}
              />

              <OptionGroupsEditor
                groups={productForm.optionGroups}
                onChange={(v) => setProductForm({ ...productForm, optionGroups: v })}
              />
            </div>
            <div className="btn-group" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={closeProductModal}>
                Batal
              </button>
              <button type="submit" className="btn btn-primary" disabled={submittingProduct || uploadingPhoto}>
                {submittingProduct ? 'Menyimpan...' : uploadingPhoto ? 'Menunggu upload foto...' : 'Simpan'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
