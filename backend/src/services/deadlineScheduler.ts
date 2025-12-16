import prisma from '../config/prisma.js';
import {
    notifyProjectDeadlineOverdue,
    notifyProjectDeadlineUpcoming,
    notifyTaskDeadlineOverdue,
    notifyTaskDeadlineUpcoming
} from './pushNotificationService.js';
import { sendDeadlineReminderEmail } from './emailService.js';

// Get start of today in UTC
const getStartOfToday = (): Date => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
};

// Calculate days difference between two dates
const getDaysDifference = (date1: Date, date2: Date): number => {
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round((date1.getTime() - date2.getTime()) / oneDay);
};

// Check overdue projects and send notifications
export const checkOverdueProjects = async (): Promise<void> => {
    console.log('[DeadlineScheduler] Checking overdue projects...');
    const today = getStartOfToday();

    try {
        // Find projects that:
        // 1. Have an end date
        // 2. End date <= today
        // 3. Status is not COMPLETED
        const overdueProjects = await prisma.project.findMany({
            where: {
                endDate: {
                    lte: today
                },
                status: {
                    not: 'COMPLETED'
                }
            },
            include: {
                manager: { select: { id: true, name: true, email: true } },
                implementers: { select: { id: true, name: true, email: true } },
                followers: { select: { id: true, name: true, email: true } }
            }
        });

        console.log(`[DeadlineScheduler] Found ${overdueProjects.length} overdue projects`);

        for (const project of overdueProjects) {
            if (!project.endDate) continue;

            const daysOverdue = getDaysDifference(today, project.endDate);

            // Collect all users to notify
            const usersToNotify: { id: number; name: string; email: string | null }[] = [
                { id: project.managerId, name: project.manager.name, email: project.manager.email }
            ];
            project.implementers.forEach(impl => usersToNotify.push({ id: impl.id, name: impl.name, email: impl.email }));
            project.followers.forEach(follower => usersToNotify.push({ id: follower.id, name: follower.name, email: follower.email }));

            // Remove duplicates
            const uniqueUsers = usersToNotify.filter((user, index, self) =>
                index === self.findIndex(u => u.id === user.id)
            );

            console.log(`[DeadlineScheduler] Project "${project.name}" is ${daysOverdue} days overdue, notifying ${uniqueUsers.length} users`);

            // Send push notifications
            await notifyProjectDeadlineOverdue(
                uniqueUsers.map(u => u.id),
                project.id,
                project.name,
                daysOverdue
            );

            // Send emails
            for (const user of uniqueUsers) {
                if (user.email) {
                    await sendDeadlineReminderEmail(
                        user.email,
                        user.name,
                        project.id,
                        project.name,
                        project.code,
                        project.endDate,
                        -daysOverdue, // Negative for overdue
                        true // isOverdue
                    );
                }
            }
        }
    } catch (error) {
        console.error('[DeadlineScheduler] Error checking overdue projects:', error);
    }
};

// Check projects with upcoming deadlines (1 day before)
export const checkUpcomingProjectDeadlines = async (): Promise<void> => {
    console.log('[DeadlineScheduler] Checking upcoming project deadlines...');
    const today = getStartOfToday();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    try {
        // Find projects with deadline tomorrow
        const upcomingProjects = await prisma.project.findMany({
            where: {
                endDate: {
                    gte: tomorrow,
                    lt: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000) // Within tomorrow
                },
                status: {
                    not: 'COMPLETED'
                }
            },
            include: {
                manager: { select: { id: true, name: true, email: true } },
                implementers: { select: { id: true, name: true, email: true } },
                followers: { select: { id: true, name: true, email: true } }
            }
        });

        console.log(`[DeadlineScheduler] Found ${upcomingProjects.length} projects with deadline tomorrow`);

        for (const project of upcomingProjects) {
            if (!project.endDate) continue;

            // Collect all users to notify
            const usersToNotify: { id: number; name: string; email: string | null }[] = [
                { id: project.managerId, name: project.manager.name, email: project.manager.email }
            ];
            project.implementers.forEach(impl => usersToNotify.push({ id: impl.id, name: impl.name, email: impl.email }));
            project.followers.forEach(follower => usersToNotify.push({ id: follower.id, name: follower.name, email: follower.email }));

            // Remove duplicates
            const uniqueUsers = usersToNotify.filter((user, index, self) =>
                index === self.findIndex(u => u.id === user.id)
            );

            console.log(`[DeadlineScheduler] Project "${project.name}" deadline is tomorrow, notifying ${uniqueUsers.length} users`);

            // Send push notifications
            await notifyProjectDeadlineUpcoming(
                uniqueUsers.map(u => u.id),
                project.id,
                project.name,
                1 // 1 day until deadline
            );

            // Send emails
            for (const user of uniqueUsers) {
                if (user.email) {
                    await sendDeadlineReminderEmail(
                        user.email,
                        user.name,
                        project.id,
                        project.name,
                        project.code,
                        project.endDate,
                        1, // 1 day remaining
                        false // not overdue
                    );
                }
            }
        }
    } catch (error) {
        console.error('[DeadlineScheduler] Error checking upcoming project deadlines:', error);
    }
};

// Check overdue personal tasks
export const checkOverdueTasks = async (): Promise<void> => {
    console.log('[DeadlineScheduler] Checking overdue tasks...');
    const today = getStartOfToday();

    try {
        // Find personal tasks that:
        // 1. Have an end date
        // 2. End date <= today
        // 3. Status is not COMPLETED or CANCELLED
        // 4. Type is PERSONAL
        const overdueTasks = await prisma.task.findMany({
            where: {
                endDate: {
                    lte: today
                },
                status: {
                    notIn: ['COMPLETED', 'CANCELLED']
                },
                type: 'PERSONAL'
            },
            include: {
                creator: { select: { id: true, name: true } }
            }
        });

        console.log(`[DeadlineScheduler] Found ${overdueTasks.length} overdue personal tasks`);

        for (const task of overdueTasks) {
            if (!task.endDate) continue;

            const daysOverdue = getDaysDifference(today, task.endDate);

            console.log(`[DeadlineScheduler] Task "${task.title}" is ${daysOverdue} days overdue, notifying user ${task.creatorId}`);

            await notifyTaskDeadlineOverdue(
                task.creatorId,
                task.id,
                task.title,
                daysOverdue
            );
        }
    } catch (error) {
        console.error('[DeadlineScheduler] Error checking overdue tasks:', error);
    }
};

// Check tasks with upcoming deadlines (1 day before)
export const checkUpcomingTaskDeadlines = async (): Promise<void> => {
    console.log('[DeadlineScheduler] Checking upcoming task deadlines...');
    const today = getStartOfToday();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    try {
        // Find personal tasks with deadline tomorrow
        const upcomingTasks = await prisma.task.findMany({
            where: {
                endDate: {
                    gte: tomorrow,
                    lt: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)
                },
                status: {
                    notIn: ['COMPLETED', 'CANCELLED']
                },
                type: 'PERSONAL'
            },
            include: {
                creator: { select: { id: true, name: true } }
            }
        });

        console.log(`[DeadlineScheduler] Found ${upcomingTasks.length} tasks with deadline tomorrow`);

        for (const task of upcomingTasks) {
            console.log(`[DeadlineScheduler] Task "${task.title}" deadline is tomorrow, notifying user ${task.creatorId}`);

            await notifyTaskDeadlineUpcoming(
                task.creatorId,
                task.id,
                task.title,
                1 // 1 day until deadline
            );
        }
    } catch (error) {
        console.error('[DeadlineScheduler] Error checking upcoming task deadlines:', error);
    }
};

// Run all deadline checks
export const runDeadlineChecks = async (): Promise<void> => {
    console.log('[DeadlineScheduler] ========== Running deadline checks ==========');
    console.log('[DeadlineScheduler] Time:', new Date().toISOString());

    await checkOverdueProjects();
    await checkUpcomingProjectDeadlines();
    await checkOverdueTasks();
    await checkUpcomingTaskDeadlines();

    console.log('[DeadlineScheduler] ========== Deadline checks completed ==========');
};

// Interval ID for cleanup
let schedulerIntervalId: NodeJS.Timeout | null = null;

// Start the deadline scheduler (runs daily at 8:00 AM)
export const startDeadlineScheduler = (): void => {
    console.log('[DeadlineScheduler] Starting deadline scheduler...');

    // Calculate time until next 8:00 AM
    const now = new Date();
    const next8AM = new Date();
    next8AM.setHours(8, 0, 0, 0);

    // If it's already past 8 AM today, schedule for tomorrow
    if (now >= next8AM) {
        next8AM.setDate(next8AM.getDate() + 1);
    }

    const msUntil8AM = next8AM.getTime() - now.getTime();
    const hoursUntil8AM = (msUntil8AM / (1000 * 60 * 60)).toFixed(2);

    console.log(`[DeadlineScheduler] Next check scheduled for ${next8AM.toISOString()} (in ${hoursUntil8AM} hours)`);

    // First, schedule initial run at 8 AM
    setTimeout(() => {
        // Run immediately at 8 AM
        runDeadlineChecks();

        // Then run every 24 hours
        schedulerIntervalId = setInterval(runDeadlineChecks, 24 * 60 * 60 * 1000);
    }, msUntil8AM);

    // Also run immediately on server start for testing (optional - comment out in production)
    // Uncomment the line below to test immediately on server start
    // setTimeout(runDeadlineChecks, 5000); // Run 5 seconds after server start
};

// Stop the deadline scheduler
export const stopDeadlineScheduler = (): void => {
    if (schedulerIntervalId) {
        clearInterval(schedulerIntervalId);
        schedulerIntervalId = null;
        console.log('[DeadlineScheduler] Scheduler stopped');
    }
};

export default {
    runDeadlineChecks,
    startDeadlineScheduler,
    stopDeadlineScheduler,
    checkOverdueProjects,
    checkUpcomingProjectDeadlines,
    checkOverdueTasks,
    checkUpcomingTaskDeadlines
};
