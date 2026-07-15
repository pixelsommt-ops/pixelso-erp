import { useCallback, useState } from 'react';
import * as promoService from '../../services/promoService';
import useFetch from '../../hooks/useFetch';
import useAuth from '../../hooks/useAuth';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import { formatDate } from '../../utils/format';
import { compressImage } from '../../utils/compressImage';

const EMPTY_PROMO_FORM = {
  title: '',
  description: '',
  imageUrl: '',
  startDate: '',
  endDate: '',
  isActive: true,
  sortOrder: 0,
};

export default function PromoPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole('manager');

  const fetchAll = useCallback(() => promoService.getAll(), []);
  const { data, loading, error, reload } = useFetch(fetchAll, [fetchAll]);

  const [modalPromo, setModalPromo] = useState(null);
  const [promoForm, setPromoForm] = useState(EMPTY_PROMO_FORM);
  const [promoError, setPromoError] = useState('');
  const [submittingPromo, setSubmittingPromo] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');

  const openCreatePromo = () => {
    setPromoForm(EMPTY_PROMO_FORM);
    setPromoError('');
    setPhotoError('');
    setModalPromo({});
  };

  const openEditPromo = (promo) => {
    setPromoForm({
      title: promo.title,
      description: promo.description || '',
      imageUrl: promo.imageUrl || '',
      startDate: promo.startDate ? promo.startDate.slice(0, 10) : '',
      endDate: promo.endDate ? promo.endDate.slice(0, 10) : '',
      isActive: promo.isActive,
      sortOrder: promo.sortOrder,
    });
    setPromoError('');
    setPhotoError('');
    setModalPromo(promo);
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError('');
    setUploadingPhoto(true);
    try {
      const { dataUrl } = await compressImage(file);
      const { data } = await promoService.uploadPhoto(dataUrl, file.name);
      setPromoForm((prev) => ({ ...prev, imageUrl: data.url }));
    } catch (err) {
      setPhotoError(err?.response?.data?.message || err?.message || 'Gagal mengunggah foto');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const closePromoModal = () => setModalPromo(null);

  const handlePromoSubmit = async (e) => {
    e.preventDefault();
    setPromoError('');
    // Cegah simpan sebelum upload foto selesai - sama seperti guard di halaman Pricing.
    if (uploadingPhoto) {
      setPromoError('Tunggu proses upload foto selesai dulu sebelum menyimpan.');
      return;
    }
    setSubmittingPromo(true);
    try {
      const payload = { ...promoForm, sortOrder: Number(promoForm.sortOrder) };
      if (modalPromo?.promoId) {
        await promoService.updatePromo(modalPromo.promoId, payload);
      } else {
        await promoService.createPromo(payload);
      }
      closePromoModal();
      reload();
    } catch (err) {
      setPromoError(err?.response?.data?.message || 'Gagal menyimpan promo');
    } finally {
      setSubmittingPromo(false);
    }
  };

  const handleDeletePromo = async (promo) => {
    if (!window.confirm(`Hapus promo "${promo.title}"?`)) return;
    await promoService.deletePromo(promo.promoId);
    reload();
  };

  const columns = [
    {
      key: 'imageUrl',
      label: 'Foto',
      render: (r) =>
        r.imageUrl ? (
          <img src={r.imageUrl} alt={r.title} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />
        ) : (
          <span style={{ color: 'var(--text-muted, #666)' }}>-</span>
        ),
    },
    { key: 'isActive', label: 'Aktif', render: (r) => (r.isActive ? '✓' : '—') },
    { key: 'title', label: 'Judul' },
    { key: 'startDate', label: 'Mulai', render: (r) => (r.startDate ? formatDate(r.startDate) : '-') },
    { key: 'endDate', label: 'Selesai', render: (r) => (r.endDate ? formatDate(r.endDate) : '-') },
    { key: 'sortOrder', label: 'Urutan' },
    ...(canManage
      ? [
          {
            key: 'actions',
            label: '',
            render: (r) => (
              <div className="btn-group">
                <button type="button" className="btn btn-sm" onClick={() => openEditPromo(r)}>
                  Edit
                </button>
                <button type="button" className="btn btn-sm" onClick={() => handleDeletePromo(r)}>
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
        <h1>Promo</h1>
        <div className="alert alert-error">Halaman ini hanya bisa diakses oleh role manager.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Promo</h1>
      </div>
      <p style={{ marginTop: '-0.5rem', color: 'var(--text-muted, #666)' }}>
        Promo yang aktif dan berada di rentang tanggal berlaku akan tampil otomatis di halaman
        Promo cetakpixelso.com. Kosongkan tanggal kalau promo tidak punya batas waktu.
      </p>

      <div className="card">
        <div className="card-head">
          <div>
            <h3>Daftar Promo</h3>
          </div>
          <button type="button" className="btn btn-primary" onClick={openCreatePromo}>
            + Tambah Promo
          </button>
        </div>
        <DataTable columns={columns} rows={data} loading={loading} error={error} rowKey="promoId" />
      </div>

      {modalPromo && (
        <Modal title={modalPromo.promoId ? 'Edit Promo' : 'Tambah Promo'} onClose={closePromoModal}>
          <form onSubmit={handlePromoSubmit}>
            {promoError && <div className="alert alert-error">{promoError}</div>}
            <div className="form-grid">
              <div className="form-group full">
                <label>Judul Promo</label>
                <input
                  type="text"
                  required
                  value={promoForm.title}
                  onChange={(e) => setPromoForm({ ...promoForm, title: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Tanggal Mulai (opsional)</label>
                <input
                  type="date"
                  value={promoForm.startDate}
                  onChange={(e) => setPromoForm({ ...promoForm, startDate: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Tanggal Selesai (opsional)</label>
                <input
                  type="date"
                  value={promoForm.endDate}
                  onChange={(e) => setPromoForm({ ...promoForm, endDate: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Aktif</label>
                <select
                  value={promoForm.isActive ? '1' : '0'}
                  onChange={(e) => setPromoForm({ ...promoForm, isActive: e.target.value === '1' })}
                >
                  <option value="1">Ya</option>
                  <option value="0">Tidak</option>
                </select>
              </div>
              <div className="form-group">
                <label>Urutan Tampil</label>
                <input
                  type="number"
                  min="0"
                  value={promoForm.sortOrder}
                  onChange={(e) => setPromoForm({ ...promoForm, sortOrder: e.target.value })}
                />
              </div>

              <div className="form-group full">
                <label>Foto Promo</label>
                {promoForm.imageUrl && (
                  <div className="card" style={{ padding: '0.5rem', marginBottom: '0.6rem', maxWidth: 200 }}>
                    <img
                      src={promoForm.imageUrl}
                      alt="Foto promo"
                      style={{ width: '100%', height: 96, objectFit: 'cover', borderRadius: 6, marginBottom: '0.4rem' }}
                    />
                    <button type="button" className="btn btn-sm" onClick={() => setPromoForm({ ...promoForm, imageUrl: '' })}>
                      Hapus Foto
                    </button>
                  </div>
                )}
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoChange} disabled={uploadingPhoto} />
                <small style={{ display: 'block', color: 'var(--text-muted, #666)' }}>
                  Otomatis dikecilkan sebelum diupload. File asli boleh sampai 5MB.
                </small>
                {uploadingPhoto && <small style={{ color: 'var(--text-muted, #666)' }}>Mengunggah...</small>}
                {photoError && <div className="alert alert-error" style={{ marginTop: '0.5rem' }}>{photoError}</div>}
              </div>

              <div className="form-group full">
                <label>Deskripsi</label>
                <textarea
                  rows={3}
                  placeholder="Mis. Diskon 10% untuk semua produk banner, berlaku sampai akhir bulan."
                  value={promoForm.description}
                  onChange={(e) => setPromoForm({ ...promoForm, description: e.target.value })}
                />
              </div>
            </div>
            <div className="btn-group" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={closePromoModal}>
                Batal
              </button>
              <button type="submit" className="btn btn-primary" disabled={submittingPromo || uploadingPhoto}>
                {submittingPromo ? 'Menyimpan...' : uploadingPhoto ? 'Menunggu upload foto...' : 'Simpan'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
