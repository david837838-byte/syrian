const express = require('express');
const router = express.Router();
const transactionsController = require('../controllers/transactionsController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/', authMiddleware, transactionsController.getTransactions);
router.post('/deposit', authMiddleware, transactionsController.deposit);
router.post('/withdraw/request-code', authMiddleware, transactionsController.requestWithdrawCode);
router.post('/withdraw', authMiddleware, transactionsController.withdraw);
router.post('/internal-transfer', authMiddleware, transactionsController.internalTransfer);

module.exports = router;
