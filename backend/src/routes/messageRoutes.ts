import express from 'express';
import {
    getMessages,
    createMessage,
    uploadVoiceMessage,
    uploadFileMessage,
    deleteMessage,
    downloadAttachment,
    serveAttachment,
    upload
} from '../controllers/messageController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Serve attachment file (no auth - for direct image/file access)
router.get('/messages/:id/file', serveAttachment);

// All other routes require authentication
router.use(authenticateToken);

// Get all messages for a project
router.get('/projects/:projectId/messages', getMessages);

// Create text message
router.post('/projects/:projectId/messages', createMessage);

// Upload voice message
router.post('/projects/:projectId/messages/voice', upload.single('audio'), uploadVoiceMessage);

// Upload file attachment
router.post('/projects/:projectId/messages/file', upload.single('file'), uploadFileMessage);

// Download attachment
router.get('/messages/:id/attachment', downloadAttachment);

// Delete message
router.delete('/messages/:id', deleteMessage);

export default router;
