// Master Produk - katalog item cetak
// Semua role login bisa lihat (dipakai saat input PO); hanya manager & inventory yang bisa kelola.

const { Router } = require('express');
const controller = require('./products.controller');
const { authenticate, authorize } = require('../../common/middlewares/auth');
const { ROLES } = require('../../common/constants');

const router = Router();

router.use(authenticate);

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', authorize(ROLES.MANAGER, ROLES.INVENTORY), controller.create);
router.put('/:id', authorize(ROLES.MANAGER, ROLES.INVENTORY), controller.update);

module.exports = router;
