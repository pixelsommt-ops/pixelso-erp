// Pengeluaran operasional (bukan pembelian ke supplier - itu di modules/purchasing) - tiap
// pengeluaran dikaitkan ke satu CashAccount, mengurangi saldo akun tersebut (dihitung live,
// lihat cashAccount.service.js#withBalance).

const prisma = require('../../db/prisma');
const ApiError = require('../../common/errors/ApiError');

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

const LIST_INCLUDE = {
  cashAccount: { select: { cashAccountId: true, name: true, type: true } },
  creator: { select: { userId: true, name: true } },
};

async function list(query) {
  const { cashAccountId, category, dateFrom, dateTo, page, pageSize } = query;

  const where = {
    ...(cashAccountId ? { cashAccountId: Number(cashAccountId) } : {}),
    ...(category ? { category } : {}),
    ...(dateFrom || dateTo
      ? {
          expenseDate: {
            ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00`) } : {}),
            ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999`) } : {}),
          },
        }
      : {}),
  };

  const take = Math.min(Number(pageSize) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const currentPage = Math.max(Number(page) || 1, 1);
  const skip = (currentPage - 1) * take;

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({ where, include: LIST_INCLUDE, orderBy: { expenseDate: 'desc' }, take, skip }),
    prisma.expense.count({ where }),
  ]);

  return { expenses, total, page: currentPage, pageSize: take, totalPages: Math.max(1, Math.ceil(total / take)) };
}

async function getById(id) {
  const expense = await prisma.expense.findUnique({ where: { expenseId: Number(id) }, include: LIST_INCLUDE });
  if (!expense) {
    throw new ApiError(404, 'Expense not found');
  }
  return expense;
}

async function create(data, currentUser) {
  const { cashAccountId, category, amount, expenseDate, description } = data;
  if (!cashAccountId) {
    throw new ApiError(400, 'cashAccountId is required');
  }
  if (!category) {
    throw new ApiError(400, 'category is required');
  }
  if (!amount || Number(amount) <= 0) {
    throw new ApiError(400, 'amount must be > 0');
  }
  if (!expenseDate) {
    throw new ApiError(400, 'expenseDate is required');
  }

  const account = await prisma.cashAccount.findUnique({ where: { cashAccountId: Number(cashAccountId) } });
  if (!account) {
    throw new ApiError(400, 'Invalid cashAccountId');
  }

  return prisma.expense.create({
    data: {
      cashAccountId: Number(cashAccountId),
      category,
      amount: Number(amount),
      expenseDate: new Date(expenseDate),
      description: description || null,
      createdBy: currentUser.userId,
    },
    include: LIST_INCLUDE,
  });
}

async function update(id, data) {
  const { category, amount, expenseDate, description } = data;
  await getById(id);

  if (amount !== undefined && Number(amount) <= 0) {
    throw new ApiError(400, 'amount must be > 0');
  }

  return prisma.expense.update({
    where: { expenseId: Number(id) },
    data: {
      ...(category ? { category } : {}),
      ...(amount !== undefined ? { amount: Number(amount) } : {}),
      ...(expenseDate ? { expenseDate: new Date(expenseDate) } : {}),
      ...(description !== undefined ? { description } : {}),
    },
    include: LIST_INCLUDE,
  });
}

async function deleteExpense(id) {
  await getById(id);
  return prisma.expense.delete({ where: { expenseId: Number(id) } });
}

module.exports = { list, getById, create, update, deleteExpense };
