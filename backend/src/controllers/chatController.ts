import type { Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../config/prisma.js';
import { uploadFile, getPresignedUrl, normalizeVietnameseFilename } from '../services/minioService.js';

// Lấy danh sách cuộc trò chuyện
export const getConversations = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        const conversations = await prisma.conversation.findMany({
            where: {
                members: {
                    some: { userId }
                }
            },
            include: {
                members: {
                    include: {
                        user: {
                            select: { id: true, name: true, avatar: true, position: true }
                        }
                    }
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: {
                        sender: {
                            select: { id: true, name: true }
                        }
                    }
                },
                createdBy: {
                    select: { id: true, name: true }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        // Format response với thông tin unread count
        const formattedConversations = await Promise.all(conversations.map(async (conv) => {
            const member = conv.members.find(m => m.userId === userId);
            const unreadCount = await prisma.chatMessage.count({
                where: {
                    conversationId: conv.id,
                    createdAt: { gt: member?.lastRead || new Date(0) },
                    senderId: { not: userId }
                }
            });

            // Cho chat 1-1, lấy thông tin người còn lại
            let displayName = conv.name;
            let displayAvatar = conv.avatar;
            if (conv.type === 'PRIVATE') {
                const otherMember = conv.members.find(m => m.userId !== userId);
                displayName = otherMember?.user.name || 'Unknown';
                displayAvatar = otherMember?.user.avatar || null;
            }

            return {
                ...conv,
                displayName,
                displayAvatar,
                unreadCount,
                lastMessage: conv.messages[0] || null
            };
        }));

        res.json(formattedConversations);
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Tạo cuộc trò chuyện mới
export const createConversation = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { name, type, memberIds, description } = req.body;

        // Validate
        if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
            return res.status(400).json({ message: 'Member IDs are required' });
        }

        // Cho chat 1-1, kiểm tra xem đã có cuộc trò chuyện chưa
        if (type === 'PRIVATE' && memberIds.length === 1) {
            const existingConv = await prisma.conversation.findFirst({
                where: {
                    type: 'PRIVATE',
                    AND: [
                        { members: { some: { userId } } },
                        { members: { some: { userId: memberIds[0] } } }
                    ]
                },
                include: {
                    members: {
                        include: {
                            user: {
                                select: { id: true, name: true, avatar: true }
                            }
                        }
                    }
                }
            });

            if (existingConv) {
                return res.json(existingConv);
            }
        }

        // Upload avatar nếu có
        let avatarPath = null;
        if (req.file) {
            const normalizedFilename = normalizeVietnameseFilename(req.file.originalname);
            const fileName = `chat-avatars/${Date.now()}-${normalizedFilename}`;
            avatarPath = await uploadFile(fileName, req.file.buffer, {
                'Content-Type': req.file.mimetype,
            });
        }

        // Tạo conversation
        const conversation = await prisma.conversation.create({
            data: {
                name: type === 'GROUP' ? name : null,
                type: type || 'PRIVATE',
                description,
                avatar: avatarPath,
                createdById: userId,
                members: {
                    create: [
                        { userId, isAdmin: true },
                        ...memberIds.map((id: number) => ({ userId: id, isAdmin: false }))
                    ]
                }
            },
            include: {
                members: {
                    include: {
                        user: {
                            select: { id: true, name: true, avatar: true }
                        }
                    }
                }
            }
        });

        res.status(201).json(conversation);
    } catch (error) {
        console.error('Error creating conversation:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Lấy chi tiết cuộc trò chuyện
export const getConversationById = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        const conversation = await prisma.conversation.findFirst({
            where: {
                id: Number(id),
                members: { some: { userId } }
            },
            include: {
                members: {
                    include: {
                        user: {
                            select: { id: true, name: true, avatar: true, position: true }
                        }
                    }
                },
                createdBy: {
                    select: { id: true, name: true }
                }
            }
        });

        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        res.json(conversation);
    } catch (error) {
        console.error('Error fetching conversation:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Lấy tin nhắn trong cuộc trò chuyện
export const getMessages = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        const { cursor, limit = 50 } = req.query;

        // Kiểm tra quyền truy cập
        const isMember = await prisma.conversationMember.findUnique({
            where: {
                conversationId_userId: {
                    conversationId: Number(id),
                    userId
                }
            }
        });

        if (!isMember) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const messages = await prisma.chatMessage.findMany({
            where: {
                conversationId: Number(id),
                ...(cursor ? { id: { lt: Number(cursor) } } : {})
            },
            include: {
                sender: {
                    select: { id: true, name: true, avatar: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: Number(limit)
        });

        // Cập nhật lastRead
        await prisma.conversationMember.update({
            where: {
                conversationId_userId: {
                    conversationId: Number(id),
                    userId
                }
            },
            data: { lastRead: new Date() }
        });

        // Thêm URL cho attachment
        const messagesWithUrls = await Promise.all(messages.map(async (msg) => {
            let attachmentUrl = null;
            if (msg.attachment) {
                try {
                    attachmentUrl = await getPresignedUrl(msg.attachment);
                } catch (e) {
                    console.error('Error getting presigned URL:', e);
                }
            }
            return { ...msg, attachmentUrl };
        }));

        res.json({
            messages: messagesWithUrls.reverse(),
            hasMore: messages.length === Number(limit)
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Gửi tin nhắn text
export const sendMessage = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        const { content } = req.body;

        if (!content?.trim()) {
            return res.status(400).json({ message: 'Content is required' });
        }

        // Kiểm tra quyền
        const isMember = await prisma.conversationMember.findUnique({
            where: {
                conversationId_userId: {
                    conversationId: Number(id),
                    userId
                }
            }
        });

        if (!isMember) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const message = await prisma.chatMessage.create({
            data: {
                content: content.trim(),
                messageType: 'TEXT',
                conversationId: Number(id),
                senderId: userId
            },
            include: {
                sender: {
                    select: { id: true, name: true, avatar: true }
                }
            }
        });

        // Cập nhật updatedAt của conversation
        await prisma.conversation.update({
            where: { id: Number(id) },
            data: { updatedAt: new Date() }
        });

        res.status(201).json(message);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Gửi file/ảnh
export const sendFileMessage = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        const content = req.body.content;

        if (!req.file) {
            return res.status(400).json({ message: 'File is required' });
        }

        // Kiểm tra quyền
        const isMember = await prisma.conversationMember.findUnique({
            where: {
                conversationId_userId: {
                    conversationId: Number(id),
                    userId
                }
            }
        });

        if (!isMember) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Upload file
        const normalizedFilename = normalizeVietnameseFilename(req.file.originalname);
        const fileName = `chat/${id}/${userId}-${Date.now()}-${normalizedFilename}`;
        const filePath = await uploadFile(fileName, req.file.buffer, {
            'Content-Type': req.file.mimetype,
        });

        // Xác định loại message
        const isImage = req.file.mimetype.startsWith('image/');
        let messageType: 'IMAGE' | 'FILE' | 'TEXT_WITH_FILE' = isImage ? 'IMAGE' : 'FILE';
        if (content?.trim()) {
            messageType = 'TEXT_WITH_FILE';
        }

        const message = await prisma.chatMessage.create({
            data: {
                content: content?.trim() || null,
                messageType,
                attachment: filePath,
                conversationId: Number(id),
                senderId: userId
            },
            include: {
                sender: {
                    select: { id: true, name: true, avatar: true }
                }
            }
        });

        // Lấy presigned URL
        const attachmentUrl = await getPresignedUrl(filePath);

        // Cập nhật updatedAt của conversation
        await prisma.conversation.update({
            where: { id: Number(id) },
            data: { updatedAt: new Date() }
        });

        res.status(201).json({ ...message, attachmentUrl });
    } catch (error) {
        console.error('Error sending file message:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Gửi tin nhắn thoại
export const sendVoiceMessage = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        if (!req.file) {
            return res.status(400).json({ message: 'Audio file is required' });
        }

        // Kiểm tra quyền
        const isMember = await prisma.conversationMember.findUnique({
            where: {
                conversationId_userId: {
                    conversationId: Number(id),
                    userId
                }
            }
        });

        if (!isMember) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Upload audio
        const fileName = `chat/${id}/${userId}-${Date.now()}-voice.webm`;
        const filePath = await uploadFile(fileName, req.file.buffer, {
            'Content-Type': 'audio/webm',
        });

        const message = await prisma.chatMessage.create({
            data: {
                messageType: 'VOICE',
                attachment: filePath,
                conversationId: Number(id),
                senderId: userId
            },
            include: {
                sender: {
                    select: { id: true, name: true, avatar: true }
                }
            }
        });

        const attachmentUrl = await getPresignedUrl(filePath);

        // Cập nhật updatedAt của conversation
        await prisma.conversation.update({
            where: { id: Number(id) },
            data: { updatedAt: new Date() }
        });

        res.status(201).json({ ...message, attachmentUrl });
    } catch (error) {
        console.error('Error sending voice message:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Thêm thành viên vào nhóm
export const addMembers = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        const { memberIds } = req.body;

        // Kiểm tra quyền admin
        const member = await prisma.conversationMember.findUnique({
            where: {
                conversationId_userId: {
                    conversationId: Number(id),
                    userId
                }
            }
        });

        if (!member?.isAdmin) {
            return res.status(403).json({ message: 'Only admin can add members' });
        }

        // Kiểm tra conversation type
        const conversation = await prisma.conversation.findUnique({
            where: { id: Number(id) }
        });

        if (conversation?.type !== 'GROUP') {
            return res.status(400).json({ message: 'Cannot add members to private chat' });
        }

        // Thêm members
        await prisma.conversationMember.createMany({
            data: memberIds.map((memberId: number) => ({
                conversationId: Number(id),
                userId: memberId
            })),
            skipDuplicates: true
        });

        const updatedConversation = await prisma.conversation.findUnique({
            where: { id: Number(id) },
            include: {
                members: {
                    include: {
                        user: {
                            select: { id: true, name: true, avatar: true }
                        }
                    }
                }
            }
        });

        res.json(updatedConversation);
    } catch (error) {
        console.error('Error adding members:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Rời khỏi nhóm
export const leaveConversation = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        await prisma.conversationMember.delete({
            where: {
                conversationId_userId: {
                    conversationId: Number(id),
                    userId
                }
            }
        });

        res.json({ message: 'Left conversation successfully' });
    } catch (error) {
        console.error('Error leaving conversation:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Cập nhật thông tin nhóm
export const updateConversation = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        const { name, description } = req.body;

        // Kiểm tra quyền admin
        const member = await prisma.conversationMember.findUnique({
            where: {
                conversationId_userId: {
                    conversationId: Number(id),
                    userId
                }
            }
        });

        if (!member?.isAdmin) {
            return res.status(403).json({ message: 'Only admin can update conversation' });
        }

        // Upload avatar mới nếu có
        let avatarPath = undefined;
        if (req.file) {
            const normalizedFilename = normalizeVietnameseFilename(req.file.originalname);
            const fileName = `chat-avatars/${Date.now()}-${normalizedFilename}`;
            avatarPath = await uploadFile(fileName, req.file.buffer, {
                'Content-Type': req.file.mimetype,
            });
        }

        const updated = await prisma.conversation.update({
            where: { id: Number(id) },
            data: {
                name,
                description,
                ...(avatarPath ? { avatar: avatarPath } : {})
            },
            include: {
                members: {
                    include: {
                        user: {
                            select: { id: true, name: true, avatar: true }
                        }
                    }
                }
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('Error updating conversation:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Tìm kiếm cuộc trò chuyện
export const searchConversations = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { q } = req.query;

        if (!q) {
            return res.json([]);
        }

        const conversations = await prisma.conversation.findMany({
            where: {
                members: { some: { userId } },
                OR: [
                    { name: { contains: String(q), mode: 'insensitive' } },
                    {
                        members: {
                            some: {
                                user: {
                                    name: { contains: String(q), mode: 'insensitive' }
                                }
                            }
                        }
                    }
                ]
            },
            include: {
                members: {
                    include: {
                        user: {
                            select: { id: true, name: true, avatar: true }
                        }
                    }
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            },
            take: 10
        });

        res.json(conversations);
    } catch (error) {
        console.error('Error searching conversations:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Tìm kiếm người dùng để chat
export const searchUsers = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { q } = req.query;

        if (!q) {
            return res.json([]);
        }

        const users = await prisma.user.findMany({
            where: {
                id: { not: userId },
                OR: [
                    { name: { contains: String(q), mode: 'insensitive' } },
                    { username: { contains: String(q), mode: 'insensitive' } }
                ]
            },
            select: {
                id: true,
                name: true,
                username: true,
                avatar: true,
                position: true
            },
            take: 10
        });

        res.json(users);
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
