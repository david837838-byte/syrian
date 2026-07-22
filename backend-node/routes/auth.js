const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const authMiddleware = require('../middlewares/authMiddleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/profile', authMiddleware, authController.getProfile);
router.get('/devices', authMiddleware, authController.getDevices);


// 2FA Routes
router.post('/2fa/setup', authMiddleware, authController.setup2FA);
router.post('/2fa/verify-setup', authMiddleware, authController.verifySetup2FA);
router.post('/2fa/disable', authMiddleware, authController.disable2FA);
router.post('/login-2fa', authMiddleware, authController.login2FA);

module.exports = router;
