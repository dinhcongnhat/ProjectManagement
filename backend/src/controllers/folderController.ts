import type { Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../config/prisma.js';
import { minioClient, bucketName } from '../config/minio.js';
import { Readable } from 'stream';
import type { UserFolder, UserFolderShare } from '@prisma/client';
import { isOfficeFile, getPresignedUrl } from '../services/minioService.js';

const userFolderPrefix = 'users/';
const ONLYOFFICE_URL = process.env.ONLYOFFICE_URL || 'https://jtsconlyoffice.duckdns.org';
const BACKEND_URL = process.env.BACKEND_URL || 'https://jtscapi.duckdns.org/api';

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
        const fileStream = Readable.from(req.file.buffer);
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

        // Get presigned URL
        const url = await minioClient.presignedGetObject(bucketName, file.minioPath, 3600);

        res.json({ url, file });
    } catch (error) {
        console.error('Error getting file URL:', error);
        res.status(500).json({ message: 'Lỗi khi lấy URL file' });
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

        // Get file from MinIO
        const stream = await minioClient.getObject(bucketName, file.minioPath);

        // Set headers
        res.setHeader('Content-Type', file.fileType);
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

        // Use presigned URL from MinIO - OnlyOffice will download directly from MinIO storage
        const downloadUrl = await getPresignedUrl(file.minioPath, 3600); // 1 hour expiry

        // Should use a consistent key for the file to enable collaborative editing (if shared)
        // or to allow saving back to the same file.
        // Format: userfile_<id>_<last_updated_timestamp>
        const documentKey = `userfile_${fileId}_${file.updatedAt.getTime()}`;

        const canEdit = permission === 'EDIT';

        const config = {
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
            documentType,
            editorConfig: {
                mode: canEdit ? 'edit' : 'view',
                lang: 'vi',
                callbackUrl: `${BACKEND_URL}/onlyoffice/folder-callback/${fileId}`, // Use simplified route alias
                user: {
                    id: String(userId),
                    name: currentUser?.name || file.user.name
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
                    hideRulers: false,
                    leftMenu: true,
                    rightMenu: false,
                    statusBar: true,
                    toolbarHideFileName: false,
                    toolbarNoTabs: false,
                    features: {
                        saveAs: true, // Enable Save As
                    },
                }
            }
        };

        res.json({ config, token: null });
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
        const { url, name, folderId, sourceFileType } = req.body;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (!url || !name) {
            return res.status(400).json({ message: 'URL và tên file là bắt buộc' });
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

        const minioPath = `${basePath}/${name.trim()}`;

        // Determine File Types
        // Extract extension from new filename
        const targetExt = name.split('.').pop()?.toLowerCase() || '';

        // Extract source extension from sourceFileType param or URL
        let sourceExt = sourceFileType || '';
        if (!sourceExt) {
            // Try to extract from URL if possible (often presigned URLs have the path)
            // But decoding might be tricky, let's assume if it's not passed we skip conversion or try our best
            const urlPath = url.split('?')[0];
            sourceExt = urlPath.split('.').pop()?.toLowerCase() || '';
        }

        let downloadUrl = url;

        // Perform Conversion if needed
        // Only convert if extensions differ and both are present
        if (targetExt && sourceExt && targetExt !== sourceExt) {
            console.log(`[SaveFile] Converting from ${sourceExt} to ${targetExt}`);
            try {
                const key = Date.now().toString(); // Generate a temporary key for conversion
                const conversionUrl = `${ONLYOFFICE_URL}/ConvertService.ashx`;

                const payload = {
                    async: false,
                    filetype: sourceExt,
                    key: key,
                    outputtype: targetExt,
                    title: name,
                    url: url
                };

                const convertRes = await fetch(conversionUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (!convertRes.ok) {
                    throw new Error(`Conversion service returned ${convertRes.status}`);
                }

                const convertData = await convertRes.json();

                if (convertData.error) {
                    console.error('[SaveFile] Conversion error code:', convertData.error);
                    // If conversion fails, fallback to original file (maybe? No, that would be wrong extension)
                    // Throw error
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
                name: name.trim()
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
                    name: name.trim(),
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
