import { Router } from 'express';
import prisma from '../../config/database';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { createAuditLog } from '../../middleware/auditLog';

const router = Router();

// Check if user can read sensitive project info
function canReadSensitive(req: AuthRequest): boolean {
    if (req.userRole === 'Administrador') return true;
    const perms = req.userPermissions as Record<string, string[]> | undefined;
    return !!(perms?.['project_info']?.includes('read_sensitive'));
}

// Generate project code
async function generateProjectCode(): Promise<string> {
    const lastProject = await prisma.project.findFirst({
        orderBy: { code: 'desc' },
        where: { code: { startsWith: 'PROJ-' } },
    });

    if (!lastProject) return 'PROJ-001';

    const lastNum = parseInt(lastProject.code.split('-')[1]);
    return `PROJ-${String(lastNum + 1).padStart(3, '0')}`;
}

// GET /api/projects
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const { search, status, memberId, page = '1', pageSize = '20' } = req.query;
        const skip = (parseInt(page as string) - 1) * parseInt(pageSize as string);
        const take = parseInt(pageSize as string);

        const where: any = {};
        if (search) {
            where.OR = [
                { name: { contains: search as string, mode: 'insensitive' } },
                { code: { contains: search as string, mode: 'insensitive' } },
            ];
        }
        if (status) where.status = status;
        if (memberId) {
            where.members = { some: { userId: memberId as string } };
        }

        const [projects, total] = await Promise.all([
            prisma.project.findMany({
                where,
                include: {
                    createdBy: { select: { id: true, name: true } },
                    _count: { select: { members: true, sprints: true, tasks: true } },
                },
                skip,
                take,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.project.count({ where }),
        ]);

        res.json({
            success: true,
            data: {
                items: projects,
                total,
                page: parseInt(page as string),
                pageSize: take,
                totalPages: Math.ceil(total / take),
            },
        });
    } catch (error) {
        console.error('List projects error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// GET /api/projects/:id
router.get('/:id', authenticate, async (req, res) => {
    try {
        const project = await prisma.project.findUnique({
            where: { id: req.params.id },
            include: {
                createdBy: { select: { id: true, name: true } },
                members: {
                    include: {
                        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
                    },
                },
                _count: { select: { members: true, sprints: true, tasks: true } },
            },
        });

        if (!project) {
            return res.status(404).json({ success: false, message: 'Projeto não encontrado' });
        }

        res.json({ success: true, data: project });
    } catch (error) {
        console.error('Get project error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// POST /api/projects
router.post('/', authenticate, authorize('projects', 'create'), async (req: AuthRequest, res) => {
    try {
        const { name, description, startDate, targetDate, memberIds } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, message: 'Nome é obrigatório' });
        }

        const code = await generateProjectCode();

        const project = await prisma.project.create({
            data: {
                code,
                name,
                description: description || null,
                startDate: startDate ? new Date(startDate) : null,
                targetDate: targetDate ? new Date(targetDate) : null,
                createdById: req.userId!,
                members: {
                    create: [
                        { userId: req.userId!, roleInProject: 'Líder' },
                        ...(memberIds || [])
                            .filter((id: string) => id !== req.userId)
                            .map((userId: string) => ({ userId, roleInProject: 'Membro' })),
                    ],
                },
            },
            include: {
                createdBy: { select: { id: true, name: true } },
                members: {
                    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
                },
                _count: { select: { members: true, sprints: true, tasks: true } },
            },
        });

        await createAuditLog(req, 'CREATE', 'projects', project.id, null, { name, code });

        res.status(201).json({ success: true, data: project });
    } catch (error) {
        console.error('Create project error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// PUT /api/projects/:id
router.put('/:id', authenticate, authorize('projects', 'update'), async (req: AuthRequest, res) => {
    try {
        const { name, description, startDate, targetDate } = req.body;

        const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Projeto não encontrado' });
        }

        const data: any = {};
        if (name) data.name = name;
        if (description !== undefined) data.description = description;
        if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
        if (targetDate !== undefined) data.targetDate = targetDate ? new Date(targetDate) : null;

        const project = await prisma.project.update({
            where: { id: req.params.id },
            data,
            include: {
                createdBy: { select: { id: true, name: true } },
                _count: { select: { members: true, sprints: true, tasks: true } },
            },
        });

        await createAuditLog(req, 'UPDATE', 'projects', project.id, existing, data);

        res.json({ success: true, data: project });
    } catch (error) {
        console.error('Update project error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// PATCH /api/projects/:id/status
router.patch('/:id/status', authenticate, authorize('projects', 'update'), async (req: AuthRequest, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['PLANNING', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Status inválido' });
        }

        const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Projeto não encontrado' });
        }

        const project = await prisma.project.update({
            where: { id: req.params.id },
            data: { status },
        });

        await createAuditLog(req, 'UPDATE_STATUS', 'projects', project.id, { status: existing.status }, { status });

        res.json({ success: true, data: project });
    } catch (error) {
        console.error('Update project status error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// GET /api/projects/:id/members
router.get('/:id/members', authenticate, async (req, res) => {
    try {
        const members = await prisma.projectMember.findMany({
            where: { projectId: req.params.id },
            include: {
                user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
        });

        res.json({ success: true, data: members });
    } catch (error) {
        console.error('List members error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// POST /api/projects/:id/members
router.post('/:id/members', authenticate, authorize('project_members', 'create'), async (req: AuthRequest, res) => {
    try {
        const { userId, roleInProject = 'Membro' } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'userId é obrigatório' });
        }

        const existing = await prisma.projectMember.findUnique({
            where: { projectId_userId: { projectId: req.params.id, userId } },
        });

        if (existing) {
            return res.status(409).json({ success: false, message: 'Usuário já é membro do projeto' });
        }

        const member = await prisma.projectMember.create({
            data: { projectId: req.params.id, userId, roleInProject },
            include: {
                user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
        });

        await createAuditLog(req, 'ADD_MEMBER', 'projects', req.params.id, null, { userId, roleInProject });

        res.status(201).json({ success: true, data: member });
    } catch (error) {
        console.error('Add member error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// DELETE /api/projects/:id/members/:uid
router.delete('/:id/members/:uid', authenticate, authorize('project_members', 'delete'), async (req: AuthRequest, res) => {
    try {
        const member = await prisma.projectMember.findUnique({
            where: { projectId_userId: { projectId: req.params.id, userId: req.params.uid } },
        });

        if (!member) {
            return res.status(404).json({ success: false, message: 'Membro não encontrado' });
        }

        await prisma.projectMember.delete({ where: { id: member.id } });

        await createAuditLog(req, 'REMOVE_MEMBER', 'projects', req.params.id, { userId: req.params.uid }, null);

        res.json({ success: true, message: 'Membro removido com sucesso' });
    } catch (error) {
        console.error('Remove member error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// GET /api/projects/:id/info
router.get('/:id/info', authenticate, async (req: AuthRequest, res) => {
    try {
        const sensitive = canReadSensitive(req);
        const items = await prisma.projectInfo.findMany({
            where: {
                projectId: req.params.id,
                ...(sensitive ? {} : { isSensitive: false }),
            },
            include: {
                createdBy: { select: { id: true, name: true } },
            },
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        });
        res.json({ success: true, data: items });
    } catch (error) {
        console.error('List project info error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// POST /api/projects/:id/info
router.post('/:id/info', authenticate, authorize('project_info', 'create'), async (req: AuthRequest, res) => {
    try {
        const { category, label, value, username, isSensitive, notes, order } = req.body;

        if (!label || !value || !category) {
            return res.status(400).json({ success: false, message: 'Categoria, identificação e valor são obrigatórios' });
        }

        const validCategories = ['CONTACT', 'LINK_STAGING', 'LINK_PRODUCTION', 'LINK_DATABASE', 'CREDENTIAL', 'OTHER'];
        if (!validCategories.includes(category)) {
            return res.status(400).json({ success: false, message: 'Categoria inválida' });
        }

        const forceSensitive = category === 'CREDENTIAL' ? true : (isSensitive ?? false);

        const item = await prisma.projectInfo.create({
            data: {
                projectId: req.params.id,
                category,
                label,
                value,
                username: username || null,
                isSensitive: forceSensitive,
                notes: notes || null,
                order: order ?? 0,
                createdById: req.userId!,
            },
            include: {
                createdBy: { select: { id: true, name: true } },
            },
        });

        await createAuditLog(req, 'CREATE', 'project_info', item.id, null, { label, category, isSensitive: forceSensitive });

        res.status(201).json({ success: true, data: item });
    } catch (error) {
        console.error('Create project info error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// PUT /api/projects/:id/info/:infoId
router.put('/:id/info/:infoId', authenticate, authorize('project_info', 'update'), async (req: AuthRequest, res) => {
    try {
        const existing = await prisma.projectInfo.findFirst({
            where: { id: req.params.infoId, projectId: req.params.id },
        });

        if (!existing) {
            return res.status(404).json({ success: false, message: 'Informação não encontrada' });
        }

        const { category, label, value, username, isSensitive, notes, order } = req.body;
        const data: any = {};
        if (category !== undefined) data.category = category;
        if (label !== undefined) data.label = label;
        if (value !== undefined) data.value = value;
        if (username !== undefined) data.username = username || null;
        if (isSensitive !== undefined) data.isSensitive = (data.category ?? existing.category) === 'CREDENTIAL' ? true : isSensitive;
        if (notes !== undefined) data.notes = notes || null;
        if (order !== undefined) data.order = order;

        const item = await prisma.projectInfo.update({
            where: { id: req.params.infoId },
            data,
            include: {
                createdBy: { select: { id: true, name: true } },
            },
        });

        await createAuditLog(req, 'UPDATE', 'project_info', item.id, existing, data);

        res.json({ success: true, data: item });
    } catch (error) {
        console.error('Update project info error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// DELETE /api/projects/:id/info/:infoId
router.delete('/:id/info/:infoId', authenticate, authorize('project_info', 'delete'), async (req: AuthRequest, res) => {
    try {
        const existing = await prisma.projectInfo.findFirst({
            where: { id: req.params.infoId, projectId: req.params.id },
        });

        if (!existing) {
            return res.status(404).json({ success: false, message: 'Informação não encontrada' });
        }

        await prisma.projectInfo.delete({ where: { id: req.params.infoId } });

        await createAuditLog(req, 'DELETE', 'project_info', req.params.infoId, existing, null);

        res.json({ success: true, message: 'Informação removida com sucesso' });
    } catch (error) {
        console.error('Delete project info error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// DELETE /api/projects/:id
router.delete('/:id', authenticate, authorize('projects', 'delete'), async (req: AuthRequest, res) => {
    try {
        const project = await prisma.project.findUnique({ where: { id: req.params.id } });
        if (!project) {
            return res.status(404).json({ success: false, message: 'Projeto não encontrado' });
        }

        // Delete related records and then the project
        await prisma.$transaction([
            prisma.timeEntry.deleteMany({ where: { task: { projectId: project.id } } }),
            prisma.comment.deleteMany({ where: { task: { projectId: project.id } } }),
            prisma.attachment.deleteMany({ where: { task: { projectId: project.id } } }),
            prisma.taskAssignee.deleteMany({ where: { task: { projectId: project.id } } }),
            prisma.task.deleteMany({ where: { projectId: project.id } }),
            prisma.sprint.deleteMany({ where: { projectId: project.id } }),
            prisma.projectMember.deleteMany({ where: { projectId: project.id } }),
            prisma.projectInfo.deleteMany({ where: { projectId: project.id } }),
            prisma.project.delete({ where: { id: project.id } })
        ]);

        await createAuditLog(req, 'DELETE', 'projects', project.id, project, null);

        res.json({ success: true, message: 'Projeto excluído com sucesso' });
    } catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

export default router;
