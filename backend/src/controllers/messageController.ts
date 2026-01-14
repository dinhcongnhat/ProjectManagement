import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { uploadFile, uploadAudioFile, uploadDiscussionFile, getPresignedUrl, deleteFile } from '../services/minioService.js';
import { Readable } from 'stream';
import { getIO } from '../index.js';
import { notifyProjectDiscussion, notifyMention } from '../services/pushNotificationService.js';

const prisma = new PrismaClient();

// Helper function to decode filename from various encodings
const decodeFilename = (filename: string): string => {
    // Check if the filename appears to be incorrectly decoded from UTF-8 as latin1
    // This happens when browsers send UTF-8 but multer interprets as latin1
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

// Configure multer for memory storage
const storage = multer.memoryStorage();
export const upload = multer({
    storage,
    limits: {
        fileSize: 1024 * 1024 * 1024, // 1024MB (1GB) max file size for video
    }
});

// Get all messages for a project
export const getMessages = async (req: Request, res: Response): Promise<void> => {
    try {
        const projectId = req.params.projectId;
        if (!projectId) {
            res.status(400).json({ error: 'Project ID is required' });
            return;
        }
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = (page - 1) * limit;

        const messages = await prisma.message.findMany({
            where: { projectId: parseInt(projectId) },
            include: {
                sender: {
                    select: { id: true, name: true, role: true }
                }
            },
            orderBy: { createdAt: 'asc' },
            skip,
            take: limit
        });

        // Generate relative URLs for attachments (frontend will resolve to absolute)
        const messagesWithUrls = messages.map((message) => {
            if (message.attachment) {
                // Use relative URL - frontend will prepend the correct base URL
                const attachmentUrl = `/api/messages/${message.id}/file`;
                return { ...message, attachmentUrl };
            }
            return { ...message, attachmentUrl: null };
        });

        const total = await prisma.message.count({
            where: { projectId: parseInt(projectId) }
        });

        res.json({
            messages: messagesWithUrls,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
};

// Create a text message
export const createMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const projectId = req.params.projectId;
        if (!projectId) {
            res.status(400).json({ error: 'Project ID is required' });
            return;
        }
        const { content } = req.body;
        const userId = (req as any).user.id;

        const message = await prisma.message.create({
            data: {
                content,
                messageType: 'TEXT',
                projectId: parseInt(projectId),
                senderId: userId
            },
            include: {
                sender: {
                    select: { id: true, name: true, role: true }
                }
            }
        });

        // Emit WebSocket event for realtime discussion
        try {
            const io = getIO();
            io.to(`project:${projectId}`).emit('discussion:new_message', {
                projectId: parseInt(projectId),
                message: { ...message, attachmentUrl: null }
            });
        } catch (wsError) {
            console.error('WebSocket emit error:', wsError);
        }

        // Send push notifications to project members
        try {
            const project = await prisma.project.findUnique({
                where: { id: parseInt(projectId) },
                select: {
                    name: true,
                    managerId: true,
                    implementers: { select: { id: true } },
                    followers: { select: { id: true } }
                }
            });

            if (project) {
                const recipientIds = [
                    project.managerId,
                    ...project.implementers.map(i => i.id),
                    ...project.followers.map(f => f.id)
                ];
                const uniqueRecipientIds = [...new Set(recipientIds)];
                const messagePreview = content.length > 50
                    ? content.substring(0, 50) + '...'
                    : content;

                await notifyProjectDiscussion(
                    uniqueRecipientIds,
                    userId,
                    message.sender.name,
                    parseInt(projectId),
                    project.name,
                    messagePreview
                );

                // Check for mentions
                const mentionPattern = /@(\S+)/g;
                let match;
                while ((match = mentionPattern.exec(content)) !== null) {
                    const mentionedName = match[1];
                    if (mentionedName) {
                        const mentionedUser = await prisma.user.findFirst({
                            where: { name: { contains: mentionedName, mode: 'insensitive' } }
                        });
                        if (mentionedUser && mentionedUser.id !== userId) {
                            await notifyMention(
                                mentionedUser.id,
                                message.sender.name,
                                'discussion',
                                parseInt(projectId),
                                project.name,
                                messagePreview
                            );
                        }
                    }
                }
            }
        } catch (pushError) {
            console.error('[createMessage] Push notification error:', pushError);
        }

        res.status(201).json(message);
    } catch (error) {
        console.error('Error creating message:', error);
        res.status(500).json({ error: 'Failed to create message' });
    }
};

// Upload voice message
export const uploadVoiceMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;
        if (!projectId) {
            res.status(400).json({ error: 'Project ID is required' });
            return;
        }
        const userId = (req as any).user.id;
        const file = req.file;

        if (!file) {
            res.status(400).json({ error: 'No audio file provided' });
            return;
        }

        // Generate filename with audio-specific prefix
        const timestamp = Date.now();
        const extension = file.mimetype.split('/')[1];
        const fileName = `audio/recording-${timestamp}.${extension}`;

        // Upload to MinIO audio bucket
        const audioPath = await uploadAudioFile(fileName, file.buffer, {
            'Content-Type': file.mimetype
        });

        // Create message record
        const message = await prisma.message.create({
            data: {
                messageType: 'VOICE',
                attachment: audioPath,
                projectId: parseInt(projectId),
                senderId: userId
            },
            include: {
                sender: {
                    select: { id: true, name: true, role: true }
                }
            }
        });

        // Use relative URL - frontend will prepend the correct base URL
        const attachmentUrl = `/api/messages/${message.id}/file`;

        // Emit WebSocket event for realtime discussion
        try {
            const io = getIO();
            io.to(`project:${projectId}`).emit('discussion:new_message', {
                projectId: parseInt(projectId),
                message: { ...message, attachmentUrl }
            });
        } catch (wsError) {
            console.error('WebSocket emit error:', wsError);
        }

        // Send push notification
        try {
            // Fetch project members and sender info for notification
            const [project, sender] = await Promise.all([
                prisma.project.findUnique({
                    where: { id: parseInt(projectId) },
                    include: {
                        manager: { select: { id: true } },
                        implementers: { select: { id: true } },
                        cooperators: { select: { id: true } },
                        followers: { select: { id: true } }
                    }
                }),
                prisma.user.findUnique({
                    where: { id: userId },
                    select: { name: true }
                })
            ]);

            if (project && sender) {
                const recipientIds = new Set<number>();
                if (project.managerId) recipientIds.add(project.managerId);
                project.implementers.forEach(u => recipientIds.add(u.id));
                project.cooperators.forEach(u => recipientIds.add(u.id));
                project.followers.forEach(u => recipientIds.add(u.id));
                recipientIds.delete(userId); // Exclude sender

                if (recipientIds.size > 0) {
                    await notifyProjectDiscussion(
                        Array.from(recipientIds),
                        userId,
                        sender.name,
                        parseInt(projectId),
                        project.name,
                        'đã gửi một tin nhắn thoại'
                    );
                }
            }
        } catch (pushError) {
            console.error('Push notification error:', pushError);
        }

        // Log activity for voice message
        try {
            await prisma.projectActivity.create({
                data: {
                    action: 'SEND_VOICE',
                    fieldName: 'message',
                    newValue: 'tin nhắn thoại',
                    projectId: parseInt(projectId),
                    userId: userId
                }
            });
        } catch (activityError) {
            console.error('Activity logging error:', activityError);
        }

        res.status(201).json({ ...message, attachmentUrl });
    } catch (error) {
        console.error('Error uploading voice message:', error);
        res.status(500).json({ error: 'Failed to upload voice message' });
    }
};

// Upload file message
export const uploadFileMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;
        if (!projectId) {
            res.status(400).json({ error: 'Project ID is required' });
            return;
        }
        const userId = (req as any).user.id;
        const file = req.file;
        const { content } = req.body; // Optional text with file

        if (!file) {
            res.status(400).json({ error: 'No file provided' });
            return;
        }

        // Decode Vietnamese filename using helper function
        let originalName = decodeFilename(file.originalname);
        // Normalize to NFC form for Vietnamese characters
        originalName = originalName.normalize('NFC');

        console.log('Original filename from multer:', file.originalname);
        console.log('Decoded filename:', originalName);

        // Use original filename directly without timestamp prefix
        const fileName = `${projectId}/${originalName}`;

        // Upload to MinIO discussions folder
        const filePath = await uploadDiscussionFile(fileName, file.buffer, {
            'Content-Type': file.mimetype,
            'X-Original-Name': encodeURIComponent(originalName)
        });

        // Determine message type based on file type
        const isImage = file.mimetype.startsWith('image/');
        const isVideo = file.mimetype.startsWith('video/');
        let messageType = 'FILE';
        if (content) {
            messageType = 'TEXT_WITH_FILE';
        } else if (isImage) {
            messageType = 'IMAGE';
        } else if (isVideo) {
            messageType = 'VIDEO';
        }

        // Create message record
        const message = await prisma.message.create({
            data: {
                content: content || null,
                messageType: messageType as any,
                attachment: filePath,
                projectId: parseInt(projectId),
                senderId: userId
            },
            include: {
                sender: {
                    select: { id: true, name: true, role: true }
                }
            }
        });

        // Use relative URL - frontend will prepend the correct base URL
        const attachmentUrl = `/api/messages/${message.id}/file`;

        // Emit WebSocket event for realtime discussion
        try {
            const io = getIO();
            io.to(`project:${projectId}`).emit('discussion:new_message', {
                projectId: parseInt(projectId),
                message: { ...message, attachmentUrl, originalFileName: originalName }
            });
        } catch (wsError) {
            console.error('WebSocket emit error:', wsError);
        }

        // Send push notification
        try {
            const contentTypes: Record<string, string> = {
                'IMAGE': 'hình ảnh',
                'VIDEO': 'video',
                'FILE': 'file đính kèm',
                'TEXT_WITH_FILE': 'tin nhắn có file'
            };
            const typeLabel = contentTypes[messageType] || 'tệp đính kèm';

            // Fetch project members and sender info for notification
            const [project, sender] = await Promise.all([
                prisma.project.findUnique({
                    where: { id: parseInt(projectId) },
                    include: {
                        manager: { select: { id: true } },
                        implementers: { select: { id: true } },
                        cooperators: { select: { id: true } },
                        followers: { select: { id: true } }
                    }
                }),
                prisma.user.findUnique({
                    where: { id: userId },
                    select: { name: true }
                })
            ]);

            if (project && sender) {
                const recipientIds = new Set<number>();
                if (project.managerId) recipientIds.add(project.managerId);
                project.implementers.forEach(u => recipientIds.add(u.id));
                project.cooperators.forEach(u => recipientIds.add(u.id));
                project.followers.forEach(u => recipientIds.add(u.id));
                recipientIds.delete(userId); // Exclude sender

                if (recipientIds.size > 0) {
                    await notifyProjectDiscussion(
                        Array.from(recipientIds),
                        userId,
                        sender.name,
                        parseInt(projectId),
                        project.name,
                        `đã gửi một ${typeLabel}`
                    );
                }
            }
        } catch (pushError) {
            console.error('Push notification error:', pushError);
        }

        // Log activity for file/image/video attachment
        try {
            const activityAction = messageType === 'IMAGE' ? 'SEND_IMAGE' :
                messageType === 'VIDEO' ? 'SEND_VIDEO' :
                    messageType === 'VOICE' ? 'SEND_VOICE' : 'SEND_ATTACHMENT';

            await prisma.projectActivity.create({
                data: {
                    action: activityAction,
                    fieldName: 'message',
                    newValue: originalName,
                    projectId: parseInt(projectId),
                    userId: userId
                }
            });
        } catch (activityError) {
            console.error('Activity logging error:', activityError);
        }

        res.status(201).json({ ...message, attachmentUrl, originalFileName: originalName });
    } catch (error) {
        console.error('Error uploading file message:', error);
        res.status(500).json({ error: 'Failed to upload file message' });
    }
};

// Delete a message
export const deleteMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        if (!id) {
            res.status(400).json({ error: 'Message ID is required' });
            return;
        }
        const userId = (req as any).user.id;
        const userRole = (req as any).user.role;

        // Find the message
        const message = await prisma.message.findUnique({
            where: { id: parseInt(id) }
        });

        if (!message) {
            res.status(404).json({ error: 'Message not found' });
            return;
        }

        // Check permissions: only sender or admin can delete
        if (message.senderId !== userId && userRole !== 'ADMIN') {
            res.status(403).json({ error: 'Not authorized to delete this message' });
            return;
        }

        // Delete message
        await prisma.message.delete({
            where: { id: parseInt(id) }
        });

        res.json({ message: 'Message deleted successfully' });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ error: 'Failed to delete message' });
    }
};

// Download attachment (audio or file)
export const downloadAttachment = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        if (!id) {
            res.status(400).json({ error: 'Message ID is required' });
            return;
        }

        const message = await prisma.message.findUnique({
            where: { id: parseInt(id) }
        });

        if (!message || !message.attachment) {
            res.status(404).json({ error: 'Attachment not found' });
            return;
        }

        const { getFileStream, getFileStats } = await import('../services/minioService.js');
        const fileStream = await getFileStream(message.attachment);
        const stats = await getFileStats(message.attachment);

        res.setHeader('Content-Type', stats.metaData['content-type'] || 'application/octet-stream');
        res.setHeader('Content-Length', stats.size);

        fileStream.pipe(res);
    } catch (error) {
        console.error('Error downloading attachment:', error);
        res.status(500).json({ error: 'Failed to download attachment' });
    }
};

// Serve attachment file directly (for images and direct access)
export const serveAttachment = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        if (!id) {
            res.status(400).json({ error: 'Message ID is required' });
            return;
        }

        const message = await prisma.message.findUnique({
            where: { id: parseInt(id) }
        });

        if (!message || !message.attachment) {
            res.status(404).json({ error: 'Attachment not found' });
            return;
        }

        const { getFileStream, getFileStats } = await import('../services/minioService.js');
        const fileStream = await getFileStream(message.attachment);
        const stats = await getFileStats(message.attachment);

        // Set appropriate content type
        const contentType = stats.metaData['content-type'] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', stats.size);

        // For images, allow caching
        if (contentType.startsWith('image/')) {
            res.setHeader('Cache-Control', 'public, max-age=3600');
        }

        // Allow CORS
        res.setHeader('Access-Control-Allow-Origin', '*');

        fileStream.pipe(res);
    } catch (error) {
        console.error('Error serving attachment:', error);
        res.status(500).json({ error: 'Failed to serve attachment' });
    }
};
