import { Router } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
    getFoldersAndFiles,
    createFolder,
    uploadFile,
    deleteFolder,
    deleteFile,
    getFileUrl,
    streamFile,
    checkOnlyOfficeSupport,
    getOnlyOfficeConfig,
    onlyofficeCallback,
    downloadFileForOnlyOffice,
    renameFolder,
    renameFile
} from '../controllers/folderController.js';

const router = Router();

// Configure multer for file uploads (50MB limit)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Protected routes (require authentication)

// Get folders and files list
router.get('/', authenticateToken, getFoldersAndFiles);

// Create new folder
router.post('/create', authenticateToken, createFolder);

// Upload file
router.post('/upload', authenticateToken, upload.single('file'), uploadFile);

// Rename folder
router.put('/folders/:id/rename', authenticateToken, renameFolder);

// Delete folder
router.delete('/folders/:id', authenticateToken, deleteFolder);

// Rename file
router.put('/files/:id/rename', authenticateToken, renameFile);

// Delete file
router.delete('/files/:id', authenticateToken, deleteFile);

// Get file download URL
router.get('/files/:id/url', authenticateToken, getFileUrl);

// Stream file for viewing
router.get('/files/:id/stream', authenticateToken, streamFile);

// Check OnlyOffice support
router.get('/files/:id/onlyoffice-check', authenticateToken, checkOnlyOfficeSupport);

// Get OnlyOffice config
router.get('/files/:id/onlyoffice-config', authenticateToken, getOnlyOfficeConfig);

// OnlyOffice callback (no auth needed for OnlyOffice server)
router.post('/files/onlyoffice-callback', onlyofficeCallback);

// Download file for OnlyOffice (no auth - OnlyOffice needs direct access)
router.get('/files/:id/onlyoffice-download', downloadFileForOnlyOffice);

export default router;
