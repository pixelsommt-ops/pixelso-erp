import { useCallback, useEffect, useState } from 'react';
import * as productionService from '../../services/productionService';
import * as productionOrdersService from '../../services/productionOrdersService';
import * as usersService from '../../services/usersService';
import useFetch from '../../hooks/useFetch';
import useAuth from '../../hooks/useAuth';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDateTime } from '../../utils/format';
import { TASK_STATUS_OPTIONS, TASK_STATUS_TRANSITIONS } from '../../utils/taskStatusFlow';

const EMPTY_TASK_FORM = { poId: '', poDetailId: '', machineId: '', operatorId: '', stage: '' };
// Contoh umum, tapi field-nya tetap free-text - staf boleh isi istilah lain sesuai proses di lapangan.
const STAGE_SUGGESTIONS = ['Cetak', 'Finishing', 'Potong', 'Laminasi', 'Sablon', 'Jahit'];
const EMPTY_MACHINE_FORM = { name: '', type: '', capacity: '' };

export default function ProductionPage() {
  const { hasRole, user } = useAuth();
  const canManage = hasRole('production', 'manager');

  const [tab, setTab] = useState('tasks');

  // --- Job tickets ---
  const [statusFilter, setStatusFilter] = useState('');
  const [taskCreateOpen, setTaskCreateOpen] = useState(false);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK_FORM);
  const [taskFormError, setTaskFormError] = useState('');
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [queueOrders, setQueueOrders] = useState([]);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState(null);
  const [machines, setMachines] = useState([]);
  const [operators, setOperators] = useState([]);

  const [detail, setDetail] = useState(null);
  const [transitionError, setTransitionError] = useState('');
  const [transitioning, setTransitioning] = useState(false);

  const fetchTasks = useCallback(
    () => productionService.list({ status: statusFilter || undefined }),
    [statusFilter]
  );
  const { data: tasks, loading, error, reload } = useFetch(fetchTasks, [fetchTasks]);

  const fetchMachines = useCallback(() => productionService.listMachines(), []);
  const { data: machineList, reload: reloadMachines } = useFetch(fetchMachines, [fetchMachines]);

  useEffect(() => {
    setMachines(machineList || []);
  }, [machineList]);

  const openTaskCreate = async () => {
    setTaskForm(EMPTY_TASK_FORM);
    setTaskFormError('');
    setSelectedOrderDetail(null);
    const res = await productionOrdersService.list({ status: 'queue', pageSize: 200 });
    setQueueOrders(res.data.orders);
    if (hasRole('manager')) {
      const rolesRes = await usersService.listRoles();
      const prodRole = rolesRes.data.find((r) => r.roleName === 'production');
      if (prodRole) {
        const usersRes = await usersService.list({ roleId: prodRole.roleId });
        setOperators(usersRes.data);
      }
    }
    setTaskCreateOpen(true);
  };
  const closeTaskCreate = () => setTaskCreateOpen(false);

  const handlePoSelect = async (poId) => {
    setTaskForm({ ...taskForm, poId, poDetailId: '' });
    if (!poId) {
      setSelectedOrderDetail(null);
      return;
    }
    const { data } = await productionOrdersService.getById(poId);
    setSelectedOrderDetail(data);
  };

  const submitTask = async (e) => {
    e.preventDefault();
    setTaskFormError('');
    setTaskSubmitting(true);
    try {
      const payload = {
        poDetailId: Number(taskForm.poDetailId),
        machineId: taskForm.machineId ? Number(taskForm.machineId) : undefined,
        operatorId: hasRole('production') ? user.userId : taskForm.operatorId ? Number(taskForm.operatorId) : undefined,
        stage: taskForm.stage || undefined,
      };
      await productionService.create(payload);
      closeTaskCreate();
      reload();
    } catch (err) {
      setTaskFormError(err?.response?.data?.message || 'Gagal membuat job ticket');
    } finally {
      setTaskSubmitting(false);
    }
  };

  const openDetail = async (task) => {
    const { data } = await productionService.getById(task.taskId);
    setDetail(data);
    setTransitionError('');
  };
  const closeDetail = () => setDetail(null);

  const transitionTo = async (status) => {
    setTransitioning(true);
    setTransitionError('');
    try {
      const { data } = await productionService.update(detail.taskId, { status });
      setDetail(data);
      reload();
      reloadMachines();
    } catch (err) {
      setTransitionError(err?.response?.data?.message || 'Gagal mengubah status task');
    } finally {
      setTransitioning(false);
    }
  };

  const taskColumns = [
    { key: 'taskId', label: 'ID' },
    { key: 'po', label: 'No. PO', render: (r) => r.poDetail?.productionOrder?.poNumber },
    { key: 'product', label: 'Produk', render: (r) => r.poDetail?.product?.name },
    { key: 'stage', label: 'Tahap', render: (r) => r.stage || '-' },
    { key: 'machine', label: 'Mesin', render: (r) => r.machine?.name || '-' },
    { key: 'operator', label: 'Operator', render: (r) => r.operator?.name || '-' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'startAt', label: 'Mulai', render: (r) => formatDateTime(r.startAt) },
    { key: 'finishAt', label: 'Selesai', render: (r) => formatDateTime(r.finishAt) },
  ];

  const nextStatuses = detail ? TASK_STATUS_TRANSITIONS[detail.status] || [] : [];

  return (
    <div>
      <div className="page-header">
        <h1>Produksi</h1>
      </div>

      <div className="tabs">
        <button type="button" className={`tab ${tab === 'tasks' ? 'active' : ''}`} onClick={() => setTab('tasks')}>
          Job Ticket
        </button>
        <button type="button" className={`tab ${tab === 'machines' ? 'active' : ''}`} onClick={() => setTab('machines')}>
          Mesin
        </button>
      </div>

      {tab === 'tasks' && (
        <div>
          <div className="page-header">
            <div className="filters" style={{ marginBottom: 0 }}>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Semua status</option>
                {TASK_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            {canManage && (
              <button type="button" className="btn btn-primary" onClick={openTaskCreate}>
                + Buat Job Ticket
              </button>
            )}
          </div>

          <DataTable
            columns={taskColumns}
            rows={tasks}
            loading={loading}
            error={error}
            rowKey="taskId"
            onRowClick={openDetail}
          />
        </div>
      )}

      {tab === 'machines' && <MachinesTab canManage={canManage} />}

      {taskCreateOpen && (
        <Modal title="Buat Job Ticket" onClose={closeTaskCreate}>
          <form onSubmit={submitTask}>
            {taskFormError && <div className="alert alert-error">{taskFormError}</div>}
            {queueOrders.length === 0 && (
              <div className="alert alert-error">Tidak ada PO berstatus &quot;queue&quot; saat ini.</div>
            )}
            <div className="form-grid">
              <div className="form-group full">
                <label>Production Order</label>
                <select required value={taskForm.poId} onChange={(e) => handlePoSelect(e.target.value)}>
                  <option value="" disabled>
                    Pilih PO
                  </option>
                  {queueOrders.map((o) => (
                    <option key={o.poId} value={o.poId}>
                      {o.poNumber} - {o.customer?.name}
                    </option>
                  ))}
                </select>
              </div>
              {selectedOrderDetail && (
                <div className="form-group full">
                  <label>Item</label>
                  <select
                    required
                    value={taskForm.poDetailId}
                    onChange={(e) => setTaskForm({ ...taskForm, poDetailId: e.target.value })}
                  >
                    <option value="" disabled>
                      Pilih item
                    </option>
                    {selectedOrderDetail.poDetails.map((d) => (
                      <option key={d.poDetailId} value={d.poDetailId}>
                        {d.product?.name} (qty {d.qty})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {selectedOrderDetail && (
                <div className="form-group full">
                  <label>Tahap (opsional)</label>
                  <input
                    type="text"
                    list="stage-suggestions"
                    placeholder="mis. Cetak, Finishing, Potong"
                    value={taskForm.stage}
                    onChange={(e) => setTaskForm({ ...taskForm, stage: e.target.value })}
                  />
                  <datalist id="stage-suggestions">
                    {STAGE_SUGGESTIONS.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                  <small style={{ color: 'var(--text-muted, #666)' }}>
                    Isi ini kalau item ini butuh lebih dari satu job ticket (mis. tahap cetak di satu mesin,
                    finishing di mesin lain) - biar gampang dibedakan di daftar Job Ticket.
                  </small>
                </div>
              )}
              <div className="form-group">
                <label>Mesin</label>
                <select
                  value={taskForm.machineId}
                  onChange={(e) => setTaskForm({ ...taskForm, machineId: e.target.value })}
                >
                  <option value="">- tanpa mesin -</option>
                  {machines.map((m) => (
                    <option key={m.machineId} value={m.machineId} disabled={m.status === 'busy'}>
                      {m.name} {m.status === 'busy' ? '(sedang dipakai)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              {hasRole('manager') && (
                <div className="form-group">
                  <label>Operator</label>
                  <select
                    value={taskForm.operatorId}
                    onChange={(e) => setTaskForm({ ...taskForm, operatorId: e.target.value })}
                  >
                    <option value="">- tanpa operator -</option>
                    {operators.map((o) => (
                      <option key={o.userId} value={o.userId}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="btn-group" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={closeTaskCreate}>
                Batal
              </button>
              <button type="submit" className="btn btn-primary" disabled={taskSubmitting}>
                {taskSubmitting ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {detail && (
        <Modal title={`Task #${detail.taskId}`} onClose={closeDetail}>
          <div className="grid grid-cols-2" style={{ marginBottom: '1rem' }}>
            <div>
              <div className="text-muted text-sm">PO</div>
              <div>{detail.poDetail?.productionOrder?.poNumber}</div>
            </div>
            <div>
              <div className="text-muted text-sm">Produk</div>
              <div>{detail.poDetail?.product?.name}</div>
            </div>
            <div>
              <div className="text-muted text-sm">Tahap</div>
              <div>{detail.stage || '-'}</div>
            </div>
            <div>
              <div className="text-muted text-sm">Status</div>
              <StatusBadge status={detail.status} />
            </div>
            <div>
              <div className="text-muted text-sm">Mesin</div>
              <div>{detail.machine?.name || '-'}</div>
            </div>
            <div>
              <div className="text-muted text-sm">Mulai</div>
              <div>{formatDateTime(detail.startAt)}</div>
            </div>
            <div>
              <div className="text-muted text-sm">Selesai</div>
              <div>{formatDateTime(detail.finishAt)}</div>
            </div>
          </div>

          {transitionError && <div className="alert alert-error">{transitionError}</div>}
          {canManage && nextStatuses.length > 0 && (
            <div>
              <div className="text-muted text-sm" style={{ marginBottom: '0.4rem' }}>
                Ubah status ke:
              </div>
              <div className="btn-group">
                {nextStatuses.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="btn btn-sm"
                    disabled={transitioning}
                    onClick={() => transitionTo(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function MachinesTab({ canManage }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_MACHINE_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchMachines = useCallback(() => productionService.listMachines(), []);
  const { data: machines, loading, error, reload } = useFetch(fetchMachines, [fetchMachines]);

  const openCreate = () => {
    setForm(EMPTY_MACHINE_FORM);
    setFormError('');
    setCreateOpen(true);
  };
  const closeCreate = () => setCreateOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await productionService.createMachine(form);
      closeCreate();
      reload();
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Gagal menambah mesin');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Nama Mesin' },
    { key: 'type', label: 'Tipe', render: (r) => r.type || '-' },
    { key: 'capacity', label: 'Kapasitas', render: (r) => r.capacity || '-' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <div className="page-header">
        <div />
        {canManage && (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            + Tambah Mesin
          </button>
        )}
      </div>
      <DataTable columns={columns} rows={machines} loading={loading} error={error} rowKey="machineId" />

      {createOpen && (
        <Modal title="Tambah Mesin" onClose={closeCreate}>
          <form onSubmit={handleSubmit}>
            {formError && <div className="alert alert-error">{formError}</div>}
            <div className="form-grid">
              <div className="form-group full">
                <label>Nama Mesin</label>
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Tipe</label>
                <input type="text" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Kapasitas</label>
                <input
                  type="text"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
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
