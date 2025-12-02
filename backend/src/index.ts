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
const io = new Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST']
    }
});

const port = process.env.PORT || 3000;

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import activityRoutes from './routes/activityRoutes.js';

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', messageRoutes);
app.use('/api', activityRoutes);

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

    // Disconnect
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.data.userId}`);
    });
});

httpServer.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log(`Socket.io server ready`);
});
