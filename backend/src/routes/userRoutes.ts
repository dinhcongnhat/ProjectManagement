import { Router } from 'express';
import multer from 'multer';
import { 
    getUsers, 
    createUser, 
    updateUser, 
    deleteUser,
    getProfile,
    updateProfile,
    uploadAvatar,
    changePassword,
    getUserById,
    getAllUsersWithAvatar,
    serveUserAvatar
} from '../controllers/userController.js';
import { authenticateToken, isAdmin } from '../middleware/authMiddleware.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// === PUBLIC DEBUG ENDPOINT - Test DB connection ===
router.get('/debug-db-avatar/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const prisma = (await import('@prisma/client')).PrismaClient;
        const db = new prisma();
        
        const user = await db.user.findUnique({
            where: { id: Number(id) },
            select: { id: true, name: true, avatar: true }
        });
        
        await db.$disconnect();
        
        res.json({ 
            userId: id,
            found: !!user,
            user: user 
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Test Minio permissions
router.get('/test-minio', authenticateToken, async (req, res) => {
    try {
        const { minioClient, bucketName } = await import('../config/minio.js');
        
        // Test upload
        const testContent = Buffer.from('Test ' + Date.now());
        const testFile = 'test/permissions-check.txt';
        
        console.log('[Test] Uploading test file...');
        await minioClient.putObject(bucketName, testFile, testContent, testContent.length);
        console.log('[Test] Upload successful');
        
        // Test read
        console.log('[Test] Reading test file stats...');
        const stats = await minioClient.statObject(bucketName, testFile);
        console.log('[Test] Read successful:', stats);
        
        // Clean up
        await minioClient.removeObject(bucketName, testFile);
        
        res.json({ 
            success: true, 
            message: 'Minio permissions working correctly',
            stats: { size: stats.size, etag: stats.etag }
        });
    } catch (error: any) {
        console.error('[Test] Error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            code: error.code 
        });
    }
});

// === PUBLIC DEBUG ROUTE ===
router.get('/api-test-db-user/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const prisma = (await import('@prisma/client')).PrismaClient;
        const db = new prisma();
        
        const user = await db.user.findUnique({
            where: { id: Number(id) },
            select: { id: true, name: true, avatar: true }
        });
        
        await db.$disconnect();
        
        res.json({ 
            userId: id,
            found: !!user,
            user: user 
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// === PUBLIC ROUTES - Must be BEFORE /:id ===
router.get('/:id/avatar', serveUserAvatar);

// Profile routes (authenticated user)
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);
router.post('/profile/avatar', authenticateToken, upload.single('avatar'), uploadAvatar);
router.post('/profile/change-password', authenticateToken, changePassword);

// Users list with avatars (for chat)
router.get('/with-avatars', authenticateToken, getAllUsersWithAvatar);

// Get user by ID (for viewing other profiles) - AFTER specific routes
router.get('/:id', authenticateToken, getUserById);

// Admin routes
router.get('/', authenticateToken, getUsers);
router.post('/', authenticateToken, isAdmin, createUser);
router.put('/:id', authenticateToken, isAdmin, updateUser);
router.delete('/:id', authenticateToken, isAdmin, deleteUser);

export default router;
