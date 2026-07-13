// M02: Customer & CRM Ringkas
// Fitur kunci (PRD 3.2): Data pelanggan, segmentasi, sumber order, repeat order, riwayat transaksi

const { Router } = require('express');
const controller = require('./customers.controller');
const { authenticate } = require('../../common/middlewares/auth');

const router = Router();

router.use(authenticate);

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);

module.exports = router;
