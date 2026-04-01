import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import prisma from '../../config/database';
import { config } from '../../config';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { createAuditLog } from '../../middleware/auditLog';

const router = Router();

// Configure multer for avatar upload
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const dir = path.join(config.upload.dir, 'avatars');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `avatar-${Date.now()}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB for avatars
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        cb(null, allowed.includes(file.mimetype));
    },
});

// GET /api/users/me
router.get('/me', authenticate, async (req: AuthRequest, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            include: { role: true },
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }

        res.json({
            success: true,
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatarUrl: user.avatarUrl,
                status: user.status,
                firstLogin: user.firstLogin,
                clockifyId: user.clockifyId,
                role: {
                    id: user.role.id,
                    name: user.role.name,
                    isSystem: user.role.isSystem,
                    permissions: user.role.permissions,
                },
            },
        });
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// GET /api/users
router.get('/', authenticate, authorize('users', 'read'), async (req: AuthRequest, res) => {
    try {
        const { search, status, roleId, page = '1', pageSize = '20' } = req.query;
        const skip = (parseInt(page as string) - 1) * parseInt(pageSize as string);
        const take = parseInt(pageSize as string);

        const where: any = {};
        if (search) {
            where.OR = [
                { name: { contains: search as string, mode: 'insensitive' } },
                { email: { contains: search as string, mode: 'insensitive' } },
            ];
        }
        if (status) where.status = status;
        if (roleId) where.roleId = roleId;

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                include: { role: { select: { id: true, name: true } } },
                skip,
                take,
                orderBy: { name: 'asc' },
            }),
            prisma.user.count({ where }),
        ]);

        res.json({
            success: true,
            data: {
                items: users.map((u) => ({
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    avatarUrl: u.avatarUrl,
                    status: u.status,
                    firstLogin: u.firstLogin,
                    role: u.role,
                    createdAt: u.createdAt,
                })),
                total,
                page: parseInt(page as string),
                pageSize: take,
                totalPages: Math.ceil(total / take),
            },
        });
    } catch (error) {
        console.error('List users error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// GET /api/users/:id
router.get('/:id', authenticate, authorize('users', 'read'), async (req: AuthRequest, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            include: { role: { select: { id: true, name: true } } },
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }

        res.json({
            success: true,
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatarUrl: user.avatarUrl,
                status: user.status,
                firstLogin: user.firstLogin,
                clockifyId: user.clockifyId,
                role: user.role,
                createdAt: user.createdAt,
            },
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// POST /api/users
router.post('/', authenticate, authorize('users', 'create'), async (req: AuthRequest, res) => {
    try {
        const { name, email, password, roleId } = req.body;

        if (!name || !email || !password || !roleId) {
            return res.status(400).json({ success: false, message: 'Campos obrigatórios: name, email, password, roleId' });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Email já cadastrado' });
        }

        const role = await prisma.role.findUnique({ where: { id: roleId } });
        if (!role) {
            return res.status(404).json({ success: false, message: 'Tipo de usuário não encontrado' });
        }

        const hashedPassword = await bcrypt.hash(password, config.bcryptRounds);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                roleId,
                firstLogin: true,
            },
            include: { role: { select: { id: true, name: true } } },
        });

        await createAuditLog(req, 'CREATE', 'users', user.id, null, { name, email, roleId });

        res.status(201).json({
            success: true,
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                status: user.status,
                firstLogin: user.firstLogin,
                role: user.role,
                createdAt: user.createdAt,
            },
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// PUT /api/users/:id
router.put('/:id', authenticate, authorize('users', 'update'), async (req: AuthRequest, res) => {
    try {
        const { name, email, roleId, clockifyId } = req.body;

        const existingUser = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!existingUser) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }

        if (email && email !== existingUser.email) {
            const emailTaken = await prisma.user.findUnique({ where: { email } });
            if (emailTaken) {
                return res.status(409).json({ success: false, message: 'Email já cadastrado' });
            }
        }

        const data: any = {};
        if (name) data.name = name;
        if (email) data.email = email;
        if (roleId) data.roleId = roleId;
        if (clockifyId !== undefined) data.clockifyId = clockifyId;

        const user = await prisma.user.update({
            where: { id: req.params.id },
            data,
            include: { role: { select: { id: true, name: true } } },
        });

        await createAuditLog(req, 'UPDATE', 'users', user.id, existingUser, data);

        res.json({
            success: true,
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatarUrl: user.avatarUrl,
                status: user.status,
                role: user.role,
                createdAt: user.createdAt,
            },
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// PATCH /api/users/:id/status
router.patch('/:id/status', authenticate, authorize('users', 'update'), async (req: AuthRequest, res) => {
    try {
        const { status } = req.body;
        if (!['ACTIVE', 'INACTIVE'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Status inválido. Use ACTIVE ou INACTIVE' });
        }

        if (req.params.id === req.userId && status === 'INACTIVE') {
            return res.status(403).json({ success: false, message: 'Você não pode desativar sua própria conta.' });
        }

        const user = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }

        const updated = await prisma.user.update({
            where: { id: req.params.id },
            data: { status },
        });

        await createAuditLog(req, 'UPDATE_STATUS', 'users', user.id, { status: user.status }, { status });

        res.json({ success: true, data: { id: updated.id, status: updated.status } });
    } catch (error) {
        console.error('Update user status error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// PUT /api/users/:id/avatar
router.put('/:id/avatar', authenticate, upload.single('avatar'), async (req: AuthRequest, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Arquivo de avatar é obrigatório' });
        }

        // Only self or system admin can update avatar
        if (req.params.id !== req.userId && !req.userIsSystem) {
            return res.status(403).json({ success: false, message: 'Sem permissão' });
        }

        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: { avatarUrl },
        });

        res.json({ success: true, data: { avatarUrl: user.avatarUrl } });
    } catch (error) {
        console.error('Upload avatar error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

export default router;
