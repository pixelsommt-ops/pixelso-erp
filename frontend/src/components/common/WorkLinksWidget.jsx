import { useCallback, useState } from 'react';
import * as workLinksService from '../../services/workLinksService';
import useFetch from '../../hooks/useFetch';
import useAuth from '../../hooks/useAuth';
import Modal from './Modal';
import { formatDateTime } from '../../utils/format';

const PLATFORM_LABELS = { web: 'Web', youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok' };

// Fallback kalau thumbnailUrl null (mis. Instagram/TikTok umumnya menolak scraping tanpa login -
// lihat workLinks.service.js#fetchOgMeta) - tetap tampil rapi tanpa gambar rusak.
function PlatformIcon({ platform }) {
  return (
    <div
      style={{
        width: '100%',
        height: 120,
        borderRadius: 6,
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text-muted)',
        fontSize: '0.85rem',
        fontWeight: 600,
      }}
    >
      {PLATFORM_LABELS[platform] || 'Web'}
    </div>
  );
}

export default function WorkLinksWidget() {
  const { hasRole } = useAuth();
  const isManager = hasRole('manager');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ url: '', title: '' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [clicksModal, setClicksModal] = useState(null); // { link, clicks }

  const fetchLinks = useCallback(() => workLinksService.list({ page }), [page]);
  const { data, loading, error, reload } = useFetch(fetchLinks, [fetchLinks]);

  const openCreate = () => {
    setForm({ url: '', title: '' });
    setFormError('');
    setCreateOpen(true);
  };
  const closeCreate = () => setCreateOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await workLinksService.create(form);
      closeCreate();
      reload();
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Gagal menambah link');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (link) => {
    if (!window.confirm(`Hapus link "${link.title || link.url}"?`)) return;
    try {
      await workLinksService.deleteLink(link.linkId);
      reload();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Gagal menghapus link');
    }
  };

  const openClicks = async (link) => {
    const { data: clicks } = await workLinksService.listClicks(link.linkId);
    setClicksModal({ link, clicks });
  };
  const closeClicks = () => setClicksModal(null);

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div className="page-header">
        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Link Kerja</h2>
        {isManager && (
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
            + Tambah Link
          </button>
        )}
      </div>

      {loading && <div className="empty-state">Memuat...</div>}
      {error && <div className="alert alert-error">{error}</div>}
      {data && data.links.length === 0 && <div className="empty-state">Belum ada link dibagikan</div>}

      {data && data.links.length > 0 && (
        <div className="grid grid-cols-4" style={{ gap: '0.75rem' }}>
          {data.links.map((link) => (
            <div key={link.linkId} className="card" style={{ padding: '0.6rem' }}>
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => workLinksService.recordClick(link.linkId).catch(() => {})}
              >
                {link.thumbnailUrl ? (
                  <img
                    src={link.thumbnailUrl}
                    alt={link.title || link.url}
                    style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 6 }}
                  />
                ) : (
                  <PlatformIcon platform={link.platform} />
                )}
                <div className="text-sm" style={{ marginTop: '0.4rem', fontWeight: 600, color: 'var(--color-text)' }}>
                  {link.title || link.url}
                </div>
              </a>
              <div className="text-muted text-sm" style={{ marginTop: '0.2rem', wordBreak: 'break-all' }}>
                {link.url}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                {isManager ? (
                  <button type="button" className="btn btn-sm" onClick={() => openClicks(link)}>
                    {link.clickCount} klik
                  </button>
                ) : (
                  <span className="text-muted text-sm">{link.clickCount} klik</span>
                )}
                {isManager && (
                  <button type="button" className="btn btn-sm" onClick={() => handleDelete(link)}>
                    Hapus
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="btn-group" style={{ marginTop: '0.75rem', justifyContent: 'center', alignItems: 'center' }}>
          <button type="button" className="btn btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            &larr; Sebelumnya
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #666)' }}>
            Halaman {data.page} dari {data.totalPages}
          </span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page >= data.totalPages}
          >
            Selanjutnya &rarr;
          </button>
        </div>
      )}

      {createOpen && (
        <Modal title="Tambah Link Kerja" onClose={closeCreate}>
          <form onSubmit={handleSubmit}>
            {formError && <div className="alert alert-error">{formError}</div>}
            <div className="form-grid">
              <div className="form-group full">
                <label>URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://..."
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                />
              </div>
              <div className="form-group full">
                <label>Keterangan Singkat (opsional)</label>
                <input
                  type="text"
                  placeholder="Kosongkan untuk pakai judul halaman otomatis"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
            </div>
            <p className="text-muted text-sm">
              Thumbnail diambil otomatis dari link (butuh beberapa detik untuk halaman yang lambat; Instagram/TikTok
              sering tidak menyediakan thumbnail publik, akan tampil ikon platform saja).
            </p>
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

      {clicksModal && (
        <Modal title={`Yang sudah klik: ${clicksModal.link.title || clicksModal.link.url}`} onClose={closeClicks}>
          {clicksModal.clicks.length === 0 ? (
            <div className="empty-state">Belum ada yang klik</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {clicksModal.clicks.map((c) => (
                    <tr key={c.clickId}>
                      <td>{c.user?.name}</td>
                      <td>{formatDateTime(c.clickedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
