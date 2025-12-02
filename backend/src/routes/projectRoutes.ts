import { Router } from 'express';
import { createProject, getProjects, getProjectById, updateProject, deleteProject } from '../controllers/projectController.js';
import { authenticateToken, isAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/', authenticateToken, isAdmin, createProject);
router.get('/', authenticateToken, getProjects);
router.get('/:id', authenticateToken, getProjectById);
router.put('/:id', authenticateToken, isAdmin, updateProject);
router.delete('/:id', authenticateToken, isAdmin, deleteProject);

export default router;
