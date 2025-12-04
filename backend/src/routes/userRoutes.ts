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
    getAllUsersWithAvatar
} from '../controllers/userController.js';
import { authenticateToken, isAdmin } from '../middleware/authMiddleware.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Profile routes (authenticated user)
router.get('/profile', authenticateToken, getProfile);
router.put('/profile', authenticateToken, updateProfile);
router.post('/profile/avatar', authenticateToken, upload.single('avatar'), uploadAvatar);
router.post('/profile/change-password', authenticateToken, changePassword);

// Users list with avatars (for chat)
router.get('/with-avatars', authenticateToken, getAllUsersWithAvatar);

// Get user by ID (for viewing other profiles)
router.get('/:id', authenticateToken, getUserById);

// Admin routes
router.get('/', authenticateToken, getUsers);
router.post('/', authenticateToken, isAdmin, createUser);
router.put('/:id', authenticateToken, isAdmin, updateUser);
router.delete('/:id', authenticateToken, isAdmin, deleteUser);

export default router;
