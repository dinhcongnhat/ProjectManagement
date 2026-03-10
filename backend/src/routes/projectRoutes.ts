import { Router } from 'express';
import { createProject, getProjects, getProjectById, updateProject, deleteProject, downloadAttachment, updateProjectProgress, approveProject, createSubProject, getDashboardStats } from '../controllers/projectController.js';
import {
    getProjectAttachments,
    uploadProjectAttachment,
    uploadAttachmentFromFolder,
    deleteProjectAttachment,
    downloadProjectAttachment,
    getAttachmentPresignedUrl,
    uploadProjectFolder,
    uploadFolderFromStorage,
    downloadFolderAsZip,
    saveFolderToStorage,
    getFolderContents,
    deleteProjectFolder
} from '../controllers/projectAttachmentController.js';
import { authenticateToken, isAdmin } from '../middleware/authMiddleware.js';

const router = Router();

import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

// Dashboard stats
router.get('/dashboard/stats', authenticateToken, getDashboardStats);

// Project CRUD
// POST / accepts JSON body (no file)
// POST /with-file accepts FormData with file
router.post('/', authenticateToken, createProject);
router.post('/with-file', authenticateToken, upload.single('file'), createProject);
// Create sub-project - allowed for Manager of parent project or any user
router.post('/sub-project', authenticateToken, createSubProject);
router.get('/', authenticateToken, getProjects);
router.get('/:id', authenticateToken, getProjectById);
router.put('/:id', authenticateToken, updateProject); // Permission check done in controller
router.delete('/:id', authenticateToken, deleteProject); // Permission check done in controller
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

// Folder upload/download for project attachments
router.post('/:projectId/attachments/folder', authenticateToken, upload.array('files', 500), uploadProjectFolder);
router.post('/:projectId/attachments/folder-from-storage', authenticateToken, uploadFolderFromStorage);
router.get('/:projectId/attachments/folder/download', authenticateToken, downloadFolderAsZip);
router.post('/:projectId/attachments/folder/save-to-storage', authenticateToken, saveFolderToStorage);
router.get('/:projectId/attachments/folder/contents', authenticateToken, getFolderContents);
router.delete('/:projectId/attachments/folder', authenticateToken, deleteProjectFolder);

export default router;
