// Payroll & Benefit - data gaji + potongan pajak tiap karyawan, paling sensitif dari semua data
// di ERP ini. Seluruh route dibatasi HRD & manager.

const { Router } = require('express');
const controller = require('./payroll.controller');
const { authenticate, authorize } = require('../../common/middlewares/auth');
const { ROLES } = require('../../common/constants');

const router = Router();

router.use(authenticate);
router.use(authorize(ROLES.HRD, ROLES.MANAGER));

router.get('/runs', controller.listRuns);
router.get('/runs/:id', controller.getRunById);
router.post('/runs', controller.createRun);
router.post('/runs/:id/finalize', controller.finalizeRun);
router.put('/items/:id', controller.updateItem);

module.exports = router;
