const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/balance', authMiddleware, walletController.getBalance);
router.get('/financial-channels', authMiddleware, walletController.getFinancialChannels);
router.get('/real-crypto', authMiddleware, walletController.getRealCryptoWallets);
router.post('/real-crypto/assign', authMiddleware, walletController.assignRealCryptoWallet);
router.post('/generate/:currency_id', authMiddleware, walletController.generateWallet);

module.exports = router;
