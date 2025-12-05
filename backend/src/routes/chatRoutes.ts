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
    searchUsers,
    addReaction,
    removeReaction,
    markConversationAsRead,
    deleteMessage,
    deleteConversation,
    serveMessageAttachment
} from '../controllers/chatController.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Public routes - serve files without authentication (for img src, audio src)
router.get('/messages/:messageId/file', serveMessageAttachment);

// All other routes require authentication
router.use(authenticateToken);

// Conversations
router.get('/conversations', getConversations);
router.post('/conversations', upload.single('avatar'), createConversation);
router.get('/conversations/search', searchConversations);
router.get('/conversations/:id', getConversationById);
router.put('/conversations/:id', upload.single('avatar'), updateConversation);
router.put('/conversations/:id/read', markConversationAsRead);
router.post('/conversations/:id/members', addMembers);
router.delete('/conversations/:id/leave', leaveConversation);
router.delete('/conversations/:id', deleteConversation);

// Messages
router.get('/conversations/:id/messages', getMessages);
router.post('/conversations/:id/messages', sendMessage);
router.post('/conversations/:id/messages/file', upload.single('file'), sendFileMessage);
router.post('/conversations/:id/messages/voice', upload.single('audio'), sendVoiceMessage);
router.delete('/messages/:messageId', deleteMessage);

// Reactions
router.post('/messages/:messageId/reactions', addReaction);
router.delete('/messages/:messageId/reactions/:emoji', removeReaction);

// Users search for new chat
router.get('/users/search', searchUsers);

export default router;
