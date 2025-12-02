import type { Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../config/prisma.js';
import { createActivity } from './activityController.js';

import { uploadFile, getFileStream, getFileStats } from '../services/minioService.js';

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
            const fileName = `${Date.now()}-${req.file.originalname}`;
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
        const projects = await prisma.project.findMany({
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

        // Set headers for download/preview
        const originalName = project.attachment.split('-').slice(1).join('-');

        // Use 'inline' to allow browser preview, fallback to 'attachment' if needed
        res.setHeader('Content-Disposition', `inline; filename="${originalName}"`);

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

        // Check current project status
        const currentProject = await prisma.project.findUnique({
            where: { id: Number(id) },
            select: { status: true },
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
            const progressChanged = currentProject.progress !== Number(progress);
            if (progressChanged || status !== currentProject.status) {
                await createActivity(
                    Number(id),
                    req.user.id,
                    `Cập nhật tiến độ từ ${currentProject.progress}% lên ${progress}%${status !== currentProject.status ? ` (${status === 'PENDING_APPROVAL' ? 'Chờ duyệt' : 'Đang thực hiện'})` : ''}`,
                    'progress',
                    `${currentProject.progress}%`,
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

        // Check if project exists and is pending approval
        const currentProject = await prisma.project.findUnique({
            where: { id: Number(id) },
            select: { status: true, progress: true },
        });

        if (!currentProject) {
            return res.status(404).json({ message: 'Project not found' });
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

