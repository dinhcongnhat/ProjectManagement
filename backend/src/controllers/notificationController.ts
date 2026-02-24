import type { Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../config/prisma.js';

// Lấy danh sách thông báo của user
export const getNotifications = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { limit = 20, page = 1 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const [notifications, total, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: Number(limit),
                skip,
                include: {
                    project: {
                        select: { id: true, name: true, code: true }
                    }
                }
            }),
            prisma.notification.count({ where: { userId } }),
            prisma.notification.count({ where: { userId, isRead: false } })
        ]);

        res.json({
            notifications,
            total,
            unreadCount,
            page: Number(page),
            totalPages: Math.ceil(total / Number(limit))
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Đánh dấu thông báo đã đọc
export const markAsRead = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { id } = req.params;

        const notification = await prisma.notification.findFirst({
            where: { id: Number(id), userId }
        });

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        const updated = await prisma.notification.update({
            where: { id: Number(id) },
            data: {
                isRead: true,
                readAt: new Date()
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Đánh dấu tất cả đã đọc
export const markAllAsRead = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        await prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: {
                isRead: true,
                readAt: new Date()
            }
        });

        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Xóa thông báo
export const deleteNotification = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { id } = req.params;

        const notification = await prisma.notification.findFirst({
            where: { id: Number(id), userId }
        });

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        await prisma.notification.delete({
            where: { id: Number(id) }
        });

        res.json({ message: 'Notification deleted' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Xóa tất cả thông báo đã đọc
export const deleteAllRead = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        await prisma.notification.deleteMany({
            where: { userId, isRead: true }
        });

        res.json({ message: 'All read notifications deleted' });
    } catch (error) {
        console.error('Error deleting read notifications:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Tạo thông báo (internal helper - được gọi từ các service khác)
export const createNotification = async (
    userId: number,
    type: string,
    title: string,
    message: string,
    projectId?: number,
    taskId?: number,
    kanbanBoardId?: number,
    kanbanCardId?: number
) => {
    try {
        const notification = await prisma.notification.create({
            data: {
                userId,
                type,
                title,
                message,
                projectId: projectId ?? null,
                taskId: taskId ?? null,
                kanbanBoardId: kanbanBoardId ?? null,
                kanbanCardId: kanbanCardId ?? null
            }
        });
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
};

// Tạo thông báo cho nhiều users (batch)
export const createNotificationsForUsers = async (
    userIds: number[],
    type: string,
    title: string,
    message: string,
    projectId?: number,
    taskId?: number
) => {
    try {
        const notifications = await prisma.notification.createMany({
            data: userIds.map(userId => ({
                userId,
                type,
                title,
                message,
                projectId: projectId ?? null,
                taskId: taskId ?? null
            }))
        });
        return notifications;
    } catch (error) {
        console.error('Error creating notifications:', error);
        return null;
    }
};
