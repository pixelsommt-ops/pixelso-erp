// M03: Production Order / PO
// Fitur kunci (PRD 3.2): Buat PO, upload file, produk, ukuran, qty, deadline, revisi, approval

const { Router } = require('express');
const controller = require('./production-orders.controller');
const { authenticate, authorize } = require('../../common/middlewares/auth');
const { ROLES } = require('../../common/constants');

const router = Router();

router.use(authenticate);

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', authorize(ROLES.DESIGNER, ROLES.MANAGER), controller.create);
// PUT dibiarkan terbuka untuk semua role login: manager approve (draft->approved),
// inventory pindahkan pos->material->queue, dst - beragam role menjalankan transisi
// berbeda di sepanjang lifecycle PO, hanya validitas transisi yang dijaga di service.
router.put('/:id', controller.update);
// Kaitkan/ubah link Material+qty pada satu item PO - dibiarkan terbuka juga (inventory/production
// staf yang biasanya tahu material apa yang dipakai, bukan cuma manager/designer).
router.put('/:id/details/:detailId/material', controller.setDetailMaterial);

module.exports = router;
