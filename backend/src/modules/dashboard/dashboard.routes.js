// M11: Manager Dashboard
// Fitur kunci (PRD 3.2): Order masuk, antrean, stok kritis, omzet, margin, keterlambatan, komplain

const { Router } = require('express');
const controller = require('./dashboard.controller');
const { authenticate, authorize } = require('../../common/middlewares/auth');
const { ROLES } = require('../../common/constants');

const router = Router();

router.use(authenticate);
router.use(authorize(ROLES.MANAGER));

router.get('/summary', controller.summary);

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);

module.exports = router;
