import { Router } from 'express';
import { createProject, getProjects, getProjectById, updateProject, deleteProject, downloadAttachment, updateProjectProgress, approveProject } from '../controllers/projectController.js';
import {
    getProjectAttachments,
    uploadProjectAttachment,
    uploadAttachmentFromFolder,
    deleteProjectAttachment,
    downloadProjectAttachment,
    getAttachmentPresignedUrl
} from '../controllers/projectAttachmentController.js';
import { authenticateToken, isAdmin } from '../middleware/authMiddleware.js';

const router = Router();

import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

// Project CRUD
router.post('/', authenticateToken, isAdmin, upload.single('file'), createProject);
router.get('/', authenticateToken, getProjects);
router.get('/:id', authenticateToken, getProjectById);
router.put('/:id', authenticateToken, isAdmin, updateProject);
router.delete('/:id', authenticateToken, isAdmin, deleteProject);
router.get('/:id/attachment', authenticateToken, downloadAttachment);
router.patch('/:id/progress', authenticateToken, updateProjectProgress);
router.post('/:id/approve', authenticateToken, approveProject);

// Project Attachments (multiple files)
router.get('/:projectId/attachments', authenticateToken, getProjectAttachments);
router.post('/:projectId/attachments', authenticateToken, upload.array('files', 20), uploadProjectAttachment);
router.post('/:projectId/attachments/from-folder', authenticateToken, uploadAttachmentFromFolder);
router.delete('/:projectId/attachments/:attachmentId', authenticateToken, deleteProjectAttachment);
router.get('/attachments/:attachmentId/download', authenticateToken, downloadProjectAttachment);
router.get('/attachments/:attachmentId/presigned-url', authenticateToken, getAttachmentPresignedUrl);

export default router;
