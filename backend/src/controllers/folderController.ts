import type { Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../config/prisma.js';
import { minioClient, bucketName } from '../config/minio.js';
import { Readable } from 'stream';
import { isOfficeFile } from '../services/minioService.js';

const userFolderPrefix = 'users/';
const ONLYOFFICE_URL = process.env.ONLYOFFICE_URL || 'https://jtsconlyoffice.duckdns.org';
const BACKEND_URL = process.env.BACKEND_URL || 'http://ai.jtsc.io.vn/api';

// Get username-based folder path
const getUserFolderPath = (username: string): string => {
    // Capitalize first letter of username for folder name
    const folderName = username.charAt(0).toUpperCase() + username.slice(1);
    return `${userFolderPrefix}${folderName}`;
};

// Get all folders and files for current user
export const getFoldersAndFiles = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const parentId = req.query.parentId ? parseInt(req.query.parentId as string) : null;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Get folders
        const folders = await prisma.userFolder.findMany({
            where: {
                userId,
                parentId
            },
            orderBy: { name: 'asc' }
        });

        // Get files
        const files = await prisma.userFile.findMany({
            where: {
                userId,
                folderId: parentId
            },
            orderBy: { name: 'asc' }
        });

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
                folder = folder.parent;
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
        const folderId = parseInt(req.params.id);

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
        const fileId = parseInt(req.params.id);

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
        const fileId = parseInt(req.params.id);

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
        const fileId = parseInt(req.params.id);

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
        const fileId = parseInt(req.params.id);

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
        const fileId = parseInt(req.params.id);

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Get file
        const file = await prisma.userFile.findUnique({
            where: { id: fileId },
            include: { user: true }
        });

        if (!file) {
            return res.status(404).json({ message: 'File không tồn tại' });
        }

        if (file.userId !== userId) {
            return res.status(403).json({ message: 'Bạn không có quyền truy cập file này' });
        }

        if (!isOfficeFile(file.name)) {
            return res.status(400).json({ message: 'File không được hỗ trợ bởi OnlyOffice' });
        }

        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const documentType = getDocumentType(file.name);

        // Build download URL for OnlyOffice
        const downloadUrl = `${BACKEND_URL}/folders/files/${fileId}/onlyoffice-download`;

        const config = {
            document: {
                fileType: ext,
                key: `userfile_${fileId}_${file.updatedAt.getTime()}`,
                title: file.name,
                url: downloadUrl,
            },
            documentType,
            editorConfig: {
                mode: 'view', // View only mode for personal files
                lang: 'vi',
                callbackUrl: `${BACKEND_URL}/folders/files/onlyoffice-callback`,
                user: {
                    id: String(userId),
                    name: file.user.name
                },
                customization: {
                    chat: false,
                    comments: false,
                    compactHeader: true,
                    compactToolbar: true,
                    feedback: false,
                    forcesave: false,
                    help: false,
                    hideRightMenu: true,
                    hideRulers: true,
                    leftMenu: true,
                    rightMenu: false,
                    statusBar: true,
                    toolbarHideFileName: false,
                    toolbarNoTabs: false
                }
            }
        };

        res.json({ config, token: null });
    } catch (error) {
        console.error('Error getting OnlyOffice config:', error);
        res.status(500).json({ message: 'Lỗi khi lấy cấu hình OnlyOffice' });
    }
};

// OnlyOffice callback (for save - not used in view mode)
export const onlyofficeCallback = async (req: AuthRequest, res: Response) => {
    try {
        // Just acknowledge the callback
        res.json({ error: 0 });
    } catch (error) {
        console.error('OnlyOffice callback error:', error);
        res.json({ error: 1 });
    }
};

// Download file for OnlyOffice (no auth - OnlyOffice needs direct access)
export const downloadFileForOnlyOffice = async (req: any, res: Response) => {
    try {
        const fileId = parseInt(req.params.id);

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
        const folderId = parseInt(req.params.id);
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
        const fileId = parseInt(req.params.id);
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
