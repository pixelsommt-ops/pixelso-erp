import { useCallback, useState } from 'react';
import * as financeService from '../../services/financeService';
import * as usersService from '../../services/usersService';
import useFetch from '../../hooks/useFetch';
import useAuth from '../../hooks/useAuth';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import { formatCurrency, firstDayOfMonthISO, todayISODate } from '../../utils/format';

const BONUS_SOURCES = ['po', 'pos', 'production', 'qc', 'marketing'];
const EMPTY_FORM = { userId: '', period: '', source: 'po', score: 0, amount: 0 };

export default function FinancePage() {
  const { hasRole } = useAuth();
  const canManageBonus = hasRole('finance', 'manager');
  const canSeeReport = hasRole('finance', 'manager');

  const [tab, setTab] = useState('bonus');

  return (
    <div>
      <div className="page-header">
        <h1>Finance & Bonus</h1>
      </div>
      {canSeeReport && (
        <div className="tabs">
          <button type="button" className={`tab ${tab === 'bonus' ? 'active' : ''}`} onClick={() => setTab('bonus')}>
            Bonus
          </button>
          <button type="button" className={`tab ${tab === 'report' ? 'active' : ''}`} onClick={() => setTab('report')}>
            Laporan Omzet
          </button>
        </div>
      )}
      {tab === 'bonus' ? <BonusTab canManage={canManageBonus} /> : <RevenueReportTab />}
    </div>
  );
}

function BonusTab({ canManage }) {
  const [periodFilter, setPeriodFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState([]);

  const [autoPeriod, setAutoPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoMessage, setAutoMessage] = useState('');
  const [autoSuccess, setAutoSuccess] = useState(true);

  const fetchBonuses = useCallback(
    () => financeService.list({ period: periodFilter || undefined, source: sourceFilter || undefined }),
    [periodFilter, sourceFilter]
  );
  const { data: bonuses, loading, error, reload } = useFetch(fetchBonuses, [fetchBonuses]);

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
      await financeService.create({
        userId: Number(form.userId),
        period: form.period,
        source: form.source,
        score: Number(form.score) || 0,
        amount: Number(form.amount),
      });
      closeCreate();
      reload();
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Gagal menyimpan bonus');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoCalculate = async () => {
    setAutoRunning(true);
    setAutoMessage('');
    try {
      const { data } = await financeService.autoCalculateBonus(autoPeriod);
      setAutoSuccess(true);
      setAutoMessage(`${data.length} bonus otomatis dihitung/diperbarui untuk periode ${autoPeriod}.`);
      reload();
    } catch (err) {
      setAutoSuccess(false);
      setAutoMessage(err?.response?.data?.message || 'Gagal menghitung bonus otomatis');
    } finally {
      setAutoRunning(false);
    }
  };

  const columns = [
    { key: 'user', label: 'Karyawan', render: (r) => r.user?.name },
    { key: 'role', label: 'Role', render: (r) => r.user?.role?.roleName },
    { key: 'period', label: 'Periode' },
    { key: 'source', label: 'Sumber' },
    { key: 'score', label: 'Skor' },
    { key: 'amount', label: 'Jumlah', render: (r) => formatCurrency(r.amount) },
    {
      key: 'isAuto',
      label: 'Tipe',
      render: (r) => <span className={`badge ${r.isAuto ? 'badge-info' : ''}`}>{r.isAuto ? 'otomatis' : 'manual'}</span>,
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="filters" style={{ marginBottom: 0 }}>
          <input
            type="text"
            placeholder="Periode YYYY-MM"
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
          />
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="">Semua sumber</option>
            {BONUS_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        {canManage && (
          <div className="btn-group">
            <input
              type="text"
              placeholder="YYYY-MM"
              value={autoPeriod}
              onChange={(e) => setAutoPeriod(e.target.value)}
              style={{ width: 100 }}
            />
            <button type="button" className="btn" disabled={autoRunning} onClick={handleAutoCalculate}>
              {autoRunning ? 'Menghitung...' : 'Hitung Bonus Otomatis'}
            </button>
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              + Tambah Bonus
            </button>
          </div>
        )}
      </div>

      {autoMessage && <div className={`alert ${autoSuccess ? 'alert-success' : 'alert-error'}`}>{autoMessage}</div>}

      <DataTable columns={columns} rows={bonuses} loading={loading} error={error} rowKey="bonusId" />

      {createOpen && (
        <Modal title="Tambah Bonus" onClose={closeCreate}>
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
                <label>Periode (YYYY-MM)</label>
                <input
                  type="text"
                  required
                  placeholder="2026-07"
                  pattern="\d{4}-\d{2}"
                  value={form.period}
                  onChange={(e) => setForm({ ...form, period: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Sumber</label>
                <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                  {BONUS_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Skor</label>
                <input type="number" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Jumlah</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
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

function RevenueReportTab() {
  const [from, setFrom] = useState(firstDayOfMonthISO());
  const [to, setTo] = useState(todayISODate());

  const fetchReport = useCallback(() => financeService.getRevenueReport({ from, to }), [from, to]);
  const { data: report, loading, error } = useFetch(fetchReport, [fetchReport]);

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
      </div>

      {loading && <div className="empty-state">Memuat laporan...</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {report && (
        <>
          <div className="grid grid-cols-4" style={{ marginBottom: '1.25rem' }}>
            <div className="stat-tile">
              <div className="label">Omzet</div>
              <div className="value">{formatCurrency(report.omzet)}</div>
            </div>
            <div className="stat-tile">
              <div className="label">HPP</div>
              <div className="value">{formatCurrency(report.hpp)}</div>
            </div>
            <div className="stat-tile">
              <div className="label">Margin</div>
              <div className="value">{formatCurrency(report.margin)}</div>
            </div>
            <div className="stat-tile">
              <div className="label">Jumlah Transaksi</div>
              <div className="value">{report.transactionCount}</div>
            </div>
          </div>

          <h3 style={{ fontSize: '0.95rem' }}>Rincian Harian</h3>
          {report.dailyBreakdown.length === 0 ? (
            <div className="empty-state">Tidak ada transaksi pada periode ini</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Omzet</th>
                  </tr>
                </thead>
                <tbody>
                  {report.dailyBreakdown.map((d) => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td>{formatCurrency(d.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
