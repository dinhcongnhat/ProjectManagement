import type { Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../config/prisma.js';
import { uploadFile, getFileStream, getFileStats, deleteFile, getPresignedUrl, normalizeVietnameseFilename } from '../services/minioService.js';

// Helper function to sanitize project name for folder path
const sanitizeFolderName = (name: string): string => {
    // Remove special characters, keep Vietnamese characters
    return name
        .replace(/[\/\\:*?"<>|]/g, '') // Remove invalid path characters
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .trim();
};

// Get MinIO path for project attachments
const getAttachmentPath = (projectName: string, category: 'TaiLieuDinhKem' | 'NhanVienDinhKem', fileName: string): string => {
    const sanitizedName = sanitizeFolderName(projectName);
    const timestamp = Date.now();
    return `DuAn/${sanitizedName}/${category}/${timestamp}-${fileName}`;
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
                createdBy: { select: { id: true } }
            }
        });

        if (!project) {
            return res.status(404).json({ message: 'Dự án không tồn tại' });
        }

        // Check permissions
        const isAdmin = userRole === 'ADMIN';
        const isManager = project.manager.id === userId;
        const isImplementer = project.implementers.some(impl => impl.id === userId);
        const isCreator = project.createdBy?.id === userId;

        if (!isAdmin && !isManager && !isImplementer && !isCreator) {
            return res.status(403).json({ message: 'Bạn không có quyền đính kèm tệp cho dự án này' });
        }

        // Determine category based on user role
        // Admin/Creator/Manager uploads to TaiLieuDinhKem
        // Implementer uploads to NhanVienDinhKem (only after project is completed or pending approval)
        let category: 'TaiLieuDinhKem' | 'NhanVienDinhKem' = 'TaiLieuDinhKem';

        if (!isAdmin && !isManager && !isCreator && isImplementer) {
            // Implementer can only upload after project reaches 100% or is completed
            if (project.status !== 'PENDING_APPROVAL' && project.status !== 'COMPLETED') {
                return res.status(403).json({
                    message: 'Nhân viên chỉ có thể đính kèm tệp khi dự án đã hoàn thành (100%)'
                });
            }
            category = 'NhanVienDinhKem';
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
                createdBy: { select: { id: true } }
            }
        });

        if (!project) {
            return res.status(404).json({ message: 'Dự án không tồn tại' });
        }

        // Check permissions
        const isAdmin = userRole === 'ADMIN';
        const isManager = project.manager.id === userId;
        const isImplementer = project.implementers.some(impl => impl.id === userId);
        const isCreator = project.createdBy?.id === userId;

        if (!isAdmin && !isManager && !isImplementer && !isCreator) {
            return res.status(403).json({ message: 'Bạn không có quyền đính kèm tệp cho dự án này' });
        }

        // Determine category
        let category: 'TaiLieuDinhKem' | 'NhanVienDinhKem' = 'TaiLieuDinhKem';

        if (!isAdmin && !isManager && !isCreator && isImplementer) {
            if (project.status !== 'PENDING_APPROVAL' && project.status !== 'COMPLETED') {
                return res.status(403).json({
                    message: 'Nhân viên chỉ có thể đính kèm tệp khi dự án đã hoàn thành (100%)'
                });
            }
            category = 'NhanVienDinhKem';
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

        const fileStream = await getFileStream(attachment.minioPath);
        const fileStats = await getFileStats(attachment.minioPath);

        // Encode filename for Content-Disposition header
        const encodedFilename = encodeURIComponent(attachment.name).replace(/'/g, "%27");

        res.setHeader('Content-Disposition', `inline; filename="${attachment.name}"; filename*=UTF-8''${encodedFilename}`);
        res.setHeader('Content-Type', attachment.fileType || 'application/octet-stream');
        res.setHeader('Content-Length', fileStats.size);

        fileStream.pipe(res);
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

        const url = await getPresignedUrl(attachment.minioPath, 3600);
        res.json({ url });
    } catch (error) {
        console.error('Error getting presigned URL:', error);
        res.status(500).json({ message: 'Lỗi khi lấy URL' });
    }
};
