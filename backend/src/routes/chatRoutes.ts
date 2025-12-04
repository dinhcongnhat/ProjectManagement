import express from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
    getConversations,
    createConversation,
    getConversationById,
    getMessages,
    sendMessage,
    sendFileMessage,
    sendVoiceMessage,
    addMembers,
    leaveConversation,
    updateConversation,
    searchConversations,
    searchUsers
} from '../controllers/chatController.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// All routes require authentication
router.use(authenticateToken);

// Conversations
router.get('/conversations', getConversations);
router.post('/conversations', upload.single('avatar'), createConversation);
router.get('/conversations/search', searchConversations);
router.get('/conversations/:id', getConversationById);
router.put('/conversations/:id', upload.single('avatar'), updateConversation);
router.post('/conversations/:id/members', addMembers);
router.delete('/conversations/:id/leave', leaveConversation);

// Messages
router.get('/conversations/:id/messages', getMessages);
router.post('/conversations/:id/messages', sendMessage);
router.post('/conversations/:id/messages/file', upload.single('file'), sendFileMessage);
router.post('/conversations/:id/messages/voice', upload.single('audio'), sendVoiceMessage);

// Users search for new chat
router.get('/users/search', searchUsers);

export default router;
