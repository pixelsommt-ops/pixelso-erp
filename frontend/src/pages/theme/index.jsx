import { useCallback, useState } from 'react';
import * as themeService from '../../services/themeService';
import * as settingsService from '../../services/settingsService';
import useFetch from '../../hooks/useFetch';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import { compressImage } from '../../utils/compressImage';
import { formatDateTime } from '../../utils/format';

const MAX_HERO_SLIDES = 5;

// Label ramah untuk tiap CSS var yang boleh dioverride tema - harus tetap sinkron dengan
// THEMEABLE_COLOR_KEYS di backend/src/modules/theme/theme.service.js.
const COLOR_FIELDS = [
  { key: '--red-500', label: 'Warna Utama (tombol, gradient)' },
  { key: '--red-600', label: 'Warna Aksen' },
  { key: '--red-100', label: 'Warna Highlight Lembut' },
  { key: '--maroon-700', label: 'Warna Gradient Gelap' },
  { key: '--maroon-900', label: 'Warna Gelap Sekunder' },
  { key: '--maroon-950', label: 'Warna Footer / Gelap Utama' },
  { key: '--rose-50', label: 'Warna Latar Lembut' },
  { key: '--cream', label: 'Warna Latar Krem' },
];

const EMPTY_FORM = { name: '', colors: {}, logoUrl: '', heroSlides: [], customCss: '' };

function toForm(theme) {
  return {
    name: theme.name || '',
    colors: theme.colors || {},
    logoUrl: theme.logoUrl || '',
    heroSlides: Array.isArray(theme.heroSlides) ? theme.heroSlides : [],
    customCss: theme.customCss || '',
  };
}

export default function ThemePage() {
  const fetchThemes = useCallback(() => themeService.list(), []);
  const { data: themes, loading, error, reload } = useFetch(fetchThemes, [fetchThemes]);

  const [modalTheme, setModalTheme] = useState(null); // null = closed, {} = create, {...} = edit
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [actioningId, setActioningId] = useState(null);
  const [actionError, setActionError] = useState('');

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setModalTheme({});
  };
  const openEdit = (theme) => {
    setForm(toForm(theme));
    setFormError('');
    setModalTheme(theme);
  };
  const closeModal = () => setModalTheme(null);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    setFormError('');
    try {
      const { dataUrl } = await compressImage(file, { maxWidth: 600, maxHeight: 600, targetBytes: 300000 });
      const { data: uploaded } = await settingsService.uploadPhoto(dataUrl, file.name);
      setForm((prev) => ({ ...prev, logoUrl: uploaded.url }));
    } catch (err) {
      setFormError(err?.response?.data?.message || err?.message || 'Gagal mengunggah logo');
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleHeroUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingHero(true);
    setFormError('');
    try {
      const { dataUrl } = await compressImage(file, { maxWidth: 1920, maxHeight: 1080, targetBytes: 900000 });
      const { data: uploaded } = await settingsService.uploadPhoto(dataUrl, file.name);
      setForm((prev) => ({ ...prev, heroSlides: [...prev.heroSlides, { url: uploaded.url, linkUrl: '' }] }));
    } catch (err) {
      setFormError(err?.response?.data?.message || err?.message || 'Gagal mengunggah foto hero');
    } finally {
      setUploadingHero(false);
      e.target.value = '';
    }
  };

  const removeHeroSlide = (index) => {
    setForm((prev) => ({ ...prev, heroSlides: prev.heroSlides.filter((_, i) => i !== index) }));
  };

  const removeLogo = () => {
    setForm((prev) => ({ ...prev, logoUrl: '' }));
  };

  const updateColor = (key, value) => {
    setForm((prev) => ({
      ...prev,
      colors: value ? { ...prev.colors, [key]: value } : Object.fromEntries(Object.entries(prev.colors).filter(([k]) => k !== key)),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (uploadingLogo || uploadingHero) {
      setFormError('Tunggu upload foto selesai dulu sebelum menyimpan.');
      return;
    }
    setSubmitting(true);
    try {
      if (modalTheme?.themeId) {
        await themeService.update(modalTheme.themeId, form);
      } else {
        await themeService.create(form);
      }
      closeModal();
      reload();
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Gagal menyimpan tema');
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivate = async (theme) => {
    setActionError('');
    setActioningId(theme.themeId);
    try {
      await themeService.activate(theme.themeId);
      reload();
    } catch (err) {
      setActionError(err?.response?.data?.message || 'Gagal mengaktifkan tema');
    } finally {
      setActioningId(null);
    }
  };

  const handleDeactivate = async (theme) => {
    setActionError('');
    setActioningId(theme.themeId);
    try {
      await themeService.deactivate(theme.themeId);
      reload();
    } catch (err) {
      setActionError(err?.response?.data?.message || 'Gagal menonaktifkan tema');
    } finally {
      setActioningId(null);
    }
  };

  const handleDelete = async (theme) => {
    if (!window.confirm(`Hapus tema "${theme.name}"?`)) return;
    setActionError('');
    setActioningId(theme.themeId);
    try {
      await themeService.deleteTheme(theme.themeId);
      reload();
    } catch (err) {
      setActionError(err?.response?.data?.message || 'Gagal menghapus tema');
    } finally {
      setActioningId(null);
    }
  };

  const columns = [
    { key: 'name', label: 'Nama Tema' },
    { key: 'isActive', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'active' : 'inactive'} /> },
    { key: 'updatedAt', label: 'Diubah', render: (r) => formatDateTime(r.updatedAt) },
    {
      key: 'aksi',
      label: 'Aksi',
      render: (r) => (
        <div className="btn-group">
          {r.isActive ? (
            <button
              type="button"
              className="btn btn-sm"
              disabled={actioningId === r.themeId}
              onClick={(e) => {
                e.stopPropagation();
                handleDeactivate(r);
              }}
            >
              Nonaktifkan
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={actioningId === r.themeId}
              onClick={(e) => {
                e.stopPropagation();
                handleActivate(r);
              }}
            >
              Aktifkan
            </button>
          )}
          <button
            type="button"
            className="btn btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(r);
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn btn-sm btn-danger"
            disabled={actioningId === r.themeId}
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(r);
            }}
          >
            Hapus
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Tema Website</h1>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          + Tema Baru
        </button>
      </div>
      <p style={{ marginTop: '-0.5rem', color: 'var(--text-muted, #666)' }}>
        Buat beberapa tema sesuai event (Kemerdekaan, Idul Fitri, Tema Sekolah, dst) lalu aktifkan salah satu kapan
        perlu. Cuma satu tema boleh aktif sekaligus - langsung terlihat di cetakpixelso.com begitu diaktifkan, tidak
        ada penjadwalan otomatis.
      </p>

      {actionError && <div className="alert alert-error">{actionError}</div>}

      <DataTable columns={columns} rows={themes} loading={loading} error={error} rowKey="themeId" />

      {modalTheme && (
        <Modal title={modalTheme.themeId ? 'Edit Tema' : 'Tema Baru'} onClose={closeModal} width={720}>
          <form onSubmit={handleSubmit}>
            {formError && <div className="alert alert-error">{formError}</div>}

            <div className="form-grid">
              <div className="form-group full">
                <label>Nama Tema</label>
                <input
                  type="text"
                  required
                  placeholder="mis. Kemerdekaan RI, Idul Fitri, Tema Sekolah"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
            </div>

            <h3 style={{ fontSize: '0.9rem', marginTop: '1.25rem' }}>Warna</h3>
            <p style={{ marginTop: '-0.4rem', color: 'var(--text-muted, #666)', fontSize: '0.85rem' }}>
              Kosongkan warna yang tidak ingin diubah - tetap pakai warna default Pixelso.
            </p>
            <div className="grid grid-cols-3" style={{ gap: '0.75rem' }}>
              {COLOR_FIELDS.map((f) => (
                <div className="form-group" key={f.key}>
                  <label style={{ fontSize: '0.78rem' }}>{f.label}</label>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={form.colors[f.key] || '#ffffff'}
                      onChange={(e) => updateColor(f.key, e.target.value)}
                      style={{ width: 40, padding: 2 }}
                    />
                    <button type="button" className="btn btn-sm" onClick={() => updateColor(f.key, '')}>
                      Reset
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <h3 style={{ fontSize: '0.9rem', marginTop: '1.25rem' }}>Logo</h3>
            {form.logoUrl && (
              <div style={{ marginBottom: '0.5rem' }}>
                <img
                  src={form.logoUrl}
                  alt="Logo tema"
                  style={{ width: 80, height: 80, objectFit: 'contain', borderRadius: 6, border: '1px solid var(--color-border)', display: 'block', marginBottom: '0.4rem' }}
                />
                <button type="button" className="btn btn-sm" onClick={removeLogo}>
                  Hapus Logo
                </button>
              </div>
            )}
            <div>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoUpload} disabled={uploadingLogo} />
              <small style={{ display: 'block', color: 'var(--text-muted, #666)' }}>
                Ukuran disarankan 600x600px (persegi), file asli maks. 5MB. Kosongkan untuk pakai logo default Pixelso.{' '}
                {uploadingLogo && 'Mengunggah...'}
              </small>
            </div>

            <h3 style={{ fontSize: '0.9rem', marginTop: '1.25rem' }}>Foto Hero</h3>
            <p style={{ marginTop: '-0.4rem', color: 'var(--text-muted, #666)', fontSize: '0.85rem' }}>
              Kosongkan untuk tetap pakai foto hero normal (diatur di "Halaman Depan (Website)"). Maks. {MAX_HERO_SLIDES} foto.
            </p>
            {form.heroSlides.length > 0 && (
              <div className="grid grid-cols-3" style={{ marginBottom: '0.6rem' }}>
                {form.heroSlides.map((slide, index) => (
                  <div key={slide.url} className="card" style={{ padding: '0.5rem' }}>
                    <img
                      src={slide.url}
                      alt={`Hero ${index + 1}`}
                      style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 6, marginBottom: '0.4rem' }}
                    />
                    <button type="button" className="btn btn-sm" onClick={() => removeHeroSlide(index)}>
                      Hapus
                    </button>
                  </div>
                ))}
              </div>
            )}
            {form.heroSlides.length < MAX_HERO_SLIDES && (
              <>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleHeroUpload} disabled={uploadingHero} />
                <small style={{ display: 'block', color: 'var(--text-muted, #666)' }}>
                  Ukuran disarankan 1920x1080px, file asli maks. 5MB.
                </small>
              </>
            )}
            {uploadingHero && <small style={{ color: 'var(--text-muted, #666)' }}>Mengunggah...</small>}

            <h3 style={{ fontSize: '0.9rem', marginTop: '1.25rem' }}>CSS Tambahan (opsional)</h3>
            <textarea
              rows={4}
              placeholder=".topbar { border-bottom: 3px solid gold; }"
              value={form.customCss}
              onChange={(e) => setForm({ ...form, customCss: e.target.value })}
              style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
            />

            <div className="btn-group" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={closeModal}>
                Batal
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting || uploadingLogo || uploadingHero}>
                {submitting ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
