import webpush from 'web-push';
import prisma from '../config/prisma.js';

// VAPID keys should be generated once and stored in environment variables
// You can generate them using: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BLBz5Qk7T7kxNfBJtJjNgFZ2PF4TnvPQKzXoKyKGXZ7qfKmJmKvDqnTpHG9xKhZBqfZ3JkqQr7K8kJvN5xKmKfE';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'your-private-key-here';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@jtsc.io.vn';

// Log VAPID configuration status
console.log('[PushService] VAPID Configuration:');
console.log('[PushService] - Public Key:', VAPID_PUBLIC_KEY ? 'Set (' + VAPID_PUBLIC_KEY.substring(0, 10) + '...)' : 'Not set');
console.log('[PushService] - Private Key:', VAPID_PRIVATE_KEY !== 'your-private-key-here' ? 'Set' : 'NOT CONFIGURED - Push notifications disabled');
console.log('[PushService] - Email:', VAPID_EMAIL);

// Configure web-push with VAPID keys
if (VAPID_PRIVATE_KEY !== 'your-private-key-here') {
    try {
        webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
        console.log('[PushService] VAPID configured successfully');
    } catch (error) {
        console.error('[PushService] Error configuring VAPID:', error);
    }
} else {
    console.warn('[PushService] WARNING: Push notifications are disabled because VAPID_PRIVATE_KEY is not configured');
    console.warn('[PushService] To enable push notifications, run: npx web-push generate-vapid-keys');
    console.warn('[PushService] Then set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in your .env file');
}

export interface PushPayload {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: {
        type: 'chat' | 'project' | 'task' | 'discussion' | 'mention' | 'activity' | 'kanban';
        url?: string;
        conversationId?: number;
        projectId?: number;
        taskId?: number;
        senderId?: number;
        senderName?: string;
    };
    actions?: Array<{
        action: string;
        title: string;
        icon?: string;
    }>;
    vibrate?: number[];
    requireInteraction?: boolean;
}

export const getVapidPublicKey = () => VAPID_PUBLIC_KEY;

// Subscribe a user to push notifications
export const subscribePush = async (
    userId: number,
    subscription: {
        endpoint: string;
        keys: {
            p256dh: string;
            auth: string;
        };
    },
    userAgent?: string
) => {
    try {
        // Upsert subscription (update if exists, create if not)
        const pushSubscription = await prisma.pushSubscription.upsert({
            where: { endpoint: subscription.endpoint },
            update: {
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
                userAgent: userAgent ?? null,
                userId,
                updatedAt: new Date()
            },
            create: {
                endpoint: subscription.endpoint,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
                userAgent: userAgent ?? null,
                userId
            }
        });

        // Create default notification settings if not exists
        await prisma.notificationSettings.upsert({
            where: { userId },
            update: {},
            create: { userId }
        });

        return pushSubscription;
    } catch (error) {
        console.error('[PushService] Error subscribing:', error);
        throw error;
    }
};

// Unsubscribe from push notifications
export const unsubscribePush = async (endpoint: string) => {
    try {
        await prisma.pushSubscription.delete({
            where: { endpoint }
        });
        return true;
    } catch (error) {
        console.error('[PushService] Error unsubscribing:', error);
        return false;
    }
};

// Send push notification to a specific user
export const sendPushToUser = async (userId: number, payload: PushPayload) => {
    console.log(`[PushService] sendPushToUser called for userId: ${userId}, type: ${payload.data?.type}`);

    try {
        // Check if VAPID is configured
        if (VAPID_PRIVATE_KEY === 'your-private-key-here') {
            console.log('[PushService] VAPID not configured, skipping push');
            return { success: 0, failed: 0 };
        }

        // Get user's notification settings
        const settings = await prisma.notificationSettings.findUnique({
            where: { userId }
        });

        // Check if user wants this type of notification
        if (settings && payload.data?.type) {
            const typeMap: Record<string, keyof typeof settings> = {
                'chat': 'chatMessages',
                'project': 'projectAssignments',
                'task': 'taskAssignments',
                'discussion': 'projectDiscussions',
                'mention': 'mentions',
                'activity': 'projectUpdates',
                'kanban': 'kanbanNotifications'
            };
            const settingKey = typeMap[payload.data.type];
            if (settingKey && settings[settingKey] === false) {
                console.log(`[PushService] User ${userId} has disabled ${payload.data.type} notifications`);
                return { success: 0, failed: 0, skipped: 1 };
            }
        }

        // Get all subscriptions for this user
        const subscriptions = await prisma.pushSubscription.findMany({
            where: { userId }
        });

        if (subscriptions.length === 0) {
            console.log(`[PushService] No subscriptions for user ${userId}`);
            return { success: 0, failed: 0 };
        }

        const notificationPayload = JSON.stringify({
            title: payload.title,
            body: payload.body,
            icon: payload.icon || '/icons/icon-192x192.png',
            badge: payload.badge || '/icons/icon-72x72.png',
            tag: payload.tag,
            data: payload.data,
            actions: payload.actions,
            vibrate: payload.vibrate || [100, 50, 100],
            requireInteraction: payload.requireInteraction || false
        });

        // Push delivery options for faster delivery
        const pushOptions = {
            TTL: 60, // 60 seconds TTL for faster expiry of stale notifications
            urgency: 'high' as const, // High urgency for immediate delivery
            topic: payload.tag || undefined // Allow replacing notifications with same topic
        };

        let success = 0;
        let failed = 0;

        // Send to all user's subscriptions in parallel for speed
        const results = await Promise.allSettled(
            subscriptions.map(async (sub) => {
                try {
                    await webpush.sendNotification(
                        {
                            endpoint: sub.endpoint,
                            keys: {
                                p256dh: sub.p256dh,
                                auth: sub.auth
                            }
                        },
                        notificationPayload,
                        pushOptions
                    );
                    return { success: true, subId: sub.id };
                } catch (error: any) {
                    console.error(`[PushService] Error sending to endpoint:`, error.message);
                    // Remove expired/invalid subscriptions
                    if (error.statusCode === 410 || error.statusCode === 404) {
                        await prisma.pushSubscription.delete({
                            where: { id: sub.id }
                        }).catch(() => { });
                    }
                    return { success: false, subId: sub.id };
                }
            })
        );

        for (const result of results) {
            if (result.status === 'fulfilled' && result.value.success) {
                success++;
            } else {
                failed++;
            }
        }

        console.log(`[PushService] Sent to user ${userId}: ${success} success, ${failed} failed`);
        return { success, failed };
    } catch (error) {
        console.error('[PushService] Error sending push:', error);
        throw error;
    }
};

// Send push notification to multiple users (in parallel for speed)
export const sendPushToUsers = async (userIds: number[], payload: PushPayload) => {
    const results = await Promise.allSettled(
        userIds.map(userId => sendPushToUser(userId, payload))
    );

    return {
        success: results.reduce((sum, r) => sum + (r.status === 'fulfilled' ? r.value.success : 0), 0),
        failed: results.reduce((sum, r) => sum + (r.status === 'fulfilled' ? r.value.failed : 1), 0)
    };
};

// ==================== NOTIFICATION HELPERS ====================

// Send chat message notification
export const notifyNewChatMessage = async (
    recipientIds: number[],
    senderId: number,
    senderName: string,
    conversationId: number,
    conversationName: string,
    messagePreview: string,
    isGroup: boolean,
    customUrl?: string
) => {
    // Don't notify the sender
    const recipients = recipientIds.filter(id => id !== senderId);

    console.log('[PushService] notifyNewChatMessage called:', {
        recipientIds,
        senderId,
        recipients,
        conversationId,
        isVapidConfigured: VAPID_PRIVATE_KEY !== 'your-private-key-here'
    });

    if (recipients.length === 0) {
        console.log('[PushService] No recipients to notify');
        return { success: 0, failed: 0 };
    }

    const payload: PushPayload = {
        title: isGroup ? conversationName : senderName,
        body: isGroup ? `${senderName}: ${messagePreview}` : messagePreview,
        // Don't use tag - let each message be a separate notification
        // tag: `chat-${conversationId}`,
        data: {
            type: 'chat',
            url: customUrl || '/',
            conversationId,
            senderId,
            senderName
        },
        actions: [
            { action: 'reply', title: 'Trả lời' },
            { action: 'dismiss', title: 'Bỏ qua' }
        ]
    };

    return sendPushToUsers(recipients, payload);
};

// Send project assignment notification
export const notifyProjectAssignment = async (
    userId: number,
    projectId: number,
    projectName: string,
    assignerName: string,
    role: 'manager' | 'implementer' | 'follower' | 'cooperator'
) => {
    const roleText = {
        manager: 'quản lý',
        implementer: 'thực hiện',
        follower: 'theo dõi',
        cooperator: 'phối hợp'
    };

    const title = 'Phân công dự án mới';
    const body = `${assignerName} đã thêm bạn vào dự án "${projectName}" với vai trò ${roleText[role]}`;

    // Lưu notification vào database
    try {
        await prisma.notification.create({
            data: {
                userId,
                type: 'PROJECT_ASSIGNED',
                title,
                message: body,
                projectId
            }
        });
    } catch (error) {
        console.error('[PushService] Error saving notification to database:', error);
    }

    const payload: PushPayload = {
        title,
        body,
        tag: `project-assign-${projectId}`,
        data: {
            type: 'project',
            url: `/projects/${projectId}`,
            projectId
        },
        requireInteraction: true
    };

    return sendPushToUser(userId, payload);
};

// Send project discussion notification
export const notifyProjectDiscussion = async (
    recipientIds: number[],
    senderId: number,
    senderName: string,
    projectId: number,
    projectName: string,
    messagePreview: string
) => {
    const recipients = recipientIds.filter(id => id !== senderId);

    // Save to DB for bell icon
    if (recipients.length > 0) {
        try {
            await prisma.notification.createMany({
                data: recipients.map(userId => ({
                    userId,
                    type: 'PROJECT_DISCUSSION',
                    title: `Thảo luận: ${projectName}`,
                    message: `${senderName}: ${messagePreview}`,
                    projectId
                }))
            });
        } catch (error) {
            console.error('[PushService] Error saving discussion notification to DB:', error);
        }
    }

    const payload: PushPayload = {
        title: `Thảo luận: ${projectName}`,
        body: `${senderName}: ${messagePreview}`,
        tag: `discussion-${projectId}`,
        data: {
            type: 'discussion',
            url: `/projects/${projectId}`,
            projectId,
            senderId,
            senderName
        }
    };

    return sendPushToUsers(recipients, payload);
};

// Send mention notification
export const notifyMention = async (
    mentionedUserId: number,
    mentionerName: string,
    context: 'chat' | 'discussion',
    contextId: number,
    contextName: string,
    messagePreview: string,
    customUrl?: string
) => {
    // Save to DB for bell icon
    try {
        await prisma.notification.create({
            data: {
                userId: mentionedUserId,
                type: 'MENTION',
                title: `${mentionerName} đã nhắc đến bạn`,
                message: messagePreview,
                projectId: context === 'discussion' ? contextId : null
            }
        });
    } catch (error) {
        console.error('[PushService] Error saving mention notification to DB:', error);
    }

    const data: PushPayload['data'] = {
        type: 'mention',
        url: customUrl || (context === 'chat' ? '/' : `/projects/${contextId}`)
    };

    if (context === 'chat') {
        data.conversationId = contextId;
    } else {
        data.projectId = contextId;
    }

    const payload: PushPayload = {
        title: `${mentionerName} đã nhắc đến bạn`,
        body: messagePreview,
        tag: `mention-${context}-${contextId}`,
        data,
        requireInteraction: true
    };

    return sendPushToUser(mentionedUserId, payload);
};

// Send task assignment notification
export const notifyTaskAssignment = async (
    userId: number,
    taskId: number,
    taskTitle: string,
    assignerName: string
) => {
    const title = 'Công việc mới được giao';
    const body = `${assignerName} đã giao cho bạn công việc "${taskTitle}"`;

    // Save to DB for bell icon
    try {
        await prisma.notification.create({
            data: {
                userId,
                type: 'TASK_ASSIGNED',
                title,
                message: body,
                taskId
            }
        });
    } catch (error) {
        console.error('[PushService] Error saving task notification to DB:', error);
    }

    const payload: PushPayload = {
        title,
        body,
        tag: `task-${taskId}`,
        data: {
            type: 'task',
            url: '/my-tasks',
            taskId
        },
        requireInteraction: true
    };

    return sendPushToUser(userId, payload);
};

// Send project update notification
export const notifyProjectUpdate = async (
    recipientIds: number[],
    updaterId: number,
    updaterName: string,
    projectId: number,
    projectName: string,
    updateDescription: string
) => {
    const recipients = recipientIds.filter(id => id !== updaterId);

    // Save to DB for bell icon
    if (recipients.length > 0) {
        try {
            await prisma.notification.createMany({
                data: recipients.map(userId => ({
                    userId,
                    type: 'PROJECT_UPDATED',
                    title: `Cập nhật: ${projectName}`,
                    message: `${updaterName} ${updateDescription}`,
                    projectId
                }))
            });
        } catch (error) {
            console.error('[PushService] Error saving project update notification to DB:', error);
        }
    }

    const payload: PushPayload = {
        title: `Cập nhật: ${projectName}`,
        body: `${updaterName} ${updateDescription}`,
        tag: `project-update-${projectId}`,
        data: {
            type: 'activity',
            url: `/projects/${projectId}`,
            projectId
        }
    };

    return sendPushToUsers(recipients, payload);
};

// ==================== DEADLINE REMINDER NOTIFICATIONS ====================

// Notify project deadline overdue
export const notifyProjectDeadlineOverdue = async (
    userIds: number[],
    projectId: number,
    projectName: string,
    daysOverdue: number
) => {
    const title = '⚠️ Dự án quá hạn!';
    const body = daysOverdue === 0
        ? `Dự án "${projectName}" đã đến hạn hoàn thành hôm nay!`
        : `Dự án "${projectName}" đã quá hạn ${daysOverdue} ngày!`;

    // Save to DB for bell icon
    if (userIds.length > 0) {
        try {
            await prisma.notification.createMany({
                data: userIds.map(userId => ({
                    userId,
                    type: 'DEADLINE_OVERDUE',
                    title,
                    message: body,
                    projectId
                }))
            });
        } catch (error) {
            console.error('[PushService] Error saving deadline notification to DB:', error);
        }
    }

    const payload: PushPayload = {
        title,
        body,
        tag: `project-deadline-${projectId}`,
        data: {
            type: 'project',
            url: `/projects/${projectId}`,
            projectId
        },
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200]
    };

    return sendPushToUsers(userIds, payload);
};

// Notify project deadline upcoming (1 day before)
export const notifyProjectDeadlineUpcoming = async (
    userIds: number[],
    projectId: number,
    projectName: string,
    daysUntilDeadline: number
) => {
    const title = '📅 Nhắc nhở deadline dự án';
    const body = daysUntilDeadline === 1
        ? `Dự án "${projectName}" sẽ đến hạn vào ngày mai!`
        : `Dự án "${projectName}" sẽ đến hạn trong ${daysUntilDeadline} ngày nữa.`;

    // Save to DB for bell icon
    if (userIds.length > 0) {
        try {
            await prisma.notification.createMany({
                data: userIds.map(userId => ({
                    userId,
                    type: 'DEADLINE_UPCOMING',
                    title,
                    message: body,
                    projectId
                }))
            });
        } catch (error) {
            console.error('[PushService] Error saving deadline reminder to DB:', error);
        }
    }

    const payload: PushPayload = {
        title,
        body,
        tag: `project-deadline-reminder-${projectId}`,
        data: {
            type: 'project',
            url: `/projects/${projectId}`,
            projectId
        },
        requireInteraction: false
    };

    return sendPushToUsers(userIds, payload);
};

// Notify personal task deadline overdue
export const notifyTaskDeadlineOverdue = async (
    userId: number,
    taskId: number,
    taskTitle: string,
    daysOverdue: number
) => {
    const title = '⚠️ Công việc quá hạn!';
    const body = daysOverdue === 0
        ? `Công việc "${taskTitle}" đã đến hạn hoàn thành hôm nay!`
        : `Công việc "${taskTitle}" đã quá hạn ${daysOverdue} ngày!`;

    // Save to DB for bell icon
    try {
        await prisma.notification.create({
            data: {
                userId,
                type: 'TASK_DEADLINE_OVERDUE',
                title,
                message: body,
                taskId
            }
        });
    } catch (error) {
        console.error('[PushService] Error saving task deadline notification to DB:', error);
    }

    const payload: PushPayload = {
        title,
        body,
        tag: `task-deadline-${taskId}`,
        data: {
            type: 'task',
            url: '/my-tasks',
            taskId
        },
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200]
    };

    return sendPushToUser(userId, payload);
};

// Notify personal task deadline upcoming (1 day before)
export const notifyTaskDeadlineUpcoming = async (
    userId: number,
    taskId: number,
    taskTitle: string,
    daysUntilDeadline: number
) => {
    const title = '📅 Nhắc nhở công việc';
    const body = daysUntilDeadline === 1
        ? `Công việc "${taskTitle}" sẽ đến hạn vào ngày mai!`
        : `Công việc "${taskTitle}" sẽ đến hạn trong ${daysUntilDeadline} ngày nữa.`;

    // Save to DB for bell icon
    try {
        await prisma.notification.create({
            data: {
                userId,
                type: 'TASK_DEADLINE_UPCOMING',
                title,
                message: body,
                taskId
            }
        });
    } catch (error) {
        console.error('[PushService] Error saving task deadline reminder to DB:', error);
    }

    const payload: PushPayload = {
        title,
        body,
        tag: `task-deadline-reminder-${taskId}`,
        data: {
            type: 'task',
            url: '/my-tasks',
            taskId
        },
        requireInteraction: false
    };

    return sendPushToUser(userId, payload);
};

// Notify task reminder (specific time)
export const notifyTaskReminder = async (
    userId: number,
    taskId: number,
    taskTitle: string,
    reminderAt: Date
) => {
    const timeStr = reminderAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const title = '🔔 Nhắc nhở công việc';
    const body = `Đã đến giờ cho công việc "${taskTitle}" (${timeStr})`;

    // Save to DB for bell icon
    try {
        await prisma.notification.create({
            data: {
                userId,
                type: 'TASK_REMINDER',
                title,
                message: body,
                taskId
            }
        });
    } catch (error) {
        console.error('[PushService] Error saving task reminder to DB:', error);
    }

    const payload: PushPayload = {
        title,
        body,
        tag: `task-reminder-${taskId}`,
        data: {
            type: 'task',
            url: '/my-tasks',
            taskId
        },
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200]
    };

    return sendPushToUser(userId, payload);
};

// Notify kanban card deadline approaching (10 minutes before)
export const notifyKanbanCardDeadline = async (
    recipientIds: number[],
    cardId: number,
    cardTitle: string,
    boardName: string,
    dueDate: Date
) => {
    if (recipientIds.length === 0) return { success: 0, failed: 0 };

    const timeStr = dueDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
    const dateStr = dueDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
    const title = '⏰ Sắp đến hạn công việc Kanban!';
    const body = `Thẻ "${cardTitle}" trong "${boardName}" sẽ đến hạn lúc ${timeStr} ngày ${dateStr}`;

    // Save to DB for bell icon
    try {
        await prisma.notification.createMany({
            data: recipientIds.map(userId => ({
                userId,
                type: 'KANBAN_DEADLINE_APPROACHING',
                title,
                message: body
            }))
        });
    } catch (error) {
        console.error('[PushService] Error saving kanban deadline notification to DB:', error);
    }

    const payload: PushPayload = {
        title,
        body,
        tag: `kanban-deadline-${cardId}`,
        data: {
            type: 'kanban',
            url: `/kanban?cardId=${cardId}`
        },
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200]
    };

    return sendPushToUsers(recipientIds, payload);
};

// Notify kanban daily reminder (consolidated for one user)
export const notifyKanbanDailyReminder = async (
    userId: number,
    boardName: string,
    cardTitles: string[],
    totalCards: number
) => {
    const title = '📋 Nhắc nhở công việc Kanban hàng ngày';
    const body = totalCards <= 3
        ? `Bạn có ${totalCards} đầu việc chưa hoàn thành trong "${boardName}": ${cardTitles.join(', ')}`
        : `Bạn có ${totalCards} đầu việc chưa hoàn thành trong "${boardName}": ${cardTitles.slice(0, 3).join(', ')} và ${totalCards - 3} việc khác`;

    // Save to DB for bell icon
    try {
        await prisma.notification.create({
            data: {
                userId,
                type: 'KANBAN_DAILY_REMINDER',
                title,
                message: body
            }
        });
    } catch (error) {
        console.error('[PushService] Error saving kanban reminder to DB:', error);
    }

    const payload: PushPayload = {
        title,
        body,
        tag: `kanban-daily-reminder-${userId}`,
        data: {
            type: 'kanban',
            url: '/'
        },
        requireInteraction: true,
        vibrate: [200, 100, 200]
    };

    return sendPushToUser(userId, payload);
};

// ==================== KANBAN ACTIVITY NOTIFICATIONS ====================

// Notify when a new card is created on a kanban board
export const notifyKanbanCardCreated = async (
    recipientIds: number[],
    creatorId: number,
    creatorName: string,
    boardId: number,
    boardName: string,
    cardTitle: string,
    listTitle: string,
    cardId?: number
) => {
    const recipients = recipientIds.filter(id => id !== creatorId);
    if (recipients.length === 0) return { success: 0, failed: 0 };

    const title = '📋 Thẻ mới trong Kanban';
    const body = `${creatorName} đã tạo thẻ "${cardTitle}" trong danh sách "${listTitle}"`;

    // Save to DB for bell icon
    try {
        await prisma.notification.createMany({
            data: recipients.map(userId => ({
                userId,
                type: 'KANBAN_CARD_CREATED',
                title,
                message: body
            }))
        });
    } catch (error) {
        console.error('[PushService] Error saving kanban card notification to DB:', error);
    }

    const payload: PushPayload = {
        title,
        body,
        tag: `kanban-card-${boardId}-${Date.now()}`,
        data: {
            type: 'kanban',
            url: (boardId && typeof cardId !== 'undefined') ? `/kanban?boardId=&cardId=` : boardId ? `/kanban?boardId=` : '/kanban'
        }
    };

    return sendPushToUsers(recipients, payload);
};

// Notify when a comment is added to a kanban card
export const notifyKanbanComment = async (
    recipientIds: number[],
    commenterId: number,
    commenterName: string,
    boardId: number,
    cardTitle: string,
    commentPreview: string,
    cardId?: number
) => {
    const recipients = recipientIds.filter(id => id !== commenterId);
    if (recipients.length === 0) return { success: 0, failed: 0 };

    const title = '💬 Bình luận mới trên Kanban';
    const body = `${commenterName} đã bình luận trên "${cardTitle}": ${commentPreview.substring(0, 80)}`;

    // Save to DB for bell icon is already done in kanbanController
    // Only send push notification here

    const payload: PushPayload = {
        title,
        body,
        tag: `kanban-comment-${boardId}-${Date.now()}`,
        data: {
            type: 'kanban',
            url: (boardId && typeof cardId !== 'undefined') ? `/kanban?boardId=&cardId=` : boardId ? `/kanban?boardId=` : '/kanban'
        }
    };

    return sendPushToUsers(recipients, payload);
};

// Notify when a checklist item is added to a kanban card
export const notifyKanbanChecklist = async (
    recipientIds: number[],
    userId: number,
    userName: string,
    boardId: number,
    cardTitle: string,
    checklistTitle: string,
    cardId?: number
) => {
    const recipients = recipientIds.filter(id => id !== userId);
    if (recipients.length === 0) return { success: 0, failed: 0 };

    const title = '✅ Công việc mới trong Kanban';
    const body = `${userName} đã thêm "${checklistTitle}" vào danh sách công việc của "${cardTitle}"`;

    const payload: PushPayload = {
        title,
        body,
        tag: `kanban-checklist-${boardId}-${Date.now()}`,
        data: {
            type: 'kanban',
            url: (boardId && typeof cardId !== 'undefined') ? `/kanban?boardId=&cardId=` : boardId ? `/kanban?boardId=` : '/kanban'
        }
    };

    return sendPushToUsers(recipients, payload);
};

// Notify when a user is invited to a kanban board
export const notifyKanbanInvite = async (
    invitedUserIds: number[],
    inviterId: number,
    inviterName: string,
    boardId: number,
    boardName: string,
    cardId?: number
) => {
    const recipients = invitedUserIds.filter(id => id !== inviterId);
    if (recipients.length === 0) return { success: 0, failed: 0 };

    const title = '👥 Mời vào bảng Kanban';
    const body = `${inviterName} đã mời bạn vào bảng làm việc nhóm "${boardName}"`;

    // Save to DB for bell icon
    try {
        await prisma.notification.createMany({
            data: recipients.map(userId => ({
                userId,
                type: 'KANBAN_INVITE',
                title,
                message: body
            }))
        });
    } catch (error) {
        console.error('[PushService] Error saving kanban invite notification to DB:', error);
    }

    const payload: PushPayload = {
        title,
        body,
        tag: `kanban-invite-${boardId}`,
        data: {
            type: 'kanban',
            url: (boardId && typeof cardId !== 'undefined') ? `/kanban?boardId=&cardId=` : boardId ? `/kanban?boardId=` : '/kanban'
        },
        requireInteraction: true
    };

    return sendPushToUsers(recipients, payload);
};

// Notify when a card is moved between lists
export const notifyKanbanCardMoved = async (
    recipientIds: number[],
    moverId: number,
    moverName: string,
    boardId: number,
    cardTitle: string,
    fromList: string,
    toList: string,
    cardId?: number
) => {
    const recipients = recipientIds.filter(id => id !== moverId);
    if (recipients.length === 0) return { success: 0, failed: 0 };

    const title = '🔄 Thẻ được di chuyển';
    const body = `${moverName} đã chuyển "${cardTitle}" từ "${fromList}" sang "${toList}"`;

    // bell notification is already saved in kanbanController

    const payload: PushPayload = {
        title,
        body,
        tag: `kanban-move-${boardId}-${Date.now()}`,
        data: {
            type: 'kanban',
            url: (boardId && typeof cardId !== 'undefined') ? `/kanban?boardId=&cardId=` : boardId ? `/kanban?boardId=` : '/kanban'
        }
    };

    return sendPushToUsers(recipients, payload);
};

// Notify when a card is approved
export const notifyKanbanCardApproved = async (
    recipientIds: number[],
    approverId: number,
    approverName: string,
    boardId: number,
    cardTitle: string,
    cardId?: number
) => {
    const recipients = recipientIds.filter(id => id !== approverId);
    if (recipients.length === 0) return { success: 0, failed: 0 };

    const title = '✅ Công việc đã được duyệt';
    const body = `"${cardTitle}" đã được duyệt bởi ${approverName}. Có thể chuyển sang Hoàn thành.`;

    // bell notification is already saved in kanbanController

    const payload: PushPayload = {
        title,
        body,
        tag: `kanban-approve-${boardId}-${Date.now()}`,
        data: {
            type: 'kanban',
            url: (boardId && typeof cardId !== 'undefined') ? `/kanban?boardId=&cardId=` : boardId ? `/kanban?boardId=` : '/kanban'
        },
        requireInteraction: true
    };

    return sendPushToUsers(recipients, payload);
};

export const notifyKanbanAttachment = async (
    recipientIds: number[],
    uploaderId: number,
    uploaderName: string,
    boardId: number,
    cardTitle: string,
    fileName: string,
    cardId?: number
) => {
    const recipients = recipientIds.filter(id => id !== uploaderId);
    if (recipients.length === 0) return { success: 0, failed: 0 };

    const title = '📎 File đính kèm mới trong Kanban';
    const body = `${uploaderName} đã đính kèm "${fileName}" vào thẻ "${cardTitle}"`;

    const payload: PushPayload = {
        title,
        body,
        tag: `kanban-attachment-${boardId}-${Date.now()}`,
        data: {
            type: 'kanban',
            url: (boardId && typeof cardId !== 'undefined') ? `/kanban?boardId=&cardId=` : boardId ? `/kanban?boardId=` : '/kanban'
        },
        requireInteraction: false
    };

    return sendPushToUsers(recipients, payload);
};

export const notifyKanbanChecklistToggle = async (
    recipientIds: number[],
    togglerId: number,
    togglerName: string,
    boardId: number,
    cardTitle: string,
    itemTitle: string,
    checked: boolean,
    cardId?: number
) => {
    const recipients = recipientIds.filter(id => id !== togglerId);
    if (recipients.length === 0) return { success: 0, failed: 0 };

    const title = checked ? '✅ Công việc hoàn thành' : '🔄 Công việc mở lại';
    const body = `${togglerName} đã ${checked ? 'hoàn thành' : 'mở lại'} "${itemTitle}" trong thẻ "${cardTitle}"`;

    const payload: PushPayload = {
        title,
        body,
        tag: `kanban-checklist-toggle-${boardId}-${Date.now()}`,
        data: {
            type: 'kanban',
            url: (boardId && typeof cardId !== 'undefined') ? `/kanban?boardId=&cardId=` : boardId ? `/kanban?boardId=` : '/kanban'
        },
        requireInteraction: false
    };

    return sendPushToUsers(recipients, payload);
};

export default {
    getVapidPublicKey,
    subscribePush,
    unsubscribePush,
    sendPushToUser,
    sendPushToUsers,
    notifyNewChatMessage,
    notifyProjectAssignment,
    notifyProjectDiscussion,
    notifyMention,
    notifyTaskAssignment,
    notifyProjectUpdate,
    notifyProjectDeadlineOverdue,
    notifyProjectDeadlineUpcoming,
    notifyTaskDeadlineOverdue,
    notifyTaskDeadlineUpcoming,
    notifyTaskReminder,
    notifyKanbanCardDeadline,
    notifyKanbanDailyReminder,
    notifyKanbanCardCreated,
    notifyKanbanComment,
    notifyKanbanChecklist,
    notifyKanbanInvite,
    notifyKanbanCardMoved,
    notifyKanbanCardApproved,
    notifyKanbanAttachment,
    notifyKanbanChecklistToggle
};
