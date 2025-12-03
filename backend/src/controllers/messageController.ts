import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { uploadFile, uploadAudioFile, uploadDiscussionFile, getPresignedUrl, deleteFile } from '../services/minioService.js';
import { Readable } from 'stream';

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
        fileSize: 50 * 1024 * 1024, // 50MB max file size
    }
});

// Get all messages for a project
export const getMessages = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const skip = (page - 1) * limit;
        const BACKEND_URL = process.env.BACKEND_URL || 'http://10.10.1.24:3000';

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

        // Generate backend proxy URLs for attachments (accessible from LAN)
        const messagesWithUrls = messages.map((message) => {
            if (message.attachment) {
                // Use backend proxy URL instead of MinIO presigned URL
                const attachmentUrl = `${BACKEND_URL}/api/messages/${message.id}/file`;
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
        const { projectId } = req.params;
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
        const userId = (req as any).user.id;
        const file = req.file;

        if (!file) {
            res.status(400).json({ error: 'No audio file provided' });
            return;
        }

        // Generate unique filename
        const timestamp = Date.now();
        const fileName = `voice-${userId}-${timestamp}.${file.mimetype.split('/')[1]}`;

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

        res.status(201).json(message);
    } catch (error) {
        console.error('Error uploading voice message:', error);
        res.status(500).json({ error: 'Failed to upload voice message' });
    }
};

// Upload file message
export const uploadFileMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { projectId } = req.params;
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
        
        // Generate unique filename - keep original name, MinIO handles UTF-8
        const timestamp = Date.now();
        const fileName = `${projectId}-${userId}-${timestamp}-${originalName}`;

        // Upload to MinIO discussions folder
        const filePath = await uploadDiscussionFile(fileName, file.buffer, {
            'Content-Type': file.mimetype,
            'X-Original-Name': encodeURIComponent(originalName)
        });

        // Determine message type based on file type
        const isImage = file.mimetype.startsWith('image/');
        const messageType = content ? 'TEXT_WITH_FILE' : (isImage ? 'IMAGE' : 'FILE');
        const BACKEND_URL = process.env.BACKEND_URL || 'http://10.10.1.24:3000';

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

        // Use backend proxy URL instead of MinIO presigned URL
        const attachmentUrl = `${BACKEND_URL}/api/messages/${message.id}/file`;

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
