import { Router } from 'express';
import { createProject, getProjects, getProjectById, updateProject, deleteProject, downloadAttachment } from '../controllers/projectController.js';
import { authenticateToken, isAdmin } from '../middleware/authMiddleware.js';

const router = Router();

import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

router.post('/', authenticateToken, isAdmin, upload.single('file'), createProject);
router.get('/', authenticateToken, getProjects);
router.get('/:id', authenticateToken, getProjectById);
router.put('/:id', authenticateToken, isAdmin, updateProject);
router.delete('/:id', authenticateToken, isAdmin, deleteProject);
router.get('/:id/attachment', authenticateToken, downloadAttachment);

export default router;
