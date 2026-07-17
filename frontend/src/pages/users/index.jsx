import { useCallback, useMemo, useState } from 'react';
import * as usersService from '../../services/usersService';
import useFetch from '../../hooks/useFetch';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate } from '../../utils/format';

const EMPTY_FORM = { name: '', email: '', password: '', roleId: '', teamId: '', status: 'active' };

export default function UsersPage() {
  const [tab, setTab] = useState('users');

  return (
    <div>
      <div className="page-header">
        <h1>User & Role Management</h1>
      </div>
      <div className="tabs">
        <button type="button" className={`tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
          User
        </button>
        <button type="button" className={`tab ${tab === 'teams' ? 'active' : ''}`} onClick={() => setTab('teams')}>
          Tim/Divisi
        </button>
      </div>
      {tab === 'users' ? <UsersTab /> : <TeamsTab />}
    </div>
  );
}

function UsersTab() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [modalUser, setModalUser] = useState(null); // null = closed, {} = create, {...} = edit
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = useCallback(
    () => usersService.list({ search: search || undefined, roleId: roleFilter || undefined }),
    [search, roleFilter]
  );
  const { data: users, loading, error, reload } = useFetch(fetchUsers, [fetchUsers]);

  const fetchRoles = useCallback(() => usersService.listRoles(), []);
  const { data: roles } = useFetch(fetchRoles, [fetchRoles]);
  const roleOptions = useMemo(() => roles || [], [roles]);

  const fetchTeams = useCallback(() => usersService.listTeams(), []);
  const { data: teams } = useFetch(fetchTeams, [fetchTeams]);
  const teamOptions = useMemo(() => teams || [], [teams]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setModalUser({});
  };

  const openEdit = (user) => {
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      roleId: String(user.roleId),
      teamId: user.teamId ? String(user.teamId) : '',
      status: user.status,
    });
    setFormError('');
    setModalUser(user);
  };

  const closeModal = () => setModalUser(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        roleId: Number(form.roleId),
        teamId: form.teamId ? Number(form.teamId) : null,
      };
      if (modalUser?.userId) {
        if (!payload.password) delete payload.password;
        await usersService.update(modalUser.userId, payload);
      } else {
        await usersService.create(payload);
      }
      closeModal();
      reload();
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Gagal menyimpan user');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (user) => {
    await usersService.update(user.userId, { status: user.status === 'active' ? 'inactive' : 'active' });
    reload();
  };

  const columns = [
    { key: 'name', label: 'Nama' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role', render: (r) => <StatusBadge status={r.role?.roleName} /> },
    { key: 'team', label: 'Tim', render: (r) => r.team?.name || '-' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'createdAt', label: 'Bergabung', render: (r) => formatDate(r.createdAt) },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="btn-group">
          <button type="button" className="btn btn-sm" onClick={() => openEdit(r)}>
            Edit
          </button>
          <button type="button" className="btn btn-sm" onClick={() => toggleStatus(r)}>
            {r.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="filters" style={{ marginBottom: 0 }}>
          <input
            type="text"
            placeholder="Cari nama/email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">Semua role</option>
            {roleOptions.map((r) => (
              <option key={r.roleId} value={r.roleId}>
                {r.roleName}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          + Tambah User
        </button>
      </div>

      <DataTable columns={columns} rows={users} loading={loading} error={error} rowKey="userId" />

      {modalUser && (
        <Modal title={modalUser.userId ? 'Edit User' : 'Tambah User'} onClose={closeModal}>
          <form onSubmit={handleSubmit}>
            {formError && <div className="alert alert-error">{formError}</div>}
            <div className="form-grid">
              <div className="form-group full">
                <label>Nama</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-group full">
                <label>Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="form-group full">
                <label>
                  Password {modalUser.userId && <span className="text-muted">(kosongkan jika tidak diubah)</span>}
                </label>
                <input
                  type="password"
                  required={!modalUser.userId}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select required value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
                  <option value="" disabled>
                    Pilih role
                  </option>
                  {roleOptions.map((r) => (
                    <option key={r.roleId} value={r.roleId}>
                      {r.roleName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Tim/Divisi</label>
                <select value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}>
                  <option value="">- tanpa tim -</option>
                  {teamOptions.map((t) => (
                    <option key={t.teamId} value={t.teamId}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group full">
                <label>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
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

function TeamsTab() {
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTeams = useCallback(() => usersService.listTeams(), []);
  const { data: teams, loading, error, reload } = useFetch(fetchTeams, [fetchTeams]);

  const openCreate = () => {
    setName('');
    setFormError('');
    setCreateOpen(true);
  };
  const closeCreate = () => setCreateOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await usersService.createTeam({ name });
      closeCreate();
      reload();
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Gagal menyimpan tim');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (team) => {
    if (!window.confirm(`Hapus tim "${team.name}"?`)) return;
    try {
      await usersService.deleteTeam(team.teamId);
      reload();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Gagal menghapus tim');
    }
  };

  const columns = [
    { key: 'name', label: 'Nama Tim' },
    { key: 'memberCount', label: 'Jumlah Anggota', render: (r) => r._count?.users ?? 0 },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <button type="button" className="btn btn-sm" onClick={() => handleDelete(r)}>
          Hapus
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div />
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          + Tambah Tim
        </button>
      </div>

      <DataTable columns={columns} rows={teams} loading={loading} error={error} rowKey="teamId" />

      {createOpen && (
        <Modal title="Tambah Tim/Divisi" onClose={closeCreate}>
          <form onSubmit={handleSubmit}>
            {formError && <div className="alert alert-error">{formError}</div>}
            <div className="form-group full">
              <label>Nama Tim</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} />
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
    </div>
  );
}
