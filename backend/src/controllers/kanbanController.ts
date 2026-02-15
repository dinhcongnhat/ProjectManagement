import type { Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../config/prisma.js';
import { getIO } from '../index.js';
import { createNotification } from './notificationController.js';
import { uploadFile, deleteFile, getPresignedUrl, normalizeVietnameseFilename, isOfficeFile } from '../services/minioService.js';
import {
    notifyKanbanCardCreated,
    notifyKanbanComment,
    notifyKanbanChecklist,
    notifyKanbanInvite,
    notifyKanbanCardMoved,
    notifyKanbanCardApproved,
    notifyKanbanAttachment,
    notifyKanbanChecklistToggle
} from '../services/pushNotificationService.js';

// ==================== HELPER: Emit board update to all members ====================
const emitBoardUpdate = async (boardId: number, excludeUserId?: number, eventData?: Record<string, unknown>) => {
    try {
        const io = getIO();
        const members = await prisma.kanbanBoardMember.findMany({
            where: { boardId },
            select: { userId: true }
        });
        for (const member of members) {
            if (member.userId !== excludeUserId) {
                io.to(`user:${member.userId}`).emit('kanban:board_updated', {
                    boardId,
                    ...eventData
                });
            }
        }
    } catch (error) {
        console.error('[Kanban] Error emitting board update:', error);
    }
};

// ==================== HELPER: Get or create project board ====================
export const getOrCreateProjectBoard = async (projectId: number, creatorId: number) => {
    let board = await prisma.kanbanBoard.findFirst({
        where: { projectId, isProjectBoard: true },
        include: { lists: { orderBy: { position: 'asc' } }, members: true }
    });

    if (!board) {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true, name: true, code: true, managerId: true }
        });
        if (!project) return null;

        board = await prisma.kanbanBoard.create({
            data: {
                title: `${project.code} - ${project.name}`,
                description: `Bảng công việc dự án ${project.name}`,
                background: '#0079bf',
                isProjectBoard: true,
                projectId,
                ownerId: project.managerId,
                members: { create: { userId: project.managerId, role: 'ADMIN' } },
                lists: {
                    create: [
                        { title: 'Cần làm', position: 0 },
                        { title: 'Đang làm', position: 1 },
                        { title: 'Cần review', position: 2 },
                        { title: 'Hoàn thành', position: 3 },
                    ]
                }
            },
            include: { lists: { orderBy: { position: 'asc' } }, members: true }
        });
    }

    return board;
};

// ==================== HELPER: Auto-create Kanban card for task ====================
export const createCardForTask = async (
    taskId: number, taskTitle: string, taskDescription: string | null,
    assigneeId: number, creatorId: number, projectId: number, dueDate?: Date | null
) => {
    try {
        const board = await getOrCreateProjectBoard(projectId, creatorId);
        if (!board) return null;

        const todoList = board.lists.find(l => l.title === 'Cần làm') || board.lists[0];
        if (!todoList) return null;

        // Ensure assignee is board member
        if (!board.members.some(m => m.userId === assigneeId)) {
            await prisma.kanbanBoardMember.create({
                data: { boardId: board.id, userId: assigneeId, role: 'MEMBER' }
            }).catch(() => { });
        }
        // Ensure creator is board member
        if (!board.members.some(m => m.userId === creatorId)) {
            await prisma.kanbanBoardMember.create({
                data: { boardId: board.id, userId: creatorId, role: 'ADMIN' }
            }).catch(() => { });
        }

        const maxPos = await prisma.kanbanCard.aggregate({
            where: { listId: todoList.id },
            _max: { position: true }
        });

        return await prisma.kanbanCard.create({
            data: {
                title: taskTitle,
                description: taskDescription,
                position: (maxPos._max.position ?? -1) + 1,
                dueDate: dueDate || null,
                listId: todoList.id,
                creatorId,
                taskId,
                projectId,
                assignees: { connect: [{ id: assigneeId }] }
            }
        });
    } catch (error) {
        console.error('Error creating kanban card for task:', error);
        return null;
    }
};

// ==================== BOARDS ====================

export const getBoards = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        const boards = await prisma.kanbanBoard.findMany({
            where: {
                OR: [
                    { ownerId: userId },
                    { members: { some: { userId } } }
                ]
            },
            include: {
                owner: { select: { id: true, name: true, avatar: true } },
                members: {
                    include: {
                        user: { select: { id: true, name: true, avatar: true } }
                    }
                },
                _count: { select: { lists: true } }
            },
            orderBy: { updatedAt: 'desc' }
        });

        // Add avatar URLs
        const boardsWithUrls = boards.map(board => ({
            ...board,
            owner: {
                ...board.owner,
                avatarUrl: board.owner.avatar ? `/api/users/${board.owner.id}/avatar` : null
            },
            members: board.members.map(m => ({
                ...m,
                user: {
                    ...m.user,
                    avatarUrl: m.user.avatar ? `/api/users/${m.user.id}/avatar` : null
                }
            }))
        }));

        res.json(boardsWithUrls);
    } catch (error) {
        console.error('Error fetching boards:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get upcoming cards with deadline for the current user
export const getUpcomingCards = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const now = new Date();
        const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const cards = await prisma.kanbanCard.findMany({
            where: {
                completed: false,
                dueDate: {
                    lte: sevenDaysLater,
                    not: null
                },
                list: {
                    board: {
                        OR: [
                            { ownerId: userId },
                            { members: { some: { userId } } }
                        ]
                    }
                },
                OR: [
                    { creatorId: userId },
                    { assignees: { some: { id: userId } } }
                ]
            },
            include: {
                list: {
                    select: {
                        id: true,
                        title: true,
                        board: {
                            select: { id: true, title: true }
                        }
                    }
                },
                assignees: {
                    select: { id: true, name: true }
                }
            },
            orderBy: { dueDate: 'asc' },
            take: 10
        });

        res.json(cards);
    } catch (error) {
        console.error('Error fetching upcoming cards:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Search kanban cards across all accessible boards
export const searchCards = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const query = (req.query.q as string || '').trim();

        if (!query || query.length < 1) {
            return res.json([]);
        }

        const cards = await prisma.kanbanCard.findMany({
            where: {
                title: { contains: query, mode: 'insensitive' },
                list: {
                    board: {
                        OR: [
                            { ownerId: userId },
                            { members: { some: { userId } } }
                        ]
                    }
                }
            },
            include: {
                list: {
                    select: {
                        id: true,
                        title: true,
                        board: {
                            select: { id: true, title: true, background: true }
                        }
                    }
                },
                assignees: {
                    select: { id: true, name: true }
                },
                labels: {
                    select: { id: true, name: true, color: true }
                }
            },
            orderBy: { updatedAt: 'desc' },
            take: 20
        });

        res.json(cards);
    } catch (error) {
        console.error('Error searching cards:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const createBoard = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { title, description, background } = req.body;

        if (!title?.trim()) {
            return res.status(400).json({ message: 'Tiêu đề bảng là bắt buộc' });
        }

        const board = await prisma.kanbanBoard.create({
            data: {
                title: title.trim(),
                description: description || null,
                background: background || '#0079bf',
                ownerId: userId,
                members: {
                    create: {
                        userId,
                        role: 'ADMIN'
                    }
                },
                lists: {
                    create: [
                        { title: 'Cần làm', position: 0 },
                        { title: 'Đang làm', position: 1 },
                        { title: 'Cần review', position: 2 },
                        { title: 'Hoàn thành', position: 3 },
                    ]
                }
            },
            include: {
                owner: { select: { id: true, name: true, avatar: true } },
                members: {
                    include: {
                        user: { select: { id: true, name: true, avatar: true } }
                    }
                }
            }
        });

        res.status(201).json(board);
    } catch (error) {
        console.error('Error creating board:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getBoardById = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        const board = await prisma.kanbanBoard.findUnique({
            where: { id: Number(id) },
            include: {
                owner: { select: { id: true, name: true, avatar: true } },
                members: {
                    include: {
                        user: { select: { id: true, name: true, avatar: true } }
                    }
                },
                labels: true,
                lists: {
                    orderBy: { position: 'asc' },
                    include: {
                        cards: {
                            orderBy: { position: 'asc' },
                            include: {
                                assignees: { select: { id: true, name: true, avatar: true } },
                                labels: true,
                                creator: { select: { id: true, name: true } },
                                _count: { select: { comments: true, checklist: true, attachments: true } },
                                checklist: { select: { id: true, checked: true } }
                            }
                        }
                    }
                }
            }
        });

        if (!board) {
            return res.status(404).json({ message: 'Board not found' });
        }

        // Check access
        const isMember = board.members.some(m => m.userId === userId);
        const isOwner = board.ownerId === userId;
        if (!isMember && !isOwner) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Add avatar URLs
        const boardWithUrls = {
            ...board,
            owner: {
                ...board.owner,
                avatarUrl: board.owner.avatar ? `/api/users/${board.owner.id}/avatar` : null
            },
            members: board.members.map(m => ({
                ...m,
                user: {
                    ...m.user,
                    avatarUrl: m.user.avatar ? `/api/users/${m.user.id}/avatar` : null
                }
            })),
            lists: board.lists.map(list => ({
                ...list,
                cards: list.cards.map(card => ({
                    ...card,
                    assignees: card.assignees.map(a => ({
                        ...a,
                        avatarUrl: a.avatar ? `/api/users/${a.id}/avatar` : null
                    })),
                    checklistTotal: card.checklist.length,
                    checklistChecked: card.checklist.filter(c => c.checked).length
                }))
            }))
        };

        res.json(boardWithUrls);
    } catch (error) {
        console.error('Error fetching board:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const updateBoard = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        const { title, description, background } = req.body;

        const board = await prisma.kanbanBoard.findUnique({
            where: { id: Number(id) },
            include: { members: true }
        });

        if (!board) return res.status(404).json({ message: 'Board not found' });

        const member = board.members.find(m => m.userId === userId);
        if (!member && board.ownerId !== userId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const updated = await prisma.kanbanBoard.update({
            where: { id: Number(id) },
            data: {
                ...(title !== undefined && { title }),
                ...(description !== undefined && { description }),
                ...(background !== undefined && { background }),
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('Error updating board:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const deleteBoard = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        const board = await prisma.kanbanBoard.findUnique({
            where: { id: Number(id) }
        });

        if (!board) return res.status(404).json({ message: 'Board not found' });
        if (board.ownerId !== userId) {
            return res.status(403).json({ message: 'Chỉ người tạo bảng mới có thể xóa' });
        }

        // Xóa tất cả file đính kèm trên MinIO cho các card trong board
        const boardAttachments = await prisma.kanbanAttachment.findMany({
            where: {
                card: { list: { boardId: Number(id) } },
                source: { not: 'google-drive' }
            },
            select: { minioPath: true }
        });
        for (const att of boardAttachments) {
            try {
                await deleteFile(att.minioPath);
                console.log(`[Kanban] Deleted MinIO file: ${att.minioPath}`);
            } catch (err) {
                console.error(`[Kanban] Failed to delete MinIO file: ${att.minioPath}`, err);
            }
        }

        await prisma.kanbanBoard.delete({ where: { id: Number(id) } });
        res.json({ message: 'Board deleted' });
    } catch (error) {
        console.error('Error deleting board:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ==================== BOARD MEMBERS ====================

export const addBoardMember = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        const { memberIds } = req.body;

        const board = await prisma.kanbanBoard.findUnique({
            where: { id: Number(id) },
            include: { members: true }
        });

        if (!board) return res.status(404).json({ message: 'Board not found' });

        const isAdmin = board.members.some(m => m.userId === userId && m.role === 'ADMIN') || board.ownerId === userId;
        if (!isAdmin) return res.status(403).json({ message: 'Chỉ admin mới có thể thêm thành viên' });

        const ids = Array.isArray(memberIds) ? memberIds : [memberIds];
        const existingMemberIds = board.members.map(m => m.userId);

        const newMembers = ids.filter((mid: number) => !existingMemberIds.includes(Number(mid)));

        if (newMembers.length > 0) {
            await prisma.kanbanBoardMember.createMany({
                data: newMembers.map((mid: number) => ({
                    boardId: Number(id),
                    userId: Number(mid),
                    role: 'MEMBER'
                }))
            });

            // Send push notification + bell notification to invited members
            const inviter = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
            const inviterName = inviter?.name || 'Người dùng';
            const io = getIO();

            for (const mid of newMembers) {
                await createNotification(Number(mid), 'KANBAN_INVITE', 'Mời vào bảng Kanban',
                    `${inviterName} đã mời bạn vào bảng làm việc nhóm "${board.title}"`,
                    undefined, undefined);
                io.to(`user:${mid}`).emit('new_notification', {
                    type: 'KANBAN_INVITE', title: 'Mời vào bảng Kanban',
                    message: `${inviterName} đã mời bạn vào bảng "${board.title}"`,
                    boardId: Number(id)
                });
            }

            // Push notification to devices
            notifyKanbanInvite(
                newMembers.map(Number), userId, inviterName,
                Number(id), board.title
            ).catch(err => console.error('[Kanban] Push invite notification error:', err));
        }

        const updatedBoard = await prisma.kanbanBoard.findUnique({
            where: { id: Number(id) },
            include: {
                members: {
                    include: {
                        user: { select: { id: true, name: true, avatar: true } }
                    }
                }
            }
        });

        res.json(updatedBoard?.members || []);
    } catch (error) {
        console.error('Error adding board member:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const removeBoardMember = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id, memberId } = req.params;

        const board = await prisma.kanbanBoard.findUnique({
            where: { id: Number(id) },
            include: { members: true }
        });

        if (!board) return res.status(404).json({ message: 'Board not found' });

        const isAdmin = board.members.some(m => m.userId === userId && m.role === 'ADMIN') || board.ownerId === userId;
        if (!isAdmin && userId !== Number(memberId)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        await prisma.kanbanBoardMember.deleteMany({
            where: {
                boardId: Number(id),
                userId: Number(memberId)
            }
        });

        res.json({ message: 'Member removed' });
    } catch (error) {
        console.error('Error removing board member:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ==================== LISTS ====================

export const createList = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { boardId } = req.params;
        const { title } = req.body;

        if (!title?.trim()) {
            return res.status(400).json({ message: 'Tiêu đề danh sách là bắt buộc' });
        }

        // Check board access
        const board = await prisma.kanbanBoard.findUnique({
            where: { id: Number(boardId) },
            include: { members: true }
        });

        if (!board) return res.status(404).json({ message: 'Board not found' });
        if (!board.members.some(m => m.userId === userId) && board.ownerId !== userId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Get max position
        const maxPos = await prisma.kanbanList.aggregate({
            where: { boardId: Number(boardId) },
            _max: { position: true }
        });

        const list = await prisma.kanbanList.create({
            data: {
                title: title.trim(),
                position: (maxPos._max.position ?? -1) + 1,
                boardId: Number(boardId)
            },
            include: {
                cards: true
            }
        });

        res.status(201).json(list);
    } catch (error) {
        console.error('Error creating list:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const updateList = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { title } = req.body;

        const list = await prisma.kanbanList.update({
            where: { id: Number(id) },
            data: { title }
        });

        res.json(list);
    } catch (error) {
        console.error('Error updating list:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const deleteList = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        await prisma.kanbanList.delete({ where: { id: Number(id) } });
        res.json({ message: 'List deleted' });
    } catch (error) {
        console.error('Error deleting list:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const reorderLists = async (req: AuthRequest, res: Response) => {
    try {
        const { boardId } = req.params;
        const { listIds } = req.body; // array of list IDs in new order

        if (!Array.isArray(listIds)) {
            return res.status(400).json({ message: 'listIds must be an array' });
        }

        await prisma.$transaction(
            listIds.map((listId: number, index: number) =>
                prisma.kanbanList.update({
                    where: { id: listId },
                    data: { position: index }
                })
            )
        );

        res.json({ message: 'Lists reordered' });
    } catch (error) {
        console.error('Error reordering lists:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ==================== CARDS ====================

export const createCard = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { listId } = req.params;
        const { title, description, dueDate, assigneeIds, labelIds } = req.body;

        if (!title?.trim()) {
            return res.status(400).json({ message: 'Tiêu đề thẻ là bắt buộc' });
        }

        // Get max position
        const maxPos = await prisma.kanbanCard.aggregate({
            where: { listId: Number(listId) },
            _max: { position: true }
        });

        const card = await prisma.kanbanCard.create({
            data: {
                title: title.trim(),
                description: description || null,
                position: (maxPos._max.position ?? -1) + 1,
                dueDate: dueDate ? new Date(dueDate) : null,
                listId: Number(listId),
                creatorId: userId,
                assignees: {
                    connect: Array.isArray(assigneeIds) ? assigneeIds.map((id: number) => ({ id: Number(id) })) : []
                },
                labels: {
                    connect: Array.isArray(labelIds) ? labelIds.map((id: number) => ({ id: Number(id) })) : []
                }
            },
            include: {
                assignees: { select: { id: true, name: true, avatar: true } },
                labels: true,
                creator: { select: { id: true, name: true } },
                _count: { select: { comments: true, checklist: true } }
            }
        });

        const cardWithUrls = {
            ...card,
            assignees: card.assignees.map(a => ({
                ...a,
                avatarUrl: a.avatar ? `/api/users/${a.id}/avatar` : null
            })),
            checklistTotal: 0,
            checklistChecked: 0
        };

        // Emit board update to other members
        const list = await prisma.kanbanList.findUnique({
            where: { id: Number(listId) },
            select: { boardId: true, title: true, board: { select: { id: true, title: true, members: { select: { userId: true } } } } }
        });
        if (list) {
            emitBoardUpdate(list.boardId, userId, { action: 'card_created', cardId: card.id });

            // Send push notification + bell notification to all board members
            const memberIds = list.board.members.map(m => m.userId);
            const io = getIO();
            for (const mid of memberIds.filter(m => m !== userId)) {
                await createNotification(mid, 'KANBAN_CARD_CREATED', 'Thẻ mới trong Kanban',
                    `${card.creator.name} đã tạo thẻ "${card.title}" trong danh sách "${list.title}"`,
                    undefined, undefined);
                io.to(`user:${mid}`).emit('new_notification', {
                    type: 'KANBAN_CARD_CREATED', title: 'Thẻ mới trong Kanban',
                    message: `${card.creator.name} đã tạo thẻ "${card.title}"`,
                    cardId: card.id, boardId: list.boardId
                });
            }

            // Push notification to devices
            notifyKanbanCardCreated(
                memberIds, userId, card.creator.name,
                list.boardId, list.board.title, card.title, list.title
            ).catch(err => console.error('[Kanban] Push notification error:', err));
        }

        res.status(201).json(cardWithUrls);
    } catch (error) {
        console.error('Error creating card:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const updateCard = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { title, description, dueDate, completed, assigneeIds, labelIds, listId, position } = req.body;

        const updateData: any = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (dueDate !== undefined) {
            updateData.dueDate = dueDate ? new Date(dueDate) : null;
            updateData.deadlineReminderSent = false; // Reset so reminder fires for new deadline
        }
        if (completed !== undefined) updateData.completed = completed;
        if (listId !== undefined) updateData.listId = Number(listId);
        if (position !== undefined) updateData.position = position;

        if (assigneeIds !== undefined) {
            updateData.assignees = {
                set: Array.isArray(assigneeIds) ? assigneeIds.map((aid: number) => ({ id: Number(aid) })) : []
            };
        }

        if (labelIds !== undefined) {
            updateData.labels = {
                set: Array.isArray(labelIds) ? labelIds.map((lid: number) => ({ id: Number(lid) })) : []
            };
        }

        const card = await prisma.kanbanCard.update({
            where: { id: Number(id) },
            data: updateData,
            include: {
                assignees: { select: { id: true, name: true, avatar: true } },
                labels: true,
                creator: { select: { id: true, name: true } },
                _count: { select: { comments: true, checklist: true } },
                checklist: { select: { id: true, checked: true } }
            }
        });

        const cardWithUrls = {
            ...card,
            assignees: card.assignees.map(a => ({
                ...a,
                avatarUrl: a.avatar ? `/api/users/${a.id}/avatar` : null
            })),
            checklistTotal: card.checklist.length,
            checklistChecked: card.checklist.filter(c => c.checked).length
        };

        // Emit board update to other members
        const list = await prisma.kanbanList.findUnique({ where: { id: card.listId }, select: { boardId: true } });
        if (list) {
            emitBoardUpdate(list.boardId, req.user!.id, { action: 'card_updated', cardId: card.id });
        }

        res.json(cardWithUrls);
    } catch (error) {
        console.error('Error updating card:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const deleteCard = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        // Get card's board before deleting
        const card = await prisma.kanbanCard.findUnique({
            where: { id: Number(id) },
            select: { listId: true, list: { select: { boardId: true } }, attachments: { where: { source: { not: 'google-drive' } }, select: { minioPath: true } } }
        });

        // Xóa file đính kèm trên MinIO cho card
        if (card?.attachments) {
            for (const att of card.attachments) {
                try {
                    await deleteFile(att.minioPath);
                    console.log(`[Kanban] Deleted MinIO file: ${att.minioPath}`);
                } catch (err) {
                    console.error(`[Kanban] Failed to delete MinIO file: ${att.minioPath}`, err);
                }
            }
        }

        await prisma.kanbanCard.delete({ where: { id: Number(id) } });

        // Emit board update to other members
        if (card?.list?.boardId) {
            emitBoardUpdate(card.list.boardId, req.user!.id, { action: 'card_deleted', cardId: Number(id) });
        }

        res.json({ message: 'Card deleted' });
    } catch (error) {
        console.error('Error deleting card:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const moveCard = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        const { targetListId, position } = req.body;

        // Get the card with its current list and board info
        const card = await prisma.kanbanCard.findUnique({
            where: { id: Number(id) },
            include: {
                list: {
                    include: {
                        board: {
                            include: {
                                owner: { select: { id: true, name: true } },
                                members: { include: { user: { select: { id: true, name: true } } } }
                            }
                        }
                    }
                },
                assignees: { select: { id: true, name: true } },
                creator: { select: { id: true, name: true } }
            }
        });

        if (!card) return res.status(404).json({ message: 'Card not found' });

        const sourceList = card.list;
        const board = sourceList.board;
        const targetList = await prisma.kanbanList.findUnique({ where: { id: Number(targetListId) } });
        if (!targetList) return res.status(404).json({ message: 'Target list not found' });

        const targetTitle = targetList.title.toLowerCase();
        const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        const userName = currentUser?.name || 'Người dùng';

        // ===== WORKFLOW: Block move to "Hoàn thành" if not approved =====
        if (targetTitle.includes('hoàn thành') || targetTitle === 'done') {
            const isManager = board.ownerId === userId;
            const isAdmin = board.members.some(m => m.userId === userId && m.role === 'ADMIN');
            if (!isManager && !isAdmin && !card.approved) {
                return res.status(403).json({
                    message: 'Công việc chưa được duyệt. Chỉ quản lý hoặc người theo dõi mới có thể duyệt để chuyển sang Hoàn thành.'
                });
            }
        }

        // ===== Perform move =====
        const targetCards = await prisma.kanbanCard.findMany({
            where: { listId: Number(targetListId), id: { not: Number(id) } },
            orderBy: { position: 'asc' }
        });

        const updateData: any = { listId: Number(targetListId), position: position ?? 0 };
        if (targetTitle.includes('hoàn thành') || targetTitle === 'done') {
            updateData.completed = true;
        }

        await prisma.kanbanCard.update({ where: { id: Number(id) }, data: updateData });

        const updates = targetCards.map((c, index) => {
            const newPos = index >= (position ?? 0) ? index + 1 : index;
            return prisma.kanbanCard.update({ where: { id: c.id }, data: { position: newPos } });
        });
        await prisma.$transaction(updates);

        // ===== Send notifications =====
        const io = getIO();
        const allMemberIds = board.members.map(m => m.userId).filter(mid => mid !== userId);

        // Notify ALL board members about card moves
        if (sourceList.id !== Number(targetListId)) {
            for (const mid of allMemberIds) {
                await createNotification(mid, 'KANBAN_CARD_MOVED', 'Thẻ được di chuyển',
                    `${userName} đã chuyển "${card.title}" từ "${sourceList.title}" sang "${targetList.title}"`,
                    card.projectId ?? undefined, card.taskId ?? undefined);
                io.to(`user:${mid}`).emit('new_notification', {
                    type: 'KANBAN_CARD_MOVED', title: 'Thẻ được di chuyển',
                    message: `${userName} đã chuyển "${card.title}" từ "${sourceList.title}" sang "${targetList.title}"`,
                    cardId: card.id, boardId: board.id
                });
            }

            // Push notification to devices
            notifyKanbanCardMoved(
                board.members.map(m => m.userId), userId, userName,
                board.id, card.title, sourceList.title, targetList.title
            ).catch(err => console.error('[Kanban] Push move notification error:', err));
        }

        // Emit board update event to all board members so their UI refreshes in realtime
        for (const memberId of allMemberIds) {
            io.to(`user:${memberId}`).emit('kanban:board_updated', {
                boardId: board.id,
                cardId: card.id,
                sourceListId: sourceList.id,
                targetListId: Number(targetListId),
                movedBy: userId
            });
        }

        res.json({ message: 'Card moved', targetListTitle: targetList.title });
    } catch (error) {
        console.error('Error moving card:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ==================== APPROVE CARD ====================
export const approveCard = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        const card = await prisma.kanbanCard.findUnique({
            where: { id: Number(id) },
            include: {
                list: { include: { board: { include: { members: true } } } },
                assignees: { select: { id: true, name: true } },
                creator: { select: { id: true, name: true } }
            }
        });
        if (!card) return res.status(404).json({ message: 'Card not found' });

        const board = card.list.board;
        const isManager = board.ownerId === userId;
        const isAdmin = board.members.some(m => m.userId === userId && m.role === 'ADMIN');
        const isCreator = card.creatorId === userId;
        if (!isManager && !isAdmin && !isCreator) {
            return res.status(403).json({ message: 'Chỉ người tạo thẻ, quản lý hoặc admin mới có thể duyệt công việc' });
        }

        const updatedCard = await prisma.kanbanCard.update({
            where: { id: Number(id) },
            data: { approved: true, approvedById: userId, approvedAt: new Date() }
        });

        // Emit board update to other members
        emitBoardUpdate(board.id, userId, { action: 'card_approved', cardId: card.id });

        const io = getIO();
        const approver = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        const approverName = approver?.name || 'Quản lý';

        // Notify ALL board members about approval
        const allMemberIds = board.members.map(m => m.userId).filter(mid => mid !== userId);
        for (const mid of allMemberIds) {
            await createNotification(mid, 'KANBAN_CARD_APPROVED', 'Công việc đã được duyệt',
                `"${card.title}" đã được duyệt bởi ${approverName}. Có thể chuyển sang Hoàn thành.`,
                card.projectId ?? undefined, card.taskId ?? undefined);
            io.to(`user:${mid}`).emit('new_notification', {
                type: 'KANBAN_CARD_APPROVED', title: 'Công việc đã được duyệt',
                message: `"${card.title}" đã được duyệt bởi ${approverName}`,
                cardId: card.id, boardId: board.id
            });
        }

        // Push notification to devices
        notifyKanbanCardApproved(
            board.members.map(m => m.userId), userId, approverName,
            board.id, card.title
        ).catch(err => console.error('[Kanban] Push approve notification error:', err));

        res.json(updatedCard);
    } catch (error) {
        console.error('Error approving card:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const reorderCards = async (req: AuthRequest, res: Response) => {
    try {
        const { listId } = req.params;
        const { cardIds } = req.body;

        if (!Array.isArray(cardIds)) {
            return res.status(400).json({ message: 'cardIds must be an array' });
        }

        await prisma.$transaction(
            cardIds.map((cardId: number, index: number) =>
                prisma.kanbanCard.update({
                    where: { id: cardId },
                    data: { position: index, listId: Number(listId) }
                })
            )
        );

        res.json({ message: 'Cards reordered' });
    } catch (error) {
        console.error('Error reordering cards:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ==================== LABELS ====================

export const createLabel = async (req: AuthRequest, res: Response) => {
    try {
        const { boardId } = req.params;
        const { name, color } = req.body;

        const label = await prisma.kanbanLabel.create({
            data: {
                name: name || null,
                color: color || '#61bd4f',
                boardId: Number(boardId)
            }
        });

        res.status(201).json(label);
    } catch (error) {
        console.error('Error creating label:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const deleteLabel = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.kanbanLabel.delete({ where: { id: Number(id) } });
        res.json({ message: 'Label deleted' });
    } catch (error) {
        console.error('Error deleting label:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ==================== COMMENTS ====================

export const getCardComments = async (req: AuthRequest, res: Response) => {
    try {
        const { cardId } = req.params;

        const comments = await prisma.kanbanComment.findMany({
            where: { cardId: Number(cardId) },
            include: {
                author: { select: { id: true, name: true, avatar: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        const commentsWithUrls = comments.map(c => ({
            ...c,
            author: {
                ...c.author,
                avatarUrl: c.author.avatar ? `/api/users/${c.author.id}/avatar` : null
            }
        }));

        res.json(commentsWithUrls);
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const addCardComment = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { cardId } = req.params;
        const { content } = req.body;

        if (!content?.trim()) {
            return res.status(400).json({ message: 'Nội dung bình luận là bắt buộc' });
        }

        const comment = await prisma.kanbanComment.create({
            data: {
                content: content.trim(),
                cardId: Number(cardId),
                authorId: userId
            },
            include: {
                author: { select: { id: true, name: true, avatar: true } }
            }
        });

        // Get card + board + all members to notify
        const card = await prisma.kanbanCard.findUnique({
            where: { id: Number(cardId) },
            include: {
                list: {
                    include: {
                        board: {
                            include: {
                                members: { include: { user: { select: { id: true, name: true } } } }
                            }
                        }
                    }
                }
            }
        });

        if (card) {
            const board = card.list.board;
            const io = getIO();
            const allMemberIds = board.members.map(m => m.userId).filter(mid => mid !== userId);

            for (const mid of allMemberIds) {
                await createNotification(mid, 'KANBAN_COMMENT', 'Bình luận mới trên thẻ Kanban',
                    `${comment.author.name} đã bình luận trên "${card.title}": ${content.trim().substring(0, 100)}`,
                    card.projectId ?? undefined, card.taskId ?? undefined);
                io.to(`user:${mid}`).emit('new_notification', {
                    type: 'KANBAN_COMMENT', title: 'Bình luận mới trên thẻ Kanban',
                    message: `${comment.author.name} đã bình luận trên "${card.title}"`,
                    cardId: card.id, boardId: board.id
                });
            }

            // Push notification to devices
            notifyKanbanComment(
                board.members.map(m => m.userId), userId, comment.author.name || 'Người dùng',
                board.id, card.title, content.trim()
            ).catch(err => console.error('[Kanban] Push comment notification error:', err));
        }

        res.status(201).json({
            ...comment,
            author: {
                ...comment.author,
                avatarUrl: comment.author.avatar ? `/api/users/${comment.author.id}/avatar` : null
            }
        });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const deleteComment = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        const comment = await prisma.kanbanComment.findUnique({ where: { id: Number(id) } });
        if (!comment) return res.status(404).json({ message: 'Comment not found' });
        if (comment.authorId !== userId) return res.status(403).json({ message: 'Access denied' });

        await prisma.kanbanComment.delete({ where: { id: Number(id) } });
        res.json({ message: 'Comment deleted' });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ==================== CHECKLIST ====================

export const getCardChecklist = async (req: AuthRequest, res: Response) => {
    try {
        const { cardId } = req.params;

        const items = await prisma.kanbanChecklist.findMany({
            where: { cardId: Number(cardId) },
            orderBy: { position: 'asc' }
        });

        res.json(items);
    } catch (error) {
        console.error('Error fetching checklist:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const addChecklistItem = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { cardId } = req.params;
        const { title } = req.body;

        if (!title?.trim()) {
            return res.status(400).json({ message: 'Title is required' });
        }

        const maxPos = await prisma.kanbanChecklist.aggregate({
            where: { cardId: Number(cardId) },
            _max: { position: true }
        });

        const item = await prisma.kanbanChecklist.create({
            data: {
                title: title.trim(),
                position: (maxPos._max.position ?? -1) + 1,
                cardId: Number(cardId)
            }
        });

        // Get card + board info for notifications
        const card = await prisma.kanbanCard.findUnique({
            where: { id: Number(cardId) },
            include: {
                list: {
                    include: {
                        board: {
                            include: { members: { select: { userId: true } } }
                        }
                    }
                }
            }
        });

        if (card) {
            const board = card.list.board;
            const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
            const userName = currentUser?.name || 'Người dùng';
            const io = getIO();
            const allMemberIds = board.members.map(m => m.userId).filter(mid => mid !== userId);

            // Emit board update
            emitBoardUpdate(board.id, userId, { action: 'checklist_added', cardId: Number(cardId) });

            // Bell notification + socket event
            for (const mid of allMemberIds) {
                await createNotification(mid, 'KANBAN_CHECKLIST', 'Công việc mới trong Kanban',
                    `${userName} đã thêm "${title.trim()}" vào danh sách công việc của "${card.title}"`,
                    card.projectId ?? undefined, card.taskId ?? undefined);
                io.to(`user:${mid}`).emit('new_notification', {
                    type: 'KANBAN_CHECKLIST', title: 'Công việc mới trong Kanban',
                    message: `${userName} đã thêm công việc trong "${card.title}"`,
                    cardId: card.id, boardId: board.id
                });
            }

            // Push notification to devices
            notifyKanbanChecklist(
                board.members.map(m => m.userId), userId, userName,
                board.id, card.title, title.trim()
            ).catch(err => console.error('[Kanban] Push checklist notification error:', err));
        }

        res.status(201).json(item);
    } catch (error) {
        console.error('Error adding checklist item:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const updateChecklistItem = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        const { title, checked } = req.body;

        const item = await prisma.kanbanChecklist.update({
            where: { id: Number(id) },
            data: {
                ...(title !== undefined && { title }),
                ...(checked !== undefined && { checked })
            }
        });

        // Send push notification when checklist item is toggled
        if (checked !== undefined) {
            const checklistWithCard = await prisma.kanbanChecklist.findUnique({
                where: { id: Number(id) },
                include: {
                    card: {
                        include: {
                            list: {
                                include: {
                                    board: { include: { members: { select: { userId: true } } } }
                                }
                            }
                        }
                    }
                }
            });

            if (checklistWithCard?.card) {
                const card = checklistWithCard.card;
                const board = card.list.board;
                const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
                const userName = currentUser?.name || 'Người dùng';
                const io = getIO();
                const allMemberIds = board.members.map(m => m.userId).filter(mid => mid !== userId);

                // Bell notification + socket event
                for (const mid of allMemberIds) {
                    await createNotification(mid, 'KANBAN_CHECKLIST', checked ? 'Hoàn thành công việc' : 'Mở lại công việc',
                        `${userName} đã ${checked ? 'hoàn thành' : 'mở lại'} "${item.title}" trong thẻ "${card.title}"`,
                        card.projectId ?? undefined, card.taskId ?? undefined);
                    io.to(`user:${mid}`).emit('new_notification', {
                        type: 'KANBAN_CHECKLIST', title: checked ? 'Hoàn thành công việc' : 'Mở lại công việc',
                        message: `${userName} đã ${checked ? 'hoàn thành' : 'mở lại'} "${item.title}" trong "${card.title}"`,
                        cardId: card.id, boardId: board.id
                    });
                }

                // Emit board update
                emitBoardUpdate(board.id, userId, { action: 'checklist_toggled', cardId: card.id });

                // Push notification to devices
                notifyKanbanChecklistToggle(
                    board.members.map(m => m.userId), userId, userName,
                    board.id, card.title, item.title, checked
                ).catch(err => console.error('[Kanban] Push checklist toggle notification error:', err));
            }
        }

        res.json(item);
    } catch (error) {
        console.error('Error updating checklist item:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const deleteChecklistItem = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.kanbanChecklist.delete({ where: { id: Number(id) } });
        res.json({ message: 'Checklist item deleted' });
    } catch (error) {
        console.error('Error deleting checklist item:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ==================== ATTACHMENTS ====================

export const getCardAttachments = async (req: AuthRequest, res: Response) => {
    try {
        const { cardId } = req.params;

        const attachments = await prisma.kanbanAttachment.findMany({
            where: { cardId: Number(cardId) },
            include: {
                uploadedBy: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(attachments);
    } catch (error) {
        console.error('Error getting card attachments:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const uploadCardAttachment = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { cardId } = req.params;

        // Verify card exists and user has access to the board
        const card = await prisma.kanbanCard.findUnique({
            where: { id: Number(cardId) },
            include: {
                list: {
                    include: {
                        board: { include: { members: true } }
                    }
                }
            }
        });

        if (!card) return res.status(404).json({ message: 'Card not found' });

        const board = card.list.board;
        const isMember = board.members.some(m => m.userId === userId) || board.ownerId === userId;
        if (!isMember) return res.status(403).json({ message: 'Access denied' });

        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded' });
        }

        const attachments = [];
        for (const file of files) {
            const fileName = normalizeVietnameseFilename(file.originalname);
            const timestamp = Date.now();
            const minioPath = `kanban/cards/${cardId}/${timestamp}-${fileName}`;

            await uploadFile(minioPath, file.buffer, { 'Content-Type': file.mimetype });

            const attachment = await prisma.kanbanAttachment.create({
                data: {
                    fileName,
                    fileSize: file.size,
                    mimeType: file.mimetype,
                    minioPath,
                    source: 'upload',
                    cardId: Number(cardId),
                    uploadedById: userId
                },
                include: {
                    uploadedBy: { select: { id: true, name: true } }
                }
            });
            attachments.push(attachment);
        }

        // Emit board update
        await emitBoardUpdate(board.id, userId, { action: 'attachment_added', cardId: Number(cardId) });

        // Push notification + bell notification for attachment upload
        const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        const userName = currentUser?.name || 'Người dùng';
        const io = getIO();
        const allMemberIds = board.members.map(m => m.userId).filter(mid => mid !== userId);

        for (const mid of allMemberIds) {
            await createNotification(mid, 'KANBAN_ATTACHMENT', 'File đính kèm mới',
                `${userName} đã đính kèm ${attachments.length} file vào thẻ "${card.title}"`,
                card.projectId ?? undefined, card.taskId ?? undefined);
            io.to(`user:${mid}`).emit('new_notification', {
                type: 'KANBAN_ATTACHMENT', title: 'File đính kèm mới',
                message: `${userName} đã đính kèm file vào "${card.title}"`,
                cardId: card.id, boardId: board.id
            });
        }

        // Push notification to devices
        const firstFileName = attachments[0]?.fileName || 'file';
        notifyKanbanAttachment(
            board.members.map(m => m.userId), userId, userName,
            board.id, card.title, firstFileName
        ).catch(err => console.error('[Kanban] Push attachment notification error:', err));

        res.status(201).json(attachments);
    } catch (error) {
        console.error('Error uploading card attachment:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const uploadCardAttachmentFromFolder = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { cardId } = req.params;
        const { files: folderFiles } = req.body; // Array of { id, name, mimeType, size, minioPath }

        if (!folderFiles || !Array.isArray(folderFiles) || folderFiles.length === 0) {
            return res.status(400).json({ message: 'No files selected' });
        }

        // Verify card exists and user has access
        const card = await prisma.kanbanCard.findUnique({
            where: { id: Number(cardId) },
            include: {
                list: {
                    include: {
                        board: { include: { members: true } }
                    }
                }
            }
        });

        if (!card) return res.status(404).json({ message: 'Card not found' });

        const board = card.list.board;
        const isMember = board.members.some(m => m.userId === userId) || board.ownerId === userId;
        if (!isMember) return res.status(403).json({ message: 'Access denied' });

        const attachments = [];
        for (const file of folderFiles) {
            const attachment = await prisma.kanbanAttachment.create({
                data: {
                    fileName: file.name,
                    fileSize: file.size || 0,
                    mimeType: file.mimeType || 'application/octet-stream',
                    minioPath: file.minioPath,
                    source: 'folder',
                    cardId: Number(cardId),
                    uploadedById: userId
                },
                include: {
                    uploadedBy: { select: { id: true, name: true } }
                }
            });
            attachments.push(attachment);
        }

        await emitBoardUpdate(board.id, userId, { action: 'attachment_added', cardId: Number(cardId) });

        // Push notification for folder attachment
        const currentUserFolder = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        const userNameFolder = currentUserFolder?.name || 'Người dùng';
        notifyKanbanAttachment(
            board.members.map(m => m.userId), userId, userNameFolder,
            board.id, card.title, attachments[0]?.fileName || 'file'
        ).catch(err => console.error('[Kanban] Push folder attachment notification error:', err));

        res.status(201).json(attachments);
    } catch (error) {
        console.error('Error uploading from folder:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const uploadCardAttachmentFromDrive = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { cardId } = req.params;
        const { files: driveFiles } = req.body; // Array of { name, mimeType, size, googleDriveFileId, googleDriveLink }

        if (!driveFiles || !Array.isArray(driveFiles) || driveFiles.length === 0) {
            return res.status(400).json({ message: 'No files selected' });
        }

        // Verify card exists and user has access
        const card = await prisma.kanbanCard.findUnique({
            where: { id: Number(cardId) },
            include: {
                list: {
                    include: {
                        board: { include: { members: true } }
                    }
                }
            }
        });

        if (!card) return res.status(404).json({ message: 'Card not found' });

        const board = card.list.board;
        const isMember = board.members.some(m => m.userId === userId) || board.ownerId === userId;
        if (!isMember) return res.status(403).json({ message: 'Access denied' });

        const attachments = [];
        for (const file of driveFiles) {
            const attachment = await prisma.kanbanAttachment.create({
                data: {
                    fileName: file.name,
                    fileSize: parseInt(file.size) || 0,
                    mimeType: file.mimeType || 'application/octet-stream',
                    minioPath: '', // No MinIO path for Google Drive files
                    source: 'google-drive',
                    googleDriveFileId: file.googleDriveFileId,
                    googleDriveLink: file.googleDriveLink,
                    cardId: Number(cardId),
                    uploadedById: userId
                },
                include: {
                    uploadedBy: { select: { id: true, name: true } }
                }
            });
            attachments.push(attachment);
        }

        await emitBoardUpdate(board.id, userId, { action: 'attachment_added', cardId: Number(cardId) });

        // Push notification for drive attachment
        const currentUserDrive = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
        const userNameDrive = currentUserDrive?.name || 'Người dùng';
        notifyKanbanAttachment(
            board.members.map(m => m.userId), userId, userNameDrive,
            board.id, card.title, attachments[0]?.fileName || 'file'
        ).catch(err => console.error('[Kanban] Push drive attachment notification error:', err));

        res.status(201).json(attachments);
    } catch (error) {
        console.error('Error uploading from Google Drive:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const deleteCardAttachment = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        const attachment = await prisma.kanbanAttachment.findUnique({
            where: { id: Number(id) },
            include: {
                card: {
                    include: {
                        list: {
                            include: {
                                board: { include: { members: true } }
                            }
                        }
                    }
                }
            }
        });

        if (!attachment) return res.status(404).json({ message: 'Attachment not found' });

        const board = attachment.card.list.board;
        const isOwnerOrAdmin = board.ownerId === userId || board.members.some(m => m.userId === userId && m.role === 'ADMIN');
        const isUploader = attachment.uploadedById === userId;

        if (!isOwnerOrAdmin && !isUploader) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Delete from MinIO if it was an uploaded file
        if (attachment.minioPath && attachment.source !== 'google-drive') {
            try {
                await deleteFile(attachment.minioPath);
            } catch (err) {
                console.error('Error deleting file from MinIO:', err);
            }
        }

        await prisma.kanbanAttachment.delete({ where: { id: Number(id) } });

        await emitBoardUpdate(board.id, userId, { action: 'attachment_deleted', cardId: attachment.cardId });
        res.json({ message: 'Attachment deleted' });
    } catch (error) {
        console.error('Error deleting attachment:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getAttachmentPresignedUrl = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const attachment = await prisma.kanbanAttachment.findUnique({
            where: { id: Number(id) }
        });

        if (!attachment) return res.status(404).json({ message: 'Attachment not found' });

        if (attachment.source === 'google-drive') {
            return res.json({ url: attachment.googleDriveLink, isGoogleDrive: true });
        }

        const url = await getPresignedUrl(attachment.minioPath);
        res.json({ url, isOffice: isOfficeFile(attachment.fileName) });
    } catch (error) {
        console.error('Error getting presigned URL:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
