// M04: POS & Pembayaran
// Fitur kunci (PRD 3.2): Invoice, DP, pelunasan, diskon, metode bayar, piutang, refund/void terkontrol

const { Router } = require('express');
const controller = require('./pos.controller');
const { authenticate, authorize } = require('../../common/middlewares/auth');
const { ROLES } = require('../../common/constants');

const router = Router();

router.use(authenticate);

router.get('/', controller.list);
router.get('/quote/:poId', authorize(ROLES.CASHIER, ROLES.MANAGER), controller.getQuote);
router.get('/:id', controller.getById);
router.post('/', authorize(ROLES.CASHIER, ROLES.MANAGER), controller.create);
router.put('/:id', authorize(ROLES.CASHIER, ROLES.MANAGER, ROLES.FINANCE), controller.update);
router.put('/:id/payments/:paymentId', authorize(ROLES.CASHIER, ROLES.MANAGER, ROLES.FINANCE), controller.confirmPayment);

module.exports = router;
