import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from './config/prisma.js';
dotenv.config();
const app = express();
const httpServer = createServer(app);
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost',
    'http://localhost:3001',
    'https://jtsc.io.vn',
    'http://jtsc.io.vn',
    'https://www.jtsc.io.vn',
    'http://www.jtsc.io.vn',
    'https://ai.jtsc.io.vn',
    'http://ai.jtsc.io.vn',
    // DuckDNS domains
    'https://jtscapi.duckdns.org',
    'http://jtscapi.duckdns.org',
    'https://jtscminio.duckdns.org',
    'http://jtscminio.duckdns.org',
    'https://jtsconlyoffice.duckdns.org',
    'http://jtsconlyoffice.duckdns.org',
    'https://jtscdb.duckdns.org',
    'http://jtscdb.duckdns.org',
    // IP addresses
    'http://117.0.207.175:3000',
    'http://117.0.207.175:3001',
    'http://117.0.207.175'
];
const io = new Server(httpServer, {
    cors: {
        origin: (origin, callback) => {
            // Allow requests with no origin (like mobile apps, curl, postman)
            if (!origin)
                return callback(null, true);
            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            }
            else {
                // Allow all origins for mobile app compatibility
                callback(null, true);
            }
        },
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    },
    // Connection settings for better mobile performance
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling']
});
const port = process.env.PORT || 3001;
const host = process.env.HOST || '0.0.0.0';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import onlyofficeRoutes from './routes/onlyofficeRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import folderRoutes from './routes/folderRoutes.js';
import projectImportExportRoutes from './routes/projectImportExportRoutes.js';
import workflowRoutes from './routes/workflowRoutes.js';
app.use(cors({
    origin: function (origin, callback) {
        // Cho phép requests không có origin (như mobile apps, Postman)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        }
        else {
            // Cho phép tất cả để hỗ trợ mobile app
            callback(null, true);
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cache-Control'],
    exposedHeaders: ['Content-Disposition'],
    credentials: true,
    maxAge: 86400, // Cache preflight request for 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204
}));
// Ensure Content-Type for POST requests without it
app.use((req, res, next) => {
    if (req.method === 'POST' && !req.headers['content-type']) {
        req.headers['content-type'] = 'application/json';
    }
    next();
});
// Body parsing middleware - must be before routes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// Ensure body is always an object for JSON requests
app.use((req, res, next) => {
    // Only for JSON content type
    if (req.headers['content-type']?.includes('application/json')) {
        if (req.body === undefined) {
            req.body = {};
        }
    }
    next();
});
// ==================== PUBLIC ROUTES (NO AUTH) ====================
// These routes MUST be defined here (before any routers with auth middleware)
// to ensure they're matched first
// Serve chat message attachments (public - for img src)
app.get('/api/chat/conversations/:conversationId/messages/:messageId/file', async (req, res) => {
    console.log('[Index] Public route for chat attachment');
    const { serveMessageAttachment } = await import('./controllers/chatController.js');
    return serveMessageAttachment(req, res);
});
// Serve conversation avatars (public - for img src)
app.get('/api/chat/conversations/:id/avatar', async (req, res) => {
    console.log('[Index] Public route for conversation avatar');
    const { serveConversationAvatar } = await import('./controllers/chatController.js');
    return serveConversationAvatar(req, res);
});
// OnlyOffice download routes (NO AUTH - OnlyOffice server needs direct access)
app.get('/api/onlyoffice/download/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log('[OnlyOffice Download] Project ID:', id);
        const project = await prisma.project.findUnique({
            where: { id: Number(id) },
        });
        if (!project || !project.attachment) {
            console.log('[OnlyOffice Download] Attachment not found');
            return res.status(404).json({ message: 'Attachment not found' });
        }
        console.log('[OnlyOffice Download] Found attachment:', project.attachment);
        const { getFileStream, getFileStats } = await import('./services/minioService.js');
        let fileStats;
        try {
            fileStats = await getFileStats(project.attachment);
            console.log('[OnlyOffice Download] File stats:', fileStats.size, 'bytes');
        }
        catch (statsError) {
            console.error('[OnlyOffice Download] Failed to get file stats:', statsError?.message);
            return res.status(404).json({ message: 'File not found in storage' });
        }
        let fileStream;
        try {
            fileStream = await getFileStream(project.attachment);
        }
        catch (streamError) {
            console.error('[OnlyOffice Download] Failed to get file stream:', streamError?.message);
            return res.status(500).json({ message: 'Cannot read file from storage' });
        }
        // Extract original filename
        let originalName = project.attachment.split('-').slice(1).join('-');
        if (project.attachment.includes('/')) {
            const pathParts = project.attachment.split('/');
            const fileName = pathParts[pathParts.length - 1] || '';
            originalName = fileName.split('-').slice(1).join('-');
        }
        try {
            originalName = decodeURIComponent(originalName);
        }
        catch {
            // If decoding fails, use as is
        }
        const encodedFilename = encodeURIComponent(originalName).replace(/'/g, "%27");
        const asciiFilename = originalName.replace(/[^\x00-\x7F]/g, '_');
        res.setHeader('Content-Disposition', `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`);
        const ext = originalName.split('.').pop()?.toLowerCase();
        const mimeTypes = {
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'ppt': 'application/vnd.ms-powerpoint',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'pdf': 'application/pdf',
        };
        res.setHeader('Content-Type', mimeTypes[ext || ''] || 'application/octet-stream');
        if (fileStats.size) {
            res.setHeader('Content-Length', fileStats.size);
        }
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        console.log('[OnlyOffice Download] Streaming file:', project.attachment);
        fileStream.pipe(res);
    }
    catch (error) {
        console.error('[OnlyOffice Download] Error:', error?.message, error?.stack);
        res.status(500).json({ message: 'Server error' });
    }
});
app.get('/api/onlyoffice/discussion/download/:messageId', async (req, res) => {
    try {
        const { messageId } = req.params;
        const message = await prisma.message.findUnique({
            where: { id: Number(messageId) },
        });
        if (!message || !message.attachment) {
            return res.status(404).json({ message: 'Attachment not found' });
        }
        const { getFileStream, getFileStats } = await import('./services/minioService.js');
        const fileStream = await getFileStream(message.attachment);
        const fileStats = await getFileStats(message.attachment);
        res.setHeader('Content-Type', fileStats.metaData?.['content-type'] || 'application/octet-stream');
        if (fileStats.size)
            res.setHeader('Content-Length', fileStats.size);
        res.setHeader('Access-Control-Allow-Origin', '*');
        fileStream.pipe(res);
    }
    catch (error) {
        console.error('[OnlyOffice Discussion Download] Error:', error?.message);
        res.status(500).json({ message: 'Server error' });
    }
});
app.get('/api/onlyoffice/chat/download/:messageId', async (req, res) => {
    try {
        const { messageId } = req.params;
        console.log('[OnlyOffice Chat Download] Looking for message ID:', messageId);
        const message = await prisma.chatMessage.findUnique({
            where: { id: Number(messageId) },
        });
        console.log('[OnlyOffice Chat Download] Message found:', message ? 'Yes' : 'No');
        if (message) {
            console.log('[OnlyOffice Chat Download] Attachment path:', message.attachment);
        }
        if (!message || !message.attachment) {
            return res.status(404).json({ message: 'Attachment not found' });
        }
        const { getFileStream, getFileStats } = await import('./services/minioService.js');
        const fileStream = await getFileStream(message.attachment);
        const fileStats = await getFileStats(message.attachment);
        res.setHeader('Content-Type', fileStats.metaData?.['content-type'] || 'application/octet-stream');
        if (fileStats.size)
            res.setHeader('Content-Length', fileStats.size);
        res.setHeader('Access-Control-Allow-Origin', '*');
        fileStream.pipe(res);
    }
    catch (error) {
        console.error('[OnlyOffice Chat Download] Error:', error?.message);
        res.status(500).json({ message: 'Server error' });
    }
});
// OnlyOffice download for user folder files (NO AUTH - OnlyOffice needs direct access)
app.get('/api/folders/files/:id/onlyoffice-download', async (req, res) => {
    try {
        const fileId = parseInt(req.params.id);
        console.log('[OnlyOffice Folder Download] File ID:', fileId);
        const file = await prisma.userFile.findUnique({
            where: { id: fileId }
        });
        if (!file) {
            console.log('[OnlyOffice Folder Download] File not found');
            return res.status(404).json({ message: 'File not found' });
        }
        console.log('[OnlyOffice Folder Download] Found file:', file.name, 'at', file.minioPath);
        const { getFileStream, getFileStats } = await import('./services/minioService.js');
        const fileStream = await getFileStream(file.minioPath);
        const fileStats = await getFileStats(file.minioPath);
        res.setHeader('Content-Type', file.fileType);
        if (fileStats.size)
            res.setHeader('Content-Length', fileStats.size);
        res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`);
        res.setHeader('Access-Control-Allow-Origin', '*');
        fileStream.pipe(res);
    }
    catch (error) {
        console.error('[OnlyOffice Folder Download] Error:', error?.message);
        res.status(500).json({ message: 'Server error' });
    }
});
// ==================== END PUBLIC ROUTES ====================
// Public route for VAPID key (NO AUTH - must be before authenticated routes)
app.get('/api/notifications/vapid-public-key', (req, res) => {
    console.log('[Index] VAPID public key requested (public route)');
    const publicKey = process.env.VAPID_PUBLIC_KEY || '';
    console.log('[Index] Returning VAPID key:', publicKey ? publicKey.substring(0, 20) + '...' : 'NOT SET');
    res.json({ publicKey });
});
// Debug middleware to check body parsing
app.use('/api/chat', (req, res, next) => {
    if (req.method === 'POST' && req.path.includes('/messages') && !req.path.includes('/file') && !req.path.includes('/voice')) {
        console.log('=== Chat Message Request Debug ===');
        console.log('Method:', req.method);
        console.log('Path:', req.path);
        console.log('Content-Type:', req.headers['content-type']);
        console.log('Content-Length:', req.headers['content-length']);
        console.log('Body:', req.body);
        console.log('Body type:', typeof req.body);
        console.log('Body keys:', req.body ? Object.keys(req.body) : 'N/A');
        console.log('=================================');
    }
    next();
});
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects-io', projectImportExportRoutes);
app.use('/api', messageRoutes);
app.use('/api', activityRoutes);
app.use('/api/onlyoffice', onlyofficeRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api', workflowRoutes);
app.get('/', (req, res) => {
    res.send('JTSC Project Management API');
});
app.get('/health', async (req, res) => {
    try {
        await prisma.$queryRaw `SELECT 1`;
        res.json({ status: 'ok' });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Database connection failed' });
    }
});
// Socket.io authentication middleware
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error'));
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
        socket.data.userId = decoded.id;
        socket.data.user = decoded;
        next();
    }
    catch (err) {
        next(new Error('Authentication error'));
    }
});
// Socket.io connection handling
io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.data.userId}`);
    // Update user online status
    try {
        await prisma.user.update({
            where: { id: socket.data.userId },
            data: { isOnline: true, lastActive: new Date() }
        });
        io.emit('user:online', { userId: socket.data.userId });
    }
    catch (err) {
        console.error('Error updating online status:', err);
    }
    // Join user's personal room for notifications
    socket.join(`user:${socket.data.userId}`);
    // Join project room
    socket.on('join_project', (projectId) => {
        socket.join(`project:${projectId}`);
        console.log(`User ${socket.data.userId} joined project ${projectId}`);
    });
    // Leave project room
    socket.on('leave_project', (projectId) => {
        socket.leave(`project:${projectId}`);
        console.log(`User ${socket.data.userId} left project ${projectId}`);
    });
    // Heartbeat ping/pong for PWA connection health check
    socket.on('ping', () => {
        socket.emit('pong');
    });
    // Send message
    socket.on('send_message', async (data) => {
        try {
            // Broadcast to all users in the project room
            io.to(`project:${data.projectId}`).emit('new_message', data.message);
        }
        catch (error) {
            console.error('Error broadcasting message:', error);
        }
    });
    // Typing indicator
    socket.on('typing', (data) => {
        socket.to(`project:${data.projectId}`).emit('user_typing', {
            userId: socket.data.userId,
            userName: data.userName
        });
    });
    // Stop typing
    socket.on('stop_typing', (data) => {
        socket.to(`project:${data.projectId}`).emit('user_stop_typing', {
            userId: socket.data.userId
        });
    });
    // ===== DISCUSSION EVENTS =====
    // Discussion typing indicator
    socket.on('discussion:typing', (data) => {
        socket.to(`project:${data.projectId}`).emit('discussion:typing', {
            projectId: data.projectId,
            userId: data.userId,
            userName: data.userName
        });
    });
    // Discussion stop typing
    socket.on('discussion:stop_typing', (data) => {
        socket.to(`project:${data.projectId}`).emit('discussion:stop_typing', {
            projectId: data.projectId,
            userId: data.userId
        });
    });
    // ===== CHAT EVENTS =====
    // Join conversation room
    socket.on('join_conversation', (conversationId) => {
        socket.join(`conversation:${conversationId}`);
        console.log(`User ${socket.data.userId} joined conversation ${conversationId}`);
    });
    // Leave conversation room
    socket.on('leave_conversation', (conversationId) => {
        socket.leave(`conversation:${conversationId}`);
        console.log(`User ${socket.data.userId} left conversation ${conversationId}`);
    });
    // Send chat message
    socket.on('send_chat_message', (data) => {
        // Broadcast to all users in the conversation room
        io.to(`conversation:${data.conversationId}`).emit('new_chat_message', {
            conversationId: data.conversationId,
            message: data.message
        });
    });
    // Chat typing indicator - Optimized for realtime
    socket.on('chat:typing', (data) => {
        socket.to(`conversation:${data.conversationId}`).emit('chat:typing', {
            conversationId: data.conversationId,
            userId: data.userId || socket.data.userId,
            userName: data.userName
        });
    });
    // Chat stop typing - Optimized for realtime
    socket.on('chat:stop_typing', (data) => {
        socket.to(`conversation:${data.conversationId}`).emit('chat:stop_typing', {
            conversationId: data.conversationId,
            userId: data.userId || socket.data.userId
        });
    });
    // Mark conversation as read
    socket.on('mark_read', async (conversationId) => {
        try {
            // Update lastRead in database
            await prisma.conversationMember.update({
                where: {
                    conversationId_userId: {
                        conversationId: Number(conversationId),
                        userId: socket.data.userId
                    }
                },
                data: { lastRead: new Date() }
            });
            // Notify other members that this user has read the messages
            socket.to(`conversation:${conversationId}`).emit('conversation_read', {
                conversationId: Number(conversationId),
                userId: socket.data.userId,
                readAt: new Date().toISOString()
            });
        }
        catch (err) {
            console.error('Error marking conversation as read:', err);
        }
    });
    // Message delivered acknowledgment
    socket.on('message_delivered', (data) => {
        socket.to(`conversation:${data.conversationId}`).emit('message_delivered', {
            messageId: data.messageId,
            conversationId: data.conversationId,
            userId: socket.data.userId
        });
    });
    // Disconnect
    socket.on('disconnect', async () => {
        console.log(`User disconnected: ${socket.data.userId}`);
        // Update user offline status
        try {
            await prisma.user.update({
                where: { id: socket.data.userId },
                data: { isOnline: false, lastActive: new Date() }
            });
        }
        catch (err) {
            console.error('Error updating offline status:', err);
        }
        // Broadcast offline status
        io.emit('user:offline', {
            userId: socket.data.userId,
            lastActive: new Date().toISOString()
        });
    });
});
httpServer.listen(Number(port), host, () => {
    console.log(`Server is running on http://${host}:${port}`);
    console.log(`Socket.io server ready`);
    console.log(`Access from LAN: http://<your-ip>:${port}`);
    // Start deadline scheduler for push notifications
    import('./services/deadlineScheduler.js').then(({ startDeadlineScheduler }) => {
        startDeadlineScheduler();
    }).catch(err => {
        console.error('[DeadlineScheduler] Failed to start:', err);
    });
});
// Export io for use in controllers
export const getIO = () => io;
//# sourceMappingURL=index.js.map