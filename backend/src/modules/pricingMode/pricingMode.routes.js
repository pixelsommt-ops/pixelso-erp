// Master Mode Harga - GET terbuka semua role login (dipakai dropdown di Master Produk & Pricing),
// kelola (tambah/edit/hapus) dibatasi manager & inventory sama seperti category.routes.js.

const { Router } = require('express');
const controller = require('./pricingMode.controller');
const { authenticate, authorize } = require('../../common/middlewares/auth');
const { ROLES } = require('../../common/constants');

const router = Router();

router.use(authenticate);

router.get('/', controller.list);
router.post('/', authorize(ROLES.MANAGER, ROLES.INVENTORY), controller.create);
router.put('/:key', authorize(ROLES.MANAGER, ROLES.INVENTORY), controller.update);
router.delete('/:key', authorize(ROLES.MANAGER, ROLES.INVENTORY), controller.deleteMode);

module.exports = router;
