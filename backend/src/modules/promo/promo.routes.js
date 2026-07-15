// Promo storefront - manager-only untuk seluruh route CRUD (endpoint publik ada di storefront module).

const { Router } = require('express');
const controller = require('./promo.controller');
const { authenticate, authorize } = require('../../common/middlewares/auth');
const { ROLES } = require('../../common/constants');

const router = Router();

router.use(authenticate);
router.use(authorize(ROLES.MANAGER));

router.get('/', controller.listPromos);
router.get('/:id', controller.getPromo);
router.post('/', controller.createPromo);
router.put('/:id', controller.updatePromo);
router.delete('/:id', controller.deletePromo);
router.post('/uploads', controller.uploadPhoto);

module.exports = router;
