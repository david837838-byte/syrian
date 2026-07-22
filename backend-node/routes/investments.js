const express = require('express');
const router = express.Router();
const investmentController = require('../controllers/investmentController');
const authMiddleware = require('../middlewares/authMiddleware');
const optionalAuthMiddleware = require('../middlewares/optionalAuthMiddleware');

router.get('/', optionalAuthMiddleware, investmentController.getInvestments);
router.post('/', authMiddleware, investmentController.createInvestment);

module.exports = router;
