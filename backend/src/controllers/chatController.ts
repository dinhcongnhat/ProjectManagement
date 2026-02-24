import type { Request, Response } from 'express';
import * as fs from 'fs';
import type { AuthRequest } from '../middleware/authMiddleware.js';
import prisma from '../config/prisma.js';
import { uploadFile, getPresignedUrl, normalizeVietnameseFilename, deleteFile } from '../services/minioService.js';
import { getIO } from '../index.js';
import { notifyNewChatMessage, notifyMention } from '../services/pushNotificationService.js';

// ==================== FILENAME ENCODING ====================
// Helper function to decode filename from various encodings
const decodeFilename = (filename: string): string => {
    // Check if the filename appears to be incorrectly decoded from UTF-8 as latin1
    if (/[\xC0-\xFF]/.test(filename)) {
        try {
            // Convert from latin1 bytes back to UTF-8
            return Buffer.from(filename, 'latin1').toString('utf8');
        } catch {
            return filename;
        }
    }

    // Try URL decoding
    try {
        if (filename.includes('%')) {
            return decodeURIComponent(filename);
        }
    } catch {
        // Keep as is
    }

    return filename;
};

// ==================== ENCRYPTION UTILITIES ====================
const ENCRYPTION_KEY = 'JTSC_CHAT_2025';

// Decrypt message from frontend encryption
const decryptMessage = (encrypted: string): string => {
    if (!encrypted) return encrypted;
    try {
        const decoded = atob(encrypted);
        let result = '';
        for (let i = 0; i < decoded.length; i++) {
            result += String.fromCharCode(decoded.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
        }
        return decodeURIComponent(escape(atob(result)));
    } catch {
        return encrypted; // Return original if decryption fails
    }
};

// Lấy danh sách cuộc trò chuyện
export const getConversations = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        // Fetch conversations with optimized query
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
                            select: { id: true, name: true, avatar: true, position: true, isOnline: true, lastActive: true }
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
                },
                // Include count of unread messages in a single query
                _count: {
                    select: {
                        messages: true
                    }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        // Get all member lastRead dates in one query
        const memberLastReads = await prisma.conversationMember.findMany({
            where: {
                userId,
                conversationId: { in: conversations.map(c => c.id) }
            },
            select: {
                conversationId: true,
                lastRead: true
            }
        });
        const lastReadMap = new Map(memberLastReads.map(m => [m.conversationId, m.lastRead]));

        // Get unread counts in batch - single query for all conversations
        const conversationIds = conversations.map(c => c.id);
        let unreadCounts: Array<{ conversationId: number; count: bigint }> = [];

        if (conversationIds.length > 0) {
            unreadCounts = await prisma.$queryRawUnsafe<Array<{ conversationId: number; count: bigint }>>(
                `SELECT "conversationId", COUNT(*) as count
                FROM "ChatMessage"
                WHERE "conversationId" IN (${conversationIds.join(',')})
                AND "senderId" != $1
                AND "createdAt" > (
                    SELECT COALESCE("lastRead", '1970-01-01'::timestamp)
                    FROM "ConversationMember"
                    WHERE "conversationId" = "ChatMessage"."conversationId"
                    AND "userId" = $1
                )
                GROUP BY "conversationId"`,
                userId
            ).catch((err) => {
                console.error('Error getting unread counts:', err);
                return [];
            });
        }

        const unreadMap = new Map((unreadCounts as any[]).map(u => [u.conversationId, Number(u.count)]));

        // Format response - no more N+1 queries
        const formattedConversations = conversations.map((conv) => {
            const lastRead = lastReadMap.get(conv.id) || new Date(0);
            const unreadCount = unreadMap.get(conv.id) || 0;

            // Cho chat 1-1, lấy thông tin người còn lại
            let displayName = conv.name;
            let displayAvatar = conv.avatar;
            if (conv.type === 'PRIVATE') {
                const otherMember = conv.members.find(m => m.userId !== userId);
                displayName = otherMember?.user.name || 'Unknown';
                displayAvatar = otherMember?.user.avatar || null;
            }

            // Use relative URL for avatar to avoid mixed content issues
            let avatarUrl = null;
            if (displayAvatar) {
                // For private chat, use user avatar endpoint; for group, use conversation avatar endpoint
                if (conv.type === 'PRIVATE') {
                    const otherMember = conv.members.find(m => m.userId !== userId);
                    if (otherMember?.user.avatar) {
                        avatarUrl = `/api/users/${otherMember.userId}/avatar`;
                    }
                } else if (conv.avatar) {
                    avatarUrl = `/api/chat/conversations/${conv.id}/avatar`;
                }
            }

            // Get relative URLs for member avatars
            const membersWithAvatars = conv.members.map((m) => {
                let memberAvatarUrl = null;
                if (m.user.avatar) {
                    memberAvatarUrl = `/api/users/${m.userId}/avatar`;
                }
                return {
                    ...m,
                    user: {
                        ...m.user,
                        avatarUrl: memberAvatarUrl
                    }
                };
            });

            return {
                ...conv,
                _count: undefined, // Remove from response
                members: membersWithAvatars,
                displayName,
                displayAvatar,
                avatarUrl,
                unreadCount,
                lastMessage: conv.messages[0] || null
            };
        });

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
            // Add timestamp and random ID to ensure unique filename for each group
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(2, 8);
            const ext = normalizedFilename.split('.').pop() || 'jpg';
            const uniqueFilename = `group-avatar-${timestamp}-${randomId}.${ext}`;
            const fileName = `chat-avatars/${uniqueFilename}`;
            let fileInput: any;
            if (req.file.path) {
                fileInput = fs.createReadStream(req.file.path);
            } else {
                fileInput = req.file.buffer;
            }

            avatarPath = await uploadFile(fileName, fileInput, {
                'Content-Type': req.file.mimetype,
            });

            if (req.file.path) {
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error('Error deleting temp avatar file:', err);
                });
            }
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

        // Get avatar URL if uploaded - use relative URL
        let avatarUrl = null;
        if (avatarPath) {
            avatarUrl = `/api/chat/conversations/${conversation.id}/avatar`;
        }

        // Get member avatar URLs - use relative URLs
        const membersWithAvatars = conversation.members.map((m) => {
            let memberAvatarUrl = null;
            if (m.user.avatar) {
                memberAvatarUrl = `/api/users/${m.userId}/avatar`;
            }
            return {
                ...m,
                user: {
                    ...m.user,
                    avatarUrl: memberAvatarUrl
                }
            };
        });

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
                            select: { id: true, name: true, avatar: true, position: true, isOnline: true, lastActive: true }
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
                },
                replyTo: {
                    select: {
                        id: true,
                        content: true,
                        messageType: true,
                        attachment: true,
                        sender: { select: { id: true, name: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: Number(limit)
        });

        // Cập nhật lastRead - run async, don't wait
        prisma.conversationMember.update({
            where: {
                conversationId_userId: {
                    conversationId: Number(id),
                    userId
                }
            },
            data: { lastRead: new Date() }
        }).catch(err => console.error('Error updating lastRead:', err));

        // Thêm URL cho attachment và avatar - no async needed, just transform
        const messagesWithUrls = messages.map((msg: any) => {
            let attachmentUrl = null;
            if (msg.attachment) {
                // Use relative URL - frontend will prepend the correct base URL
                // IMPORTANT: Must include conversationId in the path
                attachmentUrl = `/api/chat/conversations/${id}/messages/${msg.id}/file`;
            }

            // Add avatar URL for sender - use relative URL
            let senderAvatarUrl = null;
            if (msg.sender?.avatar) {
                senderAvatarUrl = `/api/users/${msg.sender.id}/avatar`;
            }

            return {
                ...msg,
                attachmentUrl,
                sender: {
                    ...msg.sender,
                    avatar: senderAvatarUrl
                }
            };
        });

        // Get member read status for "Seen" feature
        const memberReads = await prisma.conversationMember.findMany({
            where: { conversationId: Number(id) },
            select: { userId: true, lastRead: true }
        });

        const readReceipts = memberReads.reduce((acc: any, curr) => {
            if (curr.lastRead) acc[curr.userId] = curr.lastRead;
            return acc;
        }, {});

        res.json({
            messages: messagesWithUrls.reverse(),
            hasMore: messages.length === Number(limit),
            readReceipts
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Lấy tin nhắn xung quanh một tin nhắn cụ thể (context)
export const getMessageContext = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id, messageId } = req.params;
        const limit = 50; // Total context size

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

        const targetMessageId = Number(messageId);

        // Fetch surrounding messages
        // 1. Fetch messages NEWER than target (including target to ensure availability if needed, but easier to fetch separately)
        // 2. Fetch messages OLDER than target
        // We want roughly half/half, but need to ensure we fill the limit.

        const halfLimit = Math.floor(limit / 2);

        const replyToInclude = {
            replyTo: {
                select: {
                    id: true,
                    content: true,
                    messageType: true,
                    attachment: true,
                    sender: { select: { id: true, name: true } }
                }
            }
        };

        const newerMessages = await (prisma.chatMessage as any).findMany({
            where: {
                conversationId: Number(id),
                id: { gte: targetMessageId }
            },
            include: {
                sender: { select: { id: true, name: true, avatar: true } },
                reactions: { include: { user: { select: { id: true, name: true } } } },
                ...replyToInclude
            },
            orderBy: { id: 'asc' },
            take: halfLimit + 1 // +1 because 'gte' includes the target message
        });

        const olderMessages = await (prisma.chatMessage as any).findMany({
            where: {
                conversationId: Number(id),
                id: { lt: targetMessageId }
            },
            include: {
                sender: { select: { id: true, name: true, avatar: true } },
                reactions: { include: { user: { select: { id: true, name: true } } } },
                ...replyToInclude
            },
            orderBy: { id: 'desc' },
            take: limit - newerMessages.length + 1 // Take remaining slots
        });

        // Combine and sort
        const combinedMessages = [...olderMessages.reverse(), ...newerMessages];

        // Process URLs
        const messagesWithUrls = combinedMessages.map((msg: any) => {
            let attachmentUrl = null;
            if (msg.attachment) {
                attachmentUrl = `/api/chat/conversations/${id}/messages/${msg.id}/file`;
            }

            let senderAvatarUrl = null;
            if (msg.sender?.avatar) {
                senderAvatarUrl = `/api/users/${msg.sender.id}/avatar`;
            }

            return {
                ...msg,
                attachmentUrl,
                sender: {
                    ...msg.sender,
                    avatar: senderAvatarUrl
                }
            };
        });

        res.json({
            messages: messagesWithUrls
        });
    } catch (error) {
        console.error('Error fetching message context:', error);
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

        const { content, messageType, attachment, replyToId } = req.body;

        if ((!messageType || messageType === 'TEXT') && !content?.trim()) {
            console.log('sendMessage - Empty content. Body received:', req.body);
            return res.status(400).json({ message: 'Content is required' });
        }

        if (messageType === 'LINK' && !attachment) {
            return res.status(400).json({ message: 'Link URL is required' });
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
                content: content?.trim() || null,
                messageType: (messageType as any) || 'TEXT',
                attachment: attachment || null,
                conversationId: Number(id),
                senderId: userId,
                ...(replyToId ? { replyToId: Number(replyToId) } : {})
            },
            include: {
                sender: {
                    select: { id: true, name: true, avatar: true }
                },
                replyTo: {
                    select: {
                        id: true,
                        content: true,
                        messageType: true,
                        attachment: true,
                        sender: { select: { id: true, name: true } }
                    }
                }
            }
        });

        // Add avatar URL for sender - use relative URL
        let senderAvatarUrl = null;
        if (message.sender?.avatar) {
            senderAvatarUrl = `/api/users/${message.sender.id}/avatar`;
        }

        // Add attachment URL if exists
        let attachmentUrl = null;
        if (message.attachment) {
            attachmentUrl = `/api/chat/conversations/${id}/messages/${message.id}/file`;
        }

        const messageWithUrls = {
            ...message,
            attachmentUrl,
            sender: { ...message.sender, avatar: senderAvatarUrl }
        };

        // Cập nhật updatedAt của conversation
        await prisma.conversation.update({
            where: { id: Number(id) },
            data: { updatedAt: new Date() }
        });

        // Emit WebSocket event for realtime update
        const io = getIO();

        // Get all members of the conversation
        const conversationForEmit = await prisma.conversation.findUnique({
            where: { id: Number(id) },
            select: { members: { select: { userId: true } } }
        });

        if (conversationForEmit) {
            // Emit to each member's personal room (except sender)
            // This avoids the dual-emit (room + user) pattern that caused double messages in groups
            conversationForEmit.members.forEach(member => {
                if (member.userId !== userId) {
                    io.to(`user:${member.userId}`).emit('chat:new_message', {
                        conversationId: Number(id),
                        message: messageWithUrls
                    });
                }
            });
        }

        // Send push notifications to other members
        try {
            const conversation = await prisma.conversation.findUnique({
                where: { id: Number(id) },
                include: {
                    members: { select: { userId: true } }
                }
            });

            if (conversation) {
                const memberIds = conversation.members.map(m => m.userId);
                const displayName = conversation.type === 'GROUP'
                    ? (conversation.name || 'Nhóm chat')
                    : message.sender.name;

                const decryptedContent = decryptMessage(content.trim());
                let kanbanRedirectUrl = undefined;
                const kanbanMatch = decryptedContent.match(/📌 Thẻ công việc: \*\*(.*?)\*\*\n📚 Bảng: (.*?)\n.*?boardId=(\d+).*?cardId=(\d+)/);
                if (kanbanMatch) {
                    kanbanRedirectUrl = `/kanban?boardId=${kanbanMatch[3]}&cardId=${kanbanMatch[4]}`;
                }

                const messagePreview = decryptedContent.length > 50
                    ? decryptedContent.substring(0, 50) + '...'
                    : decryptedContent;

                await notifyNewChatMessage(
                    memberIds,
                    userId,
                    message.sender.name,
                    Number(id),
                    displayName,
                    messagePreview,
                    conversation.type === 'GROUP',
                    kanbanRedirectUrl
                );

                // Check for mentions and send separate notifications
                const mentionPattern = /@\[([^\]]+)\]|@(\S+)/g;
                let match;
                while ((match = mentionPattern.exec(decryptedContent)) !== null) {
                    const mentionedName = match[1] || match[2];
                    if (mentionedName) {
                        if (mentionedName.toLowerCase() === 'all') {
                            // Tag all
                            const otherMembers = memberIds.filter(id => id !== userId);
                            if (otherMembers.length > 0) {
                                for (const oId of otherMembers) {
                                    await notifyMention(
                                        oId,
                                        message.sender.name,
                                        'chat',
                                        Number(id),
                                        displayName,
                                        messagePreview,
                                        kanbanRedirectUrl
                                    );
                                }
                            }
                        } else {
                            // Find user by name
                            const mentionedUser = await prisma.user.findFirst({
                                where: { name: { contains: mentionedName, mode: 'insensitive' } }
                            });
                            if (mentionedUser && mentionedUser.id !== userId && memberIds.includes(mentionedUser.id)) {
                                await notifyMention(
                                    mentionedUser.id,
                                    message.sender.name,
                                    'chat',
                                    Number(id),
                                    displayName,
                                    messagePreview,
                                    kanbanRedirectUrl
                                );
                            }
                        }
                    }
                }
            }
        } catch (pushError) {
            console.error('[sendMessage] Push notification error:', pushError);
            // Don't fail the request if push fails
        }

        res.status(201).json(messageWithUrls);
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

        // Upload file - decode UTF-8 filename properly
        let originalFilename = decodeFilename(req.file.originalname);
        // Normalize to NFC form for Vietnamese characters
        originalFilename = originalFilename.normalize('NFC');

        console.log('[sendFileMessage] Original filename from multer:', req.file.originalname);
        console.log('[sendFileMessage] Decoded filename:', originalFilename);

        const fileName = `chat/${id}/${originalFilename}`;
        console.log('[sendFileMessage] Uploading file:', fileName);
        let fileInput: any;
        if (req.file.path) {
            fileInput = fs.createReadStream(req.file.path);
        } else {
            fileInput = req.file.buffer;
        }

        const filePath = await uploadFile(fileName, fileInput, {
            'Content-Type': req.file.mimetype,
        });

        if (req.file.path) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting temp chat file:', err);
            });
        }
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

        // Lấy relative URL với conversationId để match với MinIO path structure
        const attachmentUrl = `/api/chat/conversations/${id}/messages/${message.id}/file`;

        // Add avatar URL for sender - use relative URL
        let senderAvatarUrl = null;
        if (message.sender?.avatar) {
            senderAvatarUrl = `/api/users/${message.sender.id}/avatar`;
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

        // Get members and check who is in the conversation room
        const conversationForEmit = await prisma.conversation.findUnique({
            where: { id: Number(id) },
            select: { members: { select: { userId: true } } }
        });

        if (conversationForEmit) {
            // Emit to each member's personal room (except sender)
            conversationForEmit.members.forEach(member => {
                if (member.userId !== userId) {
                    io.to(`user:${member.userId}`).emit('chat:new_message', {
                        conversationId: Number(id),
                        message: responseMessage
                    });
                }
            });
        }

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
        const timestamp = Date.now();
        const fileName = `chat/${id}/audio/recording-${timestamp}.webm`;
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

        const attachmentUrl = `/api/chat/conversations/${id}/messages/${message.id}/file`;

        // Add avatar URL for sender - use relative URL
        let senderAvatarUrl = null;
        if (message.sender?.avatar) {
            senderAvatarUrl = `/api/users/${message.sender.id}/avatar`;
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

        // Get members and check who is in the conversation room
        const conversationForEmit = await prisma.conversation.findUnique({
            where: { id: Number(id) },
            select: { members: { select: { userId: true } } }
        });

        if (conversationForEmit) {
            // Emit to each member's personal room (except sender)
            conversationForEmit.members.forEach(member => {
                if (member.userId !== userId) {
                    io.to(`user:${member.userId}`).emit('chat:new_message', {
                        conversationId: Number(id),
                        message: responseMessage
                    });
                }
            });
        }

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

        // For GROUP conversations, only system ADMIN can delete the entire conversation
        if (conversation.type === 'GROUP' && req.user!.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Only system admin can delete group conversation' });
        }

        // Xóa file đính kèm trên MinIO cho tất cả tin nhắn trong cuộc hội thoại
        const messagesWithAttachments = await prisma.chatMessage.findMany({
            where: { conversationId, attachment: { not: null } },
            select: { attachment: true }
        });
        for (const m of messagesWithAttachments) {
            if (m.attachment) {
                try {
                    await deleteFile(m.attachment);
                    console.log(`[Chat] Deleted MinIO file: ${m.attachment}`);
                } catch (err) {
                    console.error(`[Chat] Failed to delete MinIO file: ${m.attachment}`, err);
                }
            }
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
            // Add timestamp and random ID to ensure unique filename
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(2, 8);
            const ext = normalizedFilename.split('.').pop() || 'jpg';
            const uniqueFilename = `group-avatar-${timestamp}-${randomId}.${ext}`;
            const fileName = `chat-avatars/${uniqueFilename}`;
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

        // Lấy avatar URL nếu có - use relative URL
        let avatarUrl = null;
        if (updated.avatar) {
            avatarUrl = `/api/chat/conversations/${updated.id}/avatar`;
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
                orderBy: { name: 'asc' }
            });

            // Add avatar URLs - use relative URLs
            const usersWithAvatars = allUsers.map((user) => {
                let avatarUrl = null;
                if (user.avatar) {
                    avatarUrl = `/api/users/${user.id}/avatar`;
                }
                return { ...user, avatarUrl };
            });

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
            take: 50
        });

        // Add avatar URLs - use relative URLs
        const usersWithAvatars = users.map((user) => {
            let avatarUrl = null;
            if (user.avatar) {
                avatarUrl = `/api/users/${user.id}/avatar`;
            }
            return { ...user, avatarUrl };
        });

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

        // Xóa file đính kèm trên MinIO nếu có
        if (message.attachment) {
            try {
                await deleteFile(message.attachment);
                console.log(`[Chat] Deleted MinIO file: ${message.attachment}`);
            } catch (err) {
                console.error(`[Chat] Failed to delete MinIO file: ${message.attachment}`, err);
            }
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

// Get presigned URL for video streaming (avoids redirect issues on iOS/mobile)
export const getVideoStreamUrl = async (req: Request, res: Response) => {
    try {
        const { conversationId, messageId } = req.params;

        const message = await prisma.chatMessage.findUnique({
            where: { id: Number(messageId) }
        });

        if (!message || !message.attachment) {
            return res.status(404).json({ message: 'Attachment not found' });
        }

        const { getPresignedUrl: getPresigned, getFileStats } = await import('../services/minioService.js');

        try {
            const fileStats = await getFileStats(message.attachment!);
            let contentType = fileStats.metaData?.['content-type'] || 'application/octet-stream';

            // Detect content type from extension if needed
            if (contentType === 'application/octet-stream') {
                const ext = message.attachment!.split('.').pop()?.toLowerCase();
                const mimeMap: Record<string, string> = {
                    'mp4': 'video/mp4', 'webm': 'video/webm', 'ogg': 'video/ogg',
                    'mov': 'video/mp4', 'avi': 'video/x-msvideo', 'mkv': 'video/x-matroska',
                    'm4v': 'video/x-m4v', '3gp': 'video/3gpp',
                };
                if (ext && mimeMap[ext]) contentType = mimeMap[ext];
            }
            // iPhone .mov files use H.264 - Chrome/Android can play if served as video/mp4
            if (contentType === 'video/quicktime') contentType = 'video/mp4';

            const presignedUrl = await getPresigned(message.attachment!, 3600);
            return res.json({
                url: presignedUrl,
                contentType,
                size: fileStats.size,
                filename: message.attachment!.split('/').pop() || 'video'
            });
        } catch (error) {
            console.error('[getVideoStreamUrl] Error:', error);
            return res.status(500).json({ message: 'Cannot generate stream URL' });
        }
    } catch (error) {
        console.error('[getVideoStreamUrl] Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Serve attachment file directly (for images, audio, and files)
// This route is public (no auth required) for img src, audio src to work
export const serveMessageAttachment = async (req: Request, res: Response) => {
    try {
        const { conversationId, messageId } = req.params;
        console.log('[serveMessageAttachment] Request for conversationId:', conversationId, 'messageId:', messageId);

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

        const { getFileStream, getFileStats, proxyFileViaPresignedUrl, getPartialFileStream } = await import('../services/minioService.js');

        // Try direct stream first (supports Range requests)
        try {
            console.log('[serveMessageAttachment] Getting file stats...');
            const fileStats = await getFileStats(message.attachment!);
            const fileSize = fileStats.size;
            let contentType = fileStats.metaData?.['content-type'] || 'application/octet-stream';

            // Fallback: detect content-type from filename extension if stored as octet-stream
            if (contentType === 'application/octet-stream' && message.attachment) {
                const ext = message.attachment.split('.').pop()?.toLowerCase();
                const mimeMap: Record<string, string> = {
                    'mp4': 'video/mp4', 'webm': 'video/webm', 'ogg': 'video/ogg',
                    'mov': 'video/mp4', 'avi': 'video/x-msvideo', 'mkv': 'video/x-matroska',
                    'm4v': 'video/x-m4v', '3gp': 'video/3gpp',
                    'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'flac': 'audio/flac',
                    'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
                    'gif': 'image/gif', 'webp': 'image/webp', 'svg': 'image/svg+xml',
                    'pdf': 'application/pdf',
                };
                if (ext && mimeMap[ext]) {
                    contentType = mimeMap[ext];
                }
            }
            // iPhone .mov files use H.264 - Chrome/Android can play if served as video/mp4
            if (contentType === 'video/quicktime') contentType = 'video/mp4';

            // For Video files, let the client fetch the presigned URL via the /video-url endpoint
            // and stream directly from MinIO. For direct /file requests (e.g. fallback), 
            // serve via Range requests through our proxy instead of redirecting (redirect breaks iOS Safari).
            if (contentType.startsWith('video/')) {
                console.log('[serveMessageAttachment] Video file detected, serving via proxy with Range support...');
                // Fall through to the Range request handler below instead of redirecting
            }

            // Handle Range Request (Video Streaming)
            const range = req.headers.range;
            if (range && fileSize > 0) {
                const MAX_CHUNK_SIZE = 2 * 1024 * 1024; // Optimize: 2MB chunks for fast playback start on Desktop
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0] || '0', 10);

                let end = parts[1] && parts[1].length > 0
                    ? parseInt(parts[1], 10)
                    : Math.min(start + MAX_CHUNK_SIZE - 1, fileSize - 1);

                end = Math.min(end, fileSize - 1);

                if (start >= fileSize) {
                    res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
                    return res.end();
                }

                const chunksize = (end - start) + 1;
                console.log(`[serveMessageAttachment] Serving range ${start}-${end}/${fileSize} (chunk: ${(chunksize / 1024 / 1024).toFixed(2)}MB)`);

                try {
                    const fileStream = await getPartialFileStream(message.attachment!, start, end);

                    res.writeHead(206, {
                        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                        'Accept-Ranges': 'bytes',
                        'Content-Length': chunksize,
                        'Content-Type': contentType,
                        'Access-Control-Allow-Origin': '*',
                        'Cross-Origin-Resource-Policy': 'cross-origin',
                        'Cache-Control': 'public, max-age=31536000'
                    });

                    fileStream.pipe(res).on('error', (err) => {
                        console.error('[serveMessageAttachment] Stream pipe error:', err);
                    });
                } catch (streamError) {
                    console.error('[serveMessageAttachment] Error getting partial stream:', streamError);
                    if (!res.headersSent) res.status(500).end();
                }
                return;
            }

            // Normal Request (Full content)
            console.log('[serveMessageAttachment] Serving full file direct stream...');
            const fileStream = await getFileStream(message.attachment!);

            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Length', fileSize);
            res.setHeader('Accept-Ranges', 'bytes'); // Advertise range support
            res.setHeader('Cache-Control', 'public, max-age=31536000');
            res.setHeader('Access-Control-Allow-Origin', '*');

            if (contentType.startsWith('image/') || contentType.startsWith('audio/') || contentType.startsWith('video/')) {
                res.setHeader('Content-Disposition', 'inline');
            } else {
                const originalName = message.attachment!.split('/').pop() || 'file';
                // Encode filename for Content-Disposition
                const encodedName = encodeURIComponent(originalName).replace(/'/g, "%27");
                res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`);
            }

            fileStream.pipe(res);

        } catch (directError: any) {
            console.log('[serveMessageAttachment] Direct stream failed, trying presigned URL proxy...');
            console.log('[serveMessageAttachment] Direct error:', directError?.code || directError?.message);

            // Fallback to Proxy (Note: This fallback currently does not support Range requests efficiently)
            try {
                const { stream, contentType, contentLength } = await proxyFileViaPresignedUrl(message.attachment!);
                console.log('[serveMessageAttachment] Proxy success:', contentType, contentLength);

                res.setHeader('Content-Type', contentType);
                if (contentLength > 0) res.setHeader('Content-Length', contentLength);
                res.setHeader('Cache-Control', 'public, max-age=31536000');
                res.setHeader('Access-Control-Allow-Origin', '*');

                if (contentType.startsWith('image/') || contentType.startsWith('audio/') || contentType.startsWith('video/')) {
                    res.setHeader('Content-Disposition', 'inline');
                } else {
                    const originalName = message.attachment!.split('/').pop() || 'file';
                    const encodedName = encodeURIComponent(originalName).replace(/'/g, "%27");
                    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`);
                }

                stream.pipe(res);
            } catch (proxyError: any) {
                console.error('[serveMessageAttachment] Both methods failed');
                console.error('[serveMessageAttachment] Proxy error:', proxyError?.message || proxyError);
                return res.status(404).json({ message: 'File not found in storage', error: proxyError?.message });
            }
        }
    } catch (error: any) {
        console.error('[serveMessageAttachment] Error:', error?.message || error);
        res.status(500).json({ message: 'Failed to serve attachment' });
    }
};

// Serve conversation avatar directly (for group chats)
export const serveConversationAvatar = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        console.log('[serveConversationAvatar] Request for conversation:', id);

        const conversation = await prisma.conversation.findUnique({
            where: { id: Number(id) }
        });

        if (!conversation || !conversation.avatar) {
            console.log('[serveConversationAvatar] Avatar not found for conversation:', id);
            return res.status(404).json({ message: 'Avatar not found' });
        }

        console.log('[serveConversationAvatar] Avatar path:', conversation.avatar);

        const { getFileStream, getFileStats, proxyFileViaPresignedUrl } = await import('../services/minioService.js');

        // Try direct stream first, then fallback to presigned URL proxy
        try {
            console.log('[serveConversationAvatar] Trying direct stream...');
            const fileStream = await getFileStream(conversation.avatar);
            const fileStats = await getFileStats(conversation.avatar);

            const contentType = fileStats.metaData?.['content-type'] || 'image/jpeg';
            console.log('[serveConversationAvatar] Direct stream success:', contentType, fileStats.size);

            res.setHeader('Content-Type', contentType);
            if (fileStats.size) {
                res.setHeader('Content-Length', fileStats.size);
            }
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.setHeader('Content-Disposition', 'inline');
            res.setHeader('Access-Control-Allow-Origin', '*');

            fileStream.pipe(res);
        } catch (directError: any) {
            console.log('[serveConversationAvatar] Direct stream failed, trying presigned URL proxy...');
            console.log('[serveConversationAvatar] Direct error:', directError?.code || directError?.message);

            try {
                const { stream, contentType, contentLength } = await proxyFileViaPresignedUrl(conversation.avatar);
                console.log('[serveConversationAvatar] Proxy success:', contentType, contentLength);

                res.setHeader('Content-Type', contentType);
                if (contentLength > 0) {
                    res.setHeader('Content-Length', contentLength);
                }
                res.setHeader('Cache-Control', 'public, max-age=86400');
                res.setHeader('Content-Disposition', 'inline');
                res.setHeader('Access-Control-Allow-Origin', '*');

                stream.pipe(res);
            } catch (proxyError: any) {
                console.error('[serveConversationAvatar] Both methods failed');
                console.error('[serveConversationAvatar] Proxy error:', proxyError?.message || proxyError);
                return res.status(404).json({ message: 'Avatar file not found in storage' });
            }
        }
    } catch (error: any) {
        console.error('[serveConversationAvatar] Error:', error?.message || error);
        res.status(500).json({ message: 'Failed to serve avatar' });
    }
};

// Chuyển tiếp tin nhắn sang cuộc trò chuyện khác
export const forwardMessage = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { messageId } = req.params;
        const { targetConversationIds } = req.body;

        if (!targetConversationIds || !Array.isArray(targetConversationIds) || targetConversationIds.length === 0) {
            return res.status(400).json({ message: 'Target conversation IDs are required' });
        }

        // Lấy tin nhắn gốc
        const originalMessage = await prisma.chatMessage.findUnique({
            where: { id: Number(messageId) },
            include: {
                sender: { select: { id: true, name: true, avatar: true } },
                conversation: { include: { members: true } }
            }
        });

        if (!originalMessage) {
            return res.status(404).json({ message: 'Message not found' });
        }

        // Kiểm tra user là member của conversation gốc
        const isMember = originalMessage.conversation.members.some(m => m.userId === userId);
        if (!isMember) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const io = getIO();
        const forwardedMessages = [];

        for (const targetConvId of targetConversationIds) {
            // Kiểm tra user là member của conversation đích
            const targetMember = await prisma.conversationMember.findUnique({
                where: {
                    conversationId_userId: {
                        conversationId: Number(targetConvId),
                        userId
                    }
                }
            });

            if (!targetMember) continue;

            // Tạo tin nhắn mới trong conversation đích
            const newMessage = await prisma.chatMessage.create({
                data: {
                    content: originalMessage.content,
                    messageType: originalMessage.messageType as any,
                    attachment: originalMessage.attachment,
                    isForwarded: true,
                    conversationId: Number(targetConvId),
                    senderId: userId
                },
                include: {
                    sender: { select: { id: true, name: true, avatar: true } }
                }
            });

            // Add URLs
            let senderAvatarUrl = null;
            if (newMessage.sender?.avatar) {
                senderAvatarUrl = `/api/users/${newMessage.sender.id}/avatar`;
            }
            let attachmentUrl = null;
            if (newMessage.attachment) {
                attachmentUrl = `/api/chat/conversations/${targetConvId}/messages/${newMessage.id}/file`;
            }

            const messageWithUrls = {
                ...newMessage,
                attachmentUrl,
                sender: { ...newMessage.sender, avatar: senderAvatarUrl }
            };

            // Update conversation timestamp
            await prisma.conversation.update({
                where: { id: Number(targetConvId) },
                data: { updatedAt: new Date() }
            });

            // Emit to each member's personal room (except sender) to avoid double messages
            const targetConv = await prisma.conversation.findUnique({
                where: { id: Number(targetConvId) },
                select: { members: { select: { userId: true } } }
            });
            if (targetConv) {
                targetConv.members.forEach(member => {
                    if (member.userId !== userId) {
                        io.to(`user:${member.userId}`).emit('chat:new_message', {
                            conversationId: Number(targetConvId),
                            message: messageWithUrls
                        });
                    }
                });
            }

            forwardedMessages.push(messageWithUrls);
        }

        res.status(201).json({ forwarded: forwardedMessages.length, messages: forwardedMessages });
    } catch (error) {
        console.error('Error forwarding message:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Tìm kiếm tin nhắn trong cuộc trò chuyện
export const searchMessagesInConversation = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        const { q } = req.query;

        if (!q) {
            return res.json([]);
        }

        const query = String(q).toLowerCase();

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

        // Fetch messages - we have to fetch all/many and filter in memory due to encryption
        // Limit to last 1000 messages for verification to avoid OOM
        const messages = await prisma.chatMessage.findMany({
            where: {
                conversationId: Number(id),
                messageType: 'TEXT' // Only search text messages
            },
            include: {
                sender: {
                    select: { id: true, name: true, avatar: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 1000
        });

        // Filter in memory
        const matches = messages
            .map(msg => ({ ...msg, decryptedContent: msg.content ? decryptMessage(msg.content) : '' }))
            .filter(msg => msg.decryptedContent?.toLowerCase().includes(query))
            .slice(0, 20); // Limit results

        // Format avatar URLs and cleanup
        const messagesWithMap = matches.map(msg => {
            // Add avatar URL for sender - use relative URL
            let senderAvatarUrl = null;
            if (msg.sender?.avatar) {
                senderAvatarUrl = `/api/users/${msg.sender.id}/avatar`;
            }
            return {
                id: msg.id,
                content: msg.content, // Return original encrypted content for frontend to handle consistent rendering
                messageType: msg.messageType,
                attachment: msg.attachment,
                createdAt: msg.createdAt,
                senderId: msg.senderId,
                sender: {
                    ...msg.sender,
                    avatar: senderAvatarUrl
                }
            };
        });

        res.json(messagesWithMap);
    } catch (error) {
        console.error('Error searching messages:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Lấy danh sách file/ảnh trong cuộc trò chuyện cho Chat Info
export const getConversationMedia = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        const { type } = req.query; // 'media' (images) or 'files' (docs)

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

        let whereCondition: any = {
            conversationId: Number(id),
            attachment: { not: null }, // Only messages with attachments
            messageType: { in: ['IMAGE', 'FILE', 'TEXT_WITH_FILE', 'VOICE'] }
        };

        if (type === 'media') {
            whereCondition.messageType = 'IMAGE';
        } else if (type === 'files') {
            whereCondition.messageType = { in: ['FILE', 'TEXT_WITH_FILE', 'VOICE'] };
        }

        const messages = await prisma.chatMessage.findMany({
            where: whereCondition,
            include: {
                sender: {
                    select: { id: true, name: true, avatar: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 100 // Increased limit
        });

        // Add attachment URLs and avatar URLs
        const messagesWithUrls = messages.map((msg: any) => {
            let attachmentUrl = null;
            if (msg.attachment) {
                attachmentUrl = `/api/chat/conversations/${id}/messages/${msg.id}/file`;
            }

            // Add avatar URL for sender
            let senderAvatarUrl = null;
            if (msg.sender?.avatar) {
                senderAvatarUrl = `/api/users/${msg.sender.id}/avatar`;
            }

            return {
                ...msg,
                attachmentUrl,
                sender: {
                    ...msg.sender,
                    avatar: senderAvatarUrl
                }
            };
        });

        res.json(messagesWithUrls);
    } catch (error) {
        console.error('Error fetching conversation media:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
