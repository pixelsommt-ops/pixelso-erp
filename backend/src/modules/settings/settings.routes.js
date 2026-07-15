// Identitas & konten halaman depan storefront - satu-satunya tempat mengedit, manager-only.

const { Router } = require('express');
const controller = require('./settings.controller');
const { authenticate, authorize } = require('../../common/middlewares/auth');
const { ROLES } = require('../../common/constants');

const router = Router();

router.use(authenticate);
router.use(authorize(ROLES.MANAGER));

router.get('/', controller.getSettings);
router.put('/', controller.updateSettings);
router.post('/uploads', controller.uploadPhoto);

module.exports = router;
