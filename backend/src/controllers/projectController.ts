import type { Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../config/prisma.js';

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
            implementerIds,
            followerIds,
            description,
        } = req.body;

        console.log('Received createProject body:', req.body);

        // Basic validation
        const missingFields = [];
        if (!code) missingFields.push('code');
        if (!name) missingFields.push('name');
        if (!managerId) missingFields.push('managerId');
        if (!progressMethod) missingFields.push('progressMethod');

        if (missingFields.length > 0) {
            return res.status(400).json({ message: `Missing required fields: ${missingFields.join(', ')}` });
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
                managerId: Number(managerId),
                implementers: {
                    connect: implementerIds?.map((id: string) => ({ id: Number(id) })) || [],
                },
                followers: {
                    connect: followerIds?.map((id: string) => ({ id: Number(id) })) || [],
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
