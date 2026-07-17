import { useCallback, useState } from 'react';
import * as positionService from '../../services/positionService';
import useFetch from '../../hooks/useFetch';
import useAuth from '../../hooks/useAuth';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';

const EMPTY_FORM = { name: '', parentId: '' };

// Susun flat list (positionId, parentId) jadi urutan terindentasi ala tree - depth-first,
// root dulu baru children-nya, supaya kelihatan hierarkinya tanpa perlu graphical org chart.
function buildTreeOrder(positions) {
  const byParent = new Map();
  positions.forEach((p) => {
    const key = p.parentId || 'root';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(p);
  });
  const result = [];
  const visit = (parentKey, depth) => {
    (byParent.get(parentKey) || []).forEach((p) => {
      result.push({ ...p, depth });
      visit(p.positionId, depth + 1);
    });
  };
  visit('root', 0);
  // Fallback: posisi yang parentId-nya mengarah ke id tidak ada (data yatim) tetap ikut tampil di root.
  const visited = new Set(result.map((p) => p.positionId));
  positions.forEach((p) => {
    if (!visited.has(p.positionId)) result.push({ ...p, depth: 0 });
  });
  return result;
}

export default function PositionsPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole('hrd', 'manager');

  const [modalPosition, setModalPosition] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchPositions = useCallback(() => positionService.list(), []);
  const { data: positions, loading, error, reload } = useFetch(fetchPositions, [fetchPositions]);

  const treeOrdered = positions ? buildTreeOrder(positions) : [];

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setModalPosition({});
  };

  const openEdit = (position) => {
    setForm({ name: position.name, parentId: position.parentId || '' });
    setFormError('');
    setModalPosition(position);
  };

  const closeModal = () => setModalPosition(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const payload = { name: form.name, parentId: form.parentId || null };
      if (modalPosition?.positionId) {
        await positionService.update(modalPosition.positionId, payload);
      } else {
        await positionService.create(payload);
      }
      closeModal();
      reload();
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Gagal menyimpan jabatan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (position) => {
    if (!window.confirm(`Hapus jabatan "${position.name}"?`)) return;
    try {
      await positionService.deletePosition(position.positionId);
      reload();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Gagal menghapus jabatan');
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Nama Jabatan',
      render: (r) => (
        <span style={{ paddingLeft: `${r.depth * 1.25}rem` }}>
          {r.depth > 0 && '↳ '}
          {r.name}
        </span>
      ),
    },
    { key: 'parent', label: 'Atasan Langsung', render: (r) => r.parent?.name || '-' },
    ...(canManage
      ? [
          {
            key: 'actions',
            label: '',
            render: (r) => (
              <div className="btn-group">
                <button type="button" className="btn btn-sm" onClick={() => openEdit(r)}>Edit</button>
                <button type="button" className="btn btn-sm" onClick={() => handleDelete(r)}>Hapus</button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Jabatan & Hierarki Organisasi</h1>
        {canManage && (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            + Tambah Jabatan
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={treeOrdered} loading={loading} error={error} rowKey="positionId" />

      {modalPosition && (
        <Modal title={modalPosition.positionId ? 'Edit Jabatan' : 'Tambah Jabatan'} onClose={closeModal}>
          <form onSubmit={handleSubmit}>
            {formError && <div className="alert alert-error">{formError}</div>}
            <div className="form-grid">
              <div className="form-group full">
                <label>Nama Jabatan</label>
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group full">
                <label>Atasan Langsung</label>
                <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
                  <option value="">- tidak ada (posisi puncak) -</option>
                  {(positions || [])
                    .filter((p) => p.positionId !== modalPosition.positionId)
                    .map((p) => (
                      <option key={p.positionId} value={p.positionId}>{p.name}</option>
                    ))}
                </select>
              </div>
            </div>
            <div className="btn-group" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={closeModal}>Batal</button>
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
