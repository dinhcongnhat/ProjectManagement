import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get activity history for a project
export const getActivities = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;
        const page = parseInt(req.query.page as string || '1');
        const limit = parseInt(req.query.limit as string || '50');
        const skip = (page - 1) * limit;

        const activities = await prisma.projectActivity.findMany({
            where: { projectId: parseInt(projectId || '0') },
            include: {
                user: {
                    select: { id: true, name: true, role: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
        });

        const total = await prisma.projectActivity.count({
            where: { projectId: parseInt(projectId || '0') }
        });

        res.json({
            activities,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({ error: 'Failed to fetch activities' });
    }
};

// Create a new activity (internal use)
export const createActivity = async (
    projectId: number,
    userId: number,
    action: string,
    fieldName?: string,
    oldValue?: string,
    newValue?: string
): Promise<void> => {
    try {
        await prisma.projectActivity.create({
            data: {
                action,
                fieldName: fieldName ?? null,
                oldValue: oldValue ?? null,
                newValue: newValue ?? null,
                projectId,
                userId
            }
        });
    } catch (error) {
        console.error('Error creating activity:', error);
        // Don't throw - activity logging shouldn't break the main operation
    }
};
