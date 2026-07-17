import { useCallback, useState } from 'react';
import * as payrollService from '../../services/payrollService';
import useFetch from '../../hooks/useFetch';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import { formatCurrency } from '../../utils/format';

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function PayrollPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [period, setPeriod] = useState(currentPeriod());
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const [detailId, setDetailId] = useState(null);

  const fetchRuns = useCallback(() => payrollService.listRuns(), []);
  const { data: runs, loading, error, reload } = useFetch(fetchRuns, [fetchRuns]);

  const openCreate = () => {
    setPeriod(currentPeriod());
    setCreateError('');
    setCreateOpen(true);
  };
  const closeCreate = () => setCreateOpen(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      const { data } = await payrollService.createRun(period);
      closeCreate();
      reload();
      setDetailId(data.payrollRunId);
    } catch (err) {
      setCreateError(err?.response?.data?.message || 'Gagal membuat payroll run');
    } finally {
      setCreating(false);
    }
  };

  const columns = [
    { key: 'period', label: 'Periode' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'itemCount', label: 'Jumlah Karyawan', render: (r) => r._count?.items ?? 0 },
    { key: 'creator', label: 'Dibuat oleh', render: (r) => r.creator?.name },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <button type="button" className="btn btn-sm" onClick={() => setDetailId(r.payrollRunId)}>
          Lihat Detail
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Payroll</h1>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          + Buat Payroll Bulan Ini
        </button>
      </div>

      <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
        <strong>Peringatan:</strong> tarif PPh 21 (TER) dan BPJS di halaman ini diisi sesuai
        pemahaman aturan resmi terkini tapi <strong>belum diverifikasi ke konsultan pajak/HR</strong>.
        Jangan dipakai untuk penggajian riil sebelum dicek ulang.
      </div>

      <DataTable columns={columns} rows={runs} loading={loading} error={error} rowKey="payrollRunId" />

      {createOpen && (
        <Modal title="Buat Payroll Run" onClose={closeCreate}>
          <form onSubmit={handleCreate}>
            {createError && <div className="alert alert-error">{createError}</div>}
            <div className="form-grid">
              <div className="form-group full">
                <label>Periode (YYYY-MM)</label>
                <input type="month" required value={period} onChange={(e) => setPeriod(e.target.value)} />
              </div>
            </div>
            <small style={{ color: 'var(--text-muted, #666)' }}>
              Semua karyawan dengan kontrak aktif akan otomatis dimasukkan dengan jam lembur &amp; insentif = 0 - isi per baris di halaman detail.
            </small>
            <div className="btn-group" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={closeCreate}>Batal</button>
              <button type="submit" className="btn btn-primary" disabled={creating}>
                {creating ? 'Membuat...' : 'Buat'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {detailId && <PayrollRunDetail runId={detailId} onClose={() => setDetailId(null)} onChanged={reload} />}
    </div>
  );
}

function PayrollRunDetail({ runId, onClose, onChanged }) {
  const fetchRun = useCallback(() => payrollService.getRunById(runId), [runId]);
  const { data: run, loading, error, reload } = useFetch(fetchRun, [fetchRun]);

  const [editRow, setEditRow] = useState({}); // { [payrollItemId]: {overtimeHours, incentive} }
  const [savingId, setSavingId] = useState(null);
  const [rowError, setRowError] = useState('');
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState('');

  const isDraft = run?.status === 'draft';

  const getFieldValue = (item, field) =>
    editRow[item.payrollItemId]?.[field] !== undefined ? editRow[item.payrollItemId][field] : item[field];

  const setFieldValue = (item, field, value) => {
    setEditRow((prev) => ({
      ...prev,
      [item.payrollItemId]: { ...prev[item.payrollItemId], [field]: value },
    }));
  };

  const handleSaveRow = async (item) => {
    setRowError('');
    setSavingId(item.payrollItemId);
    try {
      await payrollService.updateItem(item.payrollItemId, {
        overtimeHours: Number(getFieldValue(item, 'overtimeHours')),
        incentive: Number(getFieldValue(item, 'incentive')),
      });
      reload();
    } catch (err) {
      setRowError(err?.response?.data?.message || 'Gagal menyimpan');
    } finally {
      setSavingId(null);
    }
  };

  const handleFinalize = async () => {
    if (!window.confirm(`Finalisasi payroll periode ${run.period}? Setelah ini tidak bisa diubah lagi.`)) return;
    setFinalizeError('');
    setFinalizing(true);
    try {
      await payrollService.finalizeRun(run.payrollRunId);
      reload();
      onChanged();
    } catch (err) {
      setFinalizeError(err?.response?.data?.message || 'Gagal memfinalisasi');
    } finally {
      setFinalizing(false);
    }
  };

  const totalNetPay = (run?.items || []).reduce((sum, i) => sum + Number(i.netPay), 0);

  return (
    <Modal title={`Payroll ${run?.period || ''}`} onClose={onClose} width={960}>
      {loading && <div className="empty-state">Memuat...</div>}
      {error && <div className="alert alert-error">{error}</div>}
      {run && (
        <>
          <div className="grid grid-cols-4" style={{ marginBottom: '1rem' }}>
            <div className="stat-tile">
              <div className="label">Status</div>
              <div className="value"><StatusBadge status={run.status} /></div>
            </div>
            <div className="stat-tile">
              <div className="label">Jumlah Karyawan</div>
              <div className="value">{run.items.length}</div>
            </div>
            <div className="stat-tile">
              <div className="label">Total Take-Home</div>
              <div className="value">{formatCurrency(totalNetPay)}</div>
            </div>
          </div>

          {rowError && <div className="alert alert-error">{rowError}</div>}
          {finalizeError && <div className="alert alert-error">{finalizeError}</div>}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Karyawan</th>
                  <th>Gaji Pokok</th>
                  <th>Jam Lembur</th>
                  <th>Lembur (Rp)</th>
                  <th>Insentif</th>
                  <th>Gross</th>
                  <th>PPh21</th>
                  <th>BPJS Karyawan</th>
                  <th>Take-Home</th>
                  {isDraft && <th></th>}
                </tr>
              </thead>
              <tbody>
                {run.items.map((item) => (
                  <tr key={item.payrollItemId}>
                    <td>{item.user?.name}</td>
                    <td>{formatCurrency(item.baseSalary)}</td>
                    <td>
                      {isDraft ? (
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          style={{ width: 70 }}
                          value={getFieldValue(item, 'overtimeHours')}
                          onChange={(e) => setFieldValue(item, 'overtimeHours', e.target.value)}
                        />
                      ) : (
                        item.overtimeHours
                      )}
                    </td>
                    <td>{formatCurrency(item.overtimePay)}</td>
                    <td>
                      {isDraft ? (
                        <input
                          type="number"
                          min="0"
                          style={{ width: 100 }}
                          value={getFieldValue(item, 'incentive')}
                          onChange={(e) => setFieldValue(item, 'incentive', e.target.value)}
                        />
                      ) : (
                        formatCurrency(item.incentive)
                      )}
                    </td>
                    <td>{formatCurrency(item.grossPay)}</td>
                    <td>{formatCurrency(item.pph21)}</td>
                    <td>{formatCurrency(Number(item.bpjsKesehatanEmployee) + Number(item.bpjsKetenagakerjaanEmployee))}</td>
                    <td><strong>{formatCurrency(item.netPay)}</strong></td>
                    {isDraft && (
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={savingId === item.payrollItemId}
                          onClick={() => handleSaveRow(item)}
                        >
                          {savingId === item.payrollItemId ? '...' : 'Simpan'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {isDraft && (
            <div className="btn-group" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-primary" disabled={finalizing} onClick={handleFinalize}>
                {finalizing ? 'Memfinalisasi...' : 'Finalisasi Payroll'}
              </button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
