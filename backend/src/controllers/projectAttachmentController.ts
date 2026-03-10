import type { Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../config/prisma.js';
import { uploadFile, getFileStream, getFileStats, deleteFile, getPresignedUrl, normalizeVietnameseFilename, proxyFileViaPresignedUrl } from '../services/minioService.js';
import { minioClient, bucketName } from '../config/minio.js';
import archiver from 'archiver';

// Helper function to sanitize project name for folder path
const sanitizeFolderName = (name: string): string => {
    // Remove special characters, keep Vietnamese characters
    return name
        .replace(/[\/\\:*?"<>|]/g, '') // Remove invalid path characters
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .trim();
};

// Get MinIO path for project attachments
const getAttachmentPath = (projectName: string, category: string, fileName: string): string => {
    const sanitizedName = sanitizeFolderName(projectName);
    const timestamp = Date.now();
    return `DuAn/${sanitizedName}/${category}/${timestamp}-${fileName}`;
};

// Get MinIO path for folder attachments (preserves folder structure)
const getFolderAttachmentPath = (projectName: string, category: string, folderName: string, relativePath: string): string => {
    const sanitizedName = sanitizeFolderName(projectName);
    const sanitizedFolder = sanitizeFolderName(folderName);
    return `DuAn/${sanitizedName}/${category}/folders/${sanitizedFolder}/${relativePath}`;
};

// Get all attachments for a project
export const getProjectAttachments = async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params;

        const attachments = await prisma.projectAttachment.findMany({
            where: { projectId: Number(projectId) },
            include: {
                uploadedBy: { select: { id: true, name: true, role: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(attachments);
    } catch (error) {
        console.error('Error getting project attachments:', error);
        res.status(500).json({ message: 'Lỗi khi lấy danh sách tệp đính kèm' });
    }
};

// Upload new attachment(s) to a project
export const uploadProjectAttachment = async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Get project info
        const project = await prisma.project.findUnique({
            where: { id: Number(projectId) },
            include: {
                manager: { select: { id: true } },
                implementers: { select: { id: true } },
                cooperators: { select: { id: true } },
                createdBy: { select: { id: true } }
            }
        });

        if (!project) {
            return res.status(404).json({ message: 'Dự án không tồn tại' });
        }

        // Check permissions - include cooperators
        const isAdmin = userRole === 'ADMIN';
        const isManager = project.manager.id === userId;
        const isImplementer = project.implementers.some(impl => impl.id === userId);
        const isCooperator = project.cooperators.some(coop => coop.id === userId);
        const isCreator = project.createdBy?.id === userId;

        if (!isAdmin && !isManager && !isImplementer && !isCooperator && !isCreator) {
            return res.status(403).json({ message: 'Bạn không có quyền đính kèm tệp cho dự án này' });
        }

        // Determine category based on request or user role
        let category: 'TaiLieuDinhKem' | 'NhanVienDinhKem' | 'PhoiHopDinhKem' = 'TaiLieuDinhKem';
        const requestedCategory = req.body.category;

        if (requestedCategory === 'NhanVienDinhKem') {
            category = 'NhanVienDinhKem';
        } else if (requestedCategory === 'PhoiHopDinhKem') {
            if (!isCooperator && !isAdmin && !isManager && !isCreator) {
                return res.status(403).json({ message: 'Bạn không thuộc nhóm phối hợp thực hiện' });
            }
            category = 'PhoiHopDinhKem';
        } else if (requestedCategory === 'TaiLieuDinhKem') {
            if (!isAdmin && !isManager && !isCreator) {
                return res.status(403).json({ message: 'Bạn không có quyền đính kèm tài liệu dự án' });
            }
            category = 'TaiLieuDinhKem';
        } else {
            // Default logic
            if (isCooperator) {
                category = 'PhoiHopDinhKem';
            } else if (!isAdmin && !isManager && !isCreator && isImplementer) {
                category = 'NhanVienDinhKem';
            }
        }

        // Handle file uploads (multiple files)
        const files = req.files as Express.Multer.File[];
        const links = req.body.links ? JSON.parse(req.body.links) : [];

        if ((!files || files.length === 0) && (!links || links.length === 0)) {
            return res.status(400).json({ message: 'Vui lòng chọn ít nhất một tệp hoặc liên kết' });
        }

        const uploadedAttachments = [];

        // Process Links
        if (links && Array.isArray(links)) {
            for (const link of links) {
                // Determine category (same logic as files)
                // Reuse existing category variable

                const attachment = await prisma.projectAttachment.create({
                    data: {
                        name: link.name,
                        minioPath: `LINK:${link.url}`,
                        fileType: link.type || 'application/internet-shortcut',
                        fileSize: 0,
                        category,
                        projectId: Number(projectId),
                        uploadedById: userId
                    },
                    include: {
                        uploadedBy: { select: { id: true, name: true, role: true } }
                    }
                });
                uploadedAttachments.push(attachment);
            }
        }

        // Process Files
        if (files) {
            for (const file of files) {
                // Normalize Vietnamese filename
                const normalizedFilename = normalizeVietnameseFilename(file.originalname);
                const minioPath = getAttachmentPath(project.name, category, normalizedFilename);

                // Upload to MinIO
                await uploadFile(minioPath, file.buffer, {
                    'Content-Type': file.mimetype,
                });

                // Create database record
                const attachment = await prisma.projectAttachment.create({
                    data: {
                        name: normalizedFilename,
                        minioPath,
                        fileType: file.mimetype,
                        fileSize: file.size,
                        category,
                        projectId: Number(projectId),
                        uploadedById: userId
                    },
                    include: {
                        uploadedBy: { select: { id: true, name: true, role: true } }
                    }
                });

                uploadedAttachments.push(attachment);
            }
        }

        // Send notifications based on who uploaded
        try {
            const currentUser = await prisma.user.findUnique({
                where: { id: userId },
                select: { name: true }
            });
            const uploaderName = currentUser?.name || 'Một thành viên';

            const { createNotificationsForUsers } = await import('./notificationController.js');
            const { sendPushToUsers } = await import('../services/pushNotificationService.js');

            // Different notification for result reports vs project documents
            const isResultReport = category === 'NhanVienDinhKem';

            if (isAdmin || isManager) {
                // Manager/Admin uploads project documents → notify Implementers and Cooperators
                const recipientIds = new Set<number>();

                // Add all implementers
                project.implementers.forEach(impl => {
                    if (impl.id !== userId) recipientIds.add(impl.id);
                });

                // Add all cooperators
                project.cooperators.forEach(coop => {
                    if (coop.id !== userId) recipientIds.add(coop.id);
                });

                if (recipientIds.size > 0) {
                    const notificationTitle = '📁 Tài liệu dự án mới';
                    const notificationMessage = `${uploaderName} đã thêm ${uploadedAttachments.length} tài liệu vào dự án "${project.name}". Vui lòng kiểm tra!`;

                    await createNotificationsForUsers(
                        Array.from(recipientIds),
                        'FILE_UPLOAD',
                        notificationTitle,
                        notificationMessage,
                        project.id
                    );

                    // Also send push notification
                    await sendPushToUsers(Array.from(recipientIds), {
                        title: notificationTitle,
                        body: notificationMessage,
                        icon: '/Logo.png',
                        badge: '/badge.png',
                        tag: `project-doc-${project.id}`,
                        data: {
                            type: 'project',
                            url: `/projects/${project.id}`,
                            projectId: project.id
                        }
                    });
                }
            } else {
                // Implementer/Cooperator uploads → notify Manager and Admins
                const adminUsers = await prisma.user.findMany({
                    where: { role: 'ADMIN', id: { not: userId } },
                    select: { id: true }
                });

                const recipientIds = new Set<number>(adminUsers.map(u => u.id));
                if (project.manager && project.manager.id !== userId) {
                    recipientIds.add(project.manager.id);
                }

                if (recipientIds.size > 0) {
                    const notificationType = isResultReport ? 'RESULT_REPORT_UPLOAD' : 'FILE_UPLOAD';
                    const notificationTitle = isResultReport ? '📊 Báo cáo kết quả mới' : 'Tệp đính kèm mới';
                    const notificationMessage = isResultReport
                        ? `${uploaderName} đã nộp ${uploadedAttachments.length} báo cáo kết quả cho dự án "${project.name}". Vui lòng kiểm tra!`
                        : `${uploaderName} đã tải lên ${uploadedAttachments.length} tệp cho dự án "${project.name}"`;

                    await createNotificationsForUsers(
                        Array.from(recipientIds),
                        notificationType,
                        notificationTitle,
                        notificationMessage,
                        project.id
                    );

                    // Also send push notification
                    await sendPushToUsers(Array.from(recipientIds), {
                        title: notificationTitle,
                        body: notificationMessage,
                        icon: '/Logo.png',
                        badge: '/badge.png',
                        tag: `project-upload-${project.id}`,
                        data: {
                            type: 'project',
                            url: `/projects/${project.id}`,
                            projectId: project.id
                        }
                    });
                }
            }
        } catch (notifError) {
            console.error('Error sending notification:', notifError);
        }

        res.status(201).json({
            message: `Đã thêm ${uploadedAttachments.length} tệp/liên kết thành công`,
            attachments: uploadedAttachments
        });
    } catch (error) {
        console.error('Error uploading project attachment:', error);
        res.status(500).json({ message: 'Lỗi khi tải tệp lên' });
    }
};

// Upload attachment from user's personal folder
export const uploadAttachmentFromFolder = async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params;
        const { fileIds } = req.body; // Array of UserFile IDs
        const userId = req.user?.id;
        const userRole = req.user?.role;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
            return res.status(400).json({ message: 'Vui lòng chọn ít nhất một tệp' });
        }

        // Get project info
        const project = await prisma.project.findUnique({
            where: { id: Number(projectId) },
            include: {
                manager: { select: { id: true } },
                implementers: { select: { id: true } },
                cooperators: { select: { id: true } },
                createdBy: { select: { id: true } }
            }
        });

        if (!project) {
            return res.status(404).json({ message: 'Dự án không tồn tại' });
        }

        // Check permissions - include cooperators
        const isAdmin = userRole === 'ADMIN';
        const isManager = project.manager.id === userId;
        const isImplementer = project.implementers.some(impl => impl.id === userId);
        const isCooperator = project.cooperators.some(coop => coop.id === userId);
        const isCreator = project.createdBy?.id === userId;

        if (!isAdmin && !isManager && !isImplementer && !isCooperator && !isCreator) {
            return res.status(403).json({ message: 'Bạn không có quyền đính kèm tệp cho dự án này' });
        }

        // Determine category based on request or user role
        let category: 'TaiLieuDinhKem' | 'NhanVienDinhKem' | 'PhoiHopDinhKem' = 'TaiLieuDinhKem';
        const requestedCategory = req.body.category;

        if (requestedCategory === 'NhanVienDinhKem') {
            category = 'NhanVienDinhKem';
        } else if (requestedCategory === 'PhoiHopDinhKem') {
            if (!isCooperator && !isAdmin && !isManager && !isCreator) {
                return res.status(403).json({ message: 'Bạn không thuộc nhóm phối hợp thực hiện' });
            }
            category = 'PhoiHopDinhKem';
        } else if (requestedCategory === 'TaiLieuDinhKem') {
            if (!isAdmin && !isManager && !isCreator) {
                return res.status(403).json({ message: 'Bạn không có quyền đính kèm tài liệu dự án' });
            }
            category = 'TaiLieuDinhKem';
        } else {
            // Default logic: auto-detect based on user role
            if (isCooperator && !isAdmin && !isManager && !isCreator) {
                category = 'PhoiHopDinhKem';
            } else if (!isAdmin && !isManager && !isCreator && isImplementer) {
                category = 'NhanVienDinhKem';
            }
        }

        // Get user files
        const userFiles = await prisma.userFile.findMany({
            where: {
                id: { in: fileIds.map(Number) },
                userId // Ensure user owns these files
            }
        });

        if (userFiles.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy tệp nào' });
        }

        const uploadedAttachments = [];

        for (const userFile of userFiles) {
            // Copy file to project attachment folder
            const stream = await getFileStream(userFile.minioPath);
            const stats = await getFileStats(userFile.minioPath);

            const minioPath = getAttachmentPath(project.name, category, userFile.name);

            // Read stream into buffer
            const chunks: Buffer[] = [];
            for await (const chunk of stream) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            const buffer = Buffer.concat(chunks);

            // Upload to new location
            await uploadFile(minioPath, buffer, {
                'Content-Type': userFile.fileType,
            });

            // Create database record
            const attachment = await prisma.projectAttachment.create({
                data: {
                    name: userFile.name,
                    minioPath,
                    fileType: userFile.fileType,
                    fileSize: userFile.fileSize,
                    category,
                    projectId: Number(projectId),
                    uploadedById: userId
                },
                include: {
                    uploadedBy: { select: { id: true, name: true, role: true } }
                }
            });

            uploadedAttachments.push(attachment);
        }

        // Send notifications based on who uploaded
        try {
            const currentUser = await prisma.user.findUnique({
                where: { id: userId },
                select: { name: true }
            });
            const uploaderName = currentUser?.name || 'Một thành viên';

            const { createNotificationsForUsers } = await import('./notificationController.js');
            const { sendPushToUsers } = await import('../services/pushNotificationService.js');

            // Different notification for result reports vs project documents
            const isResultReport = category === 'NhanVienDinhKem';

            if (isAdmin || isManager) {
                // Manager/Admin uploads project documents → notify Implementers and Cooperators
                const recipientIds = new Set<number>();

                // Add all implementers
                project.implementers.forEach(impl => {
                    if (impl.id !== userId) recipientIds.add(impl.id);
                });

                // Add all cooperators
                project.cooperators.forEach(coop => {
                    if (coop.id !== userId) recipientIds.add(coop.id);
                });

                if (recipientIds.size > 0) {
                    const notificationTitle = '📁 Tài liệu dự án mới';
                    const notificationMessage = `${uploaderName} đã thêm ${uploadedAttachments.length} tài liệu vào dự án "${project.name}". Vui lòng kiểm tra!`;

                    await createNotificationsForUsers(
                        Array.from(recipientIds),
                        'FILE_UPLOAD',
                        notificationTitle,
                        notificationMessage,
                        project.id
                    );

                    // Also send push notification
                    await sendPushToUsers(Array.from(recipientIds), {
                        title: notificationTitle,
                        body: notificationMessage,
                        icon: '/Logo.png',
                        badge: '/badge.png',
                        tag: `project-doc-${project.id}`,
                        data: {
                            type: 'project',
                            url: `/projects/${project.id}`,
                            projectId: project.id
                        }
                    });
                }
            } else {
                // Implementer/Cooperator uploads → notify Manager and Admins
                const adminUsers = await prisma.user.findMany({
                    where: { role: 'ADMIN', id: { not: userId } },
                    select: { id: true }
                });

                const recipientIds = new Set<number>(adminUsers.map(u => u.id));
                if (project.manager && project.manager.id !== userId) {
                    recipientIds.add(project.manager.id);
                }

                if (recipientIds.size > 0) {
                    const notificationType = isResultReport ? 'RESULT_REPORT_UPLOAD' : 'FILE_UPLOAD';
                    const notificationTitle = isResultReport ? '📊 Báo cáo kết quả mới' : 'Tệp đính kèm mới';
                    const notificationMessage = isResultReport
                        ? `${uploaderName} đã nộp ${uploadedAttachments.length} báo cáo kết quả cho dự án "${project.name}". Vui lòng kiểm tra!`
                        : `${uploaderName} đã tải lên ${uploadedAttachments.length} tệp cho dự án "${project.name}"`;

                    await createNotificationsForUsers(
                        Array.from(recipientIds),
                        notificationType,
                        notificationTitle,
                        notificationMessage,
                        project.id
                    );

                    // Also send push notification
                    await sendPushToUsers(Array.from(recipientIds), {
                        title: notificationTitle,
                        body: notificationMessage,
                        icon: '/Logo.png',
                        badge: '/badge.png',
                        tag: `project-upload-${project.id}`,
                        data: {
                            type: 'project',
                            url: `/projects/${project.id}`,
                            projectId: project.id
                        }
                    });
                }
            }
        } catch (notifError) {
            console.error('Error sending notification:', notifError);
        }

        res.status(201).json({
            message: `Đã đính kèm ${uploadedAttachments.length} tệp từ thư mục cá nhân`,
            attachments: uploadedAttachments
        });
    } catch (error) {
        console.error('Error uploading attachment from folder:', error);
        res.status(500).json({ message: 'Lỗi khi đính kèm tệp từ thư mục' });
    }
};

// Delete attachment
export const deleteProjectAttachment = async (req: AuthRequest, res: Response) => {
    try {
        const { projectId, attachmentId } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Get attachment
        const attachment = await prisma.projectAttachment.findUnique({
            where: { id: Number(attachmentId) },
            include: {
                project: {
                    include: {
                        manager: { select: { id: true } },
                        createdBy: { select: { id: true } }
                    }
                }
            }
        });

        if (!attachment || attachment.projectId !== Number(projectId)) {
            return res.status(404).json({ message: 'Tệp đính kèm không tồn tại' });
        }

        // Check permissions - only uploader, admin, manager, or creator can delete
        const isAdmin = userRole === 'ADMIN';
        const isManager = attachment.project.manager.id === userId;
        const isCreator = attachment.project.createdBy?.id === userId;
        const isUploader = attachment.uploadedById === userId;

        if (!isAdmin && !isManager && !isCreator && !isUploader) {
            return res.status(403).json({ message: 'Bạn không có quyền xóa tệp này' });
        }

        // Delete from MinIO
        try {
            await deleteFile(attachment.minioPath);
        } catch (error) {
            console.error('Error deleting file from MinIO:', error);
            // Continue with database deletion even if MinIO delete fails
        }

        // Delete from database
        await prisma.projectAttachment.delete({
            where: { id: Number(attachmentId) }
        });

        res.json({ message: 'Đã xóa tệp đính kèm' });
    } catch (error) {
        console.error('Error deleting project attachment:', error);
        res.status(500).json({ message: 'Lỗi khi xóa tệp' });
    }
};

// Download attachment
export const downloadProjectAttachment = async (req: AuthRequest, res: Response) => {
    try {
        const { attachmentId } = req.params;

        const attachment = await prisma.projectAttachment.findUnique({
            where: { id: Number(attachmentId) }
        });

        if (!attachment) {
            return res.status(404).json({ message: 'Tệp đính kèm không tồn tại' });
        }

        // Handle external links (like Google Drive)
        if (attachment.minioPath && attachment.minioPath.startsWith('LINK:')) {
            const externalUrl = attachment.minioPath.substring(5);
            return res.redirect(externalUrl);
        }

        const { stream, contentType, contentLength } = await proxyFileViaPresignedUrl(attachment.minioPath);

        // Encode filename for Content-Disposition header
        const encodedFilename = encodeURIComponent(attachment.name).replace(/'/g, "%27");
        const safeFilename = attachment.name.replace(/[^\x20-\x7E]/g, '_');

        res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`);
        res.setHeader('Content-Type', attachment.fileType || contentType || 'application/octet-stream');
        res.setHeader('Content-Length', contentLength);

        stream.pipe(res);
    } catch (error) {
        console.error('Error downloading project attachment:', error);
        res.status(500).json({ message: 'Lỗi khi tải tệp' });
    }
};

// Get presigned URL for OnlyOffice viewing
export const getAttachmentPresignedUrl = async (req: AuthRequest, res: Response) => {
    try {
        const { attachmentId } = req.params;

        const attachment = await prisma.projectAttachment.findUnique({
            where: { id: Number(attachmentId) }
        });

        if (!attachment) {
            return res.status(404).json({ message: 'Tệp đính kèm không tồn tại' });
        }

        // Check if it's an external link
        if (attachment.minioPath.startsWith('LINK:')) {
            const url = attachment.minioPath.substring(5);
            return res.json({ url }); // Frontend should handle redirect
        }

        // Use backend download endpoint instead of presigned URL (MinIO might be internal)
        const url = `${process.env.BACKEND_URL || 'https://jtscapi.duckdns.org/api'}/projects/attachments/${attachmentId}/download`;
        res.json({ url });
    } catch (error) {
        console.error('Error getting presigned URL:', error);
        res.status(500).json({ message: 'Lỗi khi lấy URL' });
    }
};

// ==================== FOLDER UPLOAD/DOWNLOAD ====================

// Upload a folder to project attachments
// Files come with relativePath metadata to preserve folder structure
export const uploadProjectFolder = async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const project = await prisma.project.findUnique({
            where: { id: Number(projectId) },
            include: {
                manager: { select: { id: true } },
                implementers: { select: { id: true } },
                cooperators: { select: { id: true } },
                createdBy: { select: { id: true } }
            }
        });

        if (!project) {
            return res.status(404).json({ message: 'Dự án không tồn tại' });
        }

        const isAdmin = userRole === 'ADMIN';
        const isManager = project.manager.id === userId;
        const isImplementer = project.implementers.some(impl => impl.id === userId);
        const isCooperator = project.cooperators.some(coop => coop.id === userId);
        const isCreator = project.createdBy?.id === userId;

        if (!isAdmin && !isManager && !isImplementer && !isCooperator && !isCreator) {
            return res.status(403).json({ message: 'Bạn không có quyền đính kèm tệp cho dự án này' });
        }

        // Determine category
        let category: 'TaiLieuDinhKem' | 'NhanVienDinhKem' | 'PhoiHopDinhKem' = 'TaiLieuDinhKem';
        const requestedCategory = req.body.category;

        if (requestedCategory === 'NhanVienDinhKem') {
            category = 'NhanVienDinhKem';
        } else if (requestedCategory === 'PhoiHopDinhKem') {
            if (!isCooperator && !isAdmin && !isManager && !isCreator) {
                return res.status(403).json({ message: 'Bạn không thuộc nhóm phối hợp thực hiện' });
            }
            category = 'PhoiHopDinhKem';
        } else if (requestedCategory === 'TaiLieuDinhKem') {
            if (!isAdmin && !isManager && !isCreator) {
                return res.status(403).json({ message: 'Bạn không có quyền đính kèm tài liệu dự án' });
            }
            category = 'TaiLieuDinhKem';
        }

        const files = req.files as Express.Multer.File[];
        const folderName = req.body.folderName;
        // relativePaths is a JSON array string or an array of strings, one per file
        let relativePaths: string[] = [];
        if (req.body.relativePaths) {
            try {
                relativePaths = JSON.parse(req.body.relativePaths);
            } catch {
                // If it's a single string (for 1 file)
                relativePaths = Array.isArray(req.body.relativePaths)
                    ? req.body.relativePaths
                    : [req.body.relativePaths];
            }
        }

        if (!files || files.length === 0) {
            return res.status(400).json({ message: 'Vui lòng chọn ít nhất một tệp' });
        }

        if (!folderName) {
            return res.status(400).json({ message: 'Tên thư mục không được để trống' });
        }

        const uploadedAttachments = [];
        let totalSize = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i]!;
            const relPath = relativePaths[i] || file.originalname;
            const normalizedFilename = normalizeVietnameseFilename(file.originalname);
            const normalizedRelPath = normalizeVietnameseFilename(relPath);
            const minioPath = getFolderAttachmentPath(project.name, category, folderName, normalizedRelPath);

            await uploadFile(minioPath, file.buffer, {
                'Content-Type': file.mimetype,
            });

            const attachment = await prisma.projectAttachment.create({
                data: {
                    name: normalizedFilename,
                    minioPath,
                    fileType: file.mimetype,
                    fileSize: file.size,
                    category,
                    isFolder: true,
                    folderName: folderName,
                    relativePath: normalizedRelPath,
                    projectId: Number(projectId),
                    uploadedById: userId
                },
                include: {
                    uploadedBy: { select: { id: true, name: true, role: true } }
                }
            });

            uploadedAttachments.push(attachment);
            totalSize += file.size;
        }

        // Send notifications
        try {
            const currentUser = await prisma.user.findUnique({
                where: { id: userId },
                select: { name: true }
            });
            const uploaderName = currentUser?.name || 'Một thành viên';
            const { createNotificationsForUsers } = await import('./notificationController.js');
            const { sendPushToUsers } = await import('../services/pushNotificationService.js');

            const recipientIds = new Set<number>();
            if (isAdmin || isManager) {
                project.implementers.forEach(impl => { if (impl.id !== userId) recipientIds.add(impl.id); });
                project.cooperators.forEach(coop => { if (coop.id !== userId) recipientIds.add(coop.id); });
            } else {
                const adminUsers = await prisma.user.findMany({ where: { role: 'ADMIN', id: { not: userId } }, select: { id: true } });
                adminUsers.forEach(u => recipientIds.add(u.id));
                if (project.manager.id !== userId) recipientIds.add(project.manager.id);
            }

            if (recipientIds.size > 0) {
                const notificationTitle = '📁 Thư mục mới được tải lên';
                const notificationMessage = `${uploaderName} đã tải lên thư mục "${folderName}" (${files.length} tệp) cho dự án "${project.name}"`;

                await createNotificationsForUsers(Array.from(recipientIds), 'FILE_UPLOAD', notificationTitle, notificationMessage, project.id);
                await sendPushToUsers(Array.from(recipientIds), {
                    title: notificationTitle,
                    body: notificationMessage,
                    icon: '/Logo.png',
                    badge: '/badge.png',
                    tag: `project-folder-${project.id}`,
                    data: { type: 'project', url: `/projects/${project.id}`, projectId: project.id }
                });
            }
        } catch (notifError) {
            console.error('Error sending notification:', notifError);
        }

        res.status(201).json({
            message: `Đã tải lên thư mục "${folderName}" với ${uploadedAttachments.length} tệp`,
            attachments: uploadedAttachments,
            folderName
        });
    } catch (error) {
        console.error('Error uploading project folder:', error);
        res.status(500).json({ message: 'Lỗi khi tải thư mục lên' });
    }
};

// Upload folder from personal storage (Kho dữ liệu)
export const uploadFolderFromStorage = async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params;
        const { folderId, category: requestedCategory } = req.body;
        const userId = req.user?.id;
        const userRole = req.user?.role;

        if (!userId) return res.status(401).json({ message: 'Unauthorized' });
        if (!folderId) return res.status(400).json({ message: 'Vui lòng chọn thư mục' });

        const project = await prisma.project.findUnique({
            where: { id: Number(projectId) },
            include: {
                manager: { select: { id: true } },
                implementers: { select: { id: true } },
                cooperators: { select: { id: true } },
                createdBy: { select: { id: true } }
            }
        });

        if (!project) return res.status(404).json({ message: 'Dự án không tồn tại' });

        const isAdmin = userRole === 'ADMIN';
        const isManager = project.manager.id === userId;
        const isImplementer = project.implementers.some(impl => impl.id === userId);
        const isCooperator = project.cooperators.some(coop => coop.id === userId);
        const isCreator = project.createdBy?.id === userId;

        if (!isAdmin && !isManager && !isImplementer && !isCooperator && !isCreator) {
            return res.status(403).json({ message: 'Bạn không có quyền đính kèm tệp cho dự án này' });
        }

        let category: 'TaiLieuDinhKem' | 'NhanVienDinhKem' | 'PhoiHopDinhKem' = 'TaiLieuDinhKem';
        if (requestedCategory === 'NhanVienDinhKem') {
            category = 'NhanVienDinhKem';
        } else if (requestedCategory === 'PhoiHopDinhKem') {
            category = 'PhoiHopDinhKem';
        }

        // Get the folder and all its files recursively
        const userFolder = await prisma.userFolder.findUnique({
            where: { id: Number(folderId) }
        });

        if (!userFolder) return res.status(404).json({ message: 'Không tìm thấy thư mục' });

        // Recursively get all files in the folder
        const getAllFilesInFolder = async (parentFolderId: number, basePath: string): Promise<{ file: any, relativePath: string }[]> => {
            const files = await prisma.userFile.findMany({
                where: { folderId: parentFolderId }
            });

            const subFolders = await prisma.userFolder.findMany({
                where: { parentId: parentFolderId }
            });

            const result: { file: any, relativePath: string }[] = files.map(f => ({
                file: f,
                relativePath: basePath ? `${basePath}/${f.name}` : f.name
            }));

            for (const sub of subFolders) {
                const subPath = basePath ? `${basePath}/${sub.name}` : sub.name;
                const subFiles = await getAllFilesInFolder(sub.id, subPath);
                result.push(...subFiles);
            }

            return result;
        };

        const allFiles = await getAllFilesInFolder(userFolder.id, '');
        const uploadedAttachments = [];

        for (const { file: userFile, relativePath } of allFiles) {
            const stream = await getFileStream(userFile.minioPath);
            const fullRelPath = `${userFolder.name}/${relativePath}`;
            const minioPath = getFolderAttachmentPath(project.name, category, userFolder.name, relativePath);

            const chunks: Buffer[] = [];
            for await (const chunk of stream) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            const buffer = Buffer.concat(chunks);

            await uploadFile(minioPath, buffer, { 'Content-Type': userFile.fileType });

            const attachment = await prisma.projectAttachment.create({
                data: {
                    name: userFile.name,
                    minioPath,
                    fileType: userFile.fileType,
                    fileSize: userFile.fileSize,
                    category,
                    isFolder: true,
                    folderName: userFolder.name,
                    relativePath,
                    projectId: Number(projectId),
                    uploadedById: userId
                },
                include: {
                    uploadedBy: { select: { id: true, name: true, role: true } }
                }
            });
            uploadedAttachments.push(attachment);
        }

        res.status(201).json({
            message: `Đã đính kèm thư mục "${userFolder.name}" với ${uploadedAttachments.length} tệp`,
            attachments: uploadedAttachments,
            folderName: userFolder.name
        });
    } catch (error) {
        console.error('Error uploading folder from storage:', error);
        res.status(500).json({ message: 'Lỗi khi đính kèm thư mục từ kho dữ liệu' });
    }
};

// Download a folder as ZIP
export const downloadFolderAsZip = async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params;
        const { folderName } = req.query;

        if (!folderName) {
            return res.status(400).json({ message: 'Tên thư mục không được để trống' });
        }

        // Get all files in this folder
        const attachments = await prisma.projectAttachment.findMany({
            where: {
                projectId: Number(projectId),
                isFolder: true,
                folderName: folderName as string
            }
        });

        if (attachments.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy thư mục' });
        }

        // Set response headers for ZIP download
        const encodedFolderName = encodeURIComponent(folderName as string);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${folderName}.zip"; filename*=UTF-8''${encodedFolderName}.zip`);

        // Create archive
        const archive = archiver('zip', { zlib: { level: 6 } });

        archive.on('error', (err: Error) => {
            console.error('Archive error:', err);
            if (!res.headersSent) {
                res.status(500).json({ message: 'Lỗi khi tạo file ZIP' });
            }
        });

        archive.pipe(res);

        // Add each file to the archive
        for (const attachment of attachments) {
            try {
                const stream = await getFileStream(attachment.minioPath);
                const filePath = attachment.relativePath || attachment.name;
                archive.append(stream, { name: filePath });
            } catch (err) {
                console.error(`Error adding file ${attachment.name} to archive:`, err);
            }
        }

        await archive.finalize();
    } catch (error) {
        console.error('Error downloading folder as ZIP:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Lỗi khi tải thư mục' });
        }
    }
};

// Save folder to personal storage
export const saveFolderToStorage = async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params;
        const { folderName, targetFolderId } = req.body;
        const userId = req.user?.id;

        if (!userId) return res.status(401).json({ message: 'Unauthorized' });
        if (!folderName) return res.status(400).json({ message: 'Tên thư mục không được để trống' });

        // Get user info for folder path
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, name: true }
        });
        if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' });

        // Get all files in this folder
        const attachments = await prisma.projectAttachment.findMany({
            where: {
                projectId: Number(projectId),
                isFolder: true,
                folderName: folderName as string
            }
        });

        if (attachments.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy thư mục' });
        }

        const userFolderPrefix = 'users/';
        const userBasePath = `${userFolderPrefix}${user.username.charAt(0).toUpperCase() + user.username.slice(1)}`;

        // Create the main folder in personal storage
        const parentFolderId = targetFolderId ? Number(targetFolderId) : null;

        // Check if folder already exists
        const existingFolder = await prisma.userFolder.findFirst({
            where: {
                userId,
                parentId: parentFolderId,
                name: folderName
            }
        });

        let mainFolder;
        if (existingFolder) {
            mainFolder = existingFolder;
        } else {
            const folderMinioPath = parentFolderId
                ? await (async () => {
                    const parent = await prisma.userFolder.findUnique({ where: { id: parentFolderId } });
                    return parent ? `${parent.minioPath}/${folderName}` : `${userBasePath}/${folderName}`;
                })()
                : `${userBasePath}/${folderName}`;

            mainFolder = await prisma.userFolder.create({
                data: {
                    name: folderName,
                    minioPath: folderMinioPath,
                    userId,
                    parentId: parentFolderId
                }
            });

            // Create folder marker in MinIO
            await uploadFile(`${folderMinioPath}/.folder`, Buffer.from(''), {});
        }

        // Create subfolder structure and copy files
        const folderCache: Record<string, number> = {};
        let copiedCount = 0;

        for (const attachment of attachments) {
            const relPath = attachment.relativePath || attachment.name;
            const parts = relPath.split('/');
            const fileName = parts.pop()!;

            // Create subfolder structure
            let currentParentId = mainFolder.id;
            let currentBasePath = mainFolder.minioPath;

            for (const subfolderName of parts) {
                const cacheKey = `${currentParentId}/${subfolderName}`;
                if (folderCache[cacheKey]) {
                    currentParentId = folderCache[cacheKey];
                    currentBasePath = `${currentBasePath}/${subfolderName}`;
                    continue;
                }

                let subFolder = await prisma.userFolder.findFirst({
                    where: { userId, parentId: currentParentId, name: subfolderName }
                });

                if (!subFolder) {
                    const subFolderPath = `${currentBasePath}/${subfolderName}`;
                    subFolder = await prisma.userFolder.create({
                        data: {
                            name: subfolderName,
                            minioPath: subFolderPath,
                            userId,
                            parentId: currentParentId
                        }
                    });
                    await uploadFile(`${subFolderPath}/.folder`, Buffer.from(''), {});
                }

                folderCache[cacheKey] = subFolder.id;
                currentParentId = subFolder.id;
                currentBasePath = subFolder.minioPath;
            }

            // Copy file
            const targetMinioPath = `${currentBasePath}/${fileName}`;
            try {
                const stream = await getFileStream(attachment.minioPath);
                const chunks: Buffer[] = [];
                for await (const chunk of stream) {
                    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                }
                const buffer = Buffer.concat(chunks);

                await uploadFile(targetMinioPath, buffer, { 'Content-Type': attachment.fileType });

                await prisma.userFile.create({
                    data: {
                        name: fileName,
                        minioPath: targetMinioPath,
                        fileType: attachment.fileType,
                        fileSize: attachment.fileSize,
                        userId,
                        folderId: currentParentId
                    }
                });
                copiedCount++;
            } catch (err) {
                console.error(`Error copying file ${attachment.name}:`, err);
            }
        }

        res.json({
            message: `Đã lưu thư mục "${folderName}" về kho lưu trữ (${copiedCount} tệp)`,
            folderId: mainFolder.id
        });
    } catch (error) {
        console.error('Error saving folder to storage:', error);
        res.status(500).json({ message: 'Lỗi khi lưu thư mục về kho lưu trữ' });
    }
};

// Get folder contents (for viewing folder structure)
export const getFolderContents = async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params;
        const { folderName } = req.query;

        if (!folderName) {
            return res.status(400).json({ message: 'Tên thư mục không được để trống' });
        }

        const attachments = await prisma.projectAttachment.findMany({
            where: {
                projectId: Number(projectId),
                isFolder: true,
                folderName: folderName as string
            },
            include: {
                uploadedBy: { select: { id: true, name: true, role: true } }
            },
            orderBy: { relativePath: 'asc' }
        });

        // Build tree structure
        const buildTree = (files: typeof attachments) => {
            const root: any = { name: folderName, type: 'folder', children: [] };
            const folderMap: Record<string, any> = { '': root };

            for (const file of files) {
                const relPath = file.relativePath || file.name;
                const parts = relPath.split('/');
                const fileName = parts.pop()!;

                // Ensure parent folders exist
                let currentPath = '';
                let currentNode = root;
                for (const part of parts) {
                    const prevPath = currentPath;
                    currentPath = currentPath ? `${currentPath}/${part}` : part;
                    if (!folderMap[currentPath]) {
                        const folderNode = { name: part, type: 'folder', children: [] };
                        folderMap[currentPath] = folderNode;
                        folderMap[prevPath].children.push(folderNode);
                    }
                    currentNode = folderMap[currentPath];
                }

                currentNode.children.push({
                    id: file.id,
                    name: fileName,
                    type: 'file',
                    fileType: file.fileType,
                    fileSize: file.fileSize,
                    relativePath: relPath,
                    uploadedBy: file.uploadedBy,
                    createdAt: file.createdAt
                });
            }

            return root;
        };

        const tree = buildTree(attachments);
        const totalSize = attachments.reduce((sum, a) => sum + a.fileSize, 0);

        res.json({
            folderName,
            totalFiles: attachments.length,
            totalSize,
            tree,
            files: attachments
        });
    } catch (error) {
        console.error('Error getting folder contents:', error);
        res.status(500).json({ message: 'Lỗi khi lấy nội dung thư mục' });
    }
};

// Delete an entire folder (all files with same folderName)
export const deleteProjectFolder = async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params;
        const { folderName } = req.body;
        const userId = req.user?.id;
        const userRole = req.user?.role;

        if (!userId) return res.status(401).json({ message: 'Unauthorized' });
        if (!folderName) return res.status(400).json({ message: 'Tên thư mục không được để trống' });

        // Check permissions
        const project = await prisma.project.findUnique({
            where: { id: Number(projectId) },
            include: {
                manager: { select: { id: true } },
                createdBy: { select: { id: true } }
            }
        });

        if (!project) return res.status(404).json({ message: 'Dự án không tồn tại' });

        const isAdmin = userRole === 'ADMIN';
        const isManager = project.manager.id === userId;
        const isCreator = project.createdBy?.id === userId;

        // Get all files in the folder
        const attachments = await prisma.projectAttachment.findMany({
            where: {
                projectId: Number(projectId),
                isFolder: true,
                folderName
            }
        });

        if (attachments.length === 0) return res.status(404).json({ message: 'Không tìm thấy thư mục' });

        // Only admin, manager, creator, or the uploader can delete
        const isUploader = attachments[0]!.uploadedById === userId;
        if (!isAdmin && !isManager && !isCreator && !isUploader) {
            return res.status(403).json({ message: 'Bạn không có quyền xóa thư mục này' });
        }

        // Delete all files from MinIO
        for (const att of attachments) {
            try {
                await deleteFile(att.minioPath);
            } catch (err) {
                console.error(`Error deleting file ${att.minioPath}:`, err);
            }
        }

        // Delete all records
        await prisma.projectAttachment.deleteMany({
            where: {
                projectId: Number(projectId),
                isFolder: true,
                folderName
            }
        });

        res.json({ message: `Đã xóa thư mục "${folderName}" (${attachments.length} tệp)` });
    } catch (error) {
        console.error('Error deleting project folder:', error);
        res.status(500).json({ message: 'Lỗi khi xóa thư mục' });
    }
};
