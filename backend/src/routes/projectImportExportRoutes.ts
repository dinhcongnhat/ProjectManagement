import { Router } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
    exportProjects,
    downloadImportTemplate,
    importProjects
} from '../controllers/projectImportExportController.js';

const router = Router();

// Configure multer for file upload (memory storage)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept only Excel files
        const allowedMimes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ chấp nhận file Excel (.xlsx, .xls)'));
        }
    }
});

// Download import template
router.get('/template', authenticateToken, downloadImportTemplate);

// Export projects (POST to allow sending project IDs in body)
router.post('/export', authenticateToken, exportProjects);

// Import projects from Excel
router.post('/import', authenticateToken, upload.single('file'), importProjects);

export default router;
