// Master Kas & Bank - akun kas/bank tempat pengeluaran (Expense) dan pembelian yang sudah lunas
// (PurchaseOrder status='paid') dikaitkan. Saldo TIDAK disimpan sebagai kolom yang di-mutate -
// dihitung live dari openingBalance dikurangi total expense & purchase order lunas yang terkait,
// sama seperti finance.service.js#getRevenueReport menghitung omzet/hpp/margin live tanpa running
// total tersimpan (menghindari resiko saldo drift/salah update).

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 200;

async function withBalance(account) {
  const [expenseAgg, purchaseAgg] = await Promise.all([
    prisma.expense.aggregate({ where: { cashAccountId: account.cashAccountId }, _sum: { amount: true } }),
    prisma.purchaseOrder.aggregate({
      where: { cashAccountId: account.cashAccountId, status: 'paid' },
      _sum: { totalAmount: true },
    }),
  ]);
  const spent = Number(expenseAgg._sum.amount || 0) + Number(purchaseAgg._sum.totalAmount || 0);
  return { ...account, balance: Number(account.openingBalance) - spent };
}

async function list(query) {
  const { search, page, pageSize } = query;

  const where = search ? { name: { contains: search } } : {};

  const take = Math.min(Number(pageSize) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const currentPage = Math.max(Number(page) || 1, 1);
  const skip = (currentPage - 1) * take;

  const [accounts, total] = await Promise.all([
    prisma.cashAccount.findMany({ where, orderBy: { name: 'asc' }, take, skip }),
    prisma.cashAccount.count({ where }),
  ]);

  return {
    cashAccounts: await Promise.all(accounts.map(withBalance)),
    total,
    page: currentPage,
    pageSize: take,
    totalPages: Math.max(1, Math.ceil(total / take)),
  };
}

async function getById(id) {
  const account = await prisma.cashAccount.findUnique({ where: { cashAccountId: Number(id) } });
  if (!account) {
    throw new ApiError(404, 'Cash account not found');
  }
  return withBalance(account);
}

async function create(data) {
  const { name, type, bankName, accountNumber, openingBalance } = data;
  if (!name) {
    throw new ApiError(400, 'name is required');
  }
  if (!['cash', 'bank'].includes(type)) {
    throw new ApiError(400, "type must be 'cash' or 'bank'");
  }

  return prisma.cashAccount.create({
    data: {
      name,
      type,
      bankName: bankName || null,
      accountNumber: accountNumber || null,
      openingBalance: openingBalance ? Number(openingBalance) : 0,
    },
  });
}

async function update(id, data) {
  const { name, type, bankName, accountNumber, openingBalance, isActive } = data;
  await getById(id);

  if (type && !['cash', 'bank'].includes(type)) {
    throw new ApiError(400, "type must be 'cash' or 'bank'");
  }

  return prisma.cashAccount.update({
    where: { cashAccountId: Number(id) },
    data: {
      ...(name ? { name } : {}),
      ...(type ? { type } : {}),
      ...(bankName !== undefined ? { bankName } : {}),
      ...(accountNumber !== undefined ? { accountNumber } : {}),
      ...(openingBalance !== undefined ? { openingBalance: Number(openingBalance) } : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
    },
  });
}

async function deleteCashAccount(id) {
  await getById(id);
  const [expenseCount, purchaseCount] = await Promise.all([
    prisma.expense.count({ where: { cashAccountId: Number(id) } }),
    prisma.purchaseOrder.count({ where: { cashAccountId: Number(id) } }),
  ]);
  if (expenseCount > 0 || purchaseCount > 0) {
    throw new ApiError(400, 'Akun ini masih punya riwayat pengeluaran/pembelian, tidak bisa dihapus');
  }
  return prisma.cashAccount.delete({ where: { cashAccountId: Number(id) } });
}

module.exports = { list, getById, create, update, deleteCashAccount };
