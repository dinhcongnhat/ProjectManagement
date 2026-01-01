import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
    getOnlyOfficeConfig,
    onlyofficeCallback,
    checkOnlyOfficeSupport,
    downloadFileForOnlyOffice,
    getDiscussionOnlyOfficeConfig,
    downloadDiscussionFileForOnlyOffice,
    checkDiscussionOnlyOfficeSupport,
    checkChatOnlyOfficeSupport,
    getChatOnlyOfficeConfig,
    downloadChatFileForOnlyOffice
} from '../controllers/onlyofficeController.js';

const router = express.Router();

// Get OnlyOffice editor configuration for a project attachment
router.get('/config/:id', authenticateToken, getOnlyOfficeConfig);

// Check if a project attachment can be opened with OnlyOffice
router.get('/check/:id', authenticateToken, checkOnlyOfficeSupport);

// Download file for OnlyOffice server (no auth required - OnlyOffice server calls this)
router.get('/download/:id', downloadFileForOnlyOffice);

// OnlyOffice callback endpoint (no auth required as it's called by OnlyOffice server)
router.post('/callback/:id', onlyofficeCallback);

// Folder callback endpoint (alias to fix potential routing issues)
import { onlyofficeCallback as folderCallback } from '../controllers/folderController.js';
router.post('/folder-callback/:id', folderCallback);

// Discussion attachment endpoints (view only)
// Get OnlyOffice config for discussion message attachment
router.get('/discussion/config/:messageId', authenticateToken, getDiscussionOnlyOfficeConfig);

// Check if discussion attachment can be opened with OnlyOffice
router.get('/discussion/check/:messageId', authenticateToken, checkDiscussionOnlyOfficeSupport);

// Download discussion file for OnlyOffice server (no auth required - OnlyOffice server calls this)
router.get('/discussion/download/:messageId', downloadDiscussionFileForOnlyOffice);

// Chat message attachment endpoints (view only)
// Check if chat attachment can be opened with OnlyOffice
router.get('/chat/check/:messageId', authenticateToken, checkChatOnlyOfficeSupport);

// Get OnlyOffice config for chat message attachment
router.get('/chat/config/:messageId', authenticateToken, getChatOnlyOfficeConfig);

// Download chat file for OnlyOffice server (no auth required - OnlyOffice server calls this)
router.get('/chat/download/:messageId', downloadChatFileForOnlyOffice);

export default router;
