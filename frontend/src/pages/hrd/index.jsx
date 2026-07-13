import { useCallback, useState } from 'react';
import * as hrdService from '../../services/hrdService';
import * as usersService from '../../services/usersService';
import useFetch from '../../hooks/useFetch';
import useAuth from '../../hooks/useAuth';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import { formatDate, firstDayOfMonthISO, todayISODate } from '../../utils/format';

const EMPTY_FORM = { userId: '', date: todayISODate(), role: '', metric: '', value: 0 };

export default function HrdPage() {
  const { hasRole } = useAuth();
  const canSeeReport = hasRole('hrd', 'manager');
  const [tab, setTab] = useState('kpi');

  return (
    <div>
      <div className="page-header">
        <h1>HRD Productivity</h1>
      </div>
      {canSeeReport && (
        <div className="tabs">
          <button type="button" className={`tab ${tab === 'kpi' ? 'active' : ''}`} onClick={() => setTab('kpi')}>
            Daily KPI
          </button>
          <button type="button" className={`tab ${tab === 'productivity' ? 'active' : ''}`} onClick={() => setTab('productivity')}>
            Laporan Produktivitas
          </button>
          <button type="button" className={`tab ${tab === 'ranking' ? 'active' : ''}`} onClick={() => setTab('ranking')}>
            Ranking
          </button>
        </div>
      )}
      {tab === 'kpi' && <KpiTab canManage={canSeeReport} />}
      {tab === 'productivity' && <ProductivityTab />}
      {tab === 'ranking' && <RankingTab />}
    </div>
  );
}

function KpiTab({ canManage }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState([]);

  const fetchKpis = useCallback(() => hrdService.list(), []);
  const { data: kpis, loading, error, reload } = useFetch(fetchKpis, [fetchKpis]);

  const openCreate = async () => {
    setForm(EMPTY_FORM);
    setFormError('');
    const res = await usersService.list();
    setUsers(res.data);
    setCreateOpen(true);
  };
  const closeCreate = () => setCreateOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await hrdService.create({
        userId: Number(form.userId),
        date: form.date,
        role: form.role,
        metric: form.metric,
        value: Number(form.value),
      });
      closeCreate();
      reload();
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Gagal menyimpan KPI');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { key: 'user', label: 'Karyawan', render: (r) => r.user?.name || '-' },
    { key: 'date', label: 'Tanggal', render: (r) => formatDate(r.date) },
    { key: 'role', label: 'Role' },
    { key: 'metric', label: 'Metrik' },
    { key: 'value', label: 'Nilai' },
  ];

  return (
    <div>
      <div className="page-header">
        <div />
        {canManage && (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            + Tambah KPI
          </button>
        )}
      </div>

      <DataTable columns={columns} rows={kpis} loading={loading} error={error} rowKey="kpiId" />

      {createOpen && (
        <Modal title="Tambah Daily KPI" onClose={closeCreate}>
          <form onSubmit={handleSubmit}>
            {formError && <div className="alert alert-error">{formError}</div>}
            <div className="form-grid">
              <div className="form-group full">
                <label>Karyawan</label>
                <select required value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
                  <option value="" disabled>
                    Pilih karyawan
                  </option>
                  {users.map((u) => (
                    <option key={u.userId} value={u.userId}>
                      {u.name} ({u.role?.roleName})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Tanggal</label>
                <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Role</label>
                <input type="text" required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Metrik</label>
                <input
                  type="text"
                  required
                  placeholder="kepuasan_klien / dst"
                  value={form.metric}
                  onChange={(e) => setForm({ ...form, metric: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Nilai</label>
                <input type="number" required value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
              </div>
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

function ProductivityTab() {
  const [from, setFrom] = useState(firstDayOfMonthISO());
  const [to, setTo] = useState(todayISODate());
  const [slaHours, setSlaHours] = useState(24);

  const fetcher = useCallback(() => hrdService.getProductivityReport({ from, to, slaHours }), [from, to, slaHours]);
  const { data, loading, error } = useFetch(fetcher, [fetcher]);

  const columns = [
    { key: 'name', label: 'Karyawan' },
    { key: 'role', label: 'Role' },
    { key: 'poCreated', label: 'PO Dibuat' },
    { key: 'tasksCompleted', label: 'Task Selesai' },
    { key: 'avgDurationHours', label: 'Rata2 Durasi (jam)' },
    { key: 'tasksOverSla', label: 'Melebihi SLA' },
    { key: 'reworkCount', label: 'Rework' },
    { key: 'qcPerformed', label: 'QC Dilakukan' },
  ];

  return (
    <div>
      <div className="filters">
        <div className="form-group">
          <label>Dari</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Sampai</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="form-group">
          <label>SLA (jam)</label>
          <input type="number" min="1" value={slaHours} onChange={(e) => setSlaHours(Number(e.target.value))} />
        </div>
      </div>
      <DataTable columns={columns} rows={data} loading={loading} error={error} rowKey="userId" />
    </div>
  );
}

const RANKING_METRICS = [
  { value: 'tasksCompleted', label: 'Task Selesai' },
  { value: 'poCreated', label: 'PO Dibuat' },
  { value: 'qcPerformed', label: 'QC Dilakukan' },
  { value: 'avgDurationHours', label: 'Rata2 Durasi' },
];

function RankingTab() {
  const [metric, setMetric] = useState('tasksCompleted');

  const fetcher = useCallback(() => hrdService.getRanking({ metric, limit: 10 }), [metric]);
  const { data, loading, error } = useFetch(fetcher, [fetcher]);

  const columns = [
    { key: 'rank', label: '#', render: (r, i) => i + 1 },
    { key: 'name', label: 'Karyawan' },
    { key: 'role', label: 'Role' },
    { key: metric, label: RANKING_METRICS.find((m) => m.value === metric)?.label, render: (r) => r[metric] },
  ];

  return (
    <div>
      <div className="filters">
        <select value={metric} onChange={(e) => setMetric(e.target.value)}>
          {RANKING_METRICS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <DataTable columns={columns} rows={data} loading={loading} error={error} rowKey="userId" />
    </div>
  );
}
