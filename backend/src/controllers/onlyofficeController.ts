import type { Request, Response } from 'express';
import { Readable } from 'stream';
import type { AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../config/prisma.js';
import { isOfficeFile, getFileStream, getFileStats, getPresignedUrl } from '../services/minioService.js';
import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
import { getUserAuth } from './googleDriveController.js';

const JWT_SECRET = process.env.JWT_SECRET || '10122002';

// OnlyOffice JWT secret - MUST match the secret configured in OnlyOffice Document Server
const ONLYOFFICE_JWT_SECRET = process.env.ONLYOFFICE_JWT_SECRET || '10122002';

// Debug: Log that JWT secret is loaded (masked for security)
console.log('[OnlyOffice] JWT Secret loaded:', ONLYOFFICE_JWT_SECRET ? `${ONLYOFFICE_JWT_SECRET.substring(0, 3)}***${ONLYOFFICE_JWT_SECRET.substring(ONLYOFFICE_JWT_SECRET.length - 2)}` : 'NOT SET');
console.log('[OnlyOffice] Using env ONLYOFFICE_JWT_SECRET:', !!process.env.ONLYOFFICE_JWT_SECRET);

const ONLYOFFICE_URL = process.env.ONLYOFFICE_URL || 'https://jtsconlyoffice.duckdns.org';
const BACKEND_URL = process.env.BACKEND_URL || 'https://jtscapi.duckdns.org/api';

// Function to sign OnlyOffice config with JWT
// OnlyOffice Document Server requires this if JWT is enabled
const signOnlyOfficeConfig = (payload: any): string => {
    // Create a clean copy of payload for signing
    // OnlyOffice expects the token to contain the same structure as config
    const payloadToSign = JSON.parse(JSON.stringify(payload));

    // Remove token field if it exists (we're creating the token)
    delete payloadToSign.token;

    console.log('[OnlyOffice JWT] Signing payload with secret:', ONLYOFFICE_JWT_SECRET.substring(0, 3) + '***');
    console.log('[OnlyOffice JWT] Payload keys:', Object.keys(payloadToSign));

    const token = jwt.sign(payloadToSign, ONLYOFFICE_JWT_SECRET, {
        algorithm: 'HS256',
        noTimestamp: false  // Include iat claim
    });

    console.log('[OnlyOffice JWT] Token created, length:', token.length);
    return token;
};

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

// JWT token generation removed - OnlyOffice JWT disabled

// Get OnlyOffice editor configuration for a project attachment
// Get OnlyOffice editor configuration for a project attachment
export const getOnlyOfficeConfig = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;

        // Fetch attachment with project details for permission checking
        const attachment = await prisma.projectAttachment.findUnique({
            where: { id: Number(id) },
            include: {
                project: {
                    include: {
                        implementers: { select: { id: true } },
                        followers: { select: { id: true } },
                        manager: { select: { id: true } },
                    }
                }
            }
        });

        if (!attachment) {
            return res.status(404).json({ message: 'Attachment not found' });
        }

        const project = attachment.project;

        // Check if it's an Office file
        if (!isOfficeFile(attachment.name)) {
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

        // Use backend download endpoint instead of presigned URL (OnlyOffice server may not be able to access MinIO directly)
        const fileUrl = `${BACKEND_URL}/onlyoffice/download/${attachment.id}`;

        // Use original filename
        let originalName = attachment.name;

        // Decode the filename if it was encoded (just in case)
        try {
            originalName = decodeURIComponent(originalName);
        } catch {
            // If decoding fails, use as is
        }

        console.log('[OnlyOffice Project] Attachment Key:', attachment.minioPath);
        console.log('[OnlyOffice Project] Name:', originalName);

        const documentType = getDocumentType(originalName);
        const fileType = getFileType(originalName);

        // Create unique document key based on attachment id and updated timestamp
        // This ensures that when the file is updated, a new key is generated, forcing a fresh session
        const documentKey = `attachment_${attachment.id}_${attachment.updatedAt.getTime()}`;

        // JWT Payload
        const jwtPayload = {
            document: {
                fileType: fileType,
                key: documentKey,
                title: originalName,
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
            editorConfig: {
                callbackUrl: `${BACKEND_URL}/onlyoffice/callback/${attachment.id}`,
                lang: 'en',
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
                    compactHeader: true,
                    compactToolbar: true,
                    toolbarNoTabs: true,
                    toolbarHideFileName: true,
                    hideRightMenu: true,
                    leftMenu: true,
                    rightMenu: true,
                    statusBar: true,
                    plugins: true,
                    spellcheck: true,
                    unit: 'cm',
                    zoom: 100,
                    help: true,
                    feedback: false,
                    goback: false,
                    mentionShare: true,
                },
            },
        };

        const token = signOnlyOfficeConfig(jwtPayload);

        const signedConfig = {
            ...jwtPayload,
            documentType: documentType,
            height: '100%',
            width: '100%',
            type: 'desktop',
            token: token
        };

        res.json({
            config: signedConfig,
            onlyofficeUrl: ONLYOFFICE_URL,
            canEdit,
        });
    } catch (error) {
        console.error('Error getting OnlyOffice config:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Callback endpoint for OnlyOffice - handles document saving
// Callback endpoint for OnlyOffice - handles document saving
export const onlyofficeCallback = async (req: AuthRequest, res: Response) => {
    // Set CORS headers immediately
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    try {
        const { id } = req.params;
        const { status, url } = req.body;

        // ==================== DEBUG LOGGING ====================
        console.log(`\n[Callback] Attachment ID: ${id}, Status: ${status}, URL: ${url ? 'Provided' : 'None'}`);
        // ==================== END DEBUG ====================

        // Status 2 or 6 means document needs to be saved
        if (status === 2 || status === 6) {
            try {
                // Find attachment
                const attachment = await prisma.projectAttachment.findUnique({
                    where: { id: Number(id) },
                });

                if (!attachment) {
                    console.error('Attachment not found for callback');
                    return res.json({ error: 0 });
                }

                if (!url) {
                    console.error('No download URL provided by OnlyOffice');
                    return res.json({ error: 1 });
                }

                // Download the edited file from OnlyOffice
                const response = await fetch(url);
                if (!response.ok) {
                    console.error('Failed to download edited file from OnlyOffice');
                    return res.json({ error: 1 });
                }

                const buffer = Buffer.from(await response.arrayBuffer());

                // Import uploadFile dynamically
                const { minioClient, bucketName } = await import('../config/minio.js');

                // Upload the updated file back to MinIO with the same path
                await minioClient.putObject(bucketName, attachment.minioPath, buffer);

                // Update attachment timestamp (and size if possible)
                // Also update Project's updatedAt to reflect activity
                await prisma.$transaction([
                    prisma.projectAttachment.update({
                        where: { id: attachment.id },
                        data: {
                            updatedAt: new Date(),
                            fileSize: buffer.length
                        }
                    }),
                    prisma.project.update({
                        where: { id: attachment.projectId },
                        data: { updatedAt: new Date() }
                    })
                ]);

                console.log(`File saved successfully: ${attachment.minioPath}`);
            } catch (saveError) {
                console.error('Error saving file to MinIO or DB:', saveError);
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
// Check if a file can be opened with OnlyOffice
export const checkOnlyOfficeSupport = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const attachment = await prisma.projectAttachment.findUnique({
            where: { id: Number(id) },
        });

        if (!attachment) {
            return res.status(404).json({
                supported: false,
                message: 'Attachment not found'
            });
        }

        const supported = isOfficeFile(attachment.name);
        res.json({
            supported,
            fileName: attachment.name,
            documentType: supported ? getDocumentType(attachment.name) : null,
            onlyofficeUrl: ONLYOFFICE_URL,
        });
    } catch (error) {
        console.error('Error checking OnlyOffice support:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Download file for OnlyOffice - this endpoint is called by OnlyOffice server
// No auth required as OnlyOffice server needs to access it directly
// Download file for OnlyOffice - this endpoint is called by OnlyOffice server
// No auth required as OnlyOffice server needs to access it directly
export const downloadFileForOnlyOffice = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        console.log('[OnlyOffice Download] Request for attachment:', id);

        // Set CORS headers immediately
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        const attachment = await prisma.projectAttachment.findUnique({
            where: { id: Number(id) },
        });

        if (!attachment) {
            console.log('[OnlyOffice Download] Attachment not found:', id);
            return res.status(404).json({ message: 'Attachment not found' });
        }

        console.log('[OnlyOffice Download] Attachment path:', attachment.minioPath);

        // Stream file directly instead of redirecting to presigned URL
        const { getFileStream, getFileStats } = await import('../services/minioService.js');
        const fileStream = await getFileStream(attachment.minioPath);
        const fileStats = await getFileStats(attachment.minioPath);

        // Set headers
        const encodedFilename = encodeURIComponent(attachment.name).replace(/'/g, "%27");
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
        res.setHeader('Content-Type', fileStats.metaData?.['content-type'] || 'application/octet-stream');
        if (fileStats.size) {
            res.setHeader('Content-Length', fileStats.size);
        }
        res.setHeader('Access-Control-Allow-Origin', '*');

        console.log('[OnlyOffice Download] Streaming file');
        fileStream.pipe(res);
    } catch (error: any) {
        console.error('[OnlyOffice Download] Error:', error?.message || error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Server error', error: error?.message });
        }
    }
};

// ============== GOOGLE DRIVE ONLYOFFICE SUPPORT ==============

// Get OnlyOffice config for Google Drive file
export const getGoogleDriveOnlyOfficeConfig = async (req: AuthRequest, res: Response) => {
    try {
        const { fileId } = req.params;
        const userId = req.user?.id;

        if (!fileId) return res.status(400).json({ error: 'File ID is required' });
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const auth = await getUserAuth(userId);
        if (!auth) return res.status(400).json({ error: 'Google Drive not connected' });

        const drive = google.drive({ version: 'v3', auth });

        // Get file metadata
        const fileMetadata = await drive.files.get({
            fileId: fileId,
            fields: 'name, mimeType'
        });

        let name = fileMetadata.data.name || 'document.docx';
        const mimeType = fileMetadata.data.mimeType || '';
        let isGoogleDoc = false;
        let exportMimeType = '';

        // Adjust name/type for Google Docs
        if (mimeType === 'application/vnd.google-apps.document') {
            name += '.docx';
            exportMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            isGoogleDoc = true;
        } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
            name += '.xlsx';
            exportMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            isGoogleDoc = true;
        } else if (mimeType === 'application/vnd.google-apps.presentation') {
            name += '.pptx';
            exportMimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
            isGoogleDoc = true;
        }

        const docType = getDocumentType(name);
        const fileType = getFileType(name);

        // Build object name for MinIO cache
        const ext = name.split('.').pop() || '';
        const safeName = `document.${ext}`;
        const objectName = `temp/drive/${fileId}/${safeName}`;

        // Check if file is already cached in MinIO (within 10 minutes)
        const { minioClient, bucketName } = await import('../config/minio.js');
        let useCached = false;

        try {
            const stat = await minioClient.statObject(bucketName, objectName);
            const cacheAge = Date.now() - new Date(stat.lastModified).getTime();
            const cacheMaxAge = 10 * 60 * 1000; // 10 minutes

            if (cacheAge < cacheMaxAge) {
                console.log(`[OnlyOffice Drive] Using cached file (age: ${Math.round(cacheAge / 1000)}s)`);
                useCached = true;
            } else {
                console.log(`[OnlyOffice Drive] Cache expired (age: ${Math.round(cacheAge / 1000)}s), re-downloading`);
            }
        } catch (e) {
            console.log(`[OnlyOffice Drive] No cache found, downloading from Google Drive`);
        }

        // Download from Google Drive only if not cached
        if (!useCached) {
            let fileBuffer: Buffer;
            if (isGoogleDoc) {
                const response = await drive.files.export({
                    fileId: fileId,
                    mimeType: exportMimeType
                }, { responseType: 'arraybuffer' });
                fileBuffer = Buffer.from(response.data as unknown as ArrayBuffer);
            } else {
                const response = await drive.files.get({
                    fileId: fileId,
                    alt: 'media',
                    acknowledgeAbuse: true
                }, { responseType: 'arraybuffer' });
                fileBuffer = Buffer.from(response.data as unknown as ArrayBuffer);
            }

            if (!fileBuffer || fileBuffer.length === 0) {
                throw new Error('Downloaded file is empty');
            }

            console.log(`[OnlyOffice Drive] Downloaded from Drive. Size: ${fileBuffer.length}`);

            // Upload to MinIO cache
            await minioClient.putObject(bucketName, objectName, fileBuffer, fileBuffer.length, {
                'Content-Type': isGoogleDoc ? exportMimeType : mimeType,
                'X-Amz-Meta-Original-Filename': encodeURIComponent(name)
            });
            console.log(`[OnlyOffice Drive] Cached to MinIO: ${objectName}`);
        }
        console.log(`[OnlyOffice Drive] Uploaded cache to MinIO: ${objectName}`);

        // Use backend download endpoint instead of presigned URL for JWT compatibility
        const fileUrl = `${BACKEND_URL}/onlyoffice/drive/download/${fileId}`;
        console.log(`[OnlyOffice Drive] Using backend download URL: ${fileUrl}`);

        const documentKey = `drive_${fileId}_${Date.now()}`; // Unique session key

        // JWT Payload - only include what OnlyOffice expects to be signed
        const jwtPayload = {
            document: {
                fileType,
                key: documentKey,
                title: name,
                url: fileUrl,
                permissions: {
                    download: true,
                    edit: true,
                    print: true,
                    review: true,
                    comment: true,
                    copy: true,
                },
            },
            editorConfig: {
                callbackUrl: `${BACKEND_URL}/onlyoffice/save?type=drive&fileId=${fileId}&userId=${userId}`,
                mode: 'edit',
                lang: 'en',
                user: {
                    id: userId.toString(),
                    name: 'User',
                },
                customization: {
                    // Auto save settings
                    autosave: true,
                    forcesave: true,

                    // Collaboration features
                    chat: true,
                    comments: true,
                    // review is configured below with trackChanges settings

                    // UI Layout - Full featured like Word
                    compactHeader: false,
                    compactToolbar: false,
                    toolbarNoTabs: false,
                    toolbarHideFileName: false,
                    hideRightMenu: false,
                    leftMenu: true,
                    rightMenu: true,
                    statusBar: true,

                    // Advanced features
                    plugins: true,
                    macros: true,
                    macrosMode: 'warn',
                    spellcheck: true,

                    // Display settings
                    unit: 'cm',
                    zoom: 100,

                    // Help and feedback
                    help: true,
                    feedback: false,
                    goback: false,
                    mentionShare: true,

                    // Review/Track changes settings
                    trackChanges: false,
                    showReviewChanges: false,

                    // Features
                    features: {
                        spellcheck: {
                            mode: true,
                            change: true,
                        },
                    },
                },
            },
        };

        // Sign the payload
        const token = signOnlyOfficeConfig(jwtPayload);

        // Full config for frontend
        const signedConfig = {
            ...jwtPayload,
            documentType: docType,
            height: '100%',
            width: '100%',
            type: 'desktop',
            token: token
        };

        console.log('[OnlyOffice Drive] Config generated for file:', fileId);
        console.log('[OnlyOffice Drive] JWT token generated:', token.substring(0, 50) + '...');

        res.json({
            config: signedConfig,
            onlyofficeUrl: ONLYOFFICE_URL,
        });

    } catch (error: any) {
        console.error('Error getting Google Drive OnlyOffice config:', error?.message || error);
        res.status(500).json({ error: 'Failed to generate config', details: error?.message });
    }
};

// Download Google Drive file for OnlyOffice (uses temp token)
export const downloadDriveFileForOnlyOffice = async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;
        const { token } = req.query;

        console.log(`[OnlyOffice Drive] Download request for file: ${fileId}`);

        if (!fileId || !token) {
            console.error('[OnlyOffice Drive] Missing fileId or token');
            return res.status(400).json({ error: 'Missing parameters' });
        }

        const tokenStr = String(token);
        console.log(`[OnlyOffice Drive] Verifying token: ${tokenStr.substring(0, 10)}...`);

        // Verify token
        let decoded: any;
        try {
            decoded = jwt.verify(tokenStr, JWT_SECRET);
            console.log('[OnlyOffice Drive] Token verified for user:', decoded.userId);
        } catch (e) {
            console.error('[OnlyOffice Drive] Token verification failed:', e);
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        if (decoded.fileId !== fileId || decoded.type !== 'drive_onlyoffice') {
            return res.status(403).json({ error: 'Invalid token claim' });
        }

        const userId = Number(decoded.userId);
        const auth = await getUserAuth(userId);
        if (!auth) {
            console.error(`[OnlyOffice Drive] No Drive auth found for user ${userId}`);
            return res.status(400).json({ error: 'Google Drive not connected' });
        }

        const drive = google.drive({ version: 'v3', auth });

        // Get metadata
        console.log('[OnlyOffice Drive] Fetching metadata...');
        const fileMetadata = await drive.files.get({
            fileId: fileId,
            fields: 'name, mimeType, size'
        });

        const originalName = fileMetadata.data.name || 'download';
        const originalMimeType = fileMetadata.data.mimeType || 'application/octet-stream';
        const originalSize = fileMetadata.data.size;

        console.log(`[OnlyOffice Drive] Found file: ${originalName} (${originalMimeType})`);

        let mimeType = originalMimeType;
        let name = originalName;
        let isGoogleDoc = false;

        // Map Google Apps types to export types
        if (originalMimeType === 'application/vnd.google-apps.document') {
            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            name = `${originalName}.docx`;
            isGoogleDoc = true;
        } else if (originalMimeType === 'application/vnd.google-apps.spreadsheet') {
            mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            name = `${originalName}.xlsx`;
            isGoogleDoc = true;
        } else if (originalMimeType === 'application/vnd.google-apps.presentation') {
            mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
            name = `${originalName}.pptx`;
            isGoogleDoc = true;
        }

        // Encode filename for Content-Disposition header (RFC 5987)
        const encodedFilename = encodeURIComponent(name).replace(/'/g, "%27");
        const asciiFilename = name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s.-]/g, '_')
            .replace(/\s+/g, '_');

        // Set headers
        res.setHeader('Content-Disposition', `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        // Pass Content-Length if available and not converting
        // COMMENTED OUT: Content-Length can cause issues if it doesn't match exactly with the stream (e.g. gzipped)
        // OnlyOffice handles chunked transfer fine.
        /* if (!isGoogleDoc && originalSize) {
            res.setHeader('Content-Length', originalSize);
        } */

        let fileBuffer: Buffer;

        if (isGoogleDoc) {
            // Export file
            const response = await drive.files.export({
                fileId: fileId,
                mimeType: mimeType
            }, { responseType: 'arraybuffer' });
            fileBuffer = Buffer.from(response.data as unknown as ArrayBuffer);
        } else {
            // Download normal file
            const response = await drive.files.get({
                fileId: fileId,
                alt: 'media',
                acknowledgeAbuse: true
            }, { responseType: 'arraybuffer' });
            fileBuffer = Buffer.from(response.data as unknown as ArrayBuffer);
        }

        console.log(`[OnlyOffice Drive] Downloaded buffer size: ${fileBuffer.length}`);

        // precise content length
        res.setHeader('Content-Length', fileBuffer.length);
        res.send(fileBuffer);

    } catch (error: any) {
        console.error('OnlyOffice Drive Download Error:', error?.message || error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to download file', details: error?.message });
        }
    }
};

// Callback for Google Drive OnlyOffice - save changes back to Drive
export const onlyofficeDriveCallback = async (req: Request, res: Response) => {
    try {
        const { fileId } = req.params;
        const { status, url, users } = req.body;
        const { userId } = req.query;

        if (!fileId) {
            return res.json({ error: 1, message: 'Missing fileId' });
        }

        console.log(`[OnlyOffice Drive Callback] File: ${fileId}, Status: ${status}, User: ${userId}`);

        // Status 2 (Ready for saving) or 6 (Force save)
        if (status === 2 || status === 6) {
            if (!userId) {
                console.error('[OnlyOffice Drive Callback] Missing userId in query params');
                return res.json({ error: 1, message: 'Missing userId' });
            }

            if (!url) {
                console.error('[OnlyOffice Drive Callback] Missing download URL');
                return res.json({ error: 1, message: 'Missing URL' });
            }

            // 1. Download edited file from OnlyOffice
            const fileResponse = await fetch(url);
            if (!fileResponse.ok) {
                throw new Error('Failed to download file from OnlyOffice');
            }
            const arrayBuffer = await fileResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // 2. Upload to Google Drive
            const auth = await getUserAuth(Number(userId));
            if (!auth) {
                console.error('[OnlyOffice Drive Callback] Google Auth failed for user', userId);
                return res.json({ error: 1, message: 'Google Auth failed' });
            }

            const drive = google.drive({ version: 'v3', auth });

            // Update file content
            await drive.files.update({
                fileId: fileId,
                media: {
                    mimeType: fileResponse.headers.get('content-type') || 'application/octet-stream',
                    body: Readable.from(buffer)
                }
            });

            console.log(`[OnlyOffice Drive Callback] Successfully updated file ${fileId} on Google Drive`);
        }

        res.json({ error: 0 });
    } catch (error: any) {
        console.error('[OnlyOffice Drive Callback] Error:', error);
        res.json({ error: 1, message: error.message || 'Server error' });
    }
};

// Unified Save Callback Handler
export const handleGeneralSave = async (req: Request, res: Response) => {
    try {
        const { type, fileId, userId, id } = req.query;

        console.log('[OnlyOffice General Save] Query:', req.query);

        if (type === 'drive') {
            // Mock request object to reuse existing handler
            const mockReq = {
                ...req,
                params: { fileId: String(fileId) },
                query: { userId: String(userId) },
                body: req.body
            } as unknown as Request;

            return onlyofficeDriveCallback(mockReq, res);
        }

        // Handle project files (if we switch them to this route too)
        if (id) {
            const mockReq = {
                ...req,
                params: { id: String(id) },
                body: req.body
            } as unknown as AuthRequest;
            return onlyofficeCallback(mockReq, res);
        }

        console.error('[OnlyOffice General Save] Unknown save type or missing parameters');
        res.json({ error: 1, message: 'Invalid parameters' });

    } catch (error: any) {
        console.error('[OnlyOffice General Save] Error:', error);
        res.json({ error: 1, message: 'Server error' });
    }
};

// Save a copy of Google Drive file
export const saveAsGoogleDriveFile = async (req: AuthRequest, res: Response) => {
    try {
        const { fileId } = req.params;
        const { title, parentId } = req.body;
        const userId = req.user?.id;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!fileId) return res.status(400).json({ error: 'File ID is required' });

        const auth = await getUserAuth(userId);
        if (!auth) return res.status(400).json({ error: 'Google Drive not connected' });

        const drive = google.drive({ version: 'v3', auth });

        const requestBody: any = {
            name: title || undefined
        };
        if (parentId) {
            requestBody.parents = [parentId];
        }

        // Copy the file
        const result = await drive.files.copy({
            fileId: fileId,
            requestBody: requestBody
        });

        res.json({
            error: 0,
            file: result.data
        });
    } catch (error: any) {
        console.error('Error saving copy to Google Drive:', error);
        res.status(500).json({ error: 'Failed to save copy', message: error.message });
    }
};

// Save a copy of Google Drive file to System
export const saveDriveFileToSystem = async (req: AuthRequest, res: Response) => {
    try {
        const { fileId } = req.params;
        const { title, parentId } = req.body; // parentId here is System Folder ID
        const userId = req.user?.id;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        if (!fileId) return res.status(400).json({ error: 'File ID is required' });

        // 1. Get Google Auth & Check Metadata
        const auth = await getUserAuth(userId);
        if (!auth) return res.status(400).json({ error: 'Google Drive not connected' });
        const drive = google.drive({ version: 'v3', auth });

        // Get Metadata first
        const meta = await drive.files.get({
            fileId,
            fields: 'name, mimeType, size'
        });

        const originalMimeType = meta.data.mimeType || '';
        let downloadName = title || meta.data.name || `drive_file_${fileId}`;

        let buffer: Buffer;

        // Check if it's a Google Doc/Sheet/Slide
        if (originalMimeType.startsWith('application/vnd.google-apps.')) {
            let exportMimeType = 'application/pdf'; // Fallback
            if (originalMimeType.includes('document')) {
                exportMimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                if (!downloadName.endsWith('.docx')) downloadName += '.docx';
            } else if (originalMimeType.includes('spreadsheet')) {
                exportMimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                if (!downloadName.endsWith('.xlsx')) downloadName += '.xlsx';
            } else if (originalMimeType.includes('presentation')) {
                exportMimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
                if (!downloadName.endsWith('.pptx')) downloadName += '.pptx';
            }

            const response = await drive.files.export({
                fileId: fileId,
                mimeType: exportMimeType
            }, { responseType: 'arraybuffer' });
            buffer = Buffer.from(response.data as unknown as ArrayBuffer);

        } else {
            // Normal file
            if (!downloadName.includes('.') && meta.data.name?.includes('.')) {
                downloadName += '.' + meta.data.name.split('.').pop();
            }

            const response = await drive.files.get({
                fileId: fileId,
                alt: 'media'
            }, { responseType: 'arraybuffer' });
            buffer = Buffer.from(response.data as unknown as ArrayBuffer);
        }

        // 2. Prepare System Path
        // Import needed modules dynamic or static
        const { minioClient, bucketName } = await import('../config/minio.js');
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        let minioPath = `users/${user.username.charAt(0).toUpperCase() + user.username.slice(1)}`;
        let folderId: number | null = null; // System folder ID

        if (parentId) {
            folderId = parseInt(parentId);
            const folder = await prisma.userFolder.findUnique({ where: { id: folderId } });
            if (folder && folder.userId === userId) {
                minioPath = folder.minioPath;
            }
        }

        minioPath = `${minioPath}/${downloadName}`;

        // 3. Upload to MinIO
        await minioClient.putObject(bucketName, minioPath, buffer, buffer.length);

        // 4. Create UserFile Record
        const newFile = await prisma.userFile.create({
            data: {
                name: downloadName,
                minioPath: minioPath,
                fileType: 'application/octet-stream', // Could detect better
                fileSize: buffer.length,
                userId: userId,
                folderId: folderId
            }
        });

        res.json({ error: 0, file: newFile });

    } catch (error: any) {
        console.error('Error saving Drive file to System:', error);
        res.status(500).json({ error: 'Failed to save to system', message: error.message });
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
        const BACKEND_URL = process.env.BACKEND_URL || 'https://jtscapi.duckdns.org/api';

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

        // Extract original filename from attachment path
        // Path format could be: "discussions/123/filename.ext" or "discussions/123/timestamp-filename.ext"
        let originalName = message.attachment;

        // Get the last part after the last slash
        if (message.attachment.includes('/')) {
            const pathParts = message.attachment.split('/');
            originalName = pathParts[pathParts.length - 1] || message.attachment;
        }

        // If filename starts with timestamp (number followed by dash), remove it
        // Pattern: 1702728000000-filename.ext
        const timestampPattern = /^\d{10,}-/;
        if (timestampPattern.test(originalName)) {
            originalName = originalName.replace(timestampPattern, '');
        }

        try {
            originalName = decodeURIComponent(originalName);
        } catch {
            // If decoding fails, use as is
        }

        // Make sure we have a valid filename with extension
        if (!originalName || !originalName.includes('.')) {
            // Fallback: get extension from original attachment path
            originalName = message.attachment.split('/').pop() || 'document.docx';
        }

        // Get file extension - must come from the actual filename
        const ext = originalName.split('.').pop()?.toLowerCase() || '';

        console.log('[OnlyOffice Discussion] Attachment:', message.attachment);
        console.log('[OnlyOffice Discussion] Extracted name:', originalName);
        console.log('[OnlyOffice Discussion] Extension:', ext);

        // Determine document type based on extension
        let documentType: 'word' | 'cell' | 'slide' | 'pdf' = 'word';
        const cellExtensions = ['xls', 'xlsx', 'xlsm', 'xlt', 'xltx', 'xltm', 'ods', 'fods', 'ots', 'csv'];
        const slideExtensions = ['ppt', 'pptx', 'pptm', 'pot', 'potx', 'potm', 'odp', 'fodp', 'otp'];

        if (cellExtensions.includes(ext)) {
            documentType = 'cell';
        } else if (slideExtensions.includes(ext)) {
            documentType = 'slide';
        } else if (ext === 'pdf') {
            documentType = 'pdf';
        }

        // Use backend download endpoint instead of presigned URL (OnlyOffice server may not be able to access MinIO directly)
        const fileUrl = `${BACKEND_URL}/onlyoffice/discussion/download/${messageId}`;

        // JWT Payload for signing
        const jwtPayload = {
            document: {
                fileType: ext,
                key: `discussion_${messageId}_${Date.now()}`,
                title: originalName,
                url: fileUrl,
            },
            editorConfig: {
                mode: 'view',
                lang: 'en',
                user: {
                    id: user.id.toString(),
                    name: user.name,
                },
                customization: {
                    // View mode settings - no editing features but full viewing
                    chat: false,
                    comments: true, // Allow viewing comments
                    review: false,

                    // UI Layout - Full featured for viewing
                    compactHeader: false,
                    compactToolbar: false,
                    toolbarNoTabs: false,
                    toolbarHideFileName: false,
                    hideRightMenu: false,
                    leftMenu: true,
                    rightMenu: true,
                    statusBar: true,

                    // Advanced features for viewing
                    plugins: true,
                    spellcheck: true,

                    // Display settings
                    unit: 'cm',
                    zoom: 100,

                    // Help
                    help: true,
                    feedback: false,
                    goback: false,
                },
            },
        };

        // Sign the payload
        const token = signOnlyOfficeConfig(jwtPayload);

        // Full config for frontend
        const signedConfig = {
            ...jwtPayload,
            documentType: documentType,
            height: '100%',
            width: '100%',
            type: 'desktop',
            token: token
        };

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
        // Full list of supported Office extensions
        const supportedExtensions = [
            // Microsoft Word
            'doc', 'docx', 'docm', 'dot', 'dotx', 'dotm', 'odt', 'fodt', 'ott', 'rtf', 'txt',
            // Microsoft Excel
            'xls', 'xlsx', 'xlsm', 'xlt', 'xltx', 'xltm', 'ods', 'fods', 'ots', 'csv',
            // Microsoft PowerPoint
            'ppt', 'pptx', 'pptm', 'pot', 'potx', 'potm', 'odp', 'fodp', 'otp',
            // PDF
            'pdf'
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
        // Full list of supported Office extensions
        const supportedExtensions = [
            // Microsoft Word
            'doc', 'docx', 'docm', 'dot', 'dotx', 'dotm', 'odt', 'fodt', 'ott', 'rtf', 'txt',
            // Microsoft Excel
            'xls', 'xlsx', 'xlsm', 'xlt', 'xltx', 'xltm', 'ods', 'fods', 'ots', 'csv',
            // Microsoft PowerPoint
            'ppt', 'pptx', 'pptm', 'pot', 'potx', 'potm', 'odp', 'fodp', 'otp',
            // PDF
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

        // Extract original filename from attachment path
        // Path format could be: "chat/123/filename.ext" or "chat/123/timestamp-filename.ext"
        let originalName = message.attachment;

        // Get the last part after the last slash
        if (message.attachment.includes('/')) {
            const pathParts = message.attachment.split('/');
            originalName = pathParts[pathParts.length - 1] || message.attachment;
        }

        // If filename starts with timestamp (number followed by dash), remove it
        // Pattern: 1702728000000-filename.ext
        const timestampPattern = /^\d{10,}-/;
        if (timestampPattern.test(originalName)) {
            originalName = originalName.replace(timestampPattern, '');
        }

        try {
            originalName = decodeURIComponent(originalName);
        } catch {
            // If decoding fails, use as is
        }

        // Make sure we have a valid filename with extension
        if (!originalName || !originalName.includes('.')) {
            // Fallback: get extension from original attachment path
            originalName = message.attachment.split('/').pop() || 'document.docx';
        }

        // Get file extension - must come from the actual filename
        const ext = originalName.split('.').pop()?.toLowerCase() || '';

        console.log('[OnlyOffice Chat] Attachment:', message.attachment);
        console.log('[OnlyOffice Chat] Extracted name:', originalName);
        console.log('[OnlyOffice Chat] Extension:', ext);

        // Determine document type based on extension
        let documentType: 'word' | 'cell' | 'slide' | 'pdf' = 'word';
        const cellExtensions = ['xls', 'xlsx', 'xlsm', 'xlt', 'xltx', 'xltm', 'ods', 'fods', 'ots', 'csv'];
        const slideExtensions = ['ppt', 'pptx', 'pptm', 'pot', 'potx', 'potm', 'odp', 'fodp', 'otp'];

        if (cellExtensions.includes(ext)) {
            documentType = 'cell';
        } else if (slideExtensions.includes(ext)) {
            documentType = 'slide';
        } else if (ext === 'pdf') {
            documentType = 'pdf';
        }

        // Use backend download endpoint instead of presigned URL (OnlyOffice server may not be able to access MinIO directly)
        const fileUrl = `${BACKEND_URL}/onlyoffice/chat/download/${messageId}`;

        // JWT Payload for signing
        const jwtPayload = {
            document: {
                fileType: ext,
                key: `chat_${messageId}_${Date.now()}`,
                title: originalName,
                url: fileUrl,
            },
            editorConfig: {
                mode: 'view',
                lang: 'en',
                user: {
                    id: user.id.toString(),
                    name: 'User',
                },
                customization: {
                    // View mode settings - no editing features but full viewing
                    chat: false,
                    comments: true, // Allow viewing comments
                    review: false,

                    // UI Layout - Full featured for viewing
                    compactHeader: false,
                    compactToolbar: false,
                    toolbarNoTabs: false,
                    toolbarHideFileName: false,
                    hideRightMenu: false,
                    leftMenu: true,
                    rightMenu: true,
                    statusBar: true,

                    // Advanced features for viewing
                    plugins: true,
                    spellcheck: true,

                    // Display settings
                    unit: 'cm',
                    zoom: 100,

                    // Help
                    help: true,
                    feedback: false,
                    goback: false,
                },
            },
        };

        // Sign the payload
        const token = signOnlyOfficeConfig(jwtPayload);

        // Full config for frontend
        const signedConfig = {
            ...jwtPayload,
            documentType: documentType,
            height: '100%',
            width: '100%',
            type: 'desktop',
            token: token
        };

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

// ==================== KANBAN ATTACHMENT ONLYOFFICE ====================

export const checkKanbanOnlyOfficeSupport = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const attachment = await prisma.kanbanAttachment.findUnique({
            where: { id: Number(id) },
        });

        if (!attachment) {
            return res.status(404).json({
                supported: false,
                message: 'Attachment not found'
            });
        }

        const supported = isOfficeFile(attachment.fileName);
        res.json({
            supported,
            fileName: attachment.fileName,
            documentType: supported ? getDocumentType(attachment.fileName) : null,
            onlyofficeUrl: ONLYOFFICE_URL,
        });
    } catch (error) {
        console.error('Error checking Kanban OnlyOffice support:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getKanbanOnlyOfficeConfig = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        const attachment = await prisma.kanbanAttachment.findUnique({
            where: { id: Number(id) },
            include: {
                card: {
                    include: {
                        list: {
                            include: {
                                board: { include: { members: true } }
                            }
                        }
                    }
                }
            }
        });

        if (!attachment) {
            return res.status(404).json({ message: 'Attachment not found' });
        }

        if (!isOfficeFile(attachment.fileName)) {
            return res.status(400).json({ message: 'File is not an Office document' });
        }

        // Check board membership
        const board = attachment.card.list.board;
        const isMember = board.members.some(m => m.userId === userId) || board.ownerId === userId;
        if (!isMember) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const fileUrl = `${BACKEND_URL}/onlyoffice/kanban/download/${attachment.id}`;
        const originalName = attachment.fileName;
        const documentType = getDocumentType(originalName);
        const fileType = getFileType(originalName);
        const documentKey = `kanban_${attachment.id}_${attachment.createdAt.getTime()}`;

        const jwtPayload = {
            document: {
                fileType,
                key: documentKey,
                title: originalName,
                url: fileUrl,
                permissions: {
                    download: true,
                    edit: false,
                    print: true,
                    review: false,
                    comment: false,
                    copy: true,
                },
            },
            editorConfig: {
                lang: 'vi',
                mode: 'view',
                user: {
                    id: userId?.toString() || 'anonymous',
                    name: 'User',
                },
                customization: {
                    autosave: false,
                    forcesave: false,
                    compactHeader: true,
                    compactToolbar: true,
                    toolbarNoTabs: true,
                    toolbarHideFileName: true,
                    hideRightMenu: true,
                    help: false,
                    feedback: false,
                    goback: false,
                },
            },
        };

        const token = signOnlyOfficeConfig(jwtPayload);

        const signedConfig = {
            ...jwtPayload,
            documentType,
            height: '100%',
            width: '100%',
            type: 'desktop',
            token
        };

        res.json({
            config: signedConfig,
            onlyofficeUrl: ONLYOFFICE_URL,
            canEdit: false,
        });
    } catch (error) {
        console.error('Error getting Kanban OnlyOffice config:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
