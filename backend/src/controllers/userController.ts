import type { Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../config/prisma.js';
import bcrypt from 'bcryptjs';

export const getUsers = async (req: AuthRequest, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                username: true,
                name: true,
                role: true,
                position: true,
            },
        });
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const createUser = async (req: AuthRequest, res: Response) => {
    try {
        const { username, password, name, role, position } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                name,
                role: role || 'USER',
                position,
            },
        });

        res.status(201).json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { username, name, role, position, password } = req.body;

        const updateData: any = {
            username,
            name,
            role,
            position,
        };

        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        const user = await prisma.user.update({
            where: { id: Number(id) },
            data: updateData,
        });

        res.json(user);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = Number(id);

        // Check if user is managing any projects
        const managedProjects = await prisma.project.findMany({
            where: { managerId: userId },
            select: { id: true, name: true }
        });

        if (managedProjects.length > 0) {
            return res.status(400).json({ 
                message: `Không thể xóa người dùng này vì đang quản lý ${managedProjects.length} dự án. Vui lòng chuyển quyền quản lý trước khi xóa.`,
                projects: managedProjects
            });
        }

        // Check if user has created tasks
        const createdTasks = await prisma.task.findMany({
            where: { creatorId: userId },
            select: { id: true }
        });

        // Check if user has assigned tasks
        const assignedTasks = await prisma.task.findMany({
            where: { assigneeId: userId },
            select: { id: true }
        });

        // Use transaction to safely delete user and related data
        await prisma.$transaction(async (tx) => {
            // Disconnect from implementers
            const implementedProjects = await tx.project.findMany({
                where: { implementers: { some: { id: userId } } }
            });
            for (const project of implementedProjects) {
                await tx.project.update({
                    where: { id: project.id },
                    data: { implementers: { disconnect: { id: userId } } }
                });
            }

            // Disconnect from followers
            const followedProjects = await tx.project.findMany({
                where: { followers: { some: { id: userId } } }
            });
            for (const project of followedProjects) {
                await tx.project.update({
                    where: { id: project.id },
                    data: { followers: { disconnect: { id: userId } } }
                });
            }

            // Update created tasks to transfer to current admin
            if (createdTasks.length > 0) {
                await tx.task.updateMany({
                    where: { creatorId: userId },
                    data: { creatorId: req.user?.id || 1 }
                });
            }

            // Unassign tasks from user
            if (assignedTasks.length > 0) {
                await tx.task.updateMany({
                    where: { assigneeId: userId },
                    data: { assigneeId: null }
                });
            }

            // Delete user's messages
            await tx.message.deleteMany({
                where: { senderId: userId }
            });

            // Delete user's activities
            await tx.projectActivity.deleteMany({
                where: { userId: userId }
            });

            // Finally delete the user
            await tx.user.delete({ where: { id: userId } });
        });

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Không thể xóa người dùng. Vui lòng thử lại.' });
    }
};
