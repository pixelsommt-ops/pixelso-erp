const { Router } = require('express');
const controller = require('./workLinks.controller');
const { authenticate, authorize } = require('../../common/middlewares/auth');
const { ROLES } = require('../../common/constants');

const router = Router();

router.use(authenticate);

// Lihat daftar + catat klik terbuka untuk semua role login - referensi kerja umum di Dashboard.
router.get('/', controller.list);
router.post('/:id/click', controller.click);

// Kelola link dan lihat siapa yang klik - manager only.
router.post('/', authorize(ROLES.MANAGER), controller.create);
router.delete('/:id', authorize(ROLES.MANAGER), controller.deleteLink);
router.get('/:id/clicks', authorize(ROLES.MANAGER), controller.listClicks);

module.exports = router;
