const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// 1. Dashboard
router.get('/dashboard', adminController.getDashboardData);
router.post('/profits/accrue', adminController.accrueProfits);

// 2. Security & Readiness
router.get('/security/overview', adminController.getSecurityOverview);
router.get('/readiness', adminController.getReadiness);

// 3. User Management
router.get('/users', adminController.getUsers);
router.delete('/users/:user_id', adminController.deleteUser);
router.put('/users/:user_id', adminController.updateUser);
router.get('/users/:user_id/devices', adminController.getUserDevices);
router.get('/users/:user_id/kyc-details', adminController.getUserKycDetails);
router.post('/users/:user_id/kyc-review', adminController.reviewUserKyc);
router.get('/users/:user_id/company-details', adminController.getUserCompanyDetails);
router.post('/users/:user_id/company-review', adminController.reviewUserCompany);

// 4. Investments Management
router.get('/investments', adminController.getInvestments);
router.post('/investments', adminController.createInvestment);
router.put('/investments/:id', adminController.updateInvestment);
router.delete('/investments/:id', adminController.deleteInvestment);

// 5. Governorates
router.get('/governorates', adminController.getGovernorates);
router.post('/governorates', adminController.createGovernorate);
router.put('/governorates/:id', adminController.updateGovernorate);
router.delete('/governorates/:id', adminController.deleteGovernorate);

// 6. Withdrawals
router.get('/withdrawals', adminController.getWithdrawals);
router.post('/withdrawals/:id/approve', adminController.approveWithdrawal);
router.post('/withdrawals/:id/reject', adminController.rejectWithdrawal);

// 7. Deposits
router.get('/deposits', adminController.getDeposits);
router.post('/deposits/:id/verify', adminController.verifyDeposit);

// 8. Admin Wallets
router.get('/wallets', adminController.getWallets);
router.post('/wallets', adminController.createWallet);
router.put('/wallets/:id', adminController.updateWallet);
router.delete('/wallets/:id', adminController.deleteWallet);

// 9. Receiving Wallets
router.get('/receiving-wallets', adminController.getReceivingWallets);
router.post('/receiving-wallets', adminController.createReceivingWallet);
router.delete('/receiving-wallets/:id', adminController.deleteReceivingWallet);

// 10. Wallet Profiles (Special Wallets)
router.get('/wallet-profiles', adminController.getWalletProfiles);
router.post('/wallet-profiles', adminController.createWalletProfile);
router.delete('/wallet-profiles/:profile_id', adminController.deleteWalletProfile);

// 11. Real Crypto Wallet Pool
router.get('/real-crypto-wallet-pool', adminController.getRealCryptoWalletPool);
router.post('/real-crypto-wallet-pool', adminController.createRealCryptoWallet);
router.delete('/real-crypto-wallet-pool/:pool_id', adminController.deleteRealCryptoWallet);

// 12. Financial Channels
router.get('/financial-channels', adminController.getFinancialChannels);
router.post('/financial-channels', adminController.createFinancialChannel);
router.delete('/financial-channels/:channel_id', adminController.deleteFinancialChannel);

module.exports = router;
