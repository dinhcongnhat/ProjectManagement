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
        type: 'chat' | 'project' | 'task' | 'discussion' | 'mention' | 'activity';
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
                'activity': 'projectUpdates'
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

        let success = 0;
        let failed = 0;

        // Send to all user's subscriptions (multiple devices)
        for (const sub of subscriptions) {
            try {
                await webpush.sendNotification(
                    {
                        endpoint: sub.endpoint,
                        keys: {
                            p256dh: sub.p256dh,
                            auth: sub.auth
                        }
                    },
                    notificationPayload
                );
                success++;
            } catch (error: any) {
                failed++;
                console.error(`[PushService] Error sending to ${sub.endpoint}:`, error.message);

                // Remove expired/invalid subscriptions
                if (error.statusCode === 410 || error.statusCode === 404) {
                    await prisma.pushSubscription.delete({
                        where: { id: sub.id }
                    }).catch(() => { });
                }
            }
        }

        console.log(`[PushService] Sent to user ${userId}: ${success} success, ${failed} failed`);
        return { success, failed };
    } catch (error) {
        console.error('[PushService] Error sending push:', error);
        throw error;
    }
};

// Send push notification to multiple users
export const sendPushToUsers = async (userIds: number[], payload: PushPayload) => {
    const results = await Promise.all(
        userIds.map(userId => sendPushToUser(userId, payload))
    );

    return {
        success: results.reduce((sum, r) => sum + r.success, 0),
        failed: results.reduce((sum, r) => sum + r.failed, 0)
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
    isGroup: boolean
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
        tag: `chat-${conversationId}`,
        data: {
            type: 'chat',
            url: '/',
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
    role: 'manager' | 'implementer' | 'follower'
) => {
    const roleText = {
        manager: 'quản lý',
        implementer: 'thực hiện',
        follower: 'theo dõi'
    };

    const payload: PushPayload = {
        title: 'Phân công dự án mới',
        body: `${assignerName} đã thêm bạn vào dự án "${projectName}" với vai trò ${roleText[role]}`,
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
    messagePreview: string
) => {
    const data: PushPayload['data'] = {
        type: 'mention',
        url: context === 'chat' ? '/' : `/projects/${contextId}`
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
    const payload: PushPayload = {
        title: 'Công việc mới được giao',
        body: `${assignerName} đã giao cho bạn công việc "${taskTitle}"`,
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
    const payload: PushPayload = {
        title: '⚠️ Dự án quá hạn!',
        body: daysOverdue === 0
            ? `Dự án "${projectName}" đã đến hạn hoàn thành hôm nay!`
            : `Dự án "${projectName}" đã quá hạn ${daysOverdue} ngày!`,
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
    const payload: PushPayload = {
        title: '📅 Nhắc nhở deadline dự án',
        body: daysUntilDeadline === 1
            ? `Dự án "${projectName}" sẽ đến hạn vào ngày mai!`
            : `Dự án "${projectName}" sẽ đến hạn trong ${daysUntilDeadline} ngày nữa.`,
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
    const payload: PushPayload = {
        title: '⚠️ Công việc quá hạn!',
        body: daysOverdue === 0
            ? `Công việc "${taskTitle}" đã đến hạn hoàn thành hôm nay!`
            : `Công việc "${taskTitle}" đã quá hạn ${daysOverdue} ngày!`,
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
    const payload: PushPayload = {
        title: '📅 Nhắc nhở công việc',
        body: daysUntilDeadline === 1
            ? `Công việc "${taskTitle}" sẽ đến hạn vào ngày mai!`
            : `Công việc "${taskTitle}" sẽ đến hạn trong ${daysUntilDeadline} ngày nữa.`,
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
    notifyTaskDeadlineUpcoming
};
