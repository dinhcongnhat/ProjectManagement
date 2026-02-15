import express from 'express';
import jwt from 'jsonwebtoken';
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
    downloadChatFileForOnlyOffice,
    getGoogleDriveOnlyOfficeConfig,
    downloadDriveFileForOnlyOffice,
    onlyofficeDriveCallback,
    saveAsGoogleDriveFile,
    saveDriveFileToSystem,
    handleGeneralSave,
    checkKanbanOnlyOfficeSupport,
    getKanbanOnlyOfficeConfig,
    downloadKanbanFileForOnlyOffice
} from '../controllers/onlyofficeController.js';

const router = express.Router();

// ========== TEST ENDPOINT (NO AUTH) ==========
// Use this to verify OnlyOffice can reach callback URL
router.get('/callback-test', (req, res) => {
    console.log('\n[OnlyOffice Routes] Callback Test GET - Request received');
    console.log('[OnlyOffice Routes] Headers:', JSON.stringify(req.headers, null, 2));
    res.json({
        success: true,
        message: 'OnlyOffice callback is reachable via routes!',
        timestamp: new Date().toISOString()
    });
});

router.post('/callback-test', (req, res) => {
    console.log('\n[OnlyOffice Routes] Callback Test POST - Request received');
    console.log('[OnlyOffice Routes] Body:', JSON.stringify(req.body, null, 2));
    res.json({
        success: true,
        message: 'OnlyOffice callback POST is reachable!',
        receivedBody: req.body,
        timestamp: new Date().toISOString()
    });
});
// ========== END TEST ENDPOINT ==========

// ========== JWT DEBUG ENDPOINT ==========
const ONLYOFFICE_JWT_SECRET = process.env.ONLYOFFICE_JWT_SECRET || '10122002';

router.get('/jwt-debug', (req, res) => {
    console.log('[JWT Debug] Secret from env:', process.env.ONLYOFFICE_JWT_SECRET);
    console.log('[JWT Debug] Using secret:', ONLYOFFICE_JWT_SECRET);

    // Create a test payload
    const testPayload = {
        document: {
            fileType: 'docx',
            key: 'test_key_123',
            title: 'test.docx',
            url: 'https://example.com/test.docx',
        },
        editorConfig: {
            mode: 'view',
            lang: 'en',
            user: { id: '1', name: 'Test' },
        },
    };

    const token = jwt.sign(testPayload, ONLYOFFICE_JWT_SECRET, { algorithm: 'HS256' });

    res.json({
        secretLoaded: !!process.env.ONLYOFFICE_JWT_SECRET,
        secretPreview: ONLYOFFICE_JWT_SECRET.substring(0, 3) + '***' + ONLYOFFICE_JWT_SECRET.slice(-2),
        secretLength: ONLYOFFICE_JWT_SECRET.length,
        testToken: token,
        tokenPreview: token.substring(0, 50) + '...',
        decodedPayload: jwt.decode(token),
    });
});
// ========== END JWT DEBUG ==========

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

// Google Drive endpoints (view only)
// Get OnlyOffice config for Google Drive file
router.get('/drive/config/:fileId', authenticateToken, getGoogleDriveOnlyOfficeConfig);

// Download Google Drive file for OnlyOffice (uses query param token)
router.get('/drive/download/:fileId', downloadDriveFileForOnlyOffice);

// OnlyOffice Drive callback endpoint (no auth required as called by server)
router.post('/drive/callback/:fileId', onlyofficeDriveCallback);

// Save as copy functionality for Google Drive
router.post('/drive/save-as/:fileId', authenticateToken, saveAsGoogleDriveFile);
router.post('/drive/save-to-system/:fileId', authenticateToken, saveDriveFileToSystem);

// Unified save endpoint (no auth required as called by OnlyOffice server)
router.post('/save', handleGeneralSave);

// Kanban attachment endpoints (view only)
// Check if kanban attachment can be opened with OnlyOffice
router.get('/kanban/check/:id', authenticateToken, checkKanbanOnlyOfficeSupport);

// Get OnlyOffice config for kanban attachment
router.get('/kanban/config/:id', authenticateToken, getKanbanOnlyOfficeConfig);

// Download kanban file for OnlyOffice server (no auth required - OnlyOffice server calls this)
router.get('/kanban/download/:id', downloadKanbanFileForOnlyOffice);

export default router;
