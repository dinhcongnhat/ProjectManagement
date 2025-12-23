import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
    confirmReceived,
    confirmInProgress,
    approveCompleted,
    confirmSentToCustomer,
    getProjectWorkflow,
} from '../controllers/workflowController.js';

const router = express.Router();

// Get workflow for a project
router.get('/projects/:id/workflow', authenticateToken, getProjectWorkflow);

// Workflow status transitions
router.post('/projects/:id/workflow/confirm-received', authenticateToken, confirmReceived);
router.post('/projects/:id/workflow/confirm-in-progress', authenticateToken, confirmInProgress);
router.post('/projects/:id/workflow/approve-completed', authenticateToken, approveCompleted);
router.post('/projects/:id/workflow/confirm-sent-to-customer', authenticateToken, confirmSentToCustomer);

export default router;
