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
    'http://localhost:5173',
    'https://jtsc.io.vn',
    'http://jtsc.io.vn',
    'https://www.jtsc.io.vn',
    'http://www.jtsc.io.vn',
    'https://ai.jtsc.io.vn',
    'http://ai.jtsc.io.vn'
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

app.use(cors({
    origin: function(origin, callback) {
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
app.use('/api', messageRoutes);
app.use('/api', activityRoutes);
app.use('/api/onlyoffice', onlyofficeRoutes);
app.use('/api/chat', chatRoutes);

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
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.data.userId}`);
    
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
    socket.on('mark_read', (conversationId: string) => {
        // Notify other members that this user has read the messages
        socket.to(`conversation:${conversationId}`).emit('conversation_read', {
            conversationId,
            userId: socket.data.userId
        });
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.data.userId}`);
    });
});

httpServer.listen(Number(port), host, () => {
    console.log(`Server is running on http://${host}:${port}`);
    console.log(`Socket.io server ready`);
    console.log(`Access from LAN: http://<your-ip>:${port}`);
});

// Export io for use in controllers
export const getIO = () => io;
