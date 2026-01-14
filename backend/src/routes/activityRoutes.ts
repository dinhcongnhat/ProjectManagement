import express from 'express';
import { getActivities, getUserActivities } from '../controllers/activityController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get recent activities for a user (dashboard)
router.get('/activities', getUserActivities);

// Get activity history for a project
router.get('/projects/:projectId/activities', getActivities);

export default router;
