// M06: Produksi
// Fitur kunci (PRD 3.2): Job ticket, antrian, mesin, operator, status, timer, kapasitas, rework

const { Router } = require('express');
const controller = require('./production.controller');
const { authenticate, authorize } = require('../../common/middlewares/auth');
const { ROLES } = require('../../common/constants');

const router = Router();

router.use(authenticate);

// Master mesin - didaftarkan sebelum '/:id' agar tidak tertangkap sebagai param.
router.get('/machines', controller.listMachines);
router.post('/machines', authorize(ROLES.PRODUCTION, ROLES.MANAGER), controller.createMachine);

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', authorize(ROLES.PRODUCTION, ROLES.MANAGER), controller.create);
router.put('/:id', authorize(ROLES.PRODUCTION, ROLES.MANAGER), controller.update);

module.exports = router;
