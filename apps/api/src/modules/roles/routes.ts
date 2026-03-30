import { Router } from 'express';
import prisma from '../../config/database';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { createAuditLog } from '../../middleware/auditLog';

const router = Router();

// GET /api/roles
router.get('/', authenticate, async (_req, res) => {
    try {
        const roles = await prisma.role.findMany({
            include: { _count: { select: { users: true } } },
            orderBy: { name: 'asc' },
        });

        res.json({ success: true, data: roles });
    } catch (error) {
        console.error('List roles error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// GET /api/roles/:id
router.get('/:id', authenticate, async (req, res) => {
    try {
        const role = await prisma.role.findUnique({
            where: { id: req.params.id },
            include: { _count: { select: { users: true } } },
        });

        if (!role) {
            return res.status(404).json({ success: false, message: 'Tipo de usuário não encontrado' });
        }

        res.json({ success: true, data: role });
    } catch (error) {
        console.error('Get role error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// POST /api/roles
router.post('/', authenticate, authorize('roles', 'create'), async (req: AuthRequest, res) => {
    try {
        const { name, description, permissions } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
        }

        const existing = await prisma.role.findUnique({ where: { name } });
        if (existing) {
            return res.status(409).json({ success: false, message: 'Nome já existe' });
        }

        const role = await prisma.role.create({
            data: {
                name,
                description: description || null,
                permissions: permissions || {},
                isSystem: false,
            },
        });

        await createAuditLog(req, 'CREATE', 'roles', role.id, null, { name, permissions });

        res.status(201).json({ success: true, data: role });
    } catch (error) {
        console.error('Create role error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// PUT /api/roles/:id
router.put('/:id', authenticate, authorize('roles', 'update'), async (req: AuthRequest, res) => {
    try {
        const { name, description, permissions } = req.body;

        const role = await prisma.role.findUnique({ where: { id: req.params.id } });
        if (!role) {
            return res.status(404).json({ success: false, message: 'Tipo de usuário não encontrado' });
        }

        if (name && name !== role.name) {
            const existing = await prisma.role.findUnique({ where: { name } });
            if (existing) {
                return res.status(409).json({ success: false, message: 'Nome já existe' });
            }
        }

        const data: any = {};
        if (name) data.name = name;
        if (description !== undefined) data.description = description;
        if (permissions) data.permissions = permissions;

        const updated = await prisma.role.update({
            where: { id: req.params.id },
            data,
        });

        await createAuditLog(req, 'UPDATE', 'roles', role.id, role, data);

        res.json({ success: true, data: updated });
    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// DELETE /api/roles/:id
router.delete('/:id', authenticate, authorize('roles', 'delete'), async (req: AuthRequest, res) => {
    try {
        const role = await prisma.role.findUnique({
            where: { id: req.params.id },
            include: { _count: { select: { users: true } } },
        });

        if (!role) {
            return res.status(404).json({ success: false, message: 'Tipo de usuário não encontrado' });
        }

        if (role.isSystem) {
            return res.status(400).json({ success: false, message: 'Tipos de usuário do sistema não podem ser excluídos' });
        }

        if (role._count.users > 0) {
            return res.status(400).json({ success: false, message: 'Existem usuários vinculados a este tipo' });
        }

        await prisma.role.delete({ where: { id: req.params.id } });

        await createAuditLog(req, 'DELETE', 'roles', role.id, role, null);

        res.json({ success: true, message: 'Tipo de usuário excluído com sucesso' });
    } catch (error) {
        console.error('Delete role error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

export default router;
