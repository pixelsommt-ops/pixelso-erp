// M02: Customer & CRM Ringkas
// Fitur kunci (PRD 3.2): Data pelanggan, segmentasi, sumber order, repeat order, riwayat transaksi

const { Router } = require('express');
const controller = require('./customers.controller');
const { authenticate, authorize } = require('../../common/middlewares/auth');
const { ROLES } = require('../../common/constants');

const router = Router();

router.use(authenticate);

// Didaftarkan sebelum '/:id' supaya "reports/dormant" tidak ketangkap sebagai :id.
router.get('/reports/dormant', controller.getDormant);

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
// Hapus dibatasi manager saja - lebih sensitif dari sekadar edit data (mis. resiko kehilangan
// riwayat pelanggan), beda dengan create/update yang tetap terbuka untuk semua role login
// (mis. kasir input pelanggan baru saat transaksi POS).
router.delete('/:id', authorize(ROLES.MANAGER), controller.deleteCustomer);

module.exports = router;
