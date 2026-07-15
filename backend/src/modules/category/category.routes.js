// Master Kategori - GET terbuka semua role login (dipakai dropdown di Master Produk & Pricing),
// kelola (tambah/edit/hapus) dibatasi manager & inventory sama seperti products.routes.js.

const { Router } = require('express');
const controller = require('./category.controller');
const { authenticate, authorize } = require('../../common/middlewares/auth');
const { ROLES } = require('../../common/constants');

const router = Router();

router.use(authenticate);

router.get('/', controller.list);
router.post('/', authorize(ROLES.MANAGER, ROLES.INVENTORY), controller.create);
router.put('/:id', authorize(ROLES.MANAGER, ROLES.INVENTORY), controller.update);
router.delete('/:id', authorize(ROLES.MANAGER, ROLES.INVENTORY), controller.deleteCategory);

module.exports = router;
