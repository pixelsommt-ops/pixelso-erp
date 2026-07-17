// M08: Finance & Bonus
// Fitur kunci (PRD 3.2): Omzet, HPP, margin, bonus role, closing harian/bulanan, rekonsiliasi

const { Router } = require('express');
const controller = require('./finance.controller');
const { authenticate, authorize } = require('../../common/middlewares/auth');
const { ROLES } = require('../../common/constants');

const router = Router();

router.use(authenticate);

// Laporan omzet/HPP/margin - didaftarkan sebelum '/:id', hanya finance & manager.
router.get('/reports/revenue', authorize(ROLES.FINANCE, ROLES.MANAGER), controller.getRevenueReport);
router.get('/reports/expense-summary', authorize(ROLES.FINANCE, ROLES.MANAGER), controller.getExpenseSummary);
router.post('/bonus/auto-calculate', authorize(ROLES.FINANCE, ROLES.MANAGER), controller.autoCalculateBonus);

// Bonus records - list/getById dibatasi ke bonus milik sendiri kecuali finance/manager (lihat service).
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', authorize(ROLES.FINANCE, ROLES.MANAGER), controller.create);
router.put('/:id', authorize(ROLES.FINANCE, ROLES.MANAGER), controller.update);

module.exports = router;
