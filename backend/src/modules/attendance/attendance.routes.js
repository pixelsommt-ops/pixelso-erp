// Kehadiran - check-in/check-out terbuka semua role login (untuk diri sendiri, pakai req.user).
// GET list mengikuti pola "lihat punya sendiri kecuali HRD/manager" (lihat attendance.service.js#list).

const { Router } = require('express');
const controller = require('./attendance.controller');
const { authenticate } = require('../../common/middlewares/auth');

const router = Router();

router.use(authenticate);

router.get('/', controller.list);
router.post('/check-in', controller.checkIn);
router.post('/check-out', controller.checkOut);

module.exports = router;
