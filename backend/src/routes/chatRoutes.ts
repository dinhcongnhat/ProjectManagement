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
    serveMessageAttachment,
    serveConversationAvatar,
    searchMessagesInConversation,
    getConversationMedia,
    getMessageContext
} from '../controllers/chatController.js';

const router = express.Router();
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, 'uploads/');
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix);
        }
    }),
    limits: {
        fileSize: 5 * 1024 * 1024 * 1024 // 5GB max file size
    }
});

// Debug route to check if routing is working
router.get('/test', (req, res) => {
    res.json({ message: 'Chat routes are working', timestamp: new Date().toISOString() });
});

// Debug route to check MinIO connection and list files (NO AUTH needed)
router.get('/debug/minio', async (req, res) => {
    try {
        const { minioClient, bucketName } = await import('../config/minio.js');

        // Check if bucket exists
        const bucketExists = await minioClient.bucketExists(bucketName);

        // List files in bucket (limit to first 50)
        const objects: any[] = [];
        const objectsStream = minioClient.listObjects(bucketName, '', true);

        await new Promise<void>((resolve, reject) => {
            let count = 0;
            objectsStream.on('data', (obj) => {
                if (count < 50) {
                    objects.push({
                        name: obj.name,
                        size: obj.size,
                        lastModified: obj.lastModified
                    });
                    count++;
                }
            });
            objectsStream.on('error', reject);
            objectsStream.on('end', resolve);
        });

        res.json({
            status: 'connected',
            bucketName,
            bucketExists,
            objectCount: objects.length,
            objects
        });
    } catch (error: any) {
        res.status(500).json({
            status: 'error',
            message: error?.message || 'Unknown error',
            error: error
        });
    }
});

// Public routes - serve files without authentication (for img src, audio src)
// IMPORTANT: These MUST be before authenticateToken middleware
router.get('/conversations/:conversationId/messages/:messageId/file', (req, res, next) => {
    console.log('[chatRoutes] Matched PUBLIC route for message attachment');
    console.log('[chatRoutes] Params:', req.params);
    next();
}, serveMessageAttachment);

router.get('/conversations/:id/avatar', (req, res, next) => {
    console.log('[chatRoutes] Matched PUBLIC route for conversation avatar');
    console.log('[chatRoutes] Params:', req.params);
    next();
}, serveConversationAvatar);

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
router.get('/conversations/:id/messages/:messageId/context', getMessageContext);
router.get('/conversations/:id/search', searchMessagesInConversation);
router.get('/conversations/:id/media', getConversationMedia);
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
