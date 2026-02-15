import prisma from '../config/prisma.js';
import {
    notifyProjectDeadlineOverdue,
    notifyProjectDeadlineUpcoming,
    notifyTaskDeadlineOverdue,
    notifyTaskDeadlineUpcoming
} from './pushNotificationService.js';
import { sendDeadlineReminderEmail } from './emailService.js';
import { notifyKanbanDailyReminder, notifyKanbanCardDeadline } from './pushNotificationService.js';
import { sendKanbanDailyReminderEmail } from './emailService.js';

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

// Check kanban cards not completed and send daily reminder at 8AM VN time
export const checkKanbanIncompleteCards = async (): Promise<void> => {
    console.log('[DeadlineScheduler] Checking incomplete kanban cards...');

    try {
        // Find all boards with their members and incomplete cards
        const boards = await prisma.kanbanBoard.findMany({
            include: {
                members: {
                    include: {
                        user: { select: { id: true, name: true, email: true } }
                    }
                },
                lists: {
                    include: {
                        cards: {
                            where: { completed: false },
                            include: {
                                assignees: { select: { id: true } }
                            }
                        }
                    }
                }
            }
        });

        // Build a map: userId -> [{ boardName, cards: [{title, listName, dueDate}] }]
        const userCardsMap: Map<number, {
            userName: string;
            email: string | null;
            boards: Map<string, { title: string; listName: string; dueDate: string | null }[]>;
        }> = new Map();

        for (const board of boards) {
            const doneListTitles = board.lists
                .filter(l => l.title.toLowerCase().includes('hoàn thành') || l.title.toLowerCase() === 'done')
                .map(l => l.id);

            for (const list of board.lists) {
                // Skip "Hoàn thành"/"Done" lists
                if (doneListTitles.includes(list.id)) continue;

                for (const card of list.cards) {
                    // Get members who should be notified: assignees + all board members
                    const memberIds = board.members.map(m => m.userId);
                    // If card has assignees, only remind assignees; otherwise remind all members
                    const notifyIds = card.assignees.length > 0
                        ? card.assignees.map(a => a.id)
                        : memberIds;

                    for (const uid of notifyIds) {
                        const member = board.members.find(m => m.userId === uid);
                        if (!member) continue;

                        if (!userCardsMap.has(uid)) {
                            userCardsMap.set(uid, {
                                userName: member.user.name,
                                email: member.user.email ?? null,
                                boards: new Map()
                            });
                        }

                        const userData = userCardsMap.get(uid)!;
                        if (!userData.boards.has(board.title)) {
                            userData.boards.set(board.title, []);
                        }
                        userData.boards.get(board.title)!.push({
                            title: card.title,
                            listName: list.title,
                            dueDate: card.dueDate?.toISOString() ?? null
                        });
                    }
                }
            }
        }

        console.log(`[DeadlineScheduler] Found ${userCardsMap.size} users with incomplete kanban cards`);

        // Send ONE consolidated notification + email per user
        for (const [userId, userData] of userCardsMap) {
            const allCards: string[] = [];
            const boardsArray: { boardName: string; cards: { title: string; listName: string; dueDate: string | null }[] }[] = [];

            for (const [boardName, cards] of userData.boards) {
                allCards.push(...cards.map(c => c.title));
                boardsArray.push({ boardName, cards });
            }

            const totalCards = allCards.length;
            if (totalCards === 0) continue;

            // Send push notification (consolidated)
            const firstBoard = boardsArray[0];
            if (!firstBoard) continue;
            const displayBoardName = boardsArray.length > 1
                ? `${firstBoard.boardName} và ${boardsArray.length - 1} bảng khác`
                : firstBoard.boardName;

            await notifyKanbanDailyReminder(userId, displayBoardName, allCards, totalCards);

            // Send ONE consolidated email
            if (userData.email) {
                await sendKanbanDailyReminderEmail(
                    userData.email,
                    userData.userName,
                    boardsArray
                );
            }

            console.log(`[DeadlineScheduler] Sent kanban reminder to user ${userId}: ${totalCards} cards across ${boardsArray.length} boards`);
        }
    } catch (error) {
        console.error('[DeadlineScheduler] Error checking kanban incomplete cards:', error);
    }
};

// Check kanban cards approaching deadline (10 minutes before) - runs every minute
export const checkKanbanCardDeadlines = async (): Promise<void> => {
    const now = new Date();
    const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000);

    try {
        // Find cards with deadline between now and 10 minutes from now
        // that haven't been reminded yet and are not completed
        const cardsApproachingDeadline = await prisma.kanbanCard.findMany({
            where: {
                dueDate: {
                    gt: now,
                    lte: tenMinutesFromNow
                },
                completed: false,
                deadlineReminderSent: false
            },
            include: {
                list: {
                    include: {
                        board: {
                            include: {
                                members: {
                                    include: {
                                        user: { select: { id: true, name: true, email: true } }
                                    }
                                }
                            }
                        }
                    }
                },
                assignees: { select: { id: true, name: true } }
            }
        });

        if (cardsApproachingDeadline.length === 0) return;

        console.log(`[DeadlineScheduler] Found ${cardsApproachingDeadline.length} kanban cards approaching deadline`);

        for (const card of cardsApproachingDeadline) {
            if (!card.dueDate) continue;

            const board = card.list.board;
            // Notify assignees if any, otherwise all board members
            const recipientIds = card.assignees.length > 0
                ? card.assignees.map(a => a.id)
                : board.members.map(m => m.userId);

            // Send push notification
            await notifyKanbanCardDeadline(
                recipientIds,
                card.id,
                card.title,
                board.title,
                card.dueDate
            );

            // Mark reminder as sent
            await prisma.kanbanCard.update({
                where: { id: card.id },
                data: { deadlineReminderSent: true }
            });

            console.log(`[DeadlineScheduler] Sent deadline reminder for kanban card "${card.title}" (due: ${card.dueDate.toISOString()})`);
        }
    } catch (error) {
        console.error('[DeadlineScheduler] Error checking kanban card deadlines:', error);
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
    await checkKanbanIncompleteCards();

    console.log('[DeadlineScheduler] ========== Deadline checks completed ==========');
};

import { notifyTaskReminder } from './pushNotificationService.js';
import { sendTaskReminderEmail } from './emailService.js';

// ... (existing imports)

// Check processable task reminders
export const checkTaskReminders = async (): Promise<void> => {
    // console.log('[DeadlineScheduler] Checking task reminders...');
    const now = new Date();

    try {
        const tasksToRemind = await prisma.task.findMany({
            where: {
                reminderAt: {
                    lte: now
                },
                isReminderSent: false,
                status: {
                    not: 'COMPLETED'
                }
            },
            include: {
                creator: { select: { id: true, name: true, email: true } }
            }
        });

        if (tasksToRemind.length > 0) {
            console.log(`[DeadlineScheduler] Found ${tasksToRemind.length} tasks to remind`);

            for (const task of tasksToRemind) {
                if (!task.reminderAt) continue;

                // Send push notification
                await notifyTaskReminder(
                    task.creatorId,
                    task.id,
                    task.title,
                    task.reminderAt
                );

                // Send email
                if (task.creator.email) {
                    await sendTaskReminderEmail(
                        task.creator.email,
                        task.creator.name,
                        task.id,
                        task.title,
                        task.reminderAt
                    );
                }

                // Mark as sent
                await prisma.task.update({
                    where: { id: task.id },
                    data: { isReminderSent: true }
                });
            }
        }
    } catch (error) {
        console.error('[DeadlineScheduler] Error checking task reminders:', error);
    }
};

// ... (existing imports)

// Interval ID for cleanup
let schedulerIntervalId: NodeJS.Timeout | null = null;
let reminderIntervalId: NodeJS.Timeout | null = null;

// Start the deadline scheduler (runs daily at 8:00 AM)
export const startDeadlineScheduler = (): void => {
    console.log('[DeadlineScheduler] Starting deadline scheduler...');

    // 1. Setup Daily Deadline Check (8:00 AM Vietnam time = UTC+7)
    const now = new Date();
    const vnOffset = 7 * 60; // Vietnam is UTC+7
    const nowVN = new Date(now.getTime() + vnOffset * 60 * 1000);
    const next8AM_VN = new Date(nowVN);
    next8AM_VN.setHours(8, 0, 0, 0);

    // If it's already past 8 AM Vietnam time today, schedule for tomorrow
    if (nowVN >= next8AM_VN) {
        next8AM_VN.setDate(next8AM_VN.getDate() + 1);
    }

    // Convert back to UTC for scheduling
    const next8AM_UTC = new Date(next8AM_VN.getTime() - vnOffset * 60 * 1000);
    const msUntil8AM = next8AM_UTC.getTime() - now.getTime();
    console.log(`[DeadlineScheduler] Next daily check scheduled for ${next8AM_UTC.toISOString()} (8:00 AM Vietnam time)`);

    setTimeout(() => {
        runDeadlineChecks();
        schedulerIntervalId = setInterval(runDeadlineChecks, 24 * 60 * 60 * 1000);
    }, msUntil8AM);

    // 2. Setup Minutely Reminder Check (task reminders + kanban card deadlines)
    console.log('[DeadlineScheduler] Starting minutely reminder check...');
    // Run immediately
    checkTaskReminders();
    checkKanbanCardDeadlines();
    // Then run every minute
    reminderIntervalId = setInterval(() => {
        checkTaskReminders();
        checkKanbanCardDeadlines();
    }, 60 * 1000);
};

// Stop the deadline scheduler
export const stopDeadlineScheduler = (): void => {
    if (schedulerIntervalId) {
        clearInterval(schedulerIntervalId);
        schedulerIntervalId = null;
    }
    if (reminderIntervalId) {
        clearInterval(reminderIntervalId);
        reminderIntervalId = null;
    }
    console.log('[DeadlineScheduler] Scheduler stopped');
};

export default {
    runDeadlineChecks,
    startDeadlineScheduler,
    stopDeadlineScheduler,
    checkOverdueProjects,
    checkUpcomingProjectDeadlines,
    checkOverdueTasks,
    checkUpcomingTaskDeadlines,
    checkTaskReminders,
    checkKanbanCardDeadlines,
    checkKanbanIncompleteCards
};
