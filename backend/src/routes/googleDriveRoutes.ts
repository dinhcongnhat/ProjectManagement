
import express from 'express';
import {
    getAuthUrl,
    handleCallback,
    listDriveFiles,
    linkFileToProject,
    getProjectLinks,
    disconnectDrive,
    checkConnection,
    downloadFile,
    createFolder,
    toggleStar
} from '../controllers/googleDriveController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/auth/url', authenticateToken, getAuthUrl);
router.get('/status', authenticateToken, checkConnection);
router.post('/auth/callback', authenticateToken, handleCallback);
router.get('/files', authenticateToken, listDriveFiles);
router.get('/files/:fileId/download', authenticateToken, downloadFile);
router.post('/link', authenticateToken, linkFileToProject);
router.get('/projects/:projectId/links', authenticateToken, getProjectLinks);
router.post('/folders', authenticateToken, createFolder);
router.patch('/files/:fileId/star', authenticateToken, toggleStar);
router.delete('/disconnect', authenticateToken, disconnectDrive);

export default router;
