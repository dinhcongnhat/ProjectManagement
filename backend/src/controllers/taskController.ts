import type { Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../config/prisma.js';
import { createCardForTask } from './kanbanController.js';

export const createTask = async (req: AuthRequest, res: Response) => {
    try {
        const { title, description, assigneeId, startDate, endDate, type, reminderAt, projectId } = req.body;
        const creatorId = req.user!.id;

        // Any user can create both PERSONAL and ASSIGNED tasks
        const taskType = type || 'PERSONAL';
        const assignedTo = taskType === 'PERSONAL' ? creatorId : (assigneeId || creatorId);

        const now = new Date();
        const task = await prisma.task.create({
            data: {
                title,
                description,
                status: 'TODO',
                type: taskType,
                startDate: startDate ? new Date(startDate) : null,
                endDate: endDate ? new Date(endDate) : null,
                reminderAt: reminderAt ? new Date(reminderAt) : null,
                isReminderSent: false,
                creatorId,
                assigneeId: assignedTo,
                createdAt: now,
            },
        });

        // Auto-create Kanban card if task is ASSIGNED and has a projectId
        if (taskType === 'ASSIGNED' && assignedTo && projectId) {
            await createCardForTask(
                task.id,
                title,
                description || null,
                assignedTo,
                creatorId,
                Number(projectId),
                endDate ? new Date(endDate) : null
            );
        }

        res.status(201).json(task);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getTasks = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        // My Tasks: Only show tasks for current user
        // - Tasks assigned to this user
        // - Personal tasks created by this user
        const tasks = await prisma.task.findMany({
            where: {
                OR: [
                    { assigneeId: userId },
                    { creatorId: userId, type: 'PERSONAL' as const }
                ]
            },
            include: {
                assignee: {
                    select: { id: true, username: true, name: true }
                },
                creator: {
                    select: { id: true, username: true, name: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(tasks);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const updateTask = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { title, description, status, startDate, endDate, note, reminderAt } = req.body;
        const userId = req.user!.id;
        const role = req.user!.role;

        const task = await prisma.task.findUnique({ where: { id: Number(id) } });

        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Check permissions - user can update tasks they created or are assigned to
        if (role !== 'ADMIN') {
            if (task.assigneeId !== userId && task.creatorId !== userId) {
                return res.status(403).json({ message: 'Access denied' });
            }
        }

        const updateData: any = {
            title,
            description,
            status,
        };
        if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
        if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
        if (reminderAt !== undefined) {
            updateData.reminderAt = reminderAt ? new Date(reminderAt) : null;
            // Reset reminder sent flag if date changed
            if (reminderAt) updateData.isReminderSent = false;
        }

        // Xử lý ghi chú
        if (note !== undefined) {
            updateData.note = note;
            updateData.lastNoteAt = new Date(); // Cập nhật thời gian ghi chú
        }

        const updatedTask = await prisma.task.update({
            where: { id: Number(id) },
            data: updateData,
        });

        res.json(updatedTask);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const deleteTask = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.id;
        const role = req.user!.role;

        const task = await prisma.task.findUnique({ where: { id: Number(id) } });

        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Any user can delete tasks they created or are assigned to
        if (role !== 'ADMIN') {
            if (task.creatorId !== userId && task.assigneeId !== userId) {
                return res.status(403).json({ message: 'Access denied' });
            }
        }

        await prisma.task.delete({ where: { id: Number(id) } });
        res.json({ message: 'Task deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};
