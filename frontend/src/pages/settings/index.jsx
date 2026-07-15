import { useCallback, useState } from 'react';
import * as settingsService from '../../services/settingsService';
import useFetch from '../../hooks/useFetch';
import useAuth from '../../hooks/useAuth';
import { compressImage } from '../../utils/compressImage';
import RichTextEditor from '../../components/common/RichTextEditor';

const MAX_HERO_SLIDES = 5;

const FIELDS = [
  { key: 'name', label: 'Nama Bisnis' },
  { key: 'tagline', label: 'Tagline' },
  { key: 'whatsapp', label: 'Nomor WhatsApp', help: 'Format lokal, mis. 08156609299' },
  { key: 'openingHours', label: 'Jam Operasional', help: 'Mis. Senin–Sabtu • Konsultasi desain & cetak' },
  { key: 'instagram', label: 'Username Instagram', help: 'Tanpa @, mis. cetakpixelso' },
  { key: 'tiktok', label: 'Username TikTok' },
  { key: 'youtube', label: 'Username/Handle YouTube' },
  { key: 'facebook', label: 'Nama/Halaman Facebook' },
];

function toForm(settings) {
  return {
    name: settings.name || '',
    tagline: settings.tagline || '',
    description: settings.description || '',
    address: settings.address || '',
    openingHours: settings.openingHours || '',
    whatsapp: settings.whatsapp || '',
    instagram: settings.instagram || '',
    tiktok: settings.tiktok || '',
    youtube: settings.youtube || '',
    facebook: settings.facebook || '',
    heroSlides: Array.isArray(settings.heroSlides) ? settings.heroSlides : [],
    galleryImages: Array.isArray(settings.galleryImages) ? settings.galleryImages : [],
  };
}

export default function SettingsPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole('manager');

  const fetchSettings = useCallback(() => settingsService.getSettings(), []);
  const { data, loading, error, reload } = useFetch(fetchSettings, [fetchSettings]);

  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [heroError, setHeroError] = useState('');
  const [galleryError, setGalleryError] = useState('');

  const editing = form || (data ? toForm(data) : null);

  const startEditing = () => {
    setForm(toForm(data));
    setFormError('');
    setSavedMsg('');
  };

  const cancelEditing = () => setForm(null);

  const handleHeroUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHeroError('');
    setUploadingHero(true);
    try {
      const { dataUrl } = await compressImage(file, { maxWidth: 1920, maxHeight: 1080, targetBytes: 900000 });
      const { data: uploaded } = await settingsService.uploadPhoto(dataUrl, file.name);
      setForm((prev) => ({ ...prev, heroSlides: [...prev.heroSlides, { url: uploaded.url, linkUrl: '' }] }));
    } catch (err) {
      setHeroError(err?.response?.data?.message || err?.message || 'Gagal mengunggah foto hero');
    } finally {
      setUploadingHero(false);
      e.target.value = '';
    }
  };

  const updateHeroSlideLink = (index, linkUrl) => {
    setForm((prev) => ({
      ...prev,
      heroSlides: prev.heroSlides.map((s, i) => (i === index ? { ...s, linkUrl } : s)),
    }));
  };

  const removeHeroSlide = (index) => {
    setForm((prev) => ({ ...prev, heroSlides: prev.heroSlides.filter((_, i) => i !== index) }));
  };

  const moveHeroSlide = (index, direction) => {
    setForm((prev) => {
      const slides = [...prev.heroSlides];
      const target = index + direction;
      if (target < 0 || target >= slides.length) return prev;
      [slides[index], slides[target]] = [slides[target], slides[index]];
      return { ...prev, heroSlides: slides };
    });
  };

  const handleGalleryUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGalleryError('');
    setUploadingGallery(true);
    try {
      const { dataUrl } = await compressImage(file);
      const { data: uploaded } = await settingsService.uploadPhoto(dataUrl, file.name);
      setForm((prev) => ({ ...prev, galleryImages: [...prev.galleryImages, { url: uploaded.url, caption: '' }] }));
    } catch (err) {
      setGalleryError(err?.response?.data?.message || err?.message || 'Gagal mengunggah foto');
    } finally {
      setUploadingGallery(false);
      e.target.value = '';
    }
  };

  const updateGalleryCaption = (index, caption) => {
    setForm((prev) => ({
      ...prev,
      galleryImages: prev.galleryImages.map((g, i) => (i === index ? { ...g, caption } : g)),
    }));
  };

  const removeGalleryImage = (index) => {
    setForm((prev) => ({ ...prev, galleryImages: prev.galleryImages.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    // Cegah simpan sebelum upload foto selesai - kalau tidak, foto yang baru dipilih belum
    // sempat masuk ke form dan yang tersimpan jadi data lama (kelihatan seperti "tidak tersimpan").
    if (uploadingHero || uploadingGallery) {
      setFormError('Tunggu proses upload foto selesai dulu sebelum menyimpan.');
      return;
    }
    setSaving(true);
    try {
      await settingsService.updateSettings(form);
      setForm(null);
      setSavedMsg('Tersimpan.');
      reload();
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return (
      <div>
        <h1>Halaman Depan (Website)</h1>
        <div className="alert alert-error">Halaman ini hanya bisa diakses oleh role manager.</div>
      </div>
    );
  }

  if (loading) return <div><h1>Halaman Depan (Website)</h1><p>Memuat...</p></div>;
  if (error) return <div><h1>Halaman Depan (Website)</h1><div className="alert alert-error">{error}</div></div>;

  const isEditing = Boolean(form);

  return (
    <div>
      <div className="page-header">
        <h1>Halaman Depan (Website)</h1>
        {!isEditing && (
          <button type="button" className="btn btn-primary" onClick={startEditing}>
            Edit
          </button>
        )}
      </div>
      <p style={{ marginTop: '-0.5rem', color: 'var(--text-muted, #666)' }}>
        Ini satu-satunya tempat mengedit alamat, kontak sosial media, dan foto pendukung yang tampil di
        cetakpixelso.com. Perubahan langsung terlihat pelanggan setelah disimpan.
      </p>

      {savedMsg && !isEditing && <div className="alert alert-success">{savedMsg}</div>}

      <form onSubmit={handleSubmit}>
        {formError && <div className="alert alert-error">{formError}</div>}

        <div className="card">
          <h3>Identitas &amp; Kontak</h3>
          <div className="form-grid">
            {FIELDS.map((f) => (
              <div className="form-group" key={f.key}>
                <label>{f.label}</label>
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={editing[f.key]}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    />
                    {f.help && <small style={{ color: 'var(--text-muted, #666)' }}>{f.help}</small>}
                  </>
                ) : (
                  <p>{editing[f.key] || '-'}</p>
                )}
              </div>
            ))}
            <div className="form-group full">
              <label>Deskripsi Singkat</label>
              {isEditing ? (
                <RichTextEditor
                  value={editing.description}
                  onChange={(html) => setForm({ ...form, description: html })}
                />
              ) : editing.description ? (
                <div dangerouslySetInnerHTML={{ __html: editing.description }} />
              ) : (
                <p>-</p>
              )}
            </div>
            <div className="form-group full">
              <label>Alamat</label>
              {isEditing ? (
                <textarea
                  rows={2}
                  value={editing.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              ) : (
                <p>{editing.address || '-'}</p>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Foto Hero (Halaman Depan)</h3>
          <p style={{ marginTop: '-0.4rem', color: 'var(--text-muted, #666)', fontSize: '0.85rem' }}>
            Maks. {MAX_HERO_SLIDES} foto, bergantian otomatis tiap 3 detik di halaman depan. Tiap foto bisa diklik
            mengarah ke link tertentu (produk unggulan, promo, dsb) - kosongkan kalau tidak perlu diklik.
          </p>
          {editing.heroSlides.length > 0 && (
            <div className="grid grid-cols-3" style={{ marginBottom: '0.6rem' }}>
              {editing.heroSlides.map((slide, index) => (
                <div key={slide.url} className="card" style={{ padding: '0.5rem' }}>
                  <img
                    src={slide.url}
                    alt={`Hero ${index + 1}`}
                    style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 6, marginBottom: '0.4rem' }}
                  />
                  {isEditing ? (
                    <>
                      <input
                        type="url"
                        placeholder="Link tujuan (opsional), mis. /produk/banner"
                        value={slide.linkUrl || ''}
                        onChange={(e) => updateHeroSlideLink(index, e.target.value)}
                        style={{ marginBottom: '0.4rem' }}
                      />
                      <div className="btn-group">
                        <button type="button" className="btn btn-sm" onClick={() => moveHeroSlide(index, -1)} disabled={index === 0}>
                          Naik
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => moveHeroSlide(index, 1)}
                          disabled={index === editing.heroSlides.length - 1}
                        >
                          Turun
                        </button>
                        <button type="button" className="btn btn-sm" onClick={() => removeHeroSlide(index)}>
                          Hapus
                        </button>
                      </div>
                    </>
                  ) : (
                    slide.linkUrl && (
                      <p style={{ fontSize: '0.8rem', margin: 0, wordBreak: 'break-all' }}>→ {slide.linkUrl}</p>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
          {isEditing && (
            <>
              {editing.heroSlides.length < MAX_HERO_SLIDES ? (
                <>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleHeroUpload} disabled={uploadingHero} />
                  <small style={{ display: 'block', color: 'var(--text-muted, #666)' }}>
                    Otomatis dikecilkan maks. 1920x1080px sebelum diupload (target &lt;900KB). File asli boleh sampai 5MB.
                  </small>
                </>
              ) : (
                <small style={{ display: 'block', color: 'var(--text-muted, #666)' }}>
                  Sudah {MAX_HERO_SLIDES} foto (maksimal). Hapus salah satu dulu untuk menambah foto lain.
                </small>
              )}
              {uploadingHero && <small style={{ color: 'var(--text-muted, #666)' }}>Mengunggah...</small>}
              {heroError && <div className="alert alert-error" style={{ marginTop: '0.5rem' }}>{heroError}</div>}
            </>
          )}
          {editing.heroSlides.length === 0 && !isEditing && <p style={{ color: 'var(--text-muted, #666)' }}>Belum ada foto hero.</p>}
        </div>

        <div className="card">
          <h3>Foto Pendukung (Galeri)</h3>
          <div className="grid grid-cols-3">
            {editing.galleryImages.map((g, index) => (
              <div key={index} className="card" style={{ padding: '0.75rem' }}>
                <img src={g.url} alt={g.caption || 'Foto'} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 6, marginBottom: '0.4rem' }} />
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      placeholder="Keterangan (opsional)"
                      value={g.caption}
                      onChange={(e) => updateGalleryCaption(index, e.target.value)}
                      style={{ marginBottom: '0.4rem' }}
                    />
                    <button type="button" className="btn btn-sm" onClick={() => removeGalleryImage(index)}>
                      Hapus
                    </button>
                  </>
                ) : (
                  g.caption && <p style={{ fontSize: '0.85rem', margin: 0 }}>{g.caption}</p>
                )}
              </div>
            ))}
          </div>
          {editing.galleryImages.length === 0 && !isEditing && (
            <p style={{ color: 'var(--text-muted, #666)' }}>Belum ada foto pendukung.</p>
          )}
          {isEditing && (
            <div style={{ marginTop: '0.75rem' }}>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleGalleryUpload} disabled={uploadingGallery} />
              <small style={{ display: 'block', color: 'var(--text-muted, #666)' }}>
                Otomatis dikecilkan maks. 1600x1200px sebelum diupload (target &lt;700KB). File asli boleh sampai 5MB.
              </small>
              {uploadingGallery && <small style={{ color: 'var(--text-muted, #666)' }}>Mengunggah...</small>}
              {galleryError && <div className="alert alert-error" style={{ marginTop: '0.5rem' }}>{galleryError}</div>}
            </div>
          )}
        </div>

        {isEditing && (
          <div className="btn-group" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={cancelEditing}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || uploadingHero || uploadingGallery}>
              {saving ? 'Menyimpan...' : uploadingHero || uploadingGallery ? 'Menunggu upload foto...' : 'Simpan'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
