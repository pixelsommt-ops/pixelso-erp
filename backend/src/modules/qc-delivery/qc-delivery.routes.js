// M07: QC & Delivery
// Fitur kunci (PRD 3.2): Checklist QC, foto bukti, alasan reject, pickup/delivery, tanda terima

const { Router } = require('express');
const controller = require('./qc-delivery.controller');
const { authenticate, authorize } = require('../../common/middlewares/auth');
const { ROLES } = require('../../common/constants');

const router = Router();

router.use(authenticate);

// Delivery - didaftarkan sebelum '/:id' agar tidak tertangkap sebagai param.
router.get('/deliveries', controller.listDeliveries);
router.post('/deliveries', authorize(ROLES.PRODUCTION, ROLES.MANAGER), controller.createDelivery);
router.put('/deliveries/:id', authorize(ROLES.PRODUCTION, ROLES.MANAGER), controller.updateDelivery);

// QC Checklist
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', authorize(ROLES.PRODUCTION, ROLES.MANAGER), controller.create);
router.put('/:id', controller.update);

module.exports = router;
