// Master Supplier - GET terbuka semua role login (dipakai dropdown di Master Produk/Inventory
// kalau nanti dipakai), kelola (tambah/edit/hapus) dibatasi manager & inventory sama seperti
// category.routes.js.

const { Router } = require('express');
const controller = require('./supplier.controller');
const { authenticate, authorize } = require('../../common/middlewares/auth');
const { ROLES } = require('../../common/constants');

const router = Router();

router.use(authenticate);

router.get('/', controller.list);
router.post('/', authorize(ROLES.MANAGER, ROLES.INVENTORY), controller.create);
router.put('/:id', authorize(ROLES.MANAGER, ROLES.INVENTORY), controller.update);
router.delete('/:id', authorize(ROLES.MANAGER, ROLES.INVENTORY), controller.deleteSupplier);

module.exports = router;
