// Tema Website - kelola tema event storefront (Kemerdekaan, Idul Fitri, dst), manager-only
// (mirip settings.routes.js - satu-satunya tempat mengedit tampilan storefront).

const { Router } = require('express');
const controller = require('./theme.controller');
const { authenticate, authorize } = require('../../common/middlewares/auth');
const { ROLES } = require('../../common/constants');

const router = Router();

router.use(authenticate);
router.use(authorize(ROLES.MANAGER));

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.deleteTheme);
router.put('/:id/activate', controller.activate);
router.put('/:id/deactivate', controller.deactivate);

module.exports = router;
