// M09: Marketing Analytics
// Fitur kunci (PRD 3.2): Produk laris, channel, customer repeat, campaign, cohort sederhana

const { Router } = require('express');
const controller = require('./marketing.controller');
const { authenticate, authorize } = require('../../common/middlewares/auth');
const { ROLES } = require('../../common/constants');

const router = Router();

router.use(authenticate);
router.use(authorize(ROLES.MARKETING, ROLES.MANAGER));

// Laporan - didaftarkan sebelum '/:id' agar tidak tertangkap sebagai param.
router.get('/top-products', controller.topProducts);
router.get('/channels', controller.channels);
router.get('/repeat-customers', controller.repeatCustomers);
router.get('/cohort', controller.cohort);

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);

module.exports = router;
