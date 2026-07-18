// M01: User & Role Management
// Fitur kunci (PRD 3.2): Login, role, permission, audit log, status user, tim/divisi

const { Router } = require('express');
const controller = require('./users.controller');
const { authenticate, authorize } = require('../../common/middlewares/auth');
const { ROLES } = require('../../common/constants');

const router = Router();

router.use(authenticate);

// List/getById/roles juga dibuka untuk finance & HRD (butuh memilih nama user saat
// input bonus/KPI manual); create/update tetap manager-only.
router.get('/roles', authorize(ROLES.MANAGER, ROLES.FINANCE, ROLES.HRD), controller.listRoles);
router.get('/teams', authorize(ROLES.MANAGER), controller.listTeams);
router.post('/teams', authorize(ROLES.MANAGER), controller.createTeam);
router.delete('/teams/:id', authorize(ROLES.MANAGER), controller.deleteTeam);

router.get('/', authorize(ROLES.MANAGER, ROLES.FINANCE, ROLES.HRD), controller.list);
router.get('/:id', authorize(ROLES.MANAGER, ROLES.FINANCE, ROLES.HRD), controller.getById);
router.post('/', authorize(ROLES.MANAGER), controller.create);
router.put('/:id', authorize(ROLES.MANAGER), controller.update);
router.post('/uploads', authorize(ROLES.MANAGER), controller.uploadPhoto);

module.exports = router;
