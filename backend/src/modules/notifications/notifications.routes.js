// M12: Notification & Approval
// Fitur kunci (PRD 3.2): Notifikasi WhatsApp/email internal, approval harga, stok kurang, PO terlambat

const { Router } = require('express');
const controller = require('./notifications.controller');
const { authenticate } = require('../../common/middlewares/auth');

const router = Router();

router.use(authenticate);

router.put('/mark-all-read', controller.markAllRead);

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);

module.exports = router;
