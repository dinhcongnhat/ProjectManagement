import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from './config/prisma.js';

dotenv.config();

const app = express();
// Force restart timestamp: 2026-01-07T15:55:00+07:00
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
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
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

export const getIO = () => io;

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
import googleDriveRoutes from './routes/googleDriveRoutes.js';

app.use(cors({
    origin: function (origin, callback) {
        // Cho phép requests không có origin (như mobile apps, Postman)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
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
        } catch (statsError: any) {
            console.error('[OnlyOffice Download] Failed to get file stats:', statsError?.message);
            return res.status(404).json({ message: 'File not found in storage' });
        }

        let fileStream;
        try {
            fileStream = await getFileStream(project.attachment);
        } catch (streamError: any) {
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
        } catch {
            // If decoding fails, use as is
        }

        const encodedFilename = encodeURIComponent(originalName).replace(/'/g, "%27");
        const asciiFilename = originalName.replace(/[^\x00-\x7F]/g, '_');

        res.setHeader('Content-Disposition', `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`);

        const ext = originalName.split('.').pop()?.toLowerCase();
        const mimeTypes: Record<string, string> = {
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
    } catch (error: any) {
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
        if (fileStats.size) res.setHeader('Content-Length', fileStats.size);
        res.setHeader('Access-Control-Allow-Origin', '*');

        fileStream.pipe(res);
    } catch (error: any) {
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
        if (fileStats.size) res.setHeader('Content-Length', fileStats.size);
        res.setHeader('Access-Control-Allow-Origin', '*');

        fileStream.pipe(res);
    } catch (error: any) {
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
        if (fileStats.size) res.setHeader('Content-Length', fileStats.size);
        res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`);
        res.setHeader('Access-Control-Allow-Origin', '*');

        fileStream.pipe(res);
    } catch (error: any) {
        console.error('[OnlyOffice Folder Download] Error:', error?.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// OnlyOffice download for Google Drive temp files (NO AUTH - OnlyOffice needs direct access)
app.get('/api/onlyoffice/drive/download/:fileId', async (req, res) => {
    try {
        const fileId = req.params.fileId;
        console.log('[OnlyOffice Drive Download] File ID:', fileId);

        const { getFileStream, getFileStats } = await import('./services/minioService.js');

        // Look for any file in the temp/drive/fileId folder
        const { minioClient, bucketName } = await import('./config/minio.js');
        const prefix = `temp/drive/${fileId}/`;

        let objectName = '';
        const stream = minioClient.listObjects(bucketName, prefix, false);

        await new Promise<void>((resolve, reject) => {
            stream.on('data', (obj: any) => {
                if (obj.name) objectName = obj.name;
            });
            stream.on('error', reject);
            stream.on('end', resolve);
        });

        if (!objectName) {
            console.log('[OnlyOffice Drive Download] File not found');
            return res.status(404).json({ message: 'File not found' });
        }

        console.log('[OnlyOffice Drive Download] Found:', objectName);

        const fileStream = await getFileStream(objectName);
        const fileStats = await getFileStats(objectName);

        res.setHeader('Content-Type', fileStats.metaData?.['content-type'] || 'application/octet-stream');
        if (fileStats.size) res.setHeader('Content-Length', fileStats.size);
        res.setHeader('Access-Control-Allow-Origin', '*');

        fileStream.pipe(res);
    } catch (error: any) {
        console.error('[OnlyOffice Drive Download] Error:', error?.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== ONLYOFFICE PUBLIC CALLBACKS ====================
// These MUST be public (no auth) as OnlyOffice Document Server calls them directly

// Test endpoint to verify OnlyOffice callback URL is reachable
app.get('/api/onlyoffice/callback-test', (req, res) => {
    console.log('\n[OnlyOffice] Callback Test - GET request received');
    console.log('[OnlyOffice] Callback Test - Headers:', JSON.stringify(req.headers, null, 2));
    res.json({
        success: true,
        message: 'OnlyOffice callback endpoint is reachable',
        timestamp: new Date().toISOString(),
        method: 'GET'
    });
});

app.post('/api/onlyoffice/callback-test', (req, res) => {
    console.log('\n[OnlyOffice] Callback Test - POST request received');
    console.log('[OnlyOffice] Callback Test - Headers:', JSON.stringify(req.headers, null, 2));
    console.log('[OnlyOffice] Callback Test - Body:', JSON.stringify(req.body, null, 2));
    res.json({
        success: true,
        message: 'OnlyOffice callback POST endpoint is reachable',
        timestamp: new Date().toISOString(),
        method: 'POST',
        receivedBody: req.body
    });
});

// Project callback (NO AUTH - OnlyOffice server calls this)
app.post('/api/onlyoffice/callback/:id', async (req, res) => {
    // Set CORS headers immediately
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    const { id } = req.params;
    const { status, url, key, users, actions, forcesavetype } = req.body;

    console.log('\n========== ONLYOFFICE PROJECT CALLBACK (PUBLIC) ==========');
    console.log('[Public Callback] Project ID:', id);
    console.log('[Public Callback] Status:', status, '(1=editing, 2=ready to save, 4=closed no changes, 6=forcesave)');
    console.log('[Public Callback] URL:', url);
    console.log('[Public Callback] Key:', key);
    console.log('[Public Callback] Users:', users);
    console.log('[Public Callback] Actions:', actions);
    console.log('[Public Callback] Force Save Type:', forcesavetype);
    console.log('[Public Callback] Timestamp:', new Date().toISOString());
    console.log('============================================================\n');

    try {
        // Status 2 or 6 means document needs to be saved
        if (status === 2 || status === 6) {
            console.log('[Public Callback] Processing save request...');

            const project = await prisma.project.findUnique({
                where: { id: Number(id) },
            });

            if (!project || !project.attachment) {
                console.error('[Public Callback] Project or attachment not found');
                return res.json({ error: 0 });
            }

            console.log('[Public Callback] Found project attachment:', project.attachment);

            if (!url) {
                console.error('[Public Callback] No download URL provided');
                return res.json({ error: 0 }); // Return 0 to acknowledge
            }

            // Download the edited file from OnlyOffice
            console.log('[Public Callback] Downloading edited file from:', url);
            const response = await fetch(url);
            if (!response.ok) {
                console.error('[Public Callback] Failed to download from OnlyOffice:', response.status, response.statusText);
                return res.json({ error: 1 });
            }

            const buffer = Buffer.from(await response.arrayBuffer());
            console.log('[Public Callback] Downloaded file size:', buffer.length, 'bytes');

            const { minioClient, bucketName } = await import('./config/minio.js');

            // Upload the updated file back to MinIO
            await minioClient.putObject(bucketName, project.attachment, buffer);
            console.log('[Public Callback] File saved to MinIO:', project.attachment);

            // Update project timestamp
            await prisma.project.update({
                where: { id: project.id },
                data: { updatedAt: new Date() }
            });

            console.log('[Public Callback] SUCCESS - File saved!');
        } else {
            console.log('[Public Callback] Status', status, '- No save needed');
        }

        res.json({ error: 0 });
    } catch (error: any) {
        console.error('[Public Callback] ERROR:', error?.message, error?.stack);
        res.json({ error: 0 }); // Return 0 to prevent OnlyOffice retry loops
    }
});

// General save endpoint (for Google Drive files)
app.post('/api/onlyoffice/save', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    console.log('\n========== ONLYOFFICE SAVE CALLBACK ==========');
    console.log('[Save] Query:', req.query);
    console.log('[Save] Body:', JSON.stringify(req.body, null, 2));
    console.log('===============================================\n');

    const { handleGeneralSave } = await import('./controllers/onlyofficeController.js');
    return handleGeneralSave(req, res);
});

// Folder file callback (NO AUTH - OnlyOffice server calls this)
app.post('/api/onlyoffice/folder-callback/:id', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    const { id } = req.params;
    const { status, url, key, users, actions } = req.body;

    console.log('\n========== ONLYOFFICE FOLDER CALLBACK (PUBLIC) ==========');
    console.log('[Folder Callback] File ID:', id);
    console.log('[Folder Callback] Status:', status);
    console.log('[Folder Callback] URL:', url);
    console.log('[Folder Callback] Key:', key);
    console.log('==========================================================\n');

    try {
        // Status 2 or 6 means document needs to be saved
        if (status === 2 || status === 6) {
            const fileId = parseInt(id);

            const file = await prisma.userFile.findUnique({
                where: { id: fileId }
            });

            if (!file) {
                console.log('[Folder Callback] File not found:', fileId);
                return res.json({ error: 0 });
            }

            if (!url) {
                console.log('[Folder Callback] No download URL provided');
                return res.json({ error: 0 });
            }

            // Download the edited file from OnlyOffice
            const response = await fetch(url);
            if (!response.ok) {
                console.error('[Folder Callback] Failed to download:', response.status);
                return res.json({ error: 1 });
            }

            const buffer = Buffer.from(await response.arrayBuffer());
            const { minioClient, bucketName } = await import('./config/minio.js');

            await minioClient.putObject(bucketName, file.minioPath, buffer);

            await prisma.userFile.update({
                where: { id: fileId },
                data: { fileSize: buffer.length, updatedAt: new Date() }
            });

            console.log('[Folder Callback] File saved successfully:', file.minioPath);
        }

        res.json({ error: 0 });
    } catch (error: any) {
        console.error('[Folder Callback] Error:', error?.message);
        res.json({ error: 0 });
    }
});

// OPTIONS handler for CORS preflight
app.options('/api/onlyoffice/callback/:id', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).send();
});

app.options('/api/onlyoffice/save', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).send();
});

// JWT Debug Endpoint (NO AUTH) - For debugging OnlyOffice JWT issues
app.get('/api/onlyoffice/jwt-debug', (req, res) => {
    const ONLYOFFICE_JWT_SECRET = process.env.ONLYOFFICE_JWT_SECRET || '10122002';

    console.log('[JWT Debug] Endpoint called');
    console.log('[JWT Debug] Secret from env:', process.env.ONLYOFFICE_JWT_SECRET);
    console.log('[JWT Debug] Using secret:', ONLYOFFICE_JWT_SECRET);

    // Create a test payload similar to OnlyOffice config
    const testPayload = {
        document: {
            fileType: 'docx',
            key: 'test_key_' + Date.now(),
            title: 'test.docx',
            url: 'https://example.com/test.docx',
        },
        editorConfig: {
            mode: 'view',
            lang: 'en',
            user: { id: '1', name: 'Test User' },
        },
    };

    const token = jwt.sign(testPayload, ONLYOFFICE_JWT_SECRET, { algorithm: 'HS256' });

    res.json({
        status: 'ok',
        secretLoaded: !!process.env.ONLYOFFICE_JWT_SECRET,
        secretPreview: ONLYOFFICE_JWT_SECRET.substring(0, 3) + '***' + ONLYOFFICE_JWT_SECRET.slice(-2),
        secretLength: ONLYOFFICE_JWT_SECRET.length,
        testToken: token,
        tokenPreview: token.substring(0, 50) + '...',
        decodedPayload: jwt.decode(token),
        timestamp: new Date().toISOString()
    });
});
// ==================== END PUBLIC ROUTES ====================

// Public route for VAPID key (NO AUTH - must be before authenticated routes)
app.get('/api/notifications/vapid-public-key', (req, res) => {
    console.log('[Index] VAPID public key requested (public route)');
    const publicKey = process.env.VAPID_PUBLIC_KEY || '';
    console.log('[Index] Returning VAPID key:', publicKey ? publicKey.substring(0, 20) + '...' : 'NOT SET');
    res.json({ publicKey });
});

// Debug middleware to check body parsing - DISABLED to reduce terminal spam
// app.use('/api/chat', (req, res, next) => {
//     if (req.method === 'POST' && req.path.includes('/messages') && !req.path.includes('/file') && !req.path.includes('/voice')) {
//         console.log('=== Chat Message Request Debug ===');
//         console.log('Method:', req.method);
//         console.log('Path:', req.path);
//         console.log('Content-Type:', req.headers['content-type']);
//         console.log('Content-Length:', req.headers['content-length']);
//         console.log('Body:', req.body);
//         console.log('Body type:', typeof req.body);
//         console.log('Body keys:', req.body ? Object.keys(req.body) : 'N/A');
//         console.log('=================================');
//     }
//     next();
// });

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
app.use('/api/drive', googleDriveRoutes);

app.get('/', (req, res) => {
    res.send('JTSC Project Management API');
});

app.get('/health', async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'ok' });
    } catch (err) {
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
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
        socket.data.userId = decoded.id;
        socket.data.user = decoded;
        next();
    } catch (err) {
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
    } catch (err) {
        console.error('Error updating online status:', err);
    }

    // Join user's personal room for notifications
    socket.join(`user:${socket.data.userId}`);

    // Join project room
    socket.on('join_project', (projectId: string) => {
        socket.join(`project:${projectId}`);
        console.log(`User ${socket.data.userId} joined project ${projectId}`);
    });

    // Leave project room
    socket.on('leave_project', (projectId: string) => {
        socket.leave(`project:${projectId}`);
        console.log(`User ${socket.data.userId} left project ${projectId}`);
    });

    // Heartbeat ping/pong for PWA connection health check
    socket.on('ping', () => {
        socket.emit('pong');
    });

    // Send message
    socket.on('send_message', async (data: { projectId: number; message: any }) => {
        try {
            // Broadcast to all users in the project room
            io.to(`project:${data.projectId}`).emit('new_message', data.message);
        } catch (error) {
            console.error('Error broadcasting message:', error);
        }
    });

    // Typing indicator
    socket.on('typing', (data: { projectId: number; userName: string }) => {
        socket.to(`project:${data.projectId}`).emit('user_typing', {
            userId: socket.data.userId,
            userName: data.userName
        });
    });

    // Stop typing
    socket.on('stop_typing', (data: { projectId: number }) => {
        socket.to(`project:${data.projectId}`).emit('user_stop_typing', {
            userId: socket.data.userId
        });
    });

    // ===== DISCUSSION EVENTS =====

    // Discussion typing indicator
    socket.on('discussion:typing', (data: { projectId: number; userId: number; userName: string }) => {
        socket.to(`project:${data.projectId}`).emit('discussion:typing', {
            projectId: data.projectId,
            userId: data.userId,
            userName: data.userName
        });
    });

    // Discussion stop typing
    socket.on('discussion:stop_typing', (data: { projectId: number; userId: number }) => {
        socket.to(`project:${data.projectId}`).emit('discussion:stop_typing', {
            projectId: data.projectId,
            userId: data.userId
        });
    });

    // ===== CHAT EVENTS =====

    // Join conversation room
    socket.on('join_conversation', (conversationId: string) => {
        socket.join(`conversation:${conversationId}`);
        console.log(`User ${socket.data.userId} joined conversation ${conversationId}`);
    });

    // Leave conversation room
    socket.on('leave_conversation', (conversationId: string) => {
        socket.leave(`conversation:${conversationId}`);
        console.log(`User ${socket.data.userId} left conversation ${conversationId}`);
    });

    // Send chat message
    socket.on('send_chat_message', (data: { conversationId: number; message: any }) => {
        // Broadcast to all users in the conversation room
        io.to(`conversation:${data.conversationId}`).emit('new_chat_message', {
            conversationId: data.conversationId,
            message: data.message
        });
    });

    // Chat typing indicator - Optimized for realtime
    socket.on('chat:typing', (data: { conversationId: number; userName: string; userId?: number }) => {
        socket.to(`conversation:${data.conversationId}`).emit('chat:typing', {
            conversationId: data.conversationId,
            userId: data.userId || socket.data.userId,
            userName: data.userName
        });
    });

    // Chat stop typing - Optimized for realtime
    socket.on('chat:stop_typing', (data: { conversationId: number; userId?: number }) => {
        socket.to(`conversation:${data.conversationId}`).emit('chat:stop_typing', {
            conversationId: data.conversationId,
            userId: data.userId || socket.data.userId
        });
    });

    // Mark conversation as read
    socket.on('mark_read', async (conversationId: string) => {
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
        } catch (err) {
            console.error('Error marking conversation as read:', err);
        }
    });

    // Message delivered acknowledgment
    socket.on('message_delivered', (data: { messageId: number; conversationId: number }) => {
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
        } catch (err) {
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

// Keep alive / Pulse check for terminal health
setInterval(() => {
    // This simple log helps confirm the process is not paused (e.g. by QuickEdit mode in Windows Terminal)
    const memUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    // We only log if NOT in production to avoid log spam, BUT user specifically asked for "activity"
    // So we'll log extremely minimally:
    if (process.env.NODE_ENV !== 'production') {
        // console.log(`[Pulse] Server active. Heap: ${memUsage.toFixed(2)} MB`);
    }
}, 60000);


