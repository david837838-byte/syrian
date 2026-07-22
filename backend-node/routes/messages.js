const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/conversations', authMiddleware, messageController.getConversations);
router.post('/conversations', authMiddleware, messageController.startConversation);
router.get('/conversations/:conversationId', authMiddleware, messageController.getConversationMessages);
router.post('/conversations/:conversationId/messages', authMiddleware, messageController.sendMessage);
router.delete('/messages/:messageId', authMiddleware, messageController.deleteMessage);

router.post('/conversations/:conversationId/call', authMiddleware, messageController.startCall);
router.get('/calls/:callId', authMiddleware, messageController.getCall);
router.post('/calls/:callId/action', authMiddleware, messageController.actOnCall);
router.post('/calls/:callId/signal', authMiddleware, messageController.addCallSignal);
router.get('/calls/:callId/signals', authMiddleware, messageController.getCallSignals);
router.get('/rtc-config', authMiddleware, messageController.getRtcConfig);

router.post('/upload', authMiddleware, messageController.uploadMiddleware, messageController.uploadAttachment);

module.exports = router;
