import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../config/prisma.js';
import { uploadFile, getPresignedUrl, normalizeVietnameseFilename } from '../services/minioService.js';
import { getIO } from '../index.js';

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
                            select: { id: true, name: true, avatar: true }
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

            // Get presigned URL for avatar
            let avatarUrl = null;
            if (displayAvatar) {
                try {
                    avatarUrl = await getPresignedUrl(displayAvatar);
                } catch (e) {
                    console.error('Error getting avatar URL:', e);
                }
            }

            // Get presigned URLs for member avatars
            const membersWithAvatars = await Promise.all(conv.members.map(async (m) => {
                let memberAvatarUrl = null;
                if (m.user.avatar) {
                    try {
                        memberAvatarUrl = await getPresignedUrl(m.user.avatar);
                    } catch (e) {
                        // Ignore error
                    }
                }
                return {
                    ...m,
                    user: {
                        ...m.user,
                        avatarUrl: memberAvatarUrl
                    }
                };
            }));

            return {
                ...conv,
                members: membersWithAvatars,
                displayName,
                displayAvatar,
                avatarUrl, // Presigned URL
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
        const { name, type, description } = req.body;
        
        // Parse memberIds - có thể là array hoặc JSON string (từ FormData)
        let memberIds = req.body.memberIds;
        if (typeof memberIds === 'string') {
            try {
                memberIds = JSON.parse(memberIds);
            } catch (e) {
                memberIds = [parseInt(memberIds)];
            }
        }

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
            const fileName = `projectmanagement/avatargroup/${Date.now()}-${normalizedFilename}`;
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

        // Emit WebSocket event to all members for realtime update
        const io = getIO();
        const allMemberIds = [userId, ...memberIds];
        
        // Get avatar URL if uploaded
        let avatarUrl = null;
        if (avatarPath) {
            try {
                avatarUrl = await getPresignedUrl(avatarPath);
            } catch (e) {
                console.error('Error getting avatar URL:', e);
            }
        }

        // Get member avatar URLs
        const membersWithAvatars = await Promise.all(conversation.members.map(async (m) => {
            let memberAvatarUrl = null;
            if (m.user.avatar) {
                try {
                    memberAvatarUrl = await getPresignedUrl(m.user.avatar);
                } catch (e) {
                    // Ignore error
                }
            }
            return {
                ...m,
                user: {
                    ...m.user,
                    avatarUrl: memberAvatarUrl
                }
            };
        }));

        const responseConv = {
            ...conversation,
            members: membersWithAvatars,
            avatarUrl
        };

        allMemberIds.forEach((memberId: number) => {
            io.to(`user:${memberId}`).emit('chat:new_conversation', {
                conversation: responseConv
            });
        });

        res.status(201).json(responseConv);
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

        const messages = await (prisma.chatMessage as any).findMany({
            where: {
                conversationId: Number(id),
                ...(cursor ? { id: { lt: Number(cursor) } } : {})
            },
            include: {
                sender: {
                    select: { id: true, name: true, avatar: true }
                },
                reactions: {
                    include: {
                        user: {
                            select: { id: true, name: true }
                        }
                    }
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

        // Thêm URL cho attachment và avatar - sử dụng relative URL để mobile có thể truy cập
        const messagesWithUrls = await Promise.all(messages.map(async (msg: any) => {
            let attachmentUrl = null;
            if (msg.attachment) {
                // Use relative URL - frontend will prepend the correct base URL
                attachmentUrl = `/api/chat/messages/${msg.id}/file`;
            }
            
            // Add avatar URL for sender
            let senderAvatarUrl = null;
            if (msg.sender?.avatar) {
                if (msg.sender.avatar.startsWith('data:')) {
                    senderAvatarUrl = msg.sender.avatar;
                } else {
                    try {
                        senderAvatarUrl = await getPresignedUrl(msg.sender.avatar);
                    } catch (e) {
                        console.error('Error getting avatar URL:', e);
                    }
                }
            }
            
            return { 
                ...msg, 
                attachmentUrl,
                sender: {
                    ...msg.sender,
                    avatar: senderAvatarUrl
                }
            };
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
        
        // Handle undefined body - this can happen if body-parser middleware isn't applied correctly
        if (!req.body) {
            console.error('sendMessage - req.body is undefined! Content-Type:', req.headers['content-type']);
            return res.status(400).json({ message: 'Request body is missing' });
        }
        
        const content = req.body.content;

        if (!content?.trim()) {
            console.log('sendMessage - Empty content. Body received:', req.body);
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

        // Add avatar URL for sender
        let senderAvatarUrl = null;
        if (message.sender?.avatar) {
            if (message.sender.avatar.startsWith('data:')) {
                senderAvatarUrl = message.sender.avatar;
            } else {
                try {
                    senderAvatarUrl = await getPresignedUrl(message.sender.avatar);
                } catch (e) {
                    console.error('Error getting avatar URL:', e);
                }
            }
        }
        const messageWithAvatar = {
            ...message,
            sender: { ...message.sender, avatar: senderAvatarUrl }
        };

        // Cập nhật updatedAt của conversation
        await prisma.conversation.update({
            where: { id: Number(id) },
            data: { updatedAt: new Date() }
        });

        // Emit WebSocket event for realtime update
        const io = getIO();
        io.to(`conversation:${id}`).emit('chat:new_message', {
            conversationId: Number(id),
            message: messageWithAvatar
        });

        res.status(201).json(messageWithAvatar);
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
        const fileName = `projectmanagement/chatcongty/${id}/${userId}-${Date.now()}-${normalizedFilename}`;
        console.log('[sendFileMessage] Uploading file:', fileName);
        const filePath = await uploadFile(fileName, req.file.buffer, {
            'Content-Type': req.file.mimetype,
        });
        console.log('[sendFileMessage] File uploaded, path:', filePath);

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

        // Lấy relative URL thay vì presigned URL để mobile có thể truy cập
        const attachmentUrl = `/api/chat/messages/${message.id}/file`;

        // Add avatar URL for sender
        let senderAvatarUrl = null;
        if (message.sender?.avatar) {
            if (message.sender.avatar.startsWith('data:')) {
                senderAvatarUrl = message.sender.avatar;
            } else {
                try {
                    senderAvatarUrl = await getPresignedUrl(message.sender.avatar);
                } catch (e) {
                    console.error('Error getting avatar URL:', e);
                }
            }
        }

        // Cập nhật updatedAt của conversation
        await prisma.conversation.update({
            where: { id: Number(id) },
            data: { updatedAt: new Date() }
        });

        // Prepare response with attachmentUrl and avatar
        const responseMessage = { 
            ...message, 
            attachmentUrl,
            sender: { ...message.sender, avatar: senderAvatarUrl }
        };

        // Emit WebSocket event for realtime update
        const io = getIO();
        io.to(`conversation:${id}`).emit('chat:new_message', {
            conversationId: Number(id),
            message: responseMessage
        });

        res.status(201).json(responseMessage);
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
        const fileName = `projectmanagement/chatcongty/${id}/${userId}-${Date.now()}-voice.webm`;
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

        const attachmentUrl = `/api/chat/messages/${message.id}/file`;

        // Add avatar URL for sender
        let senderAvatarUrl = null;
        if (message.sender?.avatar) {
            if (message.sender.avatar.startsWith('data:')) {
                senderAvatarUrl = message.sender.avatar;
            } else {
                try {
                    senderAvatarUrl = await getPresignedUrl(message.sender.avatar);
                } catch (e) {
                    console.error('Error getting avatar URL:', e);
                }
            }
        }

        // Cập nhật updatedAt của conversation
        await prisma.conversation.update({
            where: { id: Number(id) },
            data: { updatedAt: new Date() }
        });

        // Prepare response with attachmentUrl and avatar
        const responseMessage = { 
            ...message, 
            attachmentUrl,
            sender: { ...message.sender, avatar: senderAvatarUrl }
        };

        // Emit WebSocket event for realtime update
        const io = getIO();
        io.to(`conversation:${id}`).emit('chat:new_message', {
            conversationId: Number(id),
            message: responseMessage
        });

        res.status(201).json(responseMessage);
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

// Delete entire conversation (only for admins or private chat participants)
export const deleteConversation = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        const conversationId = Number(id);

        // Check if user is a member
        const member = await prisma.conversationMember.findUnique({
            where: {
                conversationId_userId: {
                    conversationId,
                    userId
                }
            }
        });

        if (!member) {
            return res.status(403).json({ message: 'You are not a member of this conversation' });
        }

        // Get conversation to check type
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId }
        });

        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }

        // For GROUP conversations, only admin can delete
        if (conversation.type === 'GROUP' && !member.isAdmin) {
            return res.status(403).json({ message: 'Only admin can delete group conversation' });
        }

        // Delete all messages first (including their reactions)
        await prisma.chatMessageReaction.deleteMany({
            where: {
                message: {
                    conversationId
                }
            }
        });

        await prisma.chatMessage.deleteMany({
            where: { conversationId }
        });

        // Delete all members
        await prisma.conversationMember.deleteMany({
            where: { conversationId }
        });

        // Delete the conversation
        await prisma.conversation.delete({
            where: { id: conversationId }
        });

        res.json({ message: 'Conversation deleted successfully' });
    } catch (error) {
        console.error('Error deleting conversation:', error);
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
            const fileName = `projectmanagement/avatargroup/${Date.now()}-${normalizedFilename}`;
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

        // Lấy avatar URL nếu có
        let avatarUrl = null;
        if (updated.avatar) {
            try {
                avatarUrl = await getPresignedUrl(updated.avatar);
            } catch (e) {
                console.error('Error getting avatar URL:', e);
            }
        }

        const result = { ...updated, avatarUrl };

        // Emit WebSocket event to all members for realtime update
        const io = getIO();
        updated.members.forEach((m) => {
            io.to(`user:${m.userId}`).emit('chat:conversation_updated', {
                conversation: result
            });
        });

        res.json(result);
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
            // Nếu không có query, trả về tất cả users (trừ chính mình)
            const allUsers = await prisma.user.findMany({
                where: {
                    id: { not: userId }
                },
                select: {
                    id: true,
                    name: true,
                    username: true,
                    avatar: true,
                    position: true
                },
                take: 20
            });

            // Add avatar URLs
            const usersWithAvatars = await Promise.all(allUsers.map(async (user) => {
                let avatarUrl = null;
                if (user.avatar) {
                    try {
                        avatarUrl = await getPresignedUrl(user.avatar);
                    } catch (e) {
                        console.error('Error getting avatar URL:', e);
                    }
                }
                return { ...user, avatarUrl };
            }));

            return res.json(usersWithAvatars);
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

        // Add avatar URLs
        const usersWithAvatars = await Promise.all(users.map(async (user) => {
            let avatarUrl = null;
            if (user.avatar) {
                try {
                    avatarUrl = await getPresignedUrl(user.avatar);
                } catch (e) {
                    console.error('Error getting avatar URL:', e);
                }
            }
            return { ...user, avatarUrl };
        }));

        res.json(usersWithAvatars);
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Thêm reaction vào tin nhắn
export const addReaction = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { messageId } = req.params;
        const { emoji } = req.body;

        if (!emoji) {
            return res.status(400).json({ message: 'Emoji is required' });
        }

        // Kiểm tra message tồn tại
        const message = await prisma.chatMessage.findUnique({
            where: { id: Number(messageId) },
            include: {
                conversation: {
                    include: {
                        members: true
                    }
                }
            }
        });

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        // Kiểm tra quyền (user phải là member của conversation)
        const isMember = message.conversation.members.some(m => m.userId === userId);
        if (!isMember) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Thêm hoặc cập nhật reaction
        const reaction = await (prisma as any).chatMessageReaction.upsert({
            where: {
                messageId_userId_emoji: {
                    messageId: Number(messageId),
                    userId,
                    emoji
                }
            },
            update: {},
            create: {
                messageId: Number(messageId),
                userId,
                emoji
            },
            include: {
                user: {
                    select: { id: true, name: true }
                }
            }
        });

        // Lấy tất cả reactions của message
        const allReactions = await (prisma as any).chatMessageReaction.findMany({
            where: { messageId: Number(messageId) },
            include: {
                user: {
                    select: { id: true, name: true }
                }
            }
        });

        // Emit WebSocket event
        const io = getIO();
        io.to(`conversation:${message.conversationId}`).emit('chat:reaction_added', {
            conversationId: message.conversationId,
            messageId: Number(messageId),
            reactions: allReactions
        });

        res.json({ reaction, allReactions });
    } catch (error) {
        console.error('Error adding reaction:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Xóa reaction khỏi tin nhắn
export const removeReaction = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { messageId, emoji } = req.params;

        if (!emoji) {
            return res.status(400).json({ message: 'Emoji is required' });
        }

        // Kiểm tra message tồn tại
        const message = await prisma.chatMessage.findUnique({
            where: { id: Number(messageId) }
        });

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        // Xóa reaction
        await (prisma as any).chatMessageReaction.deleteMany({
            where: {
                messageId: Number(messageId),
                userId,
                emoji: decodeURIComponent(emoji)
            }
        });

        // Lấy tất cả reactions còn lại
        const allReactions = await (prisma as any).chatMessageReaction.findMany({
            where: { messageId: Number(messageId) },
            include: {
                user: {
                    select: { id: true, name: true }
                }
            }
        });

        // Emit WebSocket event
        const io = getIO();
        io.to(`conversation:${message.conversationId}`).emit('chat:reaction_removed', {
            conversationId: message.conversationId,
            messageId: Number(messageId),
            reactions: allReactions
        });

        res.json({ allReactions });
    } catch (error) {
        console.error('Error removing reaction:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Đánh dấu conversation đã đọc
export const markConversationAsRead = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        await prisma.conversationMember.update({
            where: {
                conversationId_userId: {
                    conversationId: Number(id),
                    userId
                }
            },
            data: { lastRead: new Date() }
        });

        res.json({ message: 'Marked as read' });
    } catch (error) {
        console.error('Error marking as read:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Xóa tin nhắn
export const deleteMessage = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { messageId } = req.params;

        // Tìm tin nhắn
        const message = await prisma.chatMessage.findUnique({
            where: { id: Number(messageId) },
            include: {
                conversation: {
                    include: {
                        members: true
                    }
                }
            }
        });

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        // Kiểm tra quyền xóa (chỉ người gửi hoặc admin nhóm mới được xóa)
        const member = message.conversation.members.find(m => m.userId === userId);
        if (!member) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const isOwner = message.senderId === userId;
        const isAdmin = member.isAdmin;

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ message: 'Only message owner or admin can delete' });
        }

        // Xóa reactions của tin nhắn trước
        await (prisma as any).chatMessageReaction.deleteMany({
            where: { messageId: Number(messageId) }
        });

        // Xóa tin nhắn
        await prisma.chatMessage.delete({
            where: { id: Number(messageId) }
        });

        // Emit WebSocket event
        const io = getIO();
        io.to(`conversation:${message.conversationId}`).emit('chat:message_deleted', {
            conversationId: message.conversationId,
            messageId: Number(messageId)
        });

        res.json({ message: 'Message deleted successfully' });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Serve attachment file directly (for images, audio, and files)
// This route is public (no auth required) for img src, audio src to work
export const serveMessageAttachment = async (req: Request, res: Response) => {
    try {
        const { messageId } = req.params;
        console.log('[serveMessageAttachment] Request for messageId:', messageId);
        
        const message = await prisma.chatMessage.findUnique({
            where: { id: Number(messageId) }
        });

        if (!message) {
            console.log('[serveMessageAttachment] Message not found:', messageId);
            return res.status(404).json({ message: 'Message not found' });
        }
        
        if (!message.attachment) {
            console.log('[serveMessageAttachment] Message has no attachment:', messageId);
            return res.status(404).json({ message: 'Attachment not found' });
        }

        console.log('[serveMessageAttachment] Attachment path:', message.attachment);

        const { getFileStream, getFileStats } = await import('../services/minioService.js');
        
        try {
            const stats = await getFileStats(message.attachment);
            console.log('[serveMessageAttachment] File stats:', stats);
            
            const fileStream = await getFileStream(message.attachment);

            // Set appropriate content type - check both cases
            const contentType = stats.metaData['content-type'] || stats.metaData['Content-Type'] || 'application/octet-stream';
            console.log('[serveMessageAttachment] Content-Type:', contentType);
            
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Length', stats.size);
            
            // For images and audio, allow caching and inline display
            if (contentType.startsWith('image/') || contentType.startsWith('audio/')) {
                res.setHeader('Cache-Control', 'public, max-age=31536000');
                res.setHeader('Content-Disposition', 'inline');
            }
            
            // Allow CORS for cross-origin image loading
            res.setHeader('Access-Control-Allow-Origin', '*');

            fileStream.pipe(res);
        } catch (minioError) {
            console.error('[serveMessageAttachment] MinIO error:', minioError);
            return res.status(404).json({ message: 'File not found in storage' });
        }
    } catch (error) {
        console.error('[serveMessageAttachment] Error:', error);
        res.status(500).json({ message: 'Failed to serve attachment' });
    }
};
