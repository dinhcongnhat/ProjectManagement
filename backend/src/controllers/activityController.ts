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

// Get recent activities for a user (across all their projects)
export const getUserActivities = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user.id;
        const page = parseInt(req.query.page as string || '1');
        const limit = parseInt(req.query.limit as string || '20');
        const skip = (page - 1) * limit;

        // Find projects where user is involved
        const projects = await prisma.project.findMany({
            where: {
                OR: [
                    { managerId: userId },
                    { createdById: userId },
                    { implementers: { some: { id: userId } } },
                    { cooperators: { some: { id: userId } } },
                    { followers: { some: { id: userId } } }
                ]
            },
            select: { id: true, name: true, code: true }
        });

        const projectIds = projects.map(p => p.id);
        const projectMap = new Map(projects.map(p => [p.id, p]));

        // Get combined activities from multiple sources
        const combinedActivities: any[] = [];

        // 1. Get project activities
        const projectActivities = await prisma.projectActivity.findMany({
            where: {
                projectId: { in: projectIds }
            },
            include: {
                user: {
                    select: { id: true, name: true, role: true }
                },
                project: {
                    select: { id: true, name: true, code: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: limit * 2
        });

        combinedActivities.push(...projectActivities.map(a => ({
            ...a,
            activityType: 'PROJECT_ACTIVITY'
        })));

        // 2. Get recent tasks assigned to user
        const recentTasks = await prisma.task.findMany({
            where: {
                OR: [
                    { assigneeId: userId },
                    { creatorId: userId }
                ]
            },
            include: {
                assignee: {
                    select: { id: true, name: true, role: true }
                },
                creator: {
                    select: { id: true, name: true, role: true }
                }
            },
            orderBy: { updatedAt: 'desc' },
            take: limit
        });

        // Convert tasks to activity format
        for (const task of recentTasks) {
            combinedActivities.push({
                id: `task-${task.id}`,
                action: task.createdAt.getTime() === task.updatedAt.getTime() ? 'CREATE_TASK' : 'UPDATE_TASK',
                fieldName: 'task',
                oldValue: null,
                newValue: task.title,
                createdAt: task.updatedAt,
                user: task.assignee || task.creator || { id: userId, name: 'Hệ thống', role: 'SYSTEM' },
                project: null, // Tasks are not linked to projects in this schema
                activityType: 'TASK',
                taskId: task.id,
                taskStatus: task.status
            });
        }

        // 3. Get recent messages (discussions) in user's projects
        if (projectIds.length > 0) {
            const recentMessages = await prisma.message.findMany({
                where: {
                    projectId: { in: projectIds }
                },
                include: {
                    sender: {
                        select: { id: true, name: true, role: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: limit
            });

            for (const msg of recentMessages) {
                const project = projectMap.get(msg.projectId);
                // Map message type - detect video from file extension if not explicitly VIDEO
                let displayType: string = msg.messageType;
                if (msg.attachment && (msg.messageType === 'FILE' || msg.messageType === 'IMAGE')) {
                    // Check if it's a video by attachment name/extension
                    const lowerPath = msg.attachment.toLowerCase();
                    if (lowerPath.includes('.mp4') || lowerPath.includes('.webm') || lowerPath.includes('.mov') || lowerPath.includes('.avi') || lowerPath.includes('.mkv')) {
                        displayType = 'VIDEO';
                    }
                }
                
                const getDisplayText = (type: string): string => {
                    switch (type) {
                        case 'IMAGE': return 'hình ảnh';
                        case 'VIDEO': return 'video';
                        case 'VOICE': return 'tin nhắn thoại';
                        default: return 'tệp đính kèm';
                    }
                };
                
                combinedActivities.push({
                    id: `msg-${msg.id}`,
                    action: msg.messageType === 'TEXT' ? 'SEND_MESSAGE' : 'SEND_ATTACHMENT',
                    fieldName: 'message',
                    oldValue: null,
                    newValue: msg.content || getDisplayText(displayType),
                    createdAt: msg.createdAt,
                    user: msg.sender,
                    project: project || { id: msg.projectId, name: 'Dự án', code: '' },
                    activityType: 'MESSAGE',
                    messageType: displayType
                });
            }
        }

        // Sort all activities by date
        combinedActivities.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Paginate
        const paginatedActivities = combinedActivities.slice(skip, skip + limit);
        const total = combinedActivities.length;

        res.json({
            activities: paginatedActivities,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching user activities:', error);
        res.status(500).json({ error: 'Failed to fetch user activities' });
    }
};
