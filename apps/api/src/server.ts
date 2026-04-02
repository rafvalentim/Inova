import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Route imports
import authRoutes from './modules/auth/routes';
import userRoutes from './modules/users/routes';
import roleRoutes from './modules/roles/routes';
import projectRoutes from './modules/projects/routes';
import sprintRoutes from './modules/sprints/routes';
import taskRoutes from './modules/tasks/routes';
import dashboardRoutes from './modules/dashboard/routes';
import reportRoutes from './modules/reports/routes';
import auditRoutes from './modules/audit/routes';
import clockifyRoutes from './modules/clockify/routes';

const app = express();
const httpServer = createServer(app);

// Socket.IO setup
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: config.corsOrigin,
        methods: ['GET', 'POST'],
    },
});

// Socket.IO events
io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    socket.on('join-project', (projectId: string) => {
        socket.join(`project:${projectId}`);
        console.log(`[Socket.IO] ${socket.id} joined project:${projectId}`);
    });

    socket.on('leave-project', (projectId: string) => {
        socket.leave(`project:${projectId}`);
    });

    socket.on('task-updated', (data: { projectId: string; task: any }) => {
        socket.to(`project:${data.projectId}`).emit('task-updated', data.task);
    });

    socket.on('task-moved', (data: { projectId: string; taskId: string; status: string; position: number }) => {
        socket.to(`project:${data.projectId}`).emit('task-moved', data);
    });

    socket.on('task-created', (data: { projectId: string; task: any }) => {
        socket.to(`project:${data.projectId}`).emit('task-created', data.task);
    });

    socket.on('task-deleted', (data: { projectId: string; taskId: string }) => {
        socket.to(`project:${data.projectId}`).emit('task-deleted', data.taskId);
    });

    socket.on('comment-added', (data: { projectId: string; taskId: string; comment: any }) => {
        socket.to(`project:${data.projectId}`).emit('comment-added', data);
    });

    socket.on('disconnect', () => {
        console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
});

// Make io accessible to routes
app.set('io', io);

// Middleware
app.use(helmet({
    contentSecurityPolicy: false,         // API não serve HTML
    crossOriginEmbedderPolicy: false,     // compatibilidade Socket.IO
}));
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api/', rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: { success: false, message: 'Muitas requisições. Tente novamente em 1 minuto.' },
}));

// Static files (uploads)
app.use('/uploads', express.static(path.resolve(config.upload.dir)));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/sprints', sprintRoutes);
// Task routes (project-scoped and direct)
app.use('/api/tasks', taskRoutes);
app.use('/api', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/clockify', clockifyRoutes);

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ success: true, message: 'Inova API is running', version: '1.0.0' });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
httpServer.listen(config.port, () => {
    console.log(`🚀 Inova API running on port ${config.port}`);
    console.log(`📦 Environment: ${config.nodeEnv}`);
    console.log(`🌐 CORS Origin: ${config.corsOrigin}`);
});

export { app, io };
