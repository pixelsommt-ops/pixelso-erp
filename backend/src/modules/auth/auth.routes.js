// M01: Auth
// Fitur kunci (PRD 3.2): Login, session/JWT, logout, refresh token

const { Router } = require('express');
const controller = require('./auth.controller');
const { authenticate } = require('../../common/middlewares/auth');

const router = Router();

router.post('/login', controller.login);
router.get('/me', authenticate, controller.me);

module.exports = router;
