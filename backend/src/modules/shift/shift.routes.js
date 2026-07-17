// Master Shift (definisi) - GET terbuka semua role login (dipakai dropdown penugasan), kelola
// dibatasi HRD & manager. Mount: /api/shifts

const { Router } = require('express');
const controller = require('./shift.controller');
const { authenticate, authorize } = require('../../common/middlewares/auth');
const { ROLES } = require('../../common/constants');

const router = Router();

router.use(authenticate);

router.get('/', controller.listShifts);
router.post('/', authorize(ROLES.HRD, ROLES.MANAGER), controller.createShift);
router.put('/:id', authorize(ROLES.HRD, ROLES.MANAGER), controller.updateShift);
router.delete('/:id', authorize(ROLES.HRD, ROLES.MANAGER), controller.deleteShift);

module.exports = router;
