import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { 
    getOnlyOfficeConfig, 
    onlyofficeCallback, 
    checkOnlyOfficeSupport,
    downloadFileForOnlyOffice,
    getDiscussionOnlyOfficeConfig,
    downloadDiscussionFileForOnlyOffice,
    checkDiscussionOnlyOfficeSupport
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

// Discussion attachment endpoints (view only)
// Get OnlyOffice config for discussion message attachment
router.get('/discussion/config/:messageId', authenticateToken, getDiscussionOnlyOfficeConfig);

// Check if discussion attachment can be opened with OnlyOffice
router.get('/discussion/check/:messageId', authenticateToken, checkDiscussionOnlyOfficeSupport);

// Download discussion file for OnlyOffice server (no auth required - OnlyOffice server calls this)
router.get('/discussion/download/:messageId', downloadDiscussionFileForOnlyOffice);

export default router;
