import { Router } from 'express';
import type { Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import prisma from '../config/prisma.js';
import {
    getVapidPublicKey,
    subscribePush,
    unsubscribePush
} from '../services/pushNotificationService.js';

const router = Router();

// Get VAPID public key for push subscription (NO AUTH REQUIRED)
router.get('/vapid-public-key', (req, res) => {
    console.log('[NotificationRoutes] VAPID public key requested');
    const publicKey = getVapidPublicKey();
    console.log('[NotificationRoutes] Returning VAPID key:', publicKey?.substring(0, 20) + '...');
    res.json({ publicKey });
});

// DEV ONLY: Quick test email (NO AUTH - for development testing only)
router.get('/dev-test-email/:email', async (req, res) => {
    try {
        const { email } = req.params;

        if (!email || !email.includes('@')) {
            return res.status(400).json({ message: 'Invalid email' });
        }

        const { sendTestEmail } = await import('../services/emailService.js');
        const result = await sendTestEmail(email);

        if (result) {
            res.json({
                success: true,
                message: `Test email sent to ${email}`
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to send email'
            });
        }
    } catch (error: any) {
        console.error('[NotificationRoutes] Dev test email error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Subscribe to push notifications
router.post('/subscribe', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { subscription, userAgent } = req.body;

        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return res.status(400).json({ message: 'Invalid subscription data' });
        }

        const result = await subscribePush(userId, subscription, userAgent);
        res.json({ success: true, subscription: result });
    } catch (error) {
        console.error('[NotificationRoutes] Subscribe error:', error);
        res.status(500).json({ message: 'Failed to subscribe' });
    }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const { endpoint } = req.body;

        if (!endpoint) {
            return res.status(400).json({ message: 'Endpoint required' });
        }

        await unsubscribePush(endpoint);
        res.json({ success: true });
    } catch (error) {
        console.error('[NotificationRoutes] Unsubscribe error:', error);
        res.status(500).json({ message: 'Failed to unsubscribe' });
    }
});

// Get notification settings
router.get('/settings', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Verify user exists
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        let settings = await prisma.notificationSettings.findUnique({
            where: { userId }
        });

        // Create default settings if not exists
        if (!settings) {
            settings = await prisma.notificationSettings.create({
                data: { userId }
            });
        }

        res.json(settings);
    } catch (error) {
        console.error('[NotificationRoutes] Get settings error:', error);
        res.status(500).json({ message: 'Failed to get settings' });
    }
});

// Update notification settings
router.put('/settings', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Verify user exists
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const {
            chatMessages,
            projectAssignments,
            projectDiscussions,
            projectUpdates,
            taskAssignments,
            mentions
        } = req.body;

        const settings = await prisma.notificationSettings.upsert({
            where: { userId },
            update: {
                chatMessages: chatMessages ?? undefined,
                projectAssignments: projectAssignments ?? undefined,
                projectDiscussions: projectDiscussions ?? undefined,
                projectUpdates: projectUpdates ?? undefined,
                taskAssignments: taskAssignments ?? undefined,
                mentions: mentions ?? undefined
            },
            create: {
                userId,
                chatMessages: chatMessages ?? true,
                projectAssignments: projectAssignments ?? true,
                projectDiscussions: projectDiscussions ?? true,
                projectUpdates: projectUpdates ?? true,
                taskAssignments: taskAssignments ?? true,
                mentions: mentions ?? true
            }
        });

        res.json(settings);
    } catch (error) {
        console.error('[NotificationRoutes] Update settings error:', error);
        res.status(500).json({ message: 'Failed to update settings' });
    }
});

// Get user's subscriptions (for debugging)
router.get('/subscriptions', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const subscriptions = await prisma.pushSubscription.findMany({
            where: { userId },
            select: {
                id: true,
                endpoint: true,
                userAgent: true,
                createdAt: true,
                updatedAt: true
            }
        });

        res.json(subscriptions);
    } catch (error) {
        console.error('[NotificationRoutes] Get subscriptions error:', error);
        res.status(500).json({ message: 'Failed to get subscriptions' });
    }
});

// Test push notification (for debugging)
router.post('/test', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const { sendPushToUser } = await import('../services/pushNotificationService.js');

        const result = await sendPushToUser(userId, {
            title: 'Test Notification',
            body: 'Thông báo đẩy đang hoạt động! 🎉',
            data: {
                type: 'chat',
                url: '/'
            }
        });

        res.json({ success: true, result });
    } catch (error) {
        console.error('[NotificationRoutes] Test notification error:', error);
        res.status(500).json({ message: 'Failed to send test notification' });
    }
});

// Trigger deadline check (Admin only)
router.post('/check-deadlines', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Only admin can trigger manual deadline check
        if (userRole !== 'ADMIN') {
            return res.status(403).json({ message: 'Chỉ Admin mới có thể thực hiện thao tác này' });
        }

        const { runDeadlineChecks } = await import('../services/deadlineScheduler.js');

        // Run deadline checks asynchronously
        runDeadlineChecks().then(() => {
            console.log('[NotificationRoutes] Manual deadline check completed');
        }).catch(err => {
            console.error('[NotificationRoutes] Manual deadline check failed:', err);
        });

        res.json({
            success: true,
            message: 'Đã bắt đầu kiểm tra deadline. Thông báo sẽ được gửi cho những dự án/công việc quá hạn.'
        });
    } catch (error) {
        console.error('[NotificationRoutes] Deadline check trigger error:', error);
        res.status(500).json({ message: 'Lỗi khi kiểm tra deadline' });
    }
});

// Get deadline status (for dashboard)
router.get('/deadline-status', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get user's overdue projects
        const overdueProjects = await prisma.project.count({
            where: {
                OR: [
                    { managerId: userId },
                    { implementers: { some: { id: userId } } },
                    { followers: { some: { id: userId } } }
                ],
                endDate: { lte: today },
                status: { not: 'COMPLETED' }
            }
        });

        // Get user's overdue personal tasks
        const overdueTasks = await prisma.task.count({
            where: {
                creatorId: userId,
                type: 'PERSONAL',
                endDate: { lte: today },
                status: { notIn: ['COMPLETED', 'CANCELLED'] }
            }
        });

        // Get upcoming deadlines (next 7 days)
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);

        const upcomingProjectDeadlines = await prisma.project.count({
            where: {
                OR: [
                    { managerId: userId },
                    { implementers: { some: { id: userId } } },
                    { followers: { some: { id: userId } } }
                ],
                endDate: { gt: today, lte: nextWeek },
                status: { not: 'COMPLETED' }
            }
        });

        const upcomingTaskDeadlines = await prisma.task.count({
            where: {
                creatorId: userId,
                type: 'PERSONAL',
                endDate: { gt: today, lte: nextWeek },
                status: { notIn: ['COMPLETED', 'CANCELLED'] }
            }
        });

        res.json({
            overdueProjects,
            overdueTasks,
            upcomingProjectDeadlines,
            upcomingTaskDeadlines,
            totalOverdue: overdueProjects + overdueTasks,
            totalUpcoming: upcomingProjectDeadlines + upcomingTaskDeadlines
        });
    } catch (error) {
        console.error('[NotificationRoutes] Deadline status error:', error);
        res.status(500).json({ message: 'Lỗi khi lấy trạng thái deadline' });
    }
});

// Test email sending
router.post('/test-email', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Only admin can test emails
        if (userRole !== 'ADMIN') {
            return res.status(403).json({ message: 'Chỉ Admin mới có thể test email' });
        }

        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: 'Email address is required' });
        }

        const { sendTestEmail } = await import('../services/emailService.js');

        const result = await sendTestEmail(email);

        if (result) {
            res.json({
                success: true,
                message: `Email test đã được gửi thành công đến ${email}`
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Gửi email thất bại. Kiểm tra cấu hình Resend.'
            });
        }
    } catch (error) {
        console.error('[NotificationRoutes] Test email error:', error);
        res.status(500).json({ message: 'Lỗi khi gửi email test' });
    }
});

export default router;
