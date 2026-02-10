import type { Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../config/prisma.js';
import { createActivity } from './activityController.js';
import { notifyProjectAssignment, notifyProjectUpdate } from '../services/pushNotificationService.js';
import { sendProjectAssignmentEmail } from '../services/emailService.js';
import { getOrCreateProjectBoard } from './kanbanController.js';

import { uploadFile, getFileStream, getFileStats, normalizeVietnameseFilename } from '../services/minioService.js';

export const createProject = async (req: AuthRequest, res: Response) => {
    try {
        const {
            code,
            name,
            investor,  // Chủ đầu tư
            startDate,
            endDate,
            duration,
            group,
            value,
            managerId,
            description,
            parentId,  // Add parentId for sub-project
            priority,
            // New fields for sub-project
            documentNumber,
            documentDate,
            implementingUnit,
            appraisalUnit,
            approver,
            productType,
            status,
        } = req.body;

        // Parse array fields if they come as strings (FormData behavior)
        let implementerIds = req.body.implementerIds;
        if (typeof implementerIds === 'string') {
            try {
                implementerIds = JSON.parse(implementerIds);
            } catch (e) {
                implementerIds = [implementerIds];
            }
        }

        let followerIds = req.body.followerIds;
        if (typeof followerIds === 'string') {
            try {
                followerIds = JSON.parse(followerIds);
            } catch (e) {
                followerIds = [followerIds];
            }
        }

        // Parse cooperatorIds - Phối hợp thực hiện
        let cooperatorIds = req.body.cooperatorIds;
        if (typeof cooperatorIds === 'string') {
            try {
                cooperatorIds = JSON.parse(cooperatorIds);
            } catch (e) {
                cooperatorIds = [cooperatorIds];
            }
        }

        console.log('Received createProject body:', req.body);
        console.log('Received file:', req.file);

        // Basic validation
        const missingFields = [];
        if (!code) missingFields.push('code');
        if (!name) missingFields.push('name');
        // managerId is optional - defaults to the current user (creator becomes manager)

        if (missingFields.length > 0) {
            return res.status(400).json({ message: `Missing required fields: ${missingFields.join(', ')}` });
        }

        // If no managerId provided, the creator becomes the project manager
        const projectManagerId = managerId ? Number(managerId) : req.user!.id;

        let attachmentPath = null;
        if (req.file) {
            // Normalize Vietnamese filename to ensure proper encoding
            const normalizedFilename = normalizeVietnameseFilename(req.file.originalname);
            attachmentPath = await uploadFile(normalizedFilename, req.file.buffer, {
                'Content-Type': req.file.mimetype,
            });
        }

        const now = new Date();

        // Determine project status - use provided status for sub-projects or default to IN_PROGRESS
        const projectStatus = parentId && status ? status : 'IN_PROGRESS';

        const project = await prisma.project.create({
            data: {
                code,
                name,
                investor,  // Chủ đầu tư
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                duration,
                group,
                value,
                description,
                attachment: attachmentPath,
                progress: 0,
                status: projectStatus,
                priority: priority || 'NORMAL',
                managerId: projectManagerId,
                createdById: req.user?.id ?? null, // Save the creator ID
                parentId: parentId ? Number(parentId) : null,  // Add parentId
                // New fields for sub-project
                documentNumber: documentNumber || null,
                documentDate: documentDate ? new Date(documentDate) : null,
                implementingUnit: implementingUnit || null,
                appraisalUnit: appraisalUnit || null,
                approver: approver || null,
                productType: productType || null,
                implementers: {
                    connect: Array.isArray(implementerIds) ? implementerIds.map((id: string | number) => ({ id: Number(id) })) : [],
                },
                followers: {
                    connect: Array.isArray(followerIds) ? followerIds.map((id: string | number) => ({ id: Number(id) })) : [],
                },
                cooperators: {
                    connect: Array.isArray(cooperatorIds) ? cooperatorIds.map((id: string | number) => ({ id: Number(id) })) : [],
                },
                // Tự động tạo ProjectWorkflow khi tạo dự án
                workflow: {
                    create: {
                        currentStatus: 'RECEIVED',
                        receivedStartAt: now,  // Ngày bắt đầu = ngày tạo project
                    }
                }
            },
            include: {
                parent: { select: { id: true, name: true, code: true } },
                children: { select: { id: true, name: true, code: true, progress: true, status: true } },
                cooperators: { select: { id: true, name: true } },
                workflow: true,
            },
        });

        // Send push notifications and emails to assigned users
        try {
            // Get creator name from database
            let creatorName = 'Admin';
            if (req.user?.id) {
                const creator = await prisma.user.findUnique({
                    where: { id: req.user.id },
                    select: { name: true }
                });
                creatorName = creator?.name || 'Admin';
            }

            // Helper function to send notification and email
            const notifyAndEmail = async (userId: number, role: 'manager' | 'implementer' | 'follower') => {
                // Get user info for email
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { name: true, email: true }
                });

                // Send push notification
                await notifyProjectAssignment(
                    userId,
                    project.id,
                    name,
                    creatorName,
                    role
                );

                // Send email if user has email
                if (user?.email) {
                    await sendProjectAssignmentEmail(
                        user.email,
                        user.name,
                        project.id,
                        name,
                        code,
                        role,
                        creatorName,
                        startDate ? new Date(startDate) : null,
                        endDate ? new Date(endDate) : null,
                        description || null
                    );
                }
            };

            // Notify manager
            if (projectManagerId !== req.user?.id) {
                await notifyAndEmail(projectManagerId, 'manager');
            }

            // Notify implementers
            if (Array.isArray(implementerIds)) {
                for (const implId of implementerIds) {
                    if (Number(implId) !== req.user?.id) {
                        await notifyAndEmail(Number(implId), 'implementer');
                    }
                }
            }

            // Notify followers
            if (Array.isArray(followerIds)) {
                for (const followId of followerIds) {
                    if (Number(followId) !== req.user?.id) {
                        await notifyAndEmail(Number(followId), 'follower');
                    }
                }
            }
        } catch (pushError) {
            console.error('[createProject] Notification/Email error:', pushError);
        }

        // Auto-create Kanban board for project with implementers
        try {
            if (Array.isArray(implementerIds) && implementerIds.length > 0) {
                const board = await getOrCreateProjectBoard(project.id, projectManagerId);
                if (board) {
                    // Add all implementers as board members
                    for (const implId of implementerIds) {
                        const uid = Number(implId);
                        if (!board.members.some(m => m.userId === uid)) {
                            await prisma.kanbanBoardMember.create({
                                data: { boardId: board.id, userId: uid, role: 'MEMBER' }
                            }).catch(() => {});
                        }
                    }
                    // Add followers as board members too
                    if (Array.isArray(followerIds)) {
                        for (const fId of followerIds) {
                            const uid = Number(fId);
                            if (!board.members.some(m => m.userId === uid)) {
                                await prisma.kanbanBoardMember.create({
                                    data: { boardId: board.id, userId: uid, role: 'ADMIN' }
                                }).catch(() => {});
                            }
                        }
                    }
                }
            }
        } catch (kanbanError) {
            console.error('[createProject] Kanban board creation error:', kanbanError);
        }

        res.status(201).json(project);
    } catch (error: any) {
        console.error('Error creating project:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ message: 'Project code already exists' });
        }
        res.status(500).json({ message: 'Server error' });
    }
};

export const getProjects = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const { q } = req.query; // Search query

        // Nếu là Admin, lấy tất cả dự án
        // Nếu là User, lấy dự án mà user tạo ra, quản lý hoặc là người thực hiện/theo dõi/phối hợp
        let whereClause: any = {};

        if (userRole === 'ADMIN') {
            whereClause = {
                OR: [
                    { createdById: userId }, // Admin sees projects they created
                    { managerId: userId },
                    { implementers: { some: { id: userId } } },
                    { followers: { some: { id: userId } } },
                    { cooperators: { some: { id: userId } } },
                ]
            };
        } else {
            // User thường: thấy dự án mình tạo, quản lý hoặc liên quan đến mình
            whereClause = {
                OR: [
                    { createdById: userId }, // User sees projects they created
                    { managerId: userId },
                    { implementers: { some: { id: userId } } },
                    { followers: { some: { id: userId } } },
                    { cooperators: { some: { id: userId } } },
                ]
            };
        }

        // Add search filter if query provided
        if (q) {
            whereClause = {
                AND: [
                    whereClause,
                    {
                        OR: [
                            { name: { contains: String(q), mode: 'insensitive' } },
                            { code: { contains: String(q), mode: 'insensitive' } },
                            { description: { contains: String(q), mode: 'insensitive' } },
                            { investor: { contains: String(q), mode: 'insensitive' } },
                        ]
                    }
                ]
            };
        }

        const projects = await prisma.project.findMany({
            where: whereClause,
            include: {
                manager: { select: { id: true, name: true } },
                implementers: { select: { id: true, name: true } },
                followers: { select: { id: true, name: true } },
                cooperators: { select: { id: true, name: true } },
                parent: { select: { id: true, name: true, code: true } },
                children: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        progress: true,
                        status: true,
                        priority: true,
                        startDate: true,
                        endDate: true,
                        duration: true,
                        value: true,
                        description: true,
                        // Sub-project specific fields
                        documentNumber: true,
                        documentDate: true,
                        implementingUnit: true,
                        appraisalUnit: true,
                        approver: true,
                        productType: true,
                        manager: { select: { id: true, name: true } },
                        implementers: { select: { id: true, name: true } },
                        cooperators: { select: { id: true, name: true } },
                        // Nested children (3rd level)
                        children: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                                progress: true,
                                status: true,
                                priority: true,
                                startDate: true,
                                endDate: true,
                                duration: true,
                                value: true,
                                documentNumber: true,
                                documentDate: true,
                                implementingUnit: true,
                                appraisalUnit: true,
                                approver: true,
                                productType: true,
                                manager: { select: { id: true, name: true } },
                            }
                        }
                    }
                },
                workflow: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(projects);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getProjectById = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const project = await prisma.project.findUnique({
            where: { id: Number(id) },
            include: {
                manager: { select: { id: true, name: true } },
                implementers: { select: { id: true, name: true } },
                followers: { select: { id: true, name: true } },
                cooperators: { select: { id: true, name: true } },
                parent: { select: { id: true, name: true, code: true } },
                children: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        progress: true,
                        status: true,
                        priority: true,
                        startDate: true,
                        endDate: true,
                        duration: true,
                        value: true,
                        description: true,
                        // Sub-project specific fields
                        documentNumber: true,
                        documentDate: true,
                        implementingUnit: true,
                        appraisalUnit: true,
                        approver: true,
                        productType: true,
                        manager: { select: { id: true, name: true } },
                        implementers: { select: { id: true, name: true } },
                        cooperators: { select: { id: true, name: true } },
                        // Nested children (3rd level)
                        children: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                                progress: true,
                                status: true,
                                priority: true,
                                startDate: true,
                                endDate: true,
                                duration: true,
                                value: true,
                                description: true,
                                documentNumber: true,
                                documentDate: true,
                                implementingUnit: true,
                                appraisalUnit: true,
                                approver: true,
                                productType: true,
                                manager: { select: { id: true, name: true } },
                                implementers: { select: { id: true, name: true } },
                                cooperators: { select: { id: true, name: true } },
                            },
                            orderBy: { createdAt: 'desc' },
                        }
                    },
                    orderBy: { createdAt: 'desc' },
                },
                attachments: {
                    include: {
                        uploadedBy: { select: { id: true, name: true, role: true } }
                    },
                    orderBy: { createdAt: 'desc' }
                },
                workflow: {
                    include: {
                        completedApprovedBy: { select: { id: true, name: true } }
                    }
                },
            },
        });

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        res.json(project);
    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const updateProject = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;

        // First, fetch the project to check permissions
        const existingProject = await prisma.project.findUnique({
            where: { id: Number(id) },
            include: {
                implementers: { select: { id: true } },
                cooperators: { select: { id: true } },
            }
        });

        if (!existingProject) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Check permission: Admin, Manager, Implementer, or Cooperator can update
        const isAdmin = userRole === 'ADMIN';
        const isManager = existingProject.managerId === userId;
        const isImplementer = existingProject.implementers.some(imp => imp.id === userId);
        const isCooperator = existingProject.cooperators.some(coop => coop.id === userId);

        if (!isAdmin && !isManager && !isImplementer && !isCooperator) {
            return res.status(403).json({ message: 'Access denied. You are not authorized to update this project.' });
        }

        const {
            code,
            name,
            startDate,
            endDate,
            duration,
            group,
            value,
            managerId,
            implementerIds,
            cooperatorIds,
            followerIds,
            description,
            priority,
            // Sub-project specific fields
            documentNumber,
            documentDate,
            implementingUnit,
            appraisalUnit,
            approver,
            productType,
            status,
        } = req.body;


        const project = await prisma.project.update({
            where: { id: Number(id) },
            data: {
                code,
                name,
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                duration,
                group,
                value,
                description,
                priority,
                managerId: Number(managerId),
                // Sub-project specific fields
                documentNumber,
                documentDate: documentDate ? new Date(documentDate) : null,
                implementingUnit,
                appraisalUnit,
                approver,
                productType,
                status,
                implementers: {
                    set: [], // Clear existing relations
                    connect: implementerIds?.map((id: string) => ({ id: Number(id) })) || [],
                },
                cooperators: {
                    set: [], // Clear existing relations
                    connect: cooperatorIds?.map((id: string) => ({ id: Number(id) })) || [],
                },
                followers: {
                    set: [], // Clear existing relations
                    connect: followerIds?.map((id: string) => ({ id: Number(id) })) || [],
                },
            },
            include: {
                manager: { select: { id: true, name: true } },
                implementers: { select: { id: true, name: true } },
                cooperators: { select: { id: true, name: true } },
                followers: { select: { id: true, name: true } },
            },
        });

        res.json(project);
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const deleteProject = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const projectId = Number(id);
        const userId = req.user?.id;
        const userRole = req.user?.role;

        // Check permission: Admin, project creator, or project manager can delete
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { managerId: true, createdById: true }
        });

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        const isAdmin = userRole === 'ADMIN';
        const isManager = project.managerId === userId;
        const isCreator = project.createdById === userId;

        if (!isAdmin && !isManager && !isCreator) {
            return res.status(403).json({ message: 'Bạn không có quyền xóa dự án này' });
        }

        // Find all child projects (cascade delete)
        const childProjects = await prisma.project.findMany({
            where: { parentId: projectId },
            select: { id: true }
        });

        // Delete all child projects first
        if (childProjects.length > 0) {
            const childIds = childProjects.map(p => p.id);
            await prisma.project.deleteMany({
                where: { id: { in: childIds } }
            });
        }

        // Delete the parent project
        await prisma.project.delete({ where: { id: projectId } });

        res.json({
            message: 'Project deleted',
            deletedChildren: childProjects.length
        });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const downloadAttachment = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const project = await prisma.project.findUnique({
            where: { id: Number(id) },
        });

        if (!project || !project.attachment) {
            return res.status(404).json({ message: 'Attachment not found' });
        }

        const fileStream = await getFileStream(project.attachment);
        const fileStats = await getFileStats(project.attachment);

        console.log('File stats:', fileStats);

        // Extract original filename and decode if needed
        let originalName = project.attachment.split('-').slice(1).join('-');

        // Handle path with prefix (e.g., onlyoffice/timestamp-filename)
        if (project.attachment.includes('/')) {
            const pathParts = project.attachment.split('/');
            const fileName = pathParts[pathParts.length - 1] || '';
            originalName = fileName.split('-').slice(1).join('-');
        }

        // Decode URI encoded filename
        try {
            originalName = decodeURIComponent(originalName);
        } catch {
            // If decoding fails, use as is
        }

        // Encode filename for Content-Disposition header (RFC 5987)
        const encodedFilename = encodeURIComponent(originalName).replace(/'/g, "%27");

        // Use 'inline' to allow browser preview, fallback to 'attachment' if needed
        // Use RFC 5987 encoding for non-ASCII filenames
        const safeFilename = originalName.replace(/[^\x20-\x7E]/g, '_');
        res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`);

        // Set correct Content-Type from MinIO stats
        if (fileStats.metaData && fileStats.metaData['content-type']) {
            console.log('Setting Content-Type from metadata:', fileStats.metaData['content-type']);
            res.setHeader('Content-Type', fileStats.metaData['content-type']);
        } else {
            console.log('Setting default Content-Type');
            res.setHeader('Content-Type', 'application/octet-stream');
        }

        fileStream.pipe(res);
    } catch (error) {
        console.error('Error downloading attachment:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Helper function to recalculate parent project progress from children
const recalculateParentProgress = async (parentId: number) => {
    const children = await prisma.project.findMany({
        where: { parentId },
        select: { progress: true }
    });

    if (children.length === 0) return;

    // Calculate average progress of all children
    const totalProgress = children.reduce((sum, child) => sum + (child.progress ?? 0), 0);
    const avgProgress = Math.round(totalProgress / children.length);

    // Get current parent status
    const parent = await prisma.project.findUnique({
        where: { id: parentId },
        select: { status: true, progress: true, parentId: true }
    });

    if (!parent || parent.status === 'COMPLETED') return;

    // Determine new status based on progress
    let newStatus = parent.status;
    if (avgProgress === 100 && parent.status === 'IN_PROGRESS') {
        newStatus = 'PENDING_APPROVAL';
    } else if (avgProgress < 100 && parent.status === 'PENDING_APPROVAL') {
        newStatus = 'IN_PROGRESS';
    }

    // Update parent progress
    await prisma.project.update({
        where: { id: parentId },
        data: {
            progress: avgProgress,
            status: newStatus
        }
    });

    // Recursively update grandparent if exists
    if (parent.parentId) {
        await recalculateParentProgress(parent.parentId);
    }
};

export const updateProjectProgress = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { progress } = req.body;

        if (progress === undefined || progress < 0 || progress > 100) {
            return res.status(400).json({ message: 'Progress must be between 0 and 100' });
        }

        // Check current project status, progress, and if it has children
        const currentProject = await prisma.project.findUnique({
            where: { id: Number(id) },
            select: {
                status: true,
                progress: true,
                parentId: true,
                children: { select: { id: true } }
            },
        });

        if (!currentProject) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // If project has children, don't allow manual progress update
        // Progress is calculated automatically from children
        if (currentProject.children && currentProject.children.length > 0) {
            return res.status(400).json({
                message: 'Không thể cập nhật tiến độ thủ công. Tiến độ dự án cha được tính tự động từ các dự án con.'
            });
        }

        // Don't allow progress updates if already completed
        if (currentProject.status === 'COMPLETED') {
            return res.status(400).json({ message: 'Cannot update progress of completed project' });
        }

        // Determine status based on progress
        let status = currentProject.status;
        if (progress === 100 && currentProject.status === 'IN_PROGRESS') {
            status = 'PENDING_APPROVAL';
        } else if (progress < 100 && currentProject.status === 'PENDING_APPROVAL') {
            status = 'IN_PROGRESS';
        }

        const project = await prisma.project.update({
            where: { id: Number(id) },
            data: {
                progress: Number(progress),
                status,
            },
            include: {
                manager: { select: { id: true, name: true } },
                implementers: { select: { id: true, name: true } },
                followers: { select: { id: true, name: true } },
            },
        });

        // If this project has a parent, recalculate parent's progress
        if (currentProject.parentId) {
            await recalculateParentProgress(currentProject.parentId);
        }

        // Log activity
        if (req.user?.id) {
            const oldProgress = currentProject.progress ?? 0;
            const progressChanged = oldProgress !== Number(progress);
            if (progressChanged || status !== currentProject.status) {
                await createActivity(
                    Number(id),
                    req.user.id,
                    `Cập nhật tiến độ từ ${oldProgress}% lên ${progress}%${status !== currentProject.status ? ` (${status === 'PENDING_APPROVAL' ? 'Chờ duyệt' : 'Đang thực hiện'})` : ''}`,
                    'progress',
                    `${oldProgress}%`,
                    `${progress}%`
                );

            }

            // Send notification if status changed to PENDING_APPROVAL (Submitted for review)
            if (status === 'PENDING_APPROVAL' && currentProject.status !== 'PENDING_APPROVAL') {
                try {
                    const adminUsers = await prisma.user.findMany({
                        where: { role: 'ADMIN', id: { not: req.user.id } },
                        select: { id: true }
                    });

                    const currentUser = await prisma.user.findUnique({
                        where: { id: req.user.id },
                        select: { name: true }
                    });

                    const recipientIds = new Set<number>(adminUsers.map(u => u.id));
                    // Also notify manager if not the one submitting (though usually implementer submits to manager)
                    if (project.managerId && project.managerId !== req.user.id) {
                        recipientIds.add(project.managerId);
                    }

                    if (recipientIds.size > 0) {
                        const { createNotificationsForUsers } = await import('./notificationController.js');
                        const submittedByName = currentUser?.name || 'Một thành viên';
                        await createNotificationsForUsers(
                            Array.from(recipientIds),
                            'PROJECT_SUBMITTED',
                            'Dự án chờ duyệt',
                            `${submittedByName} đã báo cáo hoàn thành dự án "${project.name}". Vui lòng kiểm tra và duyệt.`,
                            project.id
                        );
                    }
                } catch (notifError) {
                    console.error('Error sending submission notification:', notifError);
                }
            }
        }

        res.json(project);
    } catch (error) {
        console.error('Error updating project progress:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const approveProject = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        // Check if project exists and is pending approval
        const currentProject = await prisma.project.findUnique({
            where: { id: Number(id) },
            select: {
                status: true,
                progress: true,
                managerId: true,
                followers: { select: { id: true } },
            },
        });

        if (!currentProject) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Check if user is admin, manager, or follower
        const isAdmin = req.user?.role === 'ADMIN';
        const isManager = currentProject.managerId === userId;
        const isFollower = currentProject.followers.some(f => f.id === userId);

        if (!isAdmin && !isManager && !isFollower) {
            return res.status(403).json({ message: 'Bạn không có quyền duyệt dự án này. Chỉ quản trị viên, quản lý dự án hoặc người theo dõi mới có thể duyệt.' });
        }

        if (currentProject.status !== 'PENDING_APPROVAL') {
            return res.status(400).json({ message: 'Project is not pending approval' });
        }

        const project = await prisma.project.update({
            where: { id: Number(id) },
            data: {
                status: 'COMPLETED',
                progress: 100, // Ensure progress is 100%
            },
            include: {
                manager: { select: { id: true, name: true } },
                implementers: { select: { id: true, name: true } },
                followers: { select: { id: true, name: true } },
            },
        });

        // Log activity
        if (req.user?.id) {
            await createActivity(
                Number(id),
                req.user.id,
                'Duyệt dự án - Chuyển sang trạng thái Hoàn thành',
                'status',
                'PENDING_APPROVAL',
                'COMPLETED'
            );
        }

        res.json(project);
    } catch (error) {
        console.error('Error approving project:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Create sub-project - allowed for Manager of parent project or Admin
export const createSubProject = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role;
        const parentId = req.body.parentId;

        if (!parentId) {
            return res.status(400).json({ message: 'parentId is required for sub-project creation' });
        }

        // Check if user is Admin or Manager of parent project
        const parentProject = await prisma.project.findUnique({
            where: { id: Number(parentId) },
            select: { id: true, managerId: true, code: true }
        });

        if (!parentProject) {
            return res.status(404).json({ message: 'Parent project not found' });
        }

        const isAdmin = userRole === 'ADMIN';
        const isParentManager = parentProject.managerId === userId;

        if (!isAdmin && !isParentManager) {
            return res.status(403).json({
                message: 'Access denied. Only Admin or Manager of parent project can create sub-projects'
            });
        }

        // Now proceed with project creation (same logic as createProject)
        const {
            code,
            name,
            startDate,
            endDate,
            duration,
            value,
            managerId,
            description,
            priority,
            documentNumber,
            documentDate,
            implementingUnit,
            appraisalUnit,
            approver,
            productType,
        } = req.body;

        // Parse array fields
        let implementerIds = req.body.implementerIds;
        if (typeof implementerIds === 'string') {
            try {
                implementerIds = JSON.parse(implementerIds);
            } catch (e) {
                implementerIds = [implementerIds];
            }
        }

        let cooperatorIds = req.body.cooperatorIds;
        if (typeof cooperatorIds === 'string') {
            try {
                cooperatorIds = JSON.parse(cooperatorIds);
            } catch (e) {
                cooperatorIds = [cooperatorIds];
            }
        }

        // Basic validation
        const missingFields = [];
        if (!code) missingFields.push('code');
        if (!name) missingFields.push('name');
        if (!managerId) missingFields.push('managerId');

        if (missingFields.length > 0) {
            return res.status(400).json({ message: `Missing required fields: ${missingFields.join(', ')}` });
        }

        const now = new Date();

        const project = await prisma.project.create({
            data: {
                code,
                name,
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                duration,
                value,
                description,
                progress: 0,
                status: 'IN_PROGRESS',
                priority: priority || 'NORMAL',
                managerId: Number(managerId),
                createdById: userId ?? null,
                parentId: Number(parentId),
                documentNumber: documentNumber || null,
                documentDate: documentDate ? new Date(documentDate) : null,
                implementingUnit: implementingUnit || null,
                appraisalUnit: appraisalUnit || null,
                approver: approver || null,
                productType: productType || null,
                implementers: {
                    connect: Array.isArray(implementerIds) ? implementerIds.map((id: string | number) => ({ id: Number(id) })) : [],
                },
                cooperators: {
                    connect: Array.isArray(cooperatorIds) ? cooperatorIds.map((id: string | number) => ({ id: Number(id) })) : [],
                },
                workflow: {
                    create: {
                        currentStatus: 'RECEIVED',
                        receivedStartAt: now,
                    }
                }
            },
            include: {
                parent: { select: { id: true, name: true, code: true } },
                manager: { select: { id: true, name: true, email: true, avatar: true } },
                implementers: { select: { id: true, name: true, email: true, avatar: true } },
                cooperators: { select: { id: true, name: true, email: true, avatar: true } },
            },
        });

        // Create activity log
        await createActivity(
            project.id,
            userId!,
            'PROJECT_CREATED',
            'Dự án con đã được tạo'
        );

        // Send push notifications and emails to assigned users
        try {
            // Get creator name from database
            let creatorName = 'Admin';
            if (userId) {
                const creator = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { name: true }
                });
                creatorName = creator?.name || 'Admin';
            }

            // Helper function to send notification ONLY (no email for sub-projects)
            const notifyOnly = async (targetUserId: number, role: 'manager' | 'implementer' | 'cooperator') => {
                // Send push notification only - no email for sub-projects
                await notifyProjectAssignment(
                    targetUserId,
                    project.id,
                    name,
                    creatorName,
                    role
                );
            };

            // Notify manager (push notification only, no email for sub-projects)
            if (Number(managerId) !== userId) {
                await notifyOnly(Number(managerId), 'manager');
            }

            // Notify implementers
            if (Array.isArray(implementerIds)) {
                for (const implId of implementerIds) {
                    if (Number(implId) !== userId) {
                        await notifyOnly(Number(implId), 'implementer');
                    }
                }
            }

            // Notify cooperators
            if (Array.isArray(cooperatorIds)) {
                for (const coopId of cooperatorIds) {
                    if (Number(coopId) !== userId) {
                        await notifyOnly(Number(coopId), 'cooperator');
                    }
                }
            }
        } catch (pushError) {
            console.error('[createSubProject] Notification/Email error:', pushError);
        }

        res.status(201).json(project);
    } catch (error: any) {
        console.error('Error creating sub-project:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ message: 'Project code already exists' });
        }
        res.status(500).json({ message: 'Server error' });
    }
};

