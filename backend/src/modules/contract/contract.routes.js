// Kontrak Kerja - data gaji sensitif, seluruh route (termasuk GET) dibatasi HRD & manager.

const { Router } = require('express');
const controller = require('./contract.controller');
const { authenticate, authorize } = require('../../common/middlewares/auth');
const { ROLES } = require('../../common/constants');

const router = Router();

router.use(authenticate);
router.use(authorize(ROLES.HRD, ROLES.MANAGER));

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.deleteContract);

module.exports = router;
