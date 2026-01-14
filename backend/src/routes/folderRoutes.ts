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
    downloadUserFile,
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
    shareFile,
    getFolderShares,
    getFileShares,
    unshareFolder,
    unshareFile,
    ensureFolderStructure,
    searchFoldersAndFiles,
    moveFolder,
    moveFile
} from '../controllers/folderController.js';

const router = Router();

// Configure multer for file uploads (500MB limit for large files)
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, 'uploads/');
        },
        filename: (req, file, cb) => {
            // Keep original extension if possible, but safer to use random name
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix);
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 * 1024 } // 5GB limit
});

// Protected routes (require authentication)

// Search folders and files (deep search)
router.get('/search', authenticateToken, searchFoldersAndFiles);

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

// Move folder
router.put('/folders/:id/move', authenticateToken, moveFolder);

// Move file
router.put('/files/:id/move', authenticateToken, moveFile);

// Get file download URL
router.get('/files/:id/url', authenticateToken, getFileUrl);

// Download file stream (attachment)
router.get('/files/:id/download', authenticateToken, downloadUserFile);

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
router.post('/ensure-structure', authenticateToken, ensureFolderStructure);

// Share folder/file
router.post('/:id/share', authenticateToken, shareFolder);
router.post('/files/:id/share', authenticateToken, shareFile);

// Get shares list
router.get('/:id/shares', authenticateToken, getFolderShares);
router.get('/files/:id/shares', authenticateToken, getFileShares);

// Unshare folder/file  
router.delete('/:id/share/:targetUserId', authenticateToken, unshareFolder);
router.delete('/files/:id/share/:targetUserId', authenticateToken, unshareFile);

export default router;
