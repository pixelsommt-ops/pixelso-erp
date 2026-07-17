// Master Jabatan - GET terbuka semua role login (dipakai dropdown "Jabatan" di form
// User/Kontrak), kelola dibatasi HRD & manager.

const { Router } = require('express');
const controller = require('./position.controller');
const { authenticate, authorize } = require('../../common/middlewares/auth');
const { ROLES } = require('../../common/constants');

const router = Router();

router.use(authenticate);

router.get('/', controller.list);
router.post('/', authorize(ROLES.HRD, ROLES.MANAGER), controller.create);
router.put('/:id', authorize(ROLES.HRD, ROLES.MANAGER), controller.update);
router.delete('/:id', authorize(ROLES.HRD, ROLES.MANAGER), controller.deletePosition);

module.exports = router;
