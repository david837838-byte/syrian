const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');

router.get('/backups', settingsController.listBackups);
router.post('/backups/create', settingsController.createBackup);
router.get('/backups/download/:filename', settingsController.downloadBackup);
router.post('/backups/restore', settingsController.restoreBackup);

module.exports = router;
