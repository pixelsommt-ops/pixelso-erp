// M10: HRD Productivity
// Fitur kunci (PRD 3.2): Output per karyawan, durasi task, revisi, rework, SLA, ranking performa

const { Router } = require('express');
const controller = require('./hrd.controller');
const { authenticate, authorize } = require('../../common/middlewares/auth');
const { ROLES } = require('../../common/constants');

const router = Router();

router.use(authenticate);

// Laporan produktivitas & ranking - hanya HRD & manager.
router.get('/reports/productivity', authorize(ROLES.HRD, ROLES.MANAGER), controller.productivityReport);
router.get('/reports/ranking', authorize(ROLES.HRD, ROLES.MANAGER), controller.ranking);

// Daily KPI (entri manual) - list/getById dibatasi ke milik sendiri kecuali HRD/manager (lihat service).
router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', authorize(ROLES.HRD, ROLES.MANAGER), controller.create);
router.put('/:id', authorize(ROLES.HRD, ROLES.MANAGER), controller.update);

module.exports = router;
