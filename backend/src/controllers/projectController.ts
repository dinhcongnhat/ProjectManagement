import type { Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../config/prisma.js';
import { createActivity } from './activityController.js';

import { uploadFile, getFileStream, getFileStats, normalizeVietnameseFilename } from '../services/minioService.js';

export const createProject = async (req: AuthRequest, res: Response) => {
    try {
        const {
            code,
            name,
            startDate,
            endDate,
            duration,
            group,
            value,
            progressMethod,
            managerId,
            description,
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

        console.log('Received createProject body:', req.body);
        console.log('Received file:', req.file);

        // Basic validation
        const missingFields = [];
        if (!code) missingFields.push('code');
        if (!name) missingFields.push('name');
        if (!managerId) missingFields.push('managerId');
        if (!progressMethod) missingFields.push('progressMethod');

        if (missingFields.length > 0) {
            return res.status(400).json({ message: `Missing required fields: ${missingFields.join(', ')}` });
        }

        let attachmentPath = null;
        if (req.file) {
            // Normalize Vietnamese filename to ensure proper encoding
            const normalizedFilename = normalizeVietnameseFilename(req.file.originalname);
            const fileName = `${Date.now()}-${normalizedFilename}`;
            attachmentPath = await uploadFile(fileName, req.file.buffer, {
                'Content-Type': req.file.mimetype,
            });
        }

        const project = await prisma.project.create({
            data: {
                code,
                name,
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                duration,
                group,
                value,
                progressMethod,
                description,
                attachment: attachmentPath,
                progress: 0,
                status: 'IN_PROGRESS',
                managerId: Number(managerId),
                implementers: {
                    connect: Array.isArray(implementerIds) ? implementerIds.map((id: string | number) => ({ id: Number(id) })) : [],
                },
                followers: {
                    connect: Array.isArray(followerIds) ? followerIds.map((id: string | number) => ({ id: Number(id) })) : [],
                },
            },
        });

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

        // Nếu là Admin, chỉ lấy dự án mà admin đó tạo ra, quản lý hoặc là người thực hiện/theo dõi
        // Nếu là User, lấy dự án mà user là người thực hiện hoặc theo dõi
        let whereClause: any = {};
        
        if (userRole === 'ADMIN') {
            whereClause = {
                OR: [
                    { managerId: userId },
                    { implementers: { some: { id: userId } } },
                    { followers: { some: { id: userId } } },
                ]
            };
        } else {
            // User thường: chỉ thấy dự án liên quan đến mình
            whereClause = {
                OR: [
                    { managerId: userId },
                    { implementers: { some: { id: userId } } },
                    { followers: { some: { id: userId } } },
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
        const {
            code,
            name,
            startDate,
            endDate,
            duration,
            group,
            value,
            progressMethod,
            managerId,
            implementerIds,
            followerIds,
            description,
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
                progressMethod,
                description,
                managerId: Number(managerId),
                implementers: {
                    set: [], // Clear existing relations
                    connect: implementerIds?.map((id: string) => ({ id: Number(id) })) || [],
                },
                followers: {
                    set: [], // Clear existing relations
                    connect: followerIds?.map((id: string) => ({ id: Number(id) })) || [],
                },
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
        await prisma.project.delete({ where: { id: Number(id) } });
        res.json({ message: 'Project deleted' });
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
        res.setHeader('Content-Disposition', `inline; filename="${originalName}"; filename*=UTF-8''${encodedFilename}`);

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

export const updateProjectProgress = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { progress } = req.body;

        if (progress === undefined || progress < 0 || progress > 100) {
            return res.status(400).json({ message: 'Progress must be between 0 and 100' });
        }

        // Check current project status and progress
        const currentProject = await prisma.project.findUnique({
            where: { id: Number(id) },
            select: { status: true, progress: true },
        });

        if (!currentProject) {
            return res.status(404).json({ message: 'Project not found' });
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

