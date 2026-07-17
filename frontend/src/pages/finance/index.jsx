import { useCallback, useState } from 'react';
import * as financeService from '../../services/financeService';
import * as usersService from '../../services/usersService';
import * as cashAccountService from '../../services/cashAccountService';
import * as expenseService from '../../services/expenseService';
import * as purchasingService from '../../services/purchasingService';
import * as assetService from '../../services/assetService';
import * as supplierService from '../../services/supplierService';
import * as inventoryService from '../../services/inventoryService';
import useFetch from '../../hooks/useFetch';
import useAuth from '../../hooks/useAuth';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
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
          <button type="button" className={`tab ${tab === 'purchasing' ? 'active' : ''}`} onClick={() => setTab('purchasing')}>
            Purchasing & Procurement
          </button>
          <button type="button" className={`tab ${tab === 'expense-cash' ? 'active' : ''}`} onClick={() => setTab('expense-cash')}>
            Expense/Cash & Bank
          </button>
          <button type="button" className={`tab ${tab === 'asset' ? 'active' : ''}`} onClick={() => setTab('asset')}>
            Asset Management
          </button>
        </div>
      )}
      {tab === 'bonus' && <BonusTab canManage={canManageBonus} />}
      {tab === 'report' && <RevenueReportTab />}
      {tab === 'purchasing' && <PurchasingTab />}
      {tab === 'expense-cash' && <ExpenseCashBankTab />}
      {tab === 'asset' && <AssetTab />}
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

const EMPTY_PURCHASE_ITEM = { materialId: '', description: '', qty: 1, unitPrice: '' };
const EMPTY_PURCHASE_FORM = { supplierId: '', expectedDate: '', notes: '', items: [{ ...EMPTY_PURCHASE_ITEM }] };
const PURCHASE_STATUS_ACTIONS = {
  draft: [{ label: 'Set Dipesan', next: 'ordered' }, { label: 'Batalkan', next: 'cancelled' }],
  ordered: [{ label: 'Set Diterima', next: 'received' }, { label: 'Batalkan', next: 'cancelled' }],
  received: [{ label: 'Tandai Lunas', next: 'paid' }],
  paid: [],
  cancelled: [],
};

function PurchasingTab() {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_PURCHASE_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [cashAccounts, setCashAccounts] = useState([]);
  const [payTarget, setPayTarget] = useState(null);
  const [payCashAccountId, setPayCashAccountId] = useState('');
  const [payError, setPayError] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);

  const fetchOrders = useCallback(
    () => purchasingService.list({ status: statusFilter || undefined, page }),
    [statusFilter, page]
  );
  const { data: result, loading, error, reload } = useFetch(fetchOrders, [fetchOrders]);

  const openCreate = async () => {
    setForm(EMPTY_PURCHASE_FORM);
    setFormError('');
    const [supplierRes, materialRes] = await Promise.all([
      supplierService.list({ pageSize: 1000 }),
      inventoryService.list({}),
    ]);
    setSuppliers(supplierRes.data.suppliers);
    setMaterials(materialRes.data);
    setCreateOpen(true);
  };
  const closeCreate = () => setCreateOpen(false);

  const updateItem = (index, field, value) => {
    const items = [...form.items];
    items[index] = { ...items[index], [field]: value };
    setForm({ ...form, items });
  };
  const addItem = () => setForm({ ...form, items: [...form.items, { ...EMPTY_PURCHASE_ITEM }] });
  const removeItem = (index) => setForm({ ...form, items: form.items.filter((_, i) => i !== index) });

  const grandTotal = form.items.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unitPrice) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await purchasingService.create({
        supplierId: Number(form.supplierId),
        expectedDate: form.expectedDate || undefined,
        notes: form.notes || undefined,
        items: form.items.map((item) => ({
          materialId: item.materialId ? Number(item.materialId) : undefined,
          description: item.description,
          qty: Number(item.qty),
          unitPrice: Number(item.unitPrice),
        })),
      });
      closeCreate();
      reload();
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Gagal menyimpan PO pembelian');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSimpleTransition = async (order, next) => {
    if (next === 'cancelled' && !window.confirm(`Batalkan PO pembelian "${order.poNumber}"?`)) return;
    try {
      await purchasingService.update(order.purchaseOrderId, { status: next });
      reload();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Gagal mengubah status');
    }
  };

  const openPay = async (order) => {
    setPayError('');
    setPayCashAccountId('');
    const res = await cashAccountService.list({ pageSize: 1000 });
    setCashAccounts(res.data.cashAccounts);
    setPayTarget(order);
  };
  const closePay = () => setPayTarget(null);

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    setPayError('');
    setPaySubmitting(true);
    try {
      await purchasingService.update(payTarget.purchaseOrderId, { status: 'paid', cashAccountId: Number(payCashAccountId) });
      closePay();
      reload();
    } catch (err) {
      setPayError(err?.response?.data?.message || 'Gagal menandai lunas');
    } finally {
      setPaySubmitting(false);
    }
  };

  const columns = [
    { key: 'poNumber', label: 'No. PO' },
    { key: 'supplier', label: 'Supplier', render: (r) => r.supplier?.name },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'itemCount', label: 'Item' },
    { key: 'totalAmount', label: 'Total', render: (r) => formatCurrency(r.totalAmount) },
    { key: 'orderDate', label: 'Tanggal', render: (r) => new Date(r.orderDate).toLocaleDateString('id-ID') },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="btn-group">
          {(PURCHASE_STATUS_ACTIONS[r.status] || []).map((action) => (
            <button
              key={action.next}
              type="button"
              className="btn btn-sm"
              onClick={() => (action.next === 'paid' ? openPay(r) : handleSimpleTransition(r, action.next))}
            >
              {action.label}
            </button>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="filters" style={{ marginBottom: 0 }}>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">Semua status</option>
            {Object.keys(PURCHASE_STATUS_ACTIONS).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          + Buat PO Pembelian
        </button>
      </div>

      <DataTable columns={columns} rows={result?.purchaseOrders} loading={loading} error={error} rowKey="purchaseOrderId" />

      {result && result.totalPages > 1 && (
        <div className="btn-group" style={{ marginTop: '0.75rem', justifyContent: 'center', alignItems: 'center' }}>
          <button type="button" className="btn btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            &larr; Sebelumnya
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #666)' }}>
            Halaman {result.page} dari {result.totalPages} ({result.total} PO)
          </span>
          <button type="button" className="btn btn-sm" onClick={() => setPage((p) => Math.min(result.totalPages, p + 1))} disabled={page >= result.totalPages}>
            Selanjutnya &rarr;
          </button>
        </div>
      )}

      {createOpen && (
        <Modal title="Buat PO Pembelian" onClose={closeCreate} width={720}>
          <form onSubmit={handleSubmit}>
            {formError && <div className="alert alert-error">{formError}</div>}
            <div className="form-grid">
              <div className="form-group full">
                <label>Supplier</label>
                <select required value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
                  <option value="" disabled>Pilih supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.supplierId} value={s.supplierId}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Perkiraan Tanggal Terima</label>
                <input type="date" value={form.expectedDate} onChange={(e) => setForm({ ...form, expectedDate: e.target.value })} />
              </div>
              <div className="form-group full">
                <label>Catatan</label>
                <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>

            <h3 style={{ fontSize: '0.95rem', marginTop: '1.25rem' }}>Item Pembelian</h3>
            {form.items.map((item, index) => (
              <div
                key={index}
                className="form-grid"
                style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem', marginTop: '0.75rem' }}
              >
                <div className="form-group">
                  <label>Material (opsional)</label>
                  <select value={item.materialId} onChange={(e) => updateItem(index, 'materialId', e.target.value)}>
                    <option value="">- bukan dari katalog -</option>
                    {materials.map((m) => (
                      <option key={m.materialId} value={m.materialId}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Deskripsi</label>
                  <input
                    type="text"
                    required
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Qty</label>
                  <input type="number" min="0.01" step="0.01" required value={item.qty} onChange={(e) => updateItem(index, 'qty', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Harga Satuan</label>
                  <input type="number" min="0" required value={item.unitPrice} onChange={(e) => updateItem(index, 'unitPrice', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Subtotal</label>
                  <div className="value" style={{ paddingTop: '0.4rem' }}>
                    {formatCurrency((Number(item.qty) || 0) * (Number(item.unitPrice) || 0))}
                  </div>
                </div>
                {form.items.length > 1 && (
                  <div className="form-group full">
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => removeItem(index)}>
                      Hapus item
                    </button>
                  </div>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-sm" style={{ marginTop: '0.75rem' }} onClick={addItem}>
              + Tambah Item
            </button>

            <div style={{ marginTop: '1rem', textAlign: 'right', fontWeight: 600 }}>
              Grand Total: {formatCurrency(grandTotal)}
            </div>

            <div className="btn-group" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={closeCreate}>Batal</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Menyimpan...' : 'Simpan PO'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {payTarget && (
        <Modal title={`Tandai Lunas - ${payTarget.poNumber}`} onClose={closePay}>
          <form onSubmit={handlePaySubmit}>
            {payError && <div className="alert alert-error">{payError}</div>}
            <div className="form-grid">
              <div className="form-group full">
                <label>Dibayar dari Akun</label>
                <select required value={payCashAccountId} onChange={(e) => setPayCashAccountId(e.target.value)}>
                  <option value="" disabled>Pilih akun kas/bank</option>
                  {cashAccounts.map((a) => (
                    <option key={a.cashAccountId} value={a.cashAccountId}>
                      {a.name} (saldo {formatCurrency(a.balance)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="btn-group" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={closePay}>Batal</button>
              <button type="submit" className="btn btn-primary" disabled={paySubmitting}>
                {paySubmitting ? 'Menyimpan...' : 'Tandai Lunas'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

const EMPTY_CASH_ACCOUNT_FORM = { name: '', type: 'cash', bankName: '', accountNumber: '', openingBalance: 0 };
const EMPTY_EXPENSE_FORM = { cashAccountId: '', category: '', amount: '', expenseDate: todayISODate(), description: '' };

function ExpenseCashBankTab() {
  const [modalAccount, setModalAccount] = useState(null);
  const [accountForm, setAccountForm] = useState(EMPTY_CASH_ACCOUNT_FORM);
  const [accountError, setAccountError] = useState('');
  const [submittingAccount, setSubmittingAccount] = useState(false);

  const [expenseAccountFilter, setExpenseAccountFilter] = useState('');
  const [expensePage, setExpensePage] = useState(1);
  const [modalExpense, setModalExpense] = useState(null);
  const [expenseForm, setExpenseForm] = useState(EMPTY_EXPENSE_FORM);
  const [expenseError, setExpenseError] = useState('');
  const [submittingExpense, setSubmittingExpense] = useState(false);

  const fetchAccounts = useCallback(() => cashAccountService.list({ pageSize: 200 }), []);
  const { data: accountResult, loading: loadingAccounts, error: accountsError, reload: reloadAccounts } =
    useFetch(fetchAccounts, [fetchAccounts]);
  const accounts = accountResult?.cashAccounts || [];

  const fetchExpenses = useCallback(
    () => expenseService.list({ cashAccountId: expenseAccountFilter || undefined, page: expensePage }),
    [expenseAccountFilter, expensePage]
  );
  const { data: expenseResult, loading: loadingExpenses, error: expensesError, reload: reloadExpenses } =
    useFetch(fetchExpenses, [fetchExpenses]);

  const openCreateAccount = () => {
    setAccountForm(EMPTY_CASH_ACCOUNT_FORM);
    setAccountError('');
    setModalAccount({});
  };
  const openEditAccount = (account) => {
    setAccountForm({
      name: account.name,
      type: account.type,
      bankName: account.bankName || '',
      accountNumber: account.accountNumber || '',
      openingBalance: account.openingBalance,
    });
    setAccountError('');
    setModalAccount(account);
  };
  const closeAccountModal = () => setModalAccount(null);

  const handleAccountSubmit = async (e) => {
    e.preventDefault();
    setAccountError('');
    setSubmittingAccount(true);
    try {
      const payload = { ...accountForm, openingBalance: Number(accountForm.openingBalance) || 0 };
      if (modalAccount?.cashAccountId) {
        await cashAccountService.update(modalAccount.cashAccountId, payload);
      } else {
        await cashAccountService.create(payload);
      }
      closeAccountModal();
      reloadAccounts();
    } catch (err) {
      setAccountError(err?.response?.data?.message || 'Gagal menyimpan akun');
    } finally {
      setSubmittingAccount(false);
    }
  };

  const handleDeleteAccount = async (account) => {
    if (!window.confirm(`Hapus akun "${account.name}"?`)) return;
    try {
      await cashAccountService.deleteCashAccount(account.cashAccountId);
      reloadAccounts();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Gagal menghapus akun');
    }
  };

  const openCreateExpense = () => {
    setExpenseForm(EMPTY_EXPENSE_FORM);
    setExpenseError('');
    setModalExpense({});
  };
  const closeExpenseModal = () => setModalExpense(null);

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    setExpenseError('');
    setSubmittingExpense(true);
    try {
      await expenseService.create({
        cashAccountId: Number(expenseForm.cashAccountId),
        category: expenseForm.category,
        amount: Number(expenseForm.amount),
        expenseDate: expenseForm.expenseDate,
        description: expenseForm.description || undefined,
      });
      closeExpenseModal();
      reloadExpenses();
      reloadAccounts();
    } catch (err) {
      setExpenseError(err?.response?.data?.message || 'Gagal menyimpan pengeluaran');
    } finally {
      setSubmittingExpense(false);
    }
  };

  const handleDeleteExpense = async (expense) => {
    if (!window.confirm('Hapus pengeluaran ini?')) return;
    try {
      await expenseService.deleteExpense(expense.expenseId);
      reloadExpenses();
      reloadAccounts();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Gagal menghapus pengeluaran');
    }
  };

  const accountColumns = [
    { key: 'name', label: 'Nama Akun' },
    { key: 'type', label: 'Tipe', render: (r) => (r.type === 'cash' ? 'Kas' : 'Bank') },
    { key: 'bankName', label: 'Bank', render: (r) => r.bankName || '-' },
    { key: 'accountNumber', label: 'No. Rekening', render: (r) => r.accountNumber || '-' },
    { key: 'balance', label: 'Saldo', render: (r) => formatCurrency(r.balance) },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="btn-group">
          <button type="button" className="btn btn-sm" onClick={() => openEditAccount(r)}>Edit</button>
          <button type="button" className="btn btn-sm" onClick={() => handleDeleteAccount(r)}>Hapus</button>
        </div>
      ),
    },
  ];

  const expenseColumns = [
    { key: 'expenseDate', label: 'Tanggal', render: (r) => new Date(r.expenseDate).toLocaleDateString('id-ID') },
    { key: 'cashAccount', label: 'Akun', render: (r) => r.cashAccount?.name },
    { key: 'category', label: 'Kategori' },
    { key: 'amount', label: 'Jumlah', render: (r) => formatCurrency(r.amount) },
    { key: 'description', label: 'Keterangan', render: (r) => r.description || '-' },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <button type="button" className="btn btn-sm" onClick={() => handleDeleteExpense(r)}>Hapus</button>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 style={{ fontSize: '1rem' }}>Kas & Bank</h1>
        <button type="button" className="btn btn-primary" onClick={openCreateAccount}>+ Tambah Akun</button>
      </div>
      <DataTable columns={accountColumns} rows={accounts} loading={loadingAccounts} error={accountsError} rowKey="cashAccountId" />

      <div className="page-header" style={{ marginTop: '2rem' }}>
        <h1 style={{ fontSize: '1rem' }}>Pengeluaran</h1>
        <div className="filters" style={{ marginBottom: 0 }}>
          <select value={expenseAccountFilter} onChange={(e) => { setExpenseAccountFilter(e.target.value); setExpensePage(1); }}>
            <option value="">Semua akun</option>
            {accounts.map((a) => (
              <option key={a.cashAccountId} value={a.cashAccountId}>{a.name}</option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateExpense}>+ Tambah Pengeluaran</button>
      </div>
      <DataTable columns={expenseColumns} rows={expenseResult?.expenses} loading={loadingExpenses} error={expensesError} rowKey="expenseId" />
      {expenseResult && expenseResult.totalPages > 1 && (
        <div className="btn-group" style={{ marginTop: '0.75rem', justifyContent: 'center', alignItems: 'center' }}>
          <button type="button" className="btn btn-sm" onClick={() => setExpensePage((p) => Math.max(1, p - 1))} disabled={expensePage <= 1}>
            &larr; Sebelumnya
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #666)' }}>
            Halaman {expenseResult.page} dari {expenseResult.totalPages} ({expenseResult.total} pengeluaran)
          </span>
          <button type="button" className="btn btn-sm" onClick={() => setExpensePage((p) => Math.min(expenseResult.totalPages, p + 1))} disabled={expensePage >= expenseResult.totalPages}>
            Selanjutnya &rarr;
          </button>
        </div>
      )}

      {modalAccount && (
        <Modal title={modalAccount.cashAccountId ? 'Edit Akun' : 'Tambah Akun'} onClose={closeAccountModal}>
          <form onSubmit={handleAccountSubmit}>
            {accountError && <div className="alert alert-error">{accountError}</div>}
            <div className="form-grid">
              <div className="form-group full">
                <label>Nama Akun</label>
                <input type="text" required value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Tipe</label>
                <select value={accountForm.type} onChange={(e) => setAccountForm({ ...accountForm, type: e.target.value })}>
                  <option value="cash">Kas</option>
                  <option value="bank">Bank</option>
                </select>
              </div>
              <div className="form-group">
                <label>Saldo Awal</label>
                <input type="number" value={accountForm.openingBalance} onChange={(e) => setAccountForm({ ...accountForm, openingBalance: e.target.value })} />
              </div>
              {accountForm.type === 'bank' && (
                <>
                  <div className="form-group">
                    <label>Nama Bank</label>
                    <input type="text" value={accountForm.bankName} onChange={(e) => setAccountForm({ ...accountForm, bankName: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>No. Rekening</label>
                    <input type="text" value={accountForm.accountNumber} onChange={(e) => setAccountForm({ ...accountForm, accountNumber: e.target.value })} />
                  </div>
                </>
              )}
            </div>
            <div className="btn-group" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={closeAccountModal}>Batal</button>
              <button type="submit" className="btn btn-primary" disabled={submittingAccount}>
                {submittingAccount ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {modalExpense && (
        <Modal title="Tambah Pengeluaran" onClose={closeExpenseModal}>
          <form onSubmit={handleExpenseSubmit}>
            {expenseError && <div className="alert alert-error">{expenseError}</div>}
            <div className="form-grid">
              <div className="form-group full">
                <label>Akun</label>
                <select required value={expenseForm.cashAccountId} onChange={(e) => setExpenseForm({ ...expenseForm, cashAccountId: e.target.value })}>
                  <option value="" disabled>Pilih akun kas/bank</option>
                  {accounts.map((a) => (
                    <option key={a.cashAccountId} value={a.cashAccountId}>{a.name} (saldo {formatCurrency(a.balance)})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Kategori</label>
                <input type="text" required placeholder="mis. Listrik, Gaji, Sewa" value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Jumlah</label>
                <input type="number" min="0" required value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Tanggal</label>
                <input type="date" required value={expenseForm.expenseDate} onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })} />
              </div>
              <div className="form-group full">
                <label>Keterangan</label>
                <textarea rows={2} value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} />
              </div>
            </div>
            <div className="btn-group" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={closeExpenseModal}>Batal</button>
              <button type="submit" className="btn btn-primary" disabled={submittingExpense}>
                {submittingExpense ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

const EMPTY_ASSET_FORM = { name: '', category: '', acquisitionDate: '', acquisitionCost: '', currentValue: '', location: '', status: 'active', notes: '' };
const ASSET_STATUSES = ['active', 'maintenance', 'disposed'];

function AssetTab() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalAsset, setModalAsset] = useState(null);
  const [form, setForm] = useState(EMPTY_ASSET_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAssets = useCallback(() => assetService.list({ search: search || undefined, page }), [search, page]);
  const { data: result, loading, error, reload } = useFetch(fetchAssets, [fetchAssets]);

  const openCreate = () => {
    setForm(EMPTY_ASSET_FORM);
    setFormError('');
    setModalAsset({});
  };
  const openEdit = (asset) => {
    setForm({
      name: asset.name,
      category: asset.category || '',
      acquisitionDate: asset.acquisitionDate ? asset.acquisitionDate.slice(0, 10) : '',
      acquisitionCost: asset.acquisitionCost ?? '',
      currentValue: asset.currentValue ?? '',
      location: asset.location || '',
      status: asset.status,
      notes: asset.notes || '',
    });
    setFormError('');
    setModalAsset(asset);
  };
  const closeModal = () => setModalAsset(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      if (modalAsset?.assetId) {
        await assetService.update(modalAsset.assetId, form);
      } else {
        await assetService.create(form);
      }
      closeModal();
      reload();
    } catch (err) {
      setFormError(err?.response?.data?.message || 'Gagal menyimpan aset');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (asset) => {
    if (!window.confirm(`Hapus aset "${asset.name}"?`)) return;
    try {
      await assetService.deleteAsset(asset.assetId);
      reload();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Gagal menghapus aset');
    }
  };

  const columns = [
    { key: 'name', label: 'Nama Aset' },
    { key: 'category', label: 'Kategori', render: (r) => r.category || '-' },
    { key: 'acquisitionDate', label: 'Tgl Beli', render: (r) => (r.acquisitionDate ? new Date(r.acquisitionDate).toLocaleDateString('id-ID') : '-') },
    { key: 'acquisitionCost', label: 'Harga Beli', render: (r) => (r.acquisitionCost != null ? formatCurrency(r.acquisitionCost) : '-') },
    { key: 'currentValue', label: 'Nilai Sekarang', render: (r) => (r.currentValue != null ? formatCurrency(r.currentValue) : '-') },
    { key: 'location', label: 'Lokasi', render: (r) => r.location || '-' },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
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
  ];

  return (
    <div>
      <div className="page-header">
        <div className="filters" style={{ marginBottom: 0 }}>
          <input type="text" placeholder="Cari nama aset..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>+ Tambah Aset</button>
      </div>

      <DataTable columns={columns} rows={result?.assets} loading={loading} error={error} rowKey="assetId" />

      {result && result.totalPages > 1 && (
        <div className="btn-group" style={{ marginTop: '0.75rem', justifyContent: 'center', alignItems: 'center' }}>
          <button type="button" className="btn btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            &larr; Sebelumnya
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #666)' }}>
            Halaman {result.page} dari {result.totalPages} ({result.total} aset)
          </span>
          <button type="button" className="btn btn-sm" onClick={() => setPage((p) => Math.min(result.totalPages, p + 1))} disabled={page >= result.totalPages}>
            Selanjutnya &rarr;
          </button>
        </div>
      )}

      {modalAsset && (
        <Modal title={modalAsset.assetId ? 'Edit Aset' : 'Tambah Aset'} onClose={closeModal} width={640}>
          <form onSubmit={handleSubmit}>
            {formError && <div className="alert alert-error">{formError}</div>}
            <div className="form-grid">
              <div className="form-group full">
                <label>Nama Aset</label>
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Kategori</label>
                <input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {ASSET_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Tanggal Perolehan</label>
                <input type="date" value={form.acquisitionDate} onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Harga Beli</label>
                <input type="number" min="0" value={form.acquisitionCost} onChange={(e) => setForm({ ...form, acquisitionCost: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Nilai Sekarang</label>
                <input type="number" min="0" value={form.currentValue} onChange={(e) => setForm({ ...form, currentValue: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Lokasi</label>
                <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div className="form-group full">
                <label>Catatan</label>
                <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
