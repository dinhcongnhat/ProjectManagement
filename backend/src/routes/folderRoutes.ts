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
    renameFile,
    saveFileFromUrl,
    getSharedWithMe,
    searchUsersForShare,
    shareFolder,
    shareFile
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

// Save file from URL (OnlyOffice Save As)
router.post('/files/save-from-url', authenticateToken, saveFileFromUrl);

// OnlyOffice callback (no auth needed for OnlyOffice server)
router.post('/files/:id/onlyoffice-callback', onlyofficeCallback);

// Download file for OnlyOffice (no auth - OnlyOffice needs direct access)
router.get('/files/:id/onlyoffice-download', downloadFileForOnlyOffice);

// Sharing System
router.get('/shared', authenticateToken, getSharedWithMe);
router.get('/users/search', authenticateToken, searchUsersForShare);
router.post('/folders/:id/share', authenticateToken, shareFolder);
router.post('/files/:id/share', authenticateToken, shareFile);

export default router;
