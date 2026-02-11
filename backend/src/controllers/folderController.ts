import type { Response } from 'express';
import * as fs from 'fs';
import type { AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../config/prisma.js';
import { minioClient, bucketName } from '../config/minio.js';
import { Readable } from 'stream';
import type { UserFolder, UserFolderShare } from '@prisma/client';
import { isOfficeFile, getPresignedUrl } from '../services/minioService.js';
import jwt from 'jsonwebtoken';

const userFolderPrefix = 'users/';
const ONLYOFFICE_URL = process.env.ONLYOFFICE_URL || 'https://jtsconlyoffice.duckdns.org';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001/api';
const ONLYOFFICE_JWT_SECRET = process.env.ONLYOFFICE_JWT_SECRET || '10122002';

// Function to sign OnlyOffice config with JWT
const signOnlyOfficeConfig = (payload: any): string => {
    const payloadToSign = JSON.parse(JSON.stringify(payload));
    delete payloadToSign.token;
    return jwt.sign(payloadToSign, ONLYOFFICE_JWT_SECRET, { algorithm: 'HS256' });
};

// Helper: Get username-based folder path
const getUserFolderPath = (username: string): string => {
    // Capitalize first letter of username for folder name
    const folderName = username.charAt(0).toUpperCase() + username.slice(1);
    return `${userFolderPrefix}${folderName}`;
};

// Helper: Check folder permission (Recursive)
export const getEffectiveFolderPermission = async (folderId: number, userId: number): Promise<'VIEW' | 'EDIT' | null> => {
    let currentId: number | null = folderId;

    // Safety break for cycles (though unlikely with tree structure)
    let depth = 0;
    while (currentId !== null && depth < 20) {
        const folder: (UserFolder & { shares: UserFolderShare[] }) | null = await prisma.userFolder.findUnique({
            where: { id: currentId },
            include: { shares: true }
        });

        if (!folder) return null;

        // Owner has full access
        if (folder.userId === userId) return 'EDIT';

        // Check explicit share
        const share = folder.shares.find(s => s.userId === userId);
        if (share) return share.permission as 'VIEW' | 'EDIT';

        currentId = folder.parentId;
        depth++;
    }

    return null;
};

// Helper: Check file permission
export const getEffectiveFilePermission = async (fileId: number, userId: number): Promise<'VIEW' | 'EDIT' | null> => {
    const file = await prisma.userFile.findUnique({
        where: { id: fileId },
        include: { shares: true }
    });

    if (!file) return null;
    if (file.userId === userId) return 'EDIT';

    // Direct share
    const directShare = file.shares.find(s => s.userId === userId);
    if (directShare) return directShare.permission as 'VIEW' | 'EDIT';

    // Inherited from folder
    if (file.folderId) {
        return await getEffectiveFolderPermission(file.folderId, userId);
    }

    return null;
};

// Get all folders and files for current user
export const getFoldersAndFiles = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const parentId = req.query.parentId ? parseInt(req.query.parentId as string) : null;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Access Check if checking a specific folder
        if (parentId) {
            const permission = await getEffectiveFolderPermission(parentId, userId);
            if (!permission) {
                return res.status(403).json({ message: 'Bạn không có quyền truy cập thư mục này' });
            }
        }

        let folders, files;

        if (parentId) {
            // Inside a folder: List ALL items regardless of owner (since we have access to the folder)
            folders = await prisma.userFolder.findMany({
                where: { parentId },
                orderBy: { name: 'asc' }
            });

            files = await prisma.userFile.findMany({
                where: { folderId: parentId },
                orderBy: { name: 'asc' }
            });
        } else {
            // Root: Only my items
            folders = await prisma.userFolder.findMany({
                where: { userId, parentId: null },
                orderBy: { name: 'asc' }
            });

            files = await prisma.userFile.findMany({
                where: { userId, folderId: null },
                orderBy: { name: 'asc' }
            });
        }

        // Get current folder info if in subfolder
        let currentFolder = null;
        if (parentId) {
            currentFolder = await prisma.userFolder.findUnique({
                where: { id: parentId },
                include: { parent: true }
            });
        }

        // Get breadcrumb path
        const breadcrumbs = [];
        if (currentFolder) {
            let folder: any = currentFolder;
            while (folder) {
                breadcrumbs.unshift({
                    id: folder.id,
                    name: folder.name
                });
                if (folder.parentId) {
                    // This is slightly inefficient (N queries), but simple for now. 
                    // Could be optimized by fetching all parents in one go if needed.
                    folder = await prisma.userFolder.findUnique({ where: { id: folder.parentId } });
                } else {
                    folder = null;
                }
            }
        }

        res.json({
            folders,
            files,
            currentFolder,
            breadcrumbs,
            parentId
        });
    } catch (error) {
        console.error('Error getting folders and files:', error);
        res.status(500).json({ message: 'Lỗi khi lấy danh sách thư mục và file' });
    }
};

// Create new folder
export const createFolder = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { name, parentId } = req.body;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ message: 'Tên thư mục không được để trống' });
        }

        // Get user info
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Build MinIO path
        const basePath = getUserFolderPath(user.username);
        let minioPath = basePath;

        // If parentId, get parent folder path
        if (parentId) {
            const parentFolder = await prisma.userFolder.findUnique({
                where: { id: parseInt(parentId) }
            });
            if (parentFolder && parentFolder.userId === userId) {
                minioPath = parentFolder.minioPath;
            }
        }

        minioPath = `${minioPath}/${name.trim()}`;

        // Check if folder already exists
        const existingFolder = await prisma.userFolder.findFirst({
            where: {
                userId,
                parentId: parentId ? parseInt(parentId) : null,
                name: name.trim()
            }
        });

        if (existingFolder) {
            return res.status(400).json({ message: 'Thư mục đã tồn tại' });
        }

        // Create folder in database
        const folder = await prisma.userFolder.create({
            data: {
                name: name.trim(),
                minioPath,
                userId,
                parentId: parentId ? parseInt(parentId) : null
            }
        });

        // Create empty folder marker in MinIO (MinIO doesn't have real folders)
        try {
            await minioClient.putObject(
                bucketName,
                `${minioPath}/.folder`,
                Buffer.from(''),
                0,
                { 'Content-Type': 'application/x-directory' }
            );
        } catch (minioError) {
            console.warn('Could not create folder marker in MinIO:', minioError);
            // Continue anyway - folder marker is optional
        }

        res.status(201).json(folder);
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({ message: 'Lỗi khi tạo thư mục' });
    }
};

// Upload file
export const uploadFile = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const folderId = req.body.folderId ? parseInt(req.body.folderId) : null;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Không có file được upload' });
        }

        // Get user info
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Build MinIO path
        let basePath = getUserFolderPath(user.username);

        // If folderId, get folder path
        if (folderId) {
            const folder = await prisma.userFolder.findUnique({
                where: { id: folderId }
            });
            if (folder && folder.userId === userId) {
                basePath = folder.minioPath;
            }
        }

        // Get original filename with proper encoding
        let originalName = req.file.originalname;
        try {
            // Handle latin1 to UTF-8 conversion
            if (/[\xC0-\xFF]/.test(originalName)) {
                originalName = Buffer.from(originalName, 'latin1').toString('utf8');
            }
            originalName = originalName.normalize('NFC').trim();
        } catch (e) {
            console.warn('Filename encoding error:', e);
        }

        const minioPath = `${basePath}/${originalName}`;

        // Upload to MinIO
        let fileStream;
        if (req.file.path) {
            fileStream = fs.createReadStream(req.file.path);
        } else {
            fileStream = Readable.from(req.file.buffer);
        }

        await minioClient.putObject(
            bucketName,
            minioPath,
            fileStream,
            req.file.size,
            {
                'Content-Type': req.file.mimetype,
                'X-Amz-Meta-Original-Filename': encodeURIComponent(originalName)
            }
        );

        // Cleanup temp file if disk storage used
        if (req.file.path) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting temp file:', err);
            });
        }

        // Check if file already exists in database
        const existingFile = await prisma.userFile.findFirst({
            where: {
                userId,
                folderId,
                name: originalName
            }
        });

        let file;
        if (existingFile) {
            // Update existing file
            file = await prisma.userFile.update({
                where: { id: existingFile.id },
                data: {
                    fileSize: req.file.size,
                    fileType: req.file.mimetype,
                    updatedAt: new Date()
                }
            });
        } else {
            // Create new file record
            file = await prisma.userFile.create({
                data: {
                    name: originalName,
                    minioPath,
                    fileType: req.file.mimetype,
                    fileSize: req.file.size,
                    userId,
                    folderId
                }
            });
        }

        res.status(201).json(file);
    } catch (error) {
        // Cleanup temp file on error
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (err) => {
                if (err && err.code !== 'ENOENT') console.error('Error deleting temp file on error:', err);
            });
        }
        console.error('Error uploading file:', error);
        res.status(500).json({ message: 'Lỗi khi upload file' });
    }
};

// Delete folder
export const deleteFolder = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const folderId = parseInt(req.params.id || '0');

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Get folder
        const folder = await prisma.userFolder.findUnique({
            where: { id: folderId },
            include: { children: true, files: true }
        });

        if (!folder) {
            return res.status(404).json({ message: 'Thư mục không tồn tại' });
        }

        if (folder.userId !== userId) {
            return res.status(403).json({ message: 'Bạn không có quyền xóa thư mục này' });
        }

        // Recursively delete all MinIO objects in folder
        try {
            const objectsList: string[] = [];
            const stream = minioClient.listObjects(bucketName, folder.minioPath, true);

            await new Promise<void>((resolve, reject) => {
                stream.on('data', (obj: any) => {
                    if (obj.name) objectsList.push(obj.name);
                });
                stream.on('error', reject);
                stream.on('end', resolve);
            });

            if (objectsList.length > 0) {
                await minioClient.removeObjects(bucketName, objectsList);
            }
        } catch (minioError) {
            console.warn('Error deleting MinIO objects:', minioError);
        }

        // Delete folder from database (cascade will delete children and files)
        await prisma.userFolder.delete({
            where: { id: folderId }
        });

        res.json({ message: 'Đã xóa thư mục' });
    } catch (error) {
        console.error('Error deleting folder:', error);
        res.status(500).json({ message: 'Lỗi khi xóa thư mục' });
    }
};

// Delete file
export const deleteFile = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const fileId = parseInt(req.params.id || '0');

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Get file
        const file = await prisma.userFile.findUnique({
            where: { id: fileId }
        });

        if (!file) {
            return res.status(404).json({ message: 'File không tồn tại' });
        }

        if (file.userId !== userId) {
            return res.status(403).json({ message: 'Bạn không có quyền xóa file này' });
        }

        // Delete from MinIO
        try {
            await minioClient.removeObject(bucketName, file.minioPath);
        } catch (minioError) {
            console.warn('Error deleting MinIO object:', minioError);
        }

        // Delete from database
        await prisma.userFile.delete({
            where: { id: fileId }
        });

        res.json({ message: 'Đã xóa file' });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ message: 'Lỗi khi xóa file' });
    }
};

// Get file presigned URL for download
export const getFileUrl = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const fileId = parseInt(req.params.id || '0');

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Get file
        const file = await prisma.userFile.findUnique({
            where: { id: fileId }
        });

        if (!file) {
            return res.status(404).json({ message: 'File không tồn tại' });
        }

        if (file.userId !== userId) {
            return res.status(403).json({ message: 'Bạn không có quyền truy cập file này' });
        }

        // Use backend download endpoint instead of presigned URL
        const url = `${BACKEND_URL}/folders/files/${fileId}/download`;

        res.json({ url, file });
    } catch (error) {
        console.error('Error getting file URL:', error);
        res.status(500).json({ message: 'Lỗi khi lấy URL file' });
    }
};

// Download file (attachment)
export const downloadUserFile = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const fileId = parseInt(req.params.id || '0');

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Get file
        const file = await prisma.userFile.findUnique({
            where: { id: fileId }
        });

        if (!file) {
            return res.status(404).json({ message: 'File không tồn tại' });
        }

        if (file.userId !== userId) {
            // Check implicit permissions
            const permission = await getEffectiveFilePermission(fileId, userId);
            if (!permission) {
                return res.status(403).json({ message: 'Bạn không có quyền truy cập file này' });
            }
        }

        // Get file from MinIO
        const { getFileStream, getFileStats } = await import('../services/minioService.js');
        const fileStream = await getFileStream(file.minioPath);
        const fileStats = await getFileStats(file.minioPath);

        // Set headers
        res.setHeader('Content-Type', file.fileType);

        // Encode filename for Content-Disposition header
        const encodedFilename = encodeURIComponent(file.name).replace(/'/g, "%27");
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);

        if (fileStats.size) {
            res.setHeader('Content-Length', fileStats.size);
        }
        res.setHeader('Access-Control-Allow-Origin', '*');

        fileStream.pipe(res);
    } catch (error) {
        console.error('Error downloading file:', error);
        res.status(500).json({ message: 'Lỗi khi download file' });
    }
};

// Stream file for viewing (images, etc)
export const streamFile = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const fileId = parseInt(req.params.id || '0');

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Get file
        const file = await prisma.userFile.findUnique({
            where: { id: fileId }
        });

        if (!file) {
            return res.status(404).json({ message: 'File không tồn tại' });
        }

        if (file.userId !== userId) {
            return res.status(403).json({ message: 'Bạn không có quyền truy cập file này' });
        }

        // Handle Range Request (Video Streaming)
        const fileSize = Number(file.fileSize);
        const range = req.headers.range;

        if (range && fileSize > 0) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0] || '0', 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;

            // Validate range
            if (start >= fileSize || end >= fileSize) {
                res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
                return res.end();
            }

            const stream = await minioClient.getPartialObject(bucketName, file.minioPath, start, chunksize);

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': file.fileType,
                'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`
            });
            stream.pipe(res);
            return;
        }

        // Get file from MinIO (Full content)
        const stream = await minioClient.getObject(bucketName, file.minioPath);

        // Set headers
        res.setHeader('Content-Type', file.fileType);
        res.setHeader('Content-Length', fileSize);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`);

        stream.pipe(res);
    } catch (error) {
        console.error('Error streaming file:', error);
        res.status(500).json({ message: 'Lỗi khi stream file' });
    }
};

// Check if file supports OnlyOffice
export const checkOnlyOfficeSupport = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const fileId = parseInt(req.params.id || '0');

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const permission = await getEffectiveFilePermission(fileId, userId);
        if (!permission) {
            return res.status(403).json({ message: 'Bạn không có quyền truy cập file này' });
        }

        // Get file
        const file = await prisma.userFile.findUnique({
            where: { id: fileId }
        });

        if (!file) {
            return res.status(404).json({ message: 'File không tồn tại' });
        }

        const supported = isOfficeFile(file.name);

        res.json({
            supported,
            onlyofficeUrl: ONLYOFFICE_URL,
            fileName: file.name
        });
    } catch (error) {
        console.error('Error checking OnlyOffice support:', error);
        res.status(500).json({ message: 'Lỗi khi kiểm tra hỗ trợ OnlyOffice' });
    }
};

// Get document type for OnlyOffice
const getDocumentType = (filename: string): string => {
    const ext = filename.toLowerCase().split('.').pop() || '';

    // Word documents
    if (['doc', 'docx', 'docm', 'dot', 'dotx', 'dotm', 'odt', 'fodt', 'ott', 'rtf', 'txt', 'html', 'htm', 'mht', 'pdf'].includes(ext)) {
        return 'word';
    }

    // Excel documents
    if (['xls', 'xlsx', 'xlsm', 'xlt', 'xltx', 'xltm', 'ods', 'fods', 'ots', 'csv'].includes(ext)) {
        return 'cell';
    }

    // PowerPoint documents
    if (['ppt', 'pptx', 'pptm', 'pot', 'potx', 'potm', 'odp', 'fodp', 'otp'].includes(ext)) {
        return 'slide';
    }

    return 'word';
};

// Get OnlyOffice config for user file
export const getOnlyOfficeConfig = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const fileId = parseInt(req.params.id || '0');

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const currentUser = await prisma.user.findUnique({
            where: { id: userId }
        });

        const permission = await getEffectiveFilePermission(fileId, userId);
        if (!permission) {
            return res.status(403).json({ message: 'Bạn không có quyền truy cập file này' });
        }

        // Get file
        const file = await prisma.userFile.findUnique({
            where: { id: fileId },
            include: { user: true }
        });

        if (!file) {
            return res.status(404).json({ message: 'File không tồn tại' });
        }

        if (!isOfficeFile(file.name)) {
            return res.status(400).json({ message: 'File không được hỗ trợ bởi OnlyOffice' });
        }

        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const documentType = getDocumentType(file.name);

        // Use backend download endpoint instead of presigned URL
        // This ensures JWT compatibility - OnlyOffice will download from our server
        const downloadUrl = `${BACKEND_URL}/folders/files/${fileId}/onlyoffice-download`;

        // Should use a consistent key for the file to enable collaborative editing (if shared)
        // or to allow saving back to the same file.
        // Format: userfile_<id>_<last_updated_timestamp>
        const documentKey = `userfile_${fileId}_${file.updatedAt.getTime()}`;

        const canEdit = permission === 'EDIT';

        // JWT Payload - only include what OnlyOffice expects to be signed
        const jwtPayload = {
            document: {
                fileType: ext,
                key: documentKey,
                title: file.name,
                url: downloadUrl,
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
                mode: canEdit ? 'edit' : 'view',
                lang: 'en', // English as default
                callbackUrl: `${BACKEND_URL}/onlyoffice/folder-callback/${fileId}`,
                user: {
                    id: String(userId),
                    name: currentUser?.name || file.user.name
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
                    // trackChanges: false means don't track new changes
                    // showReviewChanges: false means don't show review panel by default
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
            documentType,
            height: '100%',
            width: '100%',
            type: 'desktop',
            token: token
        };

        console.log('[OnlyOffice Folder] Config generated for file:', fileId);
        console.log('[OnlyOffice Folder] JWT token generated:', token.substring(0, 50) + '...');

        res.json({ config: signedConfig, onlyofficeUrl: ONLYOFFICE_URL });
    } catch (error) {
        console.error('Error getting OnlyOffice config:', error);
        res.status(500).json({ message: 'Lỗi khi lấy cấu hình OnlyOffice' });
    }
};

// OnlyOffice callback (for save)
// OnlyOffice callback (for save)
export const onlyofficeCallback = async (req: AuthRequest, res: Response) => {
    try {
        const { status, url } = req.body;
        const fileId = parseInt(req.params.id as string);

        console.log(`[OnlyOffice Callback] Request for fileId: ${fileId}, status: ${status}`);

        // Status codes:
        // 2 - document is ready for saving
        // 6 - document is being edited, but the current document state is saved
        if (status === 2 || status === 6) {
            if (!url) {
                console.error('No URL provided in callback');
                return res.json({ error: 1 });
            }

            const file = await prisma.userFile.findUnique({
                where: { id: fileId }
            });

            if (!file) {
                console.error(`File not found: ${fileId}`);
                return res.json({ error: 0 }); // File deleted? Return 0 to stop retries
            }

            console.log(`[OnlyOffice Callback] Downloading from: ${url}`);

            // Download the edited file from OnlyOffice
            const response = await fetch(url);
            if (!response.ok) {
                console.error('Failed to download edited file from OnlyOffice');
                return res.json({ error: 1 });
            }

            const buffer = Buffer.from(await response.arrayBuffer());

            // Use dynamic import to avoid potential circular dependencies and ensure fresh client
            const { minioClient, bucketName } = await import('../config/minio.js');

            console.log(`[OnlyOffice Callback] Uploading to MinIO: ${file.minioPath}, size: ${buffer.length}`);

            // Upload the updated file back to MinIO with the same path
            await minioClient.putObject(bucketName, file.minioPath, buffer);

            // Update file size and timestamp in DB to ensure new key is generated next time
            await prisma.userFile.update({
                where: { id: fileId },
                data: {
                    fileSize: buffer.length,
                    updatedAt: new Date()
                }
            });

            console.log(`File saved successfully: ${fileId}`);
        }

        res.json({ error: 0 });
    } catch (error) {
        console.error('OnlyOffice callback error:', error);
        res.json({ error: 1 });
    }
};

// Download file for OnlyOffice (no auth - OnlyOffice needs direct access)
export const downloadFileForOnlyOffice = async (req: any, res: Response) => {
    try {
        const fileId = parseInt(req.params.id || '0');

        // Get file
        const file = await prisma.userFile.findUnique({
            where: { id: fileId }
        });

        if (!file) {
            return res.status(404).json({ message: 'File không tồn tại' });
        }

        // Get file from MinIO
        const stream = await minioClient.getObject(bucketName, file.minioPath);
        const stat = await minioClient.statObject(bucketName, file.minioPath);

        // Set headers
        res.setHeader('Content-Type', file.fileType);
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`);

        stream.pipe(res);
    } catch (error) {
        console.error('Error downloading file for OnlyOffice:', error);
        res.status(500).json({ message: 'Lỗi khi download file' });
    }
};

// Rename folder
export const renameFolder = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const folderId = parseInt(req.params.id || '0');
        const { name } = req.body;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ message: 'Tên thư mục không được để trống' });
        }

        // Get folder
        const folder = await prisma.userFolder.findUnique({
            where: { id: folderId }
        });

        if (!folder) {
            return res.status(404).json({ message: 'Thư mục không tồn tại' });
        }

        if (folder.userId !== userId) {
            return res.status(403).json({ message: 'Bạn không có quyền đổi tên thư mục này' });
        }

        // Check if new name already exists
        const existingFolder = await prisma.userFolder.findFirst({
            where: {
                userId,
                parentId: folder.parentId,
                name: name.trim(),
                id: { not: folderId }
            }
        });

        if (existingFolder) {
            return res.status(400).json({ message: 'Thư mục với tên này đã tồn tại' });
        }

        // Update folder name
        const updatedFolder = await prisma.userFolder.update({
            where: { id: folderId },
            data: { name: name.trim() }
        });

        res.json(updatedFolder);
    } catch (error) {
        console.error('Error renaming folder:', error);
        res.status(500).json({ message: 'Lỗi khi đổi tên thư mục' });
    }
};

// Rename file
export const renameFile = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const fileId = parseInt(req.params.id || '0');
        const { name } = req.body;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ message: 'Tên file không được để trống' });
        }

        // Get file
        const file = await prisma.userFile.findUnique({
            where: { id: fileId }
        });

        if (!file) {
            return res.status(404).json({ message: 'File không tồn tại' });
        }

        if (file.userId !== userId) {
            return res.status(403).json({ message: 'Bạn không có quyền đổi tên file này' });
        }

        // Update file name (keep same MinIO path)
        const updatedFile = await prisma.userFile.update({
            where: { id: fileId },
            data: { name: name.trim() }
        });

        res.json(updatedFile);
    } catch (error) {
        console.error('Error renaming file:', error);
        res.status(500).json({ message: 'Lỗi khi đổi tên file' });
    }
};

// Save file from URL (for OnlyOffice Save As)
export const saveFileFromUrl = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { url, name: originalName, folderId, sourceFileType, sourceFileId } = req.body;
        let fileName = originalName; // Use mutable variable for file name

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if ((!url && !sourceFileId) || !fileName) {
            return res.status(400).json({ message: 'URL hoặc SourceFile và tên file là bắt buộc' });
        }

        // Get user info
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Determine destination folder path
        let basePath = getUserFolderPath(user.username);
        if (folderId) {
            const folder = await prisma.userFolder.findUnique({
                where: { id: parseInt(folderId) }
            });
            if (folder && folder.userId === userId) {
                basePath = folder.minioPath;
            }
        }

        const minioPath = `${basePath}/${fileName.trim()}`;

        // Determine File Types
        // Extract extension from new filename
        const targetExt = fileName.split('.').pop()?.toLowerCase() || '';

        let downloadUrl = url;
        let sourceExt = sourceFileType || '';

        // If sourceFileId is provided, use the backend download URL
        // OnlyOffice Document Server cannot access MinIO directly (400 error),
        // but it can access our backend via public URL
        if (sourceFileId) {
            const sourceFile = await prisma.userFile.findUnique({
                where: { id: parseInt(sourceFileId) }
            });

            if (sourceFile) {
                // Use Backend download URL - OnlyOffice can access this since it's public
                downloadUrl = `${BACKEND_URL}/folders/files/${sourceFileId}/onlyoffice-download`;

                if (!sourceExt) {
                    sourceExt = sourceFile.name.split('.').pop()?.toLowerCase() || '';
                }
                console.log(`[SaveFile] Using Backend download URL for file ${sourceFileId}: ${downloadUrl}`);
            }
        }

        // Extract source extension from URL if not yet found
        if (!sourceExt && downloadUrl) {
            // Try to extract from URL if possible (often presigned URLs have the path)
            // But decoding might be tricky, let's assume if it's not passed we skip conversion or try our best
            const urlPath = downloadUrl.split('?')[0];
            sourceExt = urlPath.split('.').pop()?.toLowerCase() || '';
        }

        // Perform Conversion if needed
        // Only convert if extensions differ and both are present
        if (targetExt && sourceExt && targetExt !== sourceExt) {
            console.log(`[SaveFile] Converting from ${sourceExt} to ${targetExt}`);
            try {
                const key = Date.now().toString(); // Generate a temporary key for conversion
                const conversionUrl = `${ONLYOFFICE_URL}/ConvertService.ashx`;

                // Create payload for conversion (without token first for signing)
                const conversionPayload: any = {
                    async: false,
                    filetype: sourceExt,
                    key: key,
                    outputtype: targetExt,
                    title: fileName,
                    url: downloadUrl // Ensure we use the updated downloadUrl (MinIO or Backend)
                };

                // Sign the conversion payload with JWT (OnlyOffice requires this when JWT is enabled)
                const conversionToken = signOnlyOfficeConfig(conversionPayload);

                // Add token to payload for the request
                conversionPayload.token = conversionToken;

                console.log(`[SaveFile] Sending conversion request. Source: ${sourceExt}, Target: ${targetExt}`);
                console.log(`[SaveFile] Download URL sent to OnlyOffice: ${downloadUrl}`);
                console.log(`[SaveFile] JWT token included in request body`);

                const convertRes = await fetch(conversionUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(conversionPayload)
                });

                if (!convertRes.ok) {
                    throw new Error(`Conversion service returned ${convertRes.status}`);
                }

                const convertData = await convertRes.json();

                if (convertData.error) {
                    console.error('[SaveFile] Conversion error code:', convertData.error);
                    throw new Error(`Conversion failed with error code ${convertData.error}`);
                }

                if (convertData.fileUrl) {
                    downloadUrl = convertData.fileUrl;
                    console.log(`[SaveFile] Conversion successful. New URL: ${downloadUrl}`);
                }
            } catch (convErr) {
                console.error('[SaveFile] Warning: Conversion failed:', convErr);
                return res.status(400).json({ message: 'Không thể chuyển đổi định dạng file' });
            }
        }

        // Download file (either original or converted)
        const response = await fetch(downloadUrl);
        if (!response.ok) {
            throw new Error('Failed to download file from URL');
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const fileSize = buffer.length;

        let mimeType = 'application/octet-stream';
        // Simple mime mapping
        if (targetExt === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        else if (targetExt === 'xlsx') mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        else if (targetExt === 'pptx') mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        else if (targetExt === 'pdf') mimeType = 'application/pdf';


        // Upload to MinIO
        await minioClient.putObject(
            bucketName,
            minioPath,
            buffer,
            fileSize,
            {
                'Content-Type': mimeType,
            }
        );

        // Save to DB
        const existingFile = await prisma.userFile.findFirst({
            where: {
                userId,
                folderId: folderId ? parseInt(folderId) : null,
                name: fileName.trim()
            }
        });

        let file;
        if (existingFile) {
            file = await prisma.userFile.update({
                where: { id: existingFile.id },
                data: {
                    fileSize,
                    fileType: mimeType,
                    updatedAt: new Date()
                }
            });
        } else {
            file = await prisma.userFile.create({
                data: {
                    name: fileName.trim(),
                    minioPath,
                    fileType: mimeType,
                    fileSize,
                    userId,
                    folderId: folderId ? parseInt(folderId) : null
                }
            });
        }

        res.json(file);
    } catch (error) {
        console.error('Error saving file from URL:', error);
        res.status(500).json({ message: 'Lỗi khi lưu file' });
    }
};

// Get Shared With Me items
export const getSharedWithMe = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const sharedFolders = await prisma.userFolderShare.findMany({
            where: { userId },
            include: {
                folder: {
                    include: { user: { select: { name: true } } }
                }
            }
        });

        const sharedFiles = await prisma.userFileShare.findMany({
            where: { userId },
            include: {
                file: {
                    include: { user: { select: { name: true } } }
                }
            }
        });

        res.json({
            folders: sharedFolders.map(s => ({ ...s.folder, permission: s.permission, ownerName: s.folder.user.name })),
            files: sharedFiles.map(s => ({ ...s.file, permission: s.permission, ownerName: s.file.user.name }))
        });
    } catch (error) {
        console.error('Error getting shared items:', error);
        res.status(500).json({ message: 'Lỗi khi lấy danh sách được chia sẻ' });
    }
};

// Search users to share with
export const searchUsersForShare = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const query = req.query.q as string;

        if (!userId) return res.status(401).json({ message: 'Unauthorized' });
        if (!query) return res.json([]);

        const users = await prisma.user.findMany({
            where: {
                id: { not: userId },
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { username: { contains: query, mode: 'insensitive' } },
                    { email: { contains: query, mode: 'insensitive' } }
                ]
            },
            take: 10,
            select: { id: true, name: true, username: true, avatar: true }
        });

        res.json(users);
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ message: 'Lỗi tìm kiếm người dùng' });
    }
};

// Share Folder
export const shareFolder = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const folderId = parseInt(req.params.id || '0');
        const { userIds, permission } = req.body; // userIds: number[], permission: 'VIEW' | 'EDIT'

        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const folder = await prisma.userFolder.findUnique({ where: { id: folderId } });
        if (!folder) return res.status(404).json({ message: 'Thư mục không tồn tại' });
        if (folder.userId !== userId) return res.status(403).json({ message: 'Chỉ chủ sở hữu mới được chia sẻ' });

        // Upsert shares
        for (const targetId of userIds) {
            await prisma.userFolderShare.upsert({
                where: {
                    folderId_userId: { folderId, userId: targetId }
                },
                update: { permission },
                create: { folderId, userId: targetId, permission }
            });
        }

        res.json({ message: 'Đã chia sẻ thư mục' });
    } catch (error) {
        console.error('Error sharing folder:', error);
        res.status(500).json({ message: 'Lỗi khi chia sẻ thư mục' });
    }
};

// Share File
export const shareFile = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const fileId = parseInt(req.params.id || '0');
        const { userIds, permission } = req.body;

        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const file = await prisma.userFile.findUnique({ where: { id: fileId } });
        if (!file) return res.status(404).json({ message: 'File không tồn tại' });
        if (file.userId !== userId) return res.status(403).json({ message: 'Chỉ chủ sở hữu mới được chia sẻ' });

        for (const targetId of userIds) {
            await prisma.userFileShare.upsert({
                where: {
                    fileId_userId: { fileId, userId: targetId }
                },
                update: { permission },
                create: { fileId, userId: targetId, permission }
            });
        }

        res.json({ message: 'Đã chia sẻ file' });
    } catch (error) {
        console.error('Error sharing file:', error);
        res.status(500).json({ message: 'Lỗi khi chia sẻ file' });
    }
};

// Get Folder Shares - List all users who have access to this folder
export const getFolderShares = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const folderId = parseInt(req.params.id || '0');

        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const folder = await prisma.userFolder.findUnique({ where: { id: folderId } });
        if (!folder) return res.status(404).json({ message: 'Thư mục không tồn tại' });
        if (folder.userId !== userId) return res.status(403).json({ message: 'Chỉ chủ sở hữu mới xem được' });

        const shares = await prisma.userFolderShare.findMany({
            where: { folderId },
            include: {
                user: {
                    select: { id: true, name: true, username: true, avatar: true }
                }
            }
        });

        res.json(shares.map(s => ({
            userId: s.user.id,
            name: s.user.name,
            username: s.user.username,
            avatar: s.user.avatar,
            permission: s.permission
        })));
    } catch (error) {
        console.error('Error getting folder shares:', error);
        res.status(500).json({ message: 'Lỗi khi lấy danh sách chia sẻ' });
    }
};

// Get File Shares - List all users who have access to this file
export const getFileShares = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const fileId = parseInt(req.params.id || '0');

        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const file = await prisma.userFile.findUnique({ where: { id: fileId } });
        if (!file) return res.status(404).json({ message: 'File không tồn tại' });
        if (file.userId !== userId) return res.status(403).json({ message: 'Chỉ chủ sở hữu mới xem được' });

        const shares = await prisma.userFileShare.findMany({
            where: { fileId },
            include: {
                user: {
                    select: { id: true, name: true, username: true, avatar: true }
                }
            }
        });

        res.json(shares.map(s => ({
            userId: s.user.id,
            name: s.user.name,
            username: s.user.username,
            avatar: s.user.avatar,
            permission: s.permission
        })));
    } catch (error) {
        console.error('Error getting file shares:', error);
        res.status(500).json({ message: 'Lỗi khi lấy danh sách chia sẻ' });
    }
};

// Unshare Folder - Remove a user's access to this folder
export const unshareFolder = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const folderId = parseInt(req.params.id || '0');
        const targetUserId = parseInt(req.params.targetUserId || '0');

        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const folder = await prisma.userFolder.findUnique({ where: { id: folderId } });
        if (!folder) return res.status(404).json({ message: 'Thư mục không tồn tại' });
        if (folder.userId !== userId) return res.status(403).json({ message: 'Chỉ chủ sở hữu mới dừng chia sẻ được' });

        await prisma.userFolderShare.deleteMany({
            where: { folderId, userId: targetUserId }
        });

        res.json({ message: 'Đã dừng chia sẻ thư mục' });
    } catch (error) {
        console.error('Error unsharing folder:', error);
        res.status(500).json({ message: 'Lỗi khi dừng chia sẻ thư mục' });
    }
};

// Unshare File - Remove a user's access to this file
export const unshareFile = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const fileId = parseInt(req.params.id || '0');
        const targetUserId = parseInt(req.params.targetUserId || '0');

        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const file = await prisma.userFile.findUnique({ where: { id: fileId } });
        if (!file) return res.status(404).json({ message: 'File không tồn tại' });
        if (file.userId !== userId) return res.status(403).json({ message: 'Chỉ chủ sở hữu mới dừng chia sẻ được' });

        await prisma.userFileShare.deleteMany({
            where: { fileId, userId: targetUserId }
        });

        res.json({ message: 'Đã dừng chia sẻ file' });
    } catch (error) {
        console.error('Error unsharing file:', error);
        res.status(500).json({ message: 'Lỗi khi dừng chia sẻ file' });
    }
};

// Ensure folder structure exists
export const ensureFolderStructure = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { paths, parentId } = req.body; // paths: string[] (e.g. ["A", "A/B"])

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (!Array.isArray(paths)) {
            return res.status(400).json({ message: 'Invalid paths format' });
        }

        // Fetch user to ensure we have username
        const currentUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!currentUser) return res.status(404).json({ message: 'User not found' });

        const pathMap: Record<string, number> = {};
        const folderCache: Record<string, number> = {};

        // Helper to find/create single folder
        const findOrCreate = async (pId: number | null, name: string): Promise<number> => {
            const cacheKey = `${pId}-${name}`;
            if (folderCache[cacheKey]) return folderCache[cacheKey];

            // Check DB
            const existing = await prisma.userFolder.findFirst({
                where: {
                    userId,
                    parentId: pId,
                    name: name
                }
            });

            if (existing) {
                folderCache[cacheKey] = existing.id;
                return existing.id;
            }

            // Create
            let minioPath = '';

            if (pId) {
                const parent = await prisma.userFolder.findUnique({ where: { id: pId } });
                if (parent && parent.userId === userId) {
                    minioPath = `${parent.minioPath}/${name.trim()}`;
                } else {
                    // Fallback if parent not found or owned (should catch above)
                    minioPath = `${getUserFolderPath(currentUser.username)}/${name.trim()}`;
                }
            } else {
                minioPath = `${getUserFolderPath(currentUser.username)}/${name.trim()}`;
            }

            const newFolder = await prisma.userFolder.create({
                data: {
                    userId,
                    parentId: pId,
                    name: name.trim(),
                    minioPath: minioPath
                }
            });

            // Try create marker
            try {
                await minioClient.putObject(
                    bucketName,
                    `${minioPath}/.folder`,
                    Buffer.from(''),
                    0,
                    { 'Content-Type': 'application/x-directory' }
                );
            } catch (e) { /* ignore */ }

            folderCache[cacheKey] = newFolder.id;
            return newFolder.id;
        };

        // Process paths
        // Convert paths to unique set to avoid duplicates
        const uniquePaths = Array.from(new Set(paths));
        const sortedPaths = uniquePaths.sort((a, b) => a.split('/').length - b.split('/').length);

        for (const pathStr of sortedPaths) {
            const parts = pathStr.split('/');
            let currentParentId = parentId ? parseInt(parentId) : null;

            let currentPath = '';

            for (const part of parts) {
                if (!part) continue;
                currentPath = currentPath ? `${currentPath}/${part}` : part;

                const cachedId = pathMap[currentPath];
                if (cachedId !== undefined) {
                    currentParentId = cachedId;
                    continue;
                }

                currentParentId = await findOrCreate(currentParentId, part);
                pathMap[currentPath] = currentParentId;
            }
        }

        res.json({ pathMap });
    } catch (error) {
        console.error('Error ensuring folder structure:', error);
        res.status(500).json({ message: 'Lỗi khi tạo cấu trúc thư mục' });
    }
};

// Move folder to different parent
export const moveFolder = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const folderId = parseInt(req.params.id || '0');
        const { targetFolderId } = req.body; // null for root

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Get source folder
        const folder = await prisma.userFolder.findUnique({
            where: { id: folderId }
        });

        if (!folder) {
            return res.status(404).json({ message: 'Thư mục không tồn tại' });
        }

        // Check ownership
        if (folder.userId !== userId) {
            return res.status(403).json({ message: 'Bạn không có quyền di chuyển thư mục này' });
        }

        // Prevent moving to self or own descendants
        if (targetFolderId !== null) {
            // Check if target is the folder itself
            if (targetFolderId === folderId) {
                return res.status(400).json({ message: 'Không thể di chuyển thư mục vào chính nó' });
            }

            // Check if target is a descendant of the folder
            let checkId: number | null = targetFolderId;
            while (checkId !== null) {
                if (checkId === folderId) {
                    return res.status(400).json({ message: 'Không thể di chuyển thư mục vào thư mục con của nó' });
                }
                const parentFolder = await prisma.userFolder.findUnique({
                    where: { id: checkId },
                    select: { parentId: true }
                });
                checkId = parentFolder?.parentId || null;
            }

            // Check if target folder exists and user has access
            const targetFolder = await prisma.userFolder.findUnique({
                where: { id: targetFolderId }
            });
            if (!targetFolder) {
                return res.status(404).json({ message: 'Thư mục đích không tồn tại' });
            }
            if (targetFolder.userId !== userId) {
                return res.status(403).json({ message: 'Bạn không có quyền di chuyển vào thư mục này' });
            }
        }

        // Check for name conflict in target folder
        const existing = await prisma.userFolder.findFirst({
            where: {
                userId,
                parentId: targetFolderId,
                name: folder.name,
                id: { not: folderId }
            }
        });

        if (existing) {
            return res.status(400).json({ message: 'Thư mục đích đã có thư mục cùng tên' });
        }

        // Update folder
        const updatedFolder = await prisma.userFolder.update({
            where: { id: folderId },
            data: { parentId: targetFolderId }
        });

        res.json({ message: 'Đã di chuyển thư mục thành công', folder: updatedFolder });
    } catch (error) {
        console.error('Error moving folder:', error);
        res.status(500).json({ message: 'Lỗi khi di chuyển thư mục' });
    }
};

// Move file to different folder
export const moveFile = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const fileId = parseInt(req.params.id || '0');
        const { targetFolderId } = req.body; // null for root

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Get source file
        const file = await prisma.userFile.findUnique({
            where: { id: fileId }
        });

        if (!file) {
            return res.status(404).json({ message: 'File không tồn tại' });
        }

        // Check ownership
        if (file.userId !== userId) {
            return res.status(403).json({ message: 'Bạn không có quyền di chuyển file này' });
        }

        // Check target folder exists and user has access
        if (targetFolderId !== null) {
            const targetFolder = await prisma.userFolder.findUnique({
                where: { id: targetFolderId }
            });
            if (!targetFolder) {
                return res.status(404).json({ message: 'Thư mục đích không tồn tại' });
            }
            if (targetFolder.userId !== userId) {
                return res.status(403).json({ message: 'Bạn không có quyền di chuyển vào thư mục này' });
            }
        }

        // Check for name conflict in target folder
        const existing = await prisma.userFile.findFirst({
            where: {
                userId,
                folderId: targetFolderId,
                name: file.name,
                id: { not: fileId }
            }
        });

        if (existing) {
            return res.status(400).json({ message: 'Thư mục đích đã có file cùng tên' });
        }

        // Update file
        const updatedFile = await prisma.userFile.update({
            where: { id: fileId },
            data: { folderId: targetFolderId }
        });

        res.json({ message: 'Đã di chuyển file thành công', file: updatedFile });
    } catch (error) {
        console.error('Error moving file:', error);
        res.status(500).json({ message: 'Lỗi khi di chuyển file' });
    }
};

// Search folders and files recursively (including shared)
export const searchFoldersAndFiles = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const query = (req.query.q as string || '').trim();
        const parentId = req.query.parentId ? parseInt(req.query.parentId as string) : null;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (!query || query.length < 2) {
            return res.json({ folders: [], files: [] });
        }

        // Get all shared folder IDs for this user
        const sharedFolderAccess = await prisma.userFolderShare.findMany({
            where: { userId },
            select: { folderId: true }
        });
        const sharedFolderIds = sharedFolderAccess.map(s => s.folderId);

        // Helper function to get all descendant folder IDs (for both owned and shared)
        const getAllDescendantFolderIds = async (folderIds: (number | null)[], includeOwned: boolean = true): Promise<number[]> => {
            const allIds: number[] = [];
            const visited = new Set<number>();

            const getDescendants = async (parentFolderId: number | null) => {
                const whereClause: any = { parentId: parentFolderId };
                if (includeOwned && parentFolderId === null) {
                    whereClause.userId = userId;
                }

                const children = await prisma.userFolder.findMany({
                    where: whereClause,
                    select: { id: true }
                });

                for (const child of children) {
                    if (!visited.has(child.id)) {
                        visited.add(child.id);
                        allIds.push(child.id);
                        await getDescendants(child.id);
                    }
                }
            };

            for (const folderId of folderIds) {
                if (folderId !== null && !visited.has(folderId)) {
                    visited.add(folderId);
                    allIds.push(folderId);
                }
                await getDescendants(folderId);
            }

            return allIds;
        };

        // Get all folder IDs to search in (owned + shared + their descendants)
        let searchFolderIds: number[] = [];

        if (parentId === null) {
            // Search in all owned folders
            const ownedFolderIds = await getAllDescendantFolderIds([null], true);
            // Search in all shared folders and their descendants
            const sharedDescendants = await getAllDescendantFolderIds(sharedFolderIds, false);
            searchFolderIds = [...ownedFolderIds, ...sharedFolderIds, ...sharedDescendants];
        } else {
            // Search in specific folder + all descendants
            const descendantIds = await getAllDescendantFolderIds([parentId], false);
            searchFolderIds = [parentId, ...descendantIds];
        }

        // Remove duplicates
        searchFolderIds = [...new Set(searchFolderIds)];

        // Search folders (owned)
        const ownedFolders = await prisma.userFolder.findMany({
            where: {
                OR: [
                    { userId, name: { contains: query, mode: 'insensitive' } },
                    { id: { in: searchFolderIds }, name: { contains: query, mode: 'insensitive' } }
                ]
            },
            include: {
                parent: { select: { id: true, name: true } },
                user: { select: { name: true } }
            },
            orderBy: { name: 'asc' },
            take: 50
        });

        // Search files (owned + in accessible folders)
        const files = await prisma.userFile.findMany({
            where: {
                OR: [
                    { userId, name: { contains: query, mode: 'insensitive' } },
                    { folderId: { in: searchFolderIds }, name: { contains: query, mode: 'insensitive' } }
                ]
            },
            include: {
                folder: { select: { id: true, name: true } },
                user: { select: { name: true } }
            },
            orderBy: { name: 'asc' },
            take: 50
        });

        // Build breadcrumb path for each result
        const buildPath = async (folderId: number | null): Promise<string> => {
            if (!folderId) return 'Thư mục gốc';

            const pathParts: string[] = [];
            let currentId: number | null = folderId;

            while (currentId) {
                const currentFolder: { name: string; parentId: number | null } | null = await prisma.userFolder.findUnique({
                    where: { id: currentId },
                    select: { name: true, parentId: true }
                });
                if (currentFolder) {
                    pathParts.unshift(currentFolder.name);
                    currentId = currentFolder.parentId;
                } else {
                    break;
                }
            }

            return pathParts.join(' / ') || 'Thư mục gốc';
        };

        // Check if folder is shared (not owned by user)
        const isShared = (itemUserId: number) => itemUserId !== userId;

        // Add path info and shared flag to results
        const foldersWithPath = await Promise.all(
            ownedFolders.map(async (folder) => ({
                ...folder,
                path: await buildPath(folder.parentId),
                isShared: isShared(folder.userId),
                ownerName: isShared(folder.userId) ? folder.user?.name : undefined
            }))
        );

        const filesWithPath = await Promise.all(
            files.map(async (file) => ({
                ...file,
                path: await buildPath(file.folderId),
                isShared: isShared(file.userId),
                ownerName: isShared(file.userId) ? file.user?.name : undefined
            }))
        );

        res.json({
            folders: foldersWithPath,
            files: filesWithPath,
            totalFolders: foldersWithPath.length,
            totalFiles: filesWithPath.length
        });
    } catch (error) {
        console.error('Error searching folders and files:', error);
        res.status(500).json({ message: 'Lỗi khi tìm kiếm' });
    }
};
