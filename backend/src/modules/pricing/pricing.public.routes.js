// Dipanggil server-ke-server oleh landing page (pixelso_nodejs) untuk membaca harga terkini.
// Dilindungi shared-secret header (X-API-Key), bukan JWT - bukan sesi user ERP.

const { Router } = require('express');
const { requireApiKey } = require('../../common/middlewares/apiKeyAuth');
const controller = require('./pricing.controller');

const router = Router();

router.get('/', requireApiKey, controller.getPublicPricing);

module.exports = router;
