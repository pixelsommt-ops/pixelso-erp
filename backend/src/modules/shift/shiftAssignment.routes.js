// Penugasan Shift - list mengikuti pola "lihat punya sendiri kecuali HRD/manager" (lihat
// shift.service.js#listAssignments), create/delete dibatasi HRD & manager. Mount: /api/shift-assignments

const { Router } = require('express');
const controller = require('./shift.controller');
const { authenticate, authorize } = require('../../common/middlewares/auth');
const { ROLES } = require('../../common/constants');

const router = Router();

router.use(authenticate);

router.get('/', controller.listAssignments);
router.post('/', authorize(ROLES.HRD, ROLES.MANAGER), controller.createAssignment);
router.delete('/:id', authorize(ROLES.HRD, ROLES.MANAGER), controller.deleteAssignment);

module.exports = router;
