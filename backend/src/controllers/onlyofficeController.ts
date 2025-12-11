import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../config/prisma.js';
import { isOfficeFile, getFileStream, getFileStats } from '../services/minioService.js';
import jwt from 'jsonwebtoken';

const ONLYOFFICE_URL = process.env.ONLYOFFICE_URL || 'https://jtsconlyoffice.duckdns.org';
const ONLYOFFICE_JWT_SECRET = process.env.ONLYOFFICE_JWT_SECRET || '10122002';
const BACKEND_URL = process.env.BACKEND_URL || 'http://171.237.138.176:3001';

// Get document type based on file extension
const getDocumentType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    
    // Word documents
    if (['doc', 'docx', 'odt', 'rtf', 'txt'].includes(ext)) {
        return 'word';
    }
    // Excel spreadsheets
    if (['xls', 'xlsx', 'ods', 'csv'].includes(ext)) {
        return 'cell';
    }
    // PowerPoint presentations
    if (['ppt', 'pptx', 'odp'].includes(ext)) {
        return 'slide';
    }
    // PDF documents
    if (ext === 'pdf') {
        return 'pdf';
    }
    
    return 'word'; // default
};

// Get file type for OnlyOffice
const getFileType = (filename: string): string => {
    return filename.split('.').pop()?.toLowerCase() || 'docx';
};

// Generate OnlyOffice JWT token
const generateOnlyOfficeToken = (payload: object): string => {
    return jwt.sign(payload, ONLYOFFICE_JWT_SECRET, { algorithm: 'HS256' });
};

// Get OnlyOffice editor configuration for a project attachment
export const getOnlyOfficeConfig = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;
        
        const project = await prisma.project.findUnique({
            where: { id: Number(id) },
            include: {
                implementers: { select: { id: true } },
                followers: { select: { id: true } },
                manager: { select: { id: true } },
            },
        });

        if (!project || !project.attachment) {
            return res.status(404).json({ message: 'Attachment not found' });
        }

        // Check if it's an Office file
        if (!isOfficeFile(project.attachment)) {
            return res.status(400).json({ message: 'File is not an Office document' });
        }

        // Determine if user can edit:
        // - Admin can always edit
        // - Manager can edit
        // - Implementers can edit
        // - Followers can only view
        const isAdmin = userRole === 'ADMIN';
        const isManager = project.manager?.id === userId;
        const isImplementer = project.implementers.some(impl => impl.id === userId);
        const canEdit = isAdmin || isManager || isImplementer;

        // Use backend proxy URL that OnlyOffice can access via LAN
        const fileUrl = `${BACKEND_URL}/api/onlyoffice/download/${project.id}`;
        
        // Extract original filename from attachment path
        const originalName = project.attachment.includes('/')
            ? project.attachment.split('/').pop()?.split('-').slice(1).join('-') || project.attachment
            : project.attachment.split('-').slice(1).join('-');
        
        // Decode the filename if it was encoded
        const decodedName = decodeURIComponent(originalName);
        
        const documentType = getDocumentType(decodedName);
        const fileType = getFileType(decodedName);
        
        // Create unique document key based on project id and attachment
        // Use stable key for editing session (without timestamp for same document)
        const documentKey = `project_${project.id}_v1`;
        
        // OnlyOffice configuration
        const config = {
            document: {
                fileType: fileType,
                key: documentKey,
                title: decodedName,
                url: fileUrl,
                permissions: {
                    download: true,
                    edit: canEdit,
                    print: true,
                    review: canEdit,
                    comment: true,
                    copy: true,
                    modifyContentControl: canEdit,
                    modifyFilter: canEdit,
                    fillForms: canEdit,
                },
            },
            documentType: documentType,
            editorConfig: {
                callbackUrl: `${BACKEND_URL}/api/onlyoffice/callback/${project.id}`,
                lang: 'en', // English language
                mode: canEdit ? 'edit' : 'view',
                user: {
                    id: req.user?.id?.toString() || 'anonymous',
                    name: 'User',
                },
                customization: {
                    autosave: true,
                    forcesave: true,
                    chat: true,
                    comments: true,
                    compactHeader: false,
                    compactToolbar: false,
                    feedback: false,
                    goback: false,
                    help: true,
                    hideRightMenu: false,
                    logo: {
                        image: '/Logo.png',
                        imageEmbedded: '/Logo.png',
                    },
                    mentionShare: false,
                    plugins: true,
                    toolbarHideFileName: false,
                    toolbarNoTabs: false,
                    spellcheck: true,
                    unit: 'cm',
                    zoom: 100,
                },
            },
            height: '100%',
            width: '100%',
            type: 'desktop',
        };

        // Generate JWT token for OnlyOffice
        const token = generateOnlyOfficeToken(config);
        
        res.json({
            config,
            token,
            onlyofficeUrl: ONLYOFFICE_URL,
            canEdit,
        });
    } catch (error) {
        console.error('Error getting OnlyOffice config:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Callback endpoint for OnlyOffice - handles document saving
export const onlyofficeCallback = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { status, url, key } = req.body;
        
        // Status codes:
        // 0 - no document with the key identifier could be found
        // 1 - document is being edited
        // 2 - document is ready for saving
        // 3 - document saving error has occurred
        // 4 - document is closed with no changes
        // 6 - document is being edited, but the current document state is saved
        // 7 - error has occurred while force saving the document
        
        console.log('OnlyOffice callback received:', { id, status, url, key });
        
        // Status 2 or 6 means document needs to be saved
        if (status === 2 || status === 6) {
            try {
                const project = await prisma.project.findUnique({
                    where: { id: Number(id) },
                });

                if (!project || !project.attachment) {
                    console.error('Project or attachment not found for callback');
                    return res.json({ error: 0 });
                }

                // Download the edited file from OnlyOffice
                const response = await fetch(url);
                if (!response.ok) {
                    console.error('Failed to download edited file from OnlyOffice');
                    return res.json({ error: 1 });
                }

                const buffer = Buffer.from(await response.arrayBuffer());
                
                // Import uploadFile dynamically to avoid circular dependency
                const { minioClient, bucketName } = await import('../config/minio.js');
                
                // Upload the updated file back to MinIO with the same path
                await minioClient.putObject(bucketName, project.attachment, buffer);
                
                console.log(`File saved successfully: ${project.attachment}`);
            } catch (saveError) {
                console.error('Error saving file:', saveError);
                return res.json({ error: 1, message: 'Error saving file' });
            }
        }
        
        res.json({ error: 0 });
    } catch (error) {
        console.error('Error in OnlyOffice callback:', error);
        res.json({ error: 1, message: 'Server error' });
    }
};

// Check if a file can be opened with OnlyOffice
export const checkOnlyOfficeSupport = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const project = await prisma.project.findUnique({
            where: { id: Number(id) },
        });

        if (!project || !project.attachment) {
            return res.status(404).json({ 
                supported: false, 
                message: 'Attachment not found' 
            });
        }

        const supported = isOfficeFile(project.attachment);
        const originalName = project.attachment.includes('/')
            ? project.attachment.split('/').pop()?.split('-').slice(1).join('-') || project.attachment
            : project.attachment.split('-').slice(1).join('-');
        
        res.json({
            supported,
            fileName: decodeURIComponent(originalName),
            documentType: supported ? getDocumentType(originalName) : null,
            onlyofficeUrl: ONLYOFFICE_URL,
        });
    } catch (error) {
        console.error('Error checking OnlyOffice support:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Download file for OnlyOffice - this endpoint is called by OnlyOffice server
// No auth required as OnlyOffice server needs to access it directly
export const downloadFileForOnlyOffice = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        console.log('[OnlyOffice Download] Request for project:', id);
        
        // Set CORS headers immediately
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        const project = await prisma.project.findUnique({
            where: { id: Number(id) },
        });

        if (!project || !project.attachment) {
            console.log('[OnlyOffice Download] Attachment not found for project:', id);
            return res.status(404).json({ message: 'Attachment not found' });
        }
        
        console.log('[OnlyOffice Download] Attachment path:', project.attachment);

        // Use presigned URL instead of streaming
        const { getPresignedUrl } = await import('../services/minioService.js');
        const presignedUrl = await getPresignedUrl(project.attachment, 3600); // 1 hour
        
        console.log('[OnlyOffice Download] Redirecting to presigned URL');
        res.redirect(presignedUrl);
    } catch (error: any) {
        console.error('[OnlyOffice Download] Error:', error?.message || error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Server error', error: error?.message });
        }
    }
};

// Get OnlyOffice config for discussion message attachment (view only)
export const getDiscussionOnlyOfficeConfig = async (req: AuthRequest, res: Response) => {
    try {
        const messageId = req.params.messageId;
        const userId = req.user?.id;
        
        if (!messageId) {
            return res.status(400).json({ message: 'Message ID is required' });
        }
        
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const ONLYOFFICE_URL = process.env.ONLYOFFICE_URL || 'https://jtsconlyoffice.duckdns.org';
        const JWT_SECRET = process.env.ONLYOFFICE_JWT_SECRET || '10122002';
        const BACKEND_URL = process.env.BACKEND_URL || 'https://ai.jtsc.io.vn/api';

        // Find the message with attachment
        const message = await prisma.message.findUnique({
            where: { id: parseInt(messageId) },
            include: {
                project: {
                    select: { id: true, name: true }
                }
            }
        });

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        if (!message.attachment) {
            return res.status(400).json({ message: 'This message has no attachment' });
        }

        // Get user info
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Extract original filename
        let originalName = message.attachment.split('-').slice(1).join('-');
        if (message.attachment.includes('/')) {
            const pathParts = message.attachment.split('/');
            const fileName = pathParts[pathParts.length - 1] || '';
            originalName = fileName.split('-').slice(1).join('-');
        }
        
        try {
            originalName = decodeURIComponent(originalName);
        } catch {
            // If decoding fails, use as is
        }

        // Get file extension
        const ext = originalName.split('.').pop()?.toLowerCase() || '';
        
        // Determine document type (pdf is its own type in OnlyOffice)
        let documentType: 'word' | 'cell' | 'slide' | 'pdf' = 'word';
        if (['xls', 'xlsx', 'ods', 'csv'].includes(ext)) {
            documentType = 'cell';
        } else if (['ppt', 'pptx', 'odp'].includes(ext)) {
            documentType = 'slide';
        } else if (ext === 'pdf') {
            documentType = 'pdf';
        }

        // Use backend proxy URL for file access
        const fileUrl = `${BACKEND_URL}/api/onlyoffice/discussion/download/${messageId}`;

        const config = {
            document: {
                fileType: ext,
                key: `discussion_${messageId}_${Date.now()}`,
                title: originalName,
                url: fileUrl,
            },
            documentType: documentType,
            editorConfig: {
                mode: 'view', // Always view only for discussion attachments
                lang: 'en',
                user: {
                    id: user.id.toString(),
                    name: user.name,
                },
                customization: {
                    chat: false,
                    comments: false,
                    compactHeader: false,
                    compactToolbar: false,
                    feedback: false,
                    forcesave: false,
                    help: false,
                    hideRightMenu: true,
                    toolbarNoTabs: false,
                    logo: {
                        image: '',
                        visible: false
                    }
                },
            },
        };

        // Sign the config with JWT
        const token = jwt.sign(config, JWT_SECRET);
        const signedConfig = { ...config, token };

        res.json({
            config: signedConfig,
            onlyofficeUrl: ONLYOFFICE_URL,
        });
    } catch (error) {
        console.error('Error generating discussion OnlyOffice config:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Download discussion attachment for OnlyOffice (no auth - OnlyOffice needs direct access)
export const downloadDiscussionFileForOnlyOffice = async (req: Request, res: Response) => {
    try {
        const messageId = req.params.messageId;
        
        if (!messageId) {
            return res.status(400).json({ message: 'Message ID is required' });
        }

        const message = await prisma.message.findUnique({
            where: { id: parseInt(messageId) },
            select: { id: true, attachment: true }
        });

        if (!message || !message.attachment) {
            return res.status(404).json({ message: 'Message or attachment not found' });
        }
        
        const fileStream = await getFileStream(message.attachment);
        const fileStats = await getFileStats(message.attachment);

        // Extract original filename
        let originalName = message.attachment.split('-').slice(1).join('-');
        if (message.attachment.includes('/')) {
            const pathParts = message.attachment.split('/');
            const fileName = pathParts[pathParts.length - 1] || '';
            originalName = fileName.split('-').slice(1).join('-');
        }
        
        try {
            originalName = decodeURIComponent(originalName);
        } catch {
            // If decoding fails, use as is
        }

        // Encode filename for Content-Disposition header (RFC 5987)
        const encodedFilename = encodeURIComponent(originalName).replace(/'/g, "%27");
        // Create ASCII-safe filename by keeping only ASCII alphanumeric, dots, underscores, hyphens
        const asciiFilename = originalName
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
            .replace(/[^\w\s.-]/g, '_') // Replace non-word chars
            .replace(/\s+/g, '_'); // Replace spaces with underscores

        // Set headers - use ASCII filename, UTF-8 encoded in filename*
        res.setHeader('Content-Disposition', `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`);
        
        if (fileStats.metaData && fileStats.metaData['content-type']) {
            res.setHeader('Content-Type', fileStats.metaData['content-type']);
        } else {
            const ext = originalName.split('.').pop()?.toLowerCase();
            const mimeTypes: Record<string, string> = {
                'doc': 'application/msword',
                'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'xls': 'application/vnd.ms-excel',
                'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'ppt': 'application/vnd.ms-powerpoint',
                'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                'odt': 'application/vnd.oasis.opendocument.text',
                'ods': 'application/vnd.oasis.opendocument.spreadsheet',
                'odp': 'application/vnd.oasis.opendocument.presentation',
                'csv': 'text/csv',
                'rtf': 'application/rtf',
                'pdf': 'application/pdf',
                'txt': 'text/plain',
            };
            res.setHeader('Content-Type', mimeTypes[ext || ''] || 'application/octet-stream');
        }

        if (fileStats.size) {
            res.setHeader('Content-Length', fileStats.size);
        }

        // Allow CORS for OnlyOffice server
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        fileStream.pipe(res);
    } catch (error) {
        console.error('Error downloading discussion file for OnlyOffice:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Check if discussion attachment is supported by OnlyOffice
export const checkDiscussionOnlyOfficeSupport = async (req: AuthRequest, res: Response) => {
    try {
        const messageId = req.params.messageId;
        
        if (!messageId) {
            return res.status(400).json({ message: 'Message ID is required' });
        }

        const message = await prisma.message.findUnique({
            where: { id: parseInt(messageId) },
            select: { id: true, attachment: true }
        });

        if (!message || !message.attachment) {
            return res.status(404).json({ message: 'Message or attachment not found' });
        }

        const ext = message.attachment.split('.').pop()?.toLowerCase() || '';
        const supportedExtensions = [
            'doc', 'docx', 'odt', 'rtf', 'txt',
            'xls', 'xlsx', 'ods', 'csv',
            'ppt', 'pptx', 'odp',
            'pdf' // Added PDF support
        ];

        const isSupported = supportedExtensions.includes(ext);

        res.json({
            supported: isSupported,
            extension: ext,
            mode: 'view' // Always view mode for discussion
        });
    } catch (error) {
        console.error('Error checking discussion OnlyOffice support:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ============== CHAT MESSAGE ONLYOFFICE SUPPORT ==============

// Check if chat message attachment is supported by OnlyOffice
export const checkChatOnlyOfficeSupport = async (req: AuthRequest, res: Response) => {
    try {
        const messageId = req.params.messageId;
        
        if (!messageId) {
            return res.status(400).json({ message: 'Message ID is required' });
        }

        const message = await prisma.chatMessage.findUnique({
            where: { id: parseInt(messageId) },
            select: { id: true, attachment: true }
        });

        if (!message || !message.attachment) {
            return res.status(404).json({ message: 'Message or attachment not found' });
        }

        const ext = message.attachment.split('.').pop()?.toLowerCase() || '';
        const supportedExtensions = [
            'doc', 'docx', 'odt', 'rtf', 'txt',
            'xls', 'xlsx', 'ods', 'csv',
            'ppt', 'pptx', 'odp',
            'pdf'
        ];

        const isSupported = supportedExtensions.includes(ext);

        res.json({
            supported: isSupported,
            extension: ext,
            mode: 'view'
        });
    } catch (error) {
        console.error('Error checking chat OnlyOffice support:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get OnlyOffice config for chat message attachment (view only)
export const getChatOnlyOfficeConfig = async (req: AuthRequest, res: Response) => {
    try {
        const messageId = req.params.messageId;
        const user = req.user;
        
        if (!messageId) {
            return res.status(400).json({ message: 'Message ID is required' });
        }

        if (!user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const message = await prisma.chatMessage.findUnique({
            where: { id: parseInt(messageId) },
            select: { 
                id: true, 
                attachment: true,
                conversationId: true
            }
        });

        if (!message || !message.attachment) {
            return res.status(404).json({ message: 'Message or attachment not found' });
        }

        // Verify user is participant of this conversation
        const participant = await prisma.conversationMember.findFirst({
            where: {
                conversationId: message.conversationId,
                userId: user.id
            }
        });

        if (!participant) {
            return res.status(403).json({ message: 'Not authorized to view this file' });
        }

        // Extract original filename
        let originalName = message.attachment.split('-').slice(1).join('-');
        if (message.attachment.includes('/')) {
            const pathParts = message.attachment.split('/');
            const fileName = pathParts[pathParts.length - 1] || '';
            originalName = fileName.split('-').slice(1).join('-');
        }
        
        try {
            originalName = decodeURIComponent(originalName);
        } catch {
            // If decoding fails, use as is
        }

        // Get file extension
        const ext = originalName.split('.').pop()?.toLowerCase() || '';
        
        // Determine document type
        let documentType: 'word' | 'cell' | 'slide' | 'pdf' = 'word';
        if (['xls', 'xlsx', 'ods', 'csv'].includes(ext)) {
            documentType = 'cell';
        } else if (['ppt', 'pptx', 'odp'].includes(ext)) {
            documentType = 'slide';
        } else if (ext === 'pdf') {
            documentType = 'pdf';
        }

        // Use backend proxy URL for file access
        const fileUrl = `${BACKEND_URL}/api/onlyoffice/chat/download/${messageId}`;

        const config = {
            document: {
                fileType: ext,
                key: `chat_${messageId}_${Date.now()}`,
                title: originalName,
                url: fileUrl,
            },
            documentType: documentType,
            editorConfig: {
                mode: 'view',
                lang: 'en',
                user: {
                    id: user.id.toString(),
                    name: 'User',
                },
                customization: {
                    chat: false,
                    comments: false,
                    compactHeader: false,
                    compactToolbar: false,
                    feedback: false,
                    forcesave: false,
                    help: false,
                    hideRightMenu: true,
                    toolbarNoTabs: false,
                    logo: {
                        image: '',
                        visible: false
                    }
                },
            },
        };

        // Sign the config with JWT
        const token = jwt.sign(config, ONLYOFFICE_JWT_SECRET);
        const signedConfig = { ...config, token };

        res.json({
            config: signedConfig,
            onlyofficeUrl: ONLYOFFICE_URL,
        });
    } catch (error) {
        console.error('Error generating chat OnlyOffice config:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Download chat attachment for OnlyOffice (no auth - OnlyOffice needs direct access)
export const downloadChatFileForOnlyOffice = async (req: Request, res: Response) => {
    try {
        const messageId = req.params.messageId;
        
        if (!messageId) {
            return res.status(400).json({ message: 'Message ID is required' });
        }

        const message = await prisma.chatMessage.findUnique({
            where: { id: parseInt(messageId) },
            select: { id: true, attachment: true }
        });

        if (!message || !message.attachment) {
            return res.status(404).json({ message: 'Message or attachment not found' });
        }
        
        const fileStream = await getFileStream(message.attachment);
        const fileStats = await getFileStats(message.attachment);

        // Extract original filename
        let originalName = message.attachment.split('-').slice(1).join('-');
        if (message.attachment.includes('/')) {
            const pathParts = message.attachment.split('/');
            const fileName = pathParts[pathParts.length - 1] || '';
            originalName = fileName.split('-').slice(1).join('-');
        }
        
        try {
            originalName = decodeURIComponent(originalName);
        } catch {
            // If decoding fails, use as is
        }

        // Encode filename for Content-Disposition header
        const encodedFilename = encodeURIComponent(originalName).replace(/'/g, "%27");
        const asciiFilename = originalName
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s.-]/g, '_')
            .replace(/\s+/g, '_');

        res.setHeader('Content-Disposition', `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`);
        
        if (fileStats.metaData && fileStats.metaData['content-type']) {
            res.setHeader('Content-Type', fileStats.metaData['content-type']);
        } else {
            const ext = originalName.split('.').pop()?.toLowerCase();
            const mimeTypes: Record<string, string> = {
                'doc': 'application/msword',
                'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'xls': 'application/vnd.ms-excel',
                'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'ppt': 'application/vnd.ms-powerpoint',
                'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                'odt': 'application/vnd.oasis.opendocument.text',
                'ods': 'application/vnd.oasis.opendocument.spreadsheet',
                'odp': 'application/vnd.oasis.opendocument.presentation',
                'csv': 'text/csv',
                'rtf': 'application/rtf',
                'pdf': 'application/pdf',
                'txt': 'text/plain',
            };
            res.setHeader('Content-Type', mimeTypes[ext || ''] || 'application/octet-stream');
        }

        if (fileStats.size) {
            res.setHeader('Content-Length', fileStats.size);
        }

        // Allow CORS for OnlyOffice server
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        fileStream.pipe(res);
    } catch (error) {
        console.error('Error downloading chat file for OnlyOffice:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
