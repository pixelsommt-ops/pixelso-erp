const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('./storefront.controller');
const { authenticateCustomer } = require('../../common/middlewares/customerAuth');

const router = Router();

const uploadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
// Cegah spam kirim email reset (mis. dipakai bombing inbox orang lain) - dibatasi ketat,
// beda dari uploadLimiter yang memang untuk pemakaian wajar berulang saat checkout.
const forgotPasswordLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });

router.post('/auth/register', controller.register);
router.post('/auth/login', controller.login);
router.post('/auth/google', controller.googleLogin);
router.post('/auth/forgot-password', forgotPasswordLimiter, controller.forgotPassword);
router.post('/auth/reset-password', controller.resetPassword);
router.get('/catalog', controller.getCatalog);
router.get('/settings', controller.getSiteSettings);
router.get('/promos', controller.getPromos);

// Upload desain/bukti bayar wajib login - alur checkout di frontend sudah mewajibkan login
// sebelum sampai ke halaman ini, jadi endpoint upload publik tanpa auth cuma jadi celah
// disalahgunakan (spam file) tanpa manfaat nyata bagi pelanggan.
router.use(authenticateCustomer);
router.post('/uploads', uploadLimiter, controller.upload);
router.post('/checkout', controller.checkout);
router.get('/orders', controller.myOrders);
router.get('/orders/:poId', controller.myOrderDetail);

module.exports = router;
