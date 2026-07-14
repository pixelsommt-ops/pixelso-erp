// Harga & produk kalkulator website - satu-satunya tempat mengedit harga publik.
// Manager-only untuk seluruh route (termasuk GET) karena ini data margin bisnis.

const { Router } = require('express');
const controller = require('./pricing.controller');
const { authenticate, authorize } = require('../../common/middlewares/auth');
const { ROLES } = require('../../common/constants');

const router = Router();

router.use(authenticate);
router.use(authorize(ROLES.MANAGER));

router.get('/', controller.getAll);
router.get('/settings', controller.getSettings);
router.put('/settings', controller.updateSettings);
router.get('/products', controller.listProducts);
router.get('/products/:key', controller.getProduct);
router.post('/products', controller.createProduct);
router.put('/products/:key', controller.updateProduct);
router.delete('/products/:key', controller.deleteProduct);

module.exports = router;
