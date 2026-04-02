import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileTypeFromBuffer } from 'file-type';
import prisma from '../../config/database';
import { config } from '../../config';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { createAuditLog } from '../../middleware/auditLog';
import { rejectIfCancelled } from '../../utils/projectGuard';

const router = Router();

// File upload config
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const dir = path.join(config.upload.dir, 'attachments');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`);
    },
});

// SEC-05: tipos MIME permitidos (validados via magic bytes no handler de upload)
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  // .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',        // .xlsx
];

const upload = multer({
    storage,
    limits: { fileSize: config.upload.maxFileSize },
    fileFilter: (_req, file, cb) => {
        // Primeiro layer: extensão (rápido, rejeita óbvios antes de gravar em disco)
        const ext = path.extname(file.originalname).toLowerCase();
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.txt', '.zip', '.docx', '.xlsx'];
        if (!allowedExtensions.includes(ext)) {
            return cb(new Error('Tipo de arquivo não permitido'));
        }
        // Segundo layer (magic bytes) é feito no handler após salvar em disco
        cb(null, true);
    },
});

// Inclui as sprints de uma task no formato legível
const sprintInclude = {
    sprints: {
        include: {
            sprint: { select: { id: true, name: true, status: true } },
        },
    },
};

// Auto-atualiza o status do projeto com base nas tasks em progresso em sprints ativas
async function syncProjectStatus(projectId: string) {
    try {
        const now = new Date();
        // Verifica se há alguma sprint ativa com task IN_PROGRESS
        const activeSprint = await prisma.sprint.findFirst({
            where: {
                projectId,
                status: 'ACTIVE',
                startDate: { lte: now },
                endDate: { gte: now },
                tasks: { some: { task: { status: 'IN_PROGRESS' } } },
            },
        });

        const project = await prisma.project.findUnique({ where: { id: projectId }, select: { status: true } });
        if (!project) return;

        if (activeSprint && project.status === 'PLANNING') {
            await prisma.project.update({
                where: { id: projectId },
                data: { status: 'IN_PROGRESS' },
            });
        }
    } catch (e) {
        console.error('syncProjectStatus error:', e);
    }
}

// GET /api/projects/:projectId/tasks
router.get('/projects/:projectId/tasks', authenticate, async (req, res) => {
    try {
        const { status, priority, sprintId, assigneeId, search, tags, page = '1', pageSize = '50' } = req.query;
        const skip = (parseInt(page as string) - 1) * parseInt(pageSize as string);
        const take = parseInt(pageSize as string);

        const where: any = { projectId: req.params.projectId, parentId: null };
        if (status) where.status = status;
        if (priority) where.priority = priority;
        if (sprintId !== undefined) {
            if (sprintId === 'null') {
                // Backlog: tasks sem nenhuma sprint associada
                where.sprints = { none: {} };
            } else {
                // Tasks de uma sprint específica
                where.sprints = { some: { sprintId: sprintId as string } };
            }
        }
        if (assigneeId) where.assignees = { some: { userId: assigneeId as string } };
        if (search) {
            where.OR = [
                { title: { contains: search as string, mode: 'insensitive' } },
                { description: { contains: search as string, mode: 'insensitive' } },
            ];
        }
        if (tags) {
            where.tags = { hasSome: (tags as string).split(',') };
        }

        const [tasks, total] = await Promise.all([
            prisma.task.findMany({
                where,
                include: {
                    ...sprintInclude,
                    assignees: {
                        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
                    },
                    _count: { select: { comments: true, attachments: true, subtasks: true } },
                },
                skip,
                take,
                orderBy: [{ status: 'asc' }, { position: 'asc' }],
            }),
            prisma.task.count({ where }),
        ]);

        res.json({
            success: true,
            data: {
                items: tasks,
                total,
                page: parseInt(page as string),
                pageSize: take,
                totalPages: Math.ceil(total / take),
            },
        });
    } catch (error) {
        console.error('List tasks error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// GET /api/tasks/my-tasks — tasks atribuídas ao usuário logado
router.get('/my-tasks', authenticate, async (req: AuthRequest, res) => {
    try {
        const tasks = await prisma.task.findMany({
            where: {
                assignees: { some: { userId: req.userId! } },
            },
            include: {
                project: { select: { id: true, code: true, name: true } },
                ...sprintInclude,
                assignees: {
                    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
                },
                _count: { select: { comments: true, attachments: true, subtasks: true } },
            },
            orderBy: [{ status: 'asc' }, { priority: 'desc' }, { dueDate: 'asc' }],
        });

        res.json({ success: true, data: { items: tasks, total: tasks.length } });
    } catch (error) {
        console.error('My tasks error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// GET /api/tasks/:id
router.get('/:id', authenticate, async (req, res) => {
    try {
        const task = await prisma.task.findUnique({
            where: { id: req.params.id },
            include: {
                project: { select: { id: true, code: true, name: true } },
                ...sprintInclude,
                parent: { select: { id: true, title: true } },
                subtasks: {
                    include: {
                        assignees: {
                            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
                        },
                    },
                    orderBy: { position: 'asc' },
                },
                assignees: {
                    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
                },
                comments: {
                    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
                    orderBy: { createdAt: 'desc' },
                },
                attachments: {
                    include: { uploadedBy: { select: { id: true, name: true } } },
                    orderBy: { createdAt: 'desc' },
                },
                timeEntries: {
                    include: { user: { select: { id: true, name: true } } },
                    orderBy: { date: 'desc' },
                },
                _count: { select: { comments: true, attachments: true, subtasks: true } },
            },
        });

        if (!task) {
            return res.status(404).json({ success: false, message: 'Task não encontrada' });
        }

        res.json({ success: true, data: task });
    } catch (error) {
        console.error('Get task error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// Gera código sequencial único para task (TASK-001, TASK-002, ...)
async function generateTaskCode(): Promise<string> {
    try {
        const tasks = await prisma.task.findMany({
            where: { code: { startsWith: 'TASK-' } },
            select: { code: true },
        });

        if (tasks.length === 0) return 'TASK-001';

        const max = tasks.reduce((acc, t) => {
            const num = parseInt(t.code.split('-')[1], 10);
            return isNaN(num) ? acc : Math.max(acc, num);
        }, 0);

        return `TASK-${String(max + 1).padStart(3, '0')}`;
    } catch (e: any) {
        if (e?.message?.includes('column') || e?.code === 'P2022') {
            console.warn('[generateTaskCode] Coluna code não existe ainda. Rode a migration. Usando fallback.');
            return `TASK-${Date.now().toString().slice(-6)}`;
        }
        throw e;
    }
}

// Cria task com código único — retenta até 3 vezes em caso de race condition (SEC-06, P2002)
async function createTaskWithCode(data: Omit<Parameters<typeof prisma.task.create>[0]['data'], 'code'>): Promise<Awaited<ReturnType<typeof prisma.task.create>>> {
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const code = await generateTaskCode();
        try {
            return await prisma.task.create({ data: { ...data, code } as Parameters<typeof prisma.task.create>[0]['data'] });
        } catch (e: any) {
            if (e?.code === 'P2002' && attempt < MAX_RETRIES) {
                // Race condition: outro request criou task com o mesmo código — retenta
                continue;
            }
            throw e;
        }
    }
    throw new Error('Não foi possível gerar código único para a task após 3 tentativas');
}

// POST /api/projects/:projectId/tasks
router.post('/projects/:projectId/tasks', authenticate, authorize('tasks', 'create'), async (req: AuthRequest, res) => {
    try {
        const { title, description, priority, sprintId, parentId, dueDate, storyPoints, estimatedHours, tags, assigneeIds } = req.body;

        if (!title) {
            return res.status(400).json({ success: false, message: 'Título é obrigatório' });
        }

        const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
        if (!project) {
            return res.status(404).json({ success: false, message: 'Projeto não encontrado' });
        }
        if (await rejectIfCancelled(req.params.projectId, res)) return;

        const lastTask = await prisma.task.findFirst({
            where: { projectId: req.params.projectId, status: 'BACKLOG' },
            orderBy: { position: 'desc' },
            select: { position: true },
        });
        const position = (lastTask?.position ?? -1) + 1;

        // SEC-06: createTaskWithCode faz retry em P2002 (unique constraint em code) para evitar race condition
        const createdTask = await createTaskWithCode({
            projectId: req.params.projectId,
            title,
            description: description || null,
            priority: priority || 'MEDIUM',
            parentId: parentId || null,
            dueDate: dueDate ? new Date(dueDate) : null,
            storyPoints: storyPoints != null && storyPoints !== '' ? parseInt(storyPoints as string, 10) : null,
            estimatedHours: estimatedHours != null && estimatedHours !== '' ? parseFloat(estimatedHours as string) : null,
            tags: tags || [],
            position,
            createdById: req.userId!,
            assignees: assigneeIds
                ? { create: assigneeIds.map((userId: string) => ({ userId })) }
                : undefined,
            // Associa à sprint via junction table
            sprints: sprintId
                ? { create: [{ sprintId }] }
                : undefined,
        });

        // Buscar task com includes após criação (createTaskWithCode retorna sem includes)
        const task = await prisma.task.findUnique({
            where: { id: createdTask.id },
            include: {
                ...sprintInclude,
                assignees: {
                    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
                },
                _count: { select: { comments: true, attachments: true, subtasks: true } },
            },
        });

        await createAuditLog(req, 'CREATE', 'tasks', createdTask.id, null, { code: createdTask.code, title, projectId: req.params.projectId });

        // SEC-03: Emitir evento para clientes conectados ao projeto
        const io = req.app.get('io');
        if (io) io.to(`project:${req.params.projectId}`).emit('task-created', task ?? createdTask);

        res.status(201).json({ success: true, data: task ?? createdTask });
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// PUT /api/tasks/:id
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const { title, description, priority, status, sprintId, dueDate, storyPoints, estimatedHours, tags, assigneeIds } = req.body;

        const existing = await prisma.task.findUnique({
            where: { id: req.params.id },
            include: { assignees: { select: { userId: true } } },
        });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Task não encontrada' });
        }
        if (await rejectIfCancelled(existing.projectId, res)) return;

        const hasUpdatePermission = req.userRole === 'Administrador' ||
            (req.userPermissions?.['tasks'] && req.userPermissions['tasks'].includes('update'));
        const isAssignee = existing.assignees.some((a) => a.userId === req.userId);

        if (!hasUpdatePermission && !isAssignee) {
            return res.status(403).json({ success: false, message: 'Sem permissão para editar esta task' });
        }

        const validStatuses = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
        const data: any = {};
        if (title) data.title = title;
        if (description !== undefined) data.description = description;
        if (priority) data.priority = priority;
        if (status && validStatuses.includes(status)) data.status = status;
        if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
        if (storyPoints !== undefined) data.storyPoints = storyPoints != null && storyPoints !== '' ? parseInt(storyPoints as string, 10) : null;
        if (estimatedHours !== undefined) data.estimatedHours = estimatedHours != null && estimatedHours !== '' ? parseFloat(estimatedHours as string) : null;
        if (tags) data.tags = tags;

        const task = await prisma.task.update({
            where: { id: req.params.id },
            data,
            include: {
                ...sprintInclude,
                assignees: {
                    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
                },
                _count: { select: { comments: true, attachments: true, subtasks: true } },
            },
        });

        // Atualiza assignees se fornecido
        if (assigneeIds) {
            await prisma.taskAssignee.deleteMany({ where: { taskId: req.params.id } });
            if (assigneeIds.length > 0) {
                await prisma.taskAssignee.createMany({
                    data: assigneeIds.map((userId: string) => ({ taskId: req.params.id, userId })),
                });
            }
        }

        // Adiciona à sprint se fornecido (sem remover das sprints existentes)
        if (sprintId !== undefined) {
            if (sprintId === null) {
                // Remove de todas as sprints (move para backlog)
                await prisma.sprintTask.deleteMany({ where: { taskId: req.params.id } });
            } else {
                // Adiciona à sprint, ignorando se já estiver associada
                await prisma.sprintTask.upsert({
                    where: { sprintId_taskId: { sprintId, taskId: req.params.id } },
                    create: { sprintId, taskId: req.params.id },
                    update: {},
                });
            }
        }

        await createAuditLog(req, 'UPDATE', 'tasks', task.id, existing, data);

        // SEC-03: Emitir evento para clientes conectados ao projeto
        const io = req.app.get('io');
        if (io) io.to(`project:${task.projectId}`).emit('task-updated', task);

        res.json({ success: true, data: task });
    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// PATCH /api/tasks/:id/status
router.patch('/:id/status', authenticate, async (req: AuthRequest, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Status inválido' });
        }

        const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Task não encontrada' });
        }
        if (await rejectIfCancelled(existing.projectId, res)) return;

        const task = await prisma.task.update({
            where: { id: req.params.id },
            data: { status },
        });

        await createAuditLog(req, 'UPDATE_STATUS', 'tasks', task.id, { status: existing.status }, { status });

        // Auto-atualiza status do projeto se task foi para IN_PROGRESS
        if (status === 'IN_PROGRESS') {
            await syncProjectStatus(existing.projectId);
        }

        // SEC-03: Emitir evento para clientes conectados ao projeto
        const io = req.app.get('io');
        if (io) io.to(`project:${task.projectId}`).emit('task-moved', {
            taskId: task.id,
            status: task.status,
            position: task.position,
        });

        res.json({ success: true, data: task });
    } catch (error) {
        console.error('Update task status error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// PATCH /api/tasks/:id/position
router.patch('/:id/position', authenticate, async (req: AuthRequest, res) => {
    try {
        const { position, status } = req.body;

        const taskForGuard = await prisma.task.findUnique({ where: { id: req.params.id }, select: { projectId: true } });
        if (!taskForGuard) return res.status(404).json({ success: false, message: 'Task não encontrada' });
        if (await rejectIfCancelled(taskForGuard.projectId, res)) return;

        const task = await prisma.task.update({
            where: { id: req.params.id },
            data: {
                position: position ?? undefined,
                status: status ?? undefined,
            },
        });

        // Auto-atualiza status do projeto se task foi para IN_PROGRESS via DnD
        if (status === 'IN_PROGRESS') {
            await syncProjectStatus(task.projectId);
        }

        // SEC-03: Emitir evento para clientes conectados ao projeto (DnD move)
        const io = req.app.get('io');
        if (io) io.to(`project:${task.projectId}`).emit('task-moved', {
            taskId: task.id,
            status: task.status,
            position: task.position,
        });

        res.json({ success: true, data: task });
    } catch (error) {
        console.error('Update task position error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// DELETE /api/tasks/:id
router.delete('/:id', authenticate, authorize('tasks', 'delete'), async (req: AuthRequest, res) => {
    try {
        const task = await prisma.task.findUnique({ where: { id: req.params.id } });
        if (!task) {
            return res.status(404).json({ success: false, message: 'Task não encontrada' });
        }
        if (await rejectIfCancelled(task.projectId, res)) return;

        await prisma.task.delete({ where: { id: req.params.id } });

        await createAuditLog(req, 'DELETE', 'tasks', task.id, task, null);

        // SEC-03: Emitir evento para clientes conectados ao projeto
        const io = req.app.get('io');
        if (io) io.to(`project:${task.projectId}`).emit('task-deleted', task.id);

        res.json({ success: true, message: 'Task excluída com sucesso' });
    } catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// ===== SPRINTS DE UMA TASK =====

// POST /api/tasks/:id/sprints — adiciona task a uma sprint
router.post('/:id/sprints', authenticate, authorize('tasks', 'update'), async (req: AuthRequest, res) => {
    try {
        const { sprintId } = req.body;
        if (!sprintId) {
            return res.status(400).json({ success: false, message: 'sprintId é obrigatório' });
        }

        await prisma.sprintTask.upsert({
            where: { sprintId_taskId: { sprintId, taskId: req.params.id } },
            create: { sprintId, taskId: req.params.id },
            update: {},
        });

        res.json({ success: true, message: 'Task adicionada à sprint' });
    } catch (error) {
        console.error('Add task to sprint error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// DELETE /api/tasks/:id/sprints/:sprintId — remove task de uma sprint
router.delete('/:id/sprints/:sprintId', authenticate, authorize('tasks', 'update'), async (req: AuthRequest, res) => {
    try {
        await prisma.sprintTask.deleteMany({
            where: { taskId: req.params.id, sprintId: req.params.sprintId },
        });

        res.json({ success: true, message: 'Task removida da sprint' });
    } catch (error) {
        console.error('Remove task from sprint error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// ===== COMMENTS =====

// GET /api/tasks/:id/comments
router.get('/:id/comments', authenticate, async (req, res) => {
    try {
        const comments = await prisma.comment.findMany({
            where: { taskId: req.params.id },
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
            orderBy: { createdAt: 'desc' },
        });

        res.json({ success: true, data: comments });
    } catch (error) {
        console.error('List comments error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// POST /api/tasks/:id/comments
router.post('/:id/comments', authenticate, async (req: AuthRequest, res) => {
    try {
        const { content } = req.body;
        if (!content) {
            return res.status(400).json({ success: false, message: 'Conteúdo é obrigatório' });
        }

        const taskForGuard = await prisma.task.findUnique({ where: { id: req.params.id }, select: { projectId: true } });
        if (!taskForGuard) return res.status(404).json({ success: false, message: 'Task não encontrada' });
        if (await rejectIfCancelled(taskForGuard.projectId, res)) return;

        const comment = await prisma.comment.create({
            data: { taskId: req.params.id, userId: req.userId!, content },
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        });

        await createAuditLog(req, 'CREATE', 'comments', comment.id, null, { taskId: req.params.id });

        res.status(201).json({ success: true, data: comment });
    } catch (error) {
        console.error('Create comment error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// PUT /api/comments/:id
router.put('/comments/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const { content } = req.body;
        const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });
        if (!comment) {
            return res.status(404).json({ success: false, message: 'Comentário não encontrado' });
        }

        if (comment.userId !== req.userId && req.userRole !== 'Administrador') {
            return res.status(403).json({ success: false, message: 'Sem permissão' });
        }

        const updated = await prisma.comment.update({
            where: { id: req.params.id },
            data: { content },
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        });

        res.json({ success: true, data: updated });
    } catch (error) {
        console.error('Update comment error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// DELETE /api/comments/:id
router.delete('/comments/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });
        if (!comment) {
            return res.status(404).json({ success: false, message: 'Comentário não encontrado' });
        }

        if (comment.userId !== req.userId && req.userRole !== 'Administrador') {
            return res.status(403).json({ success: false, message: 'Sem permissão' });
        }

        await prisma.comment.delete({ where: { id: req.params.id } });

        res.json({ success: true, message: 'Comentário excluído com sucesso' });
    } catch (error) {
        console.error('Delete comment error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// ===== ATTACHMENTS =====

// POST /api/tasks/:id/attachments
router.post('/:id/attachments', authenticate, upload.single('file'), async (req: AuthRequest, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Arquivo é obrigatório' });
        }

        // SEC-05: Validar MIME type real via magic bytes (não confiar no header do cliente)
        const fileBuffer = fs.readFileSync(req.file.path);
        const detectedType = await fileTypeFromBuffer(fileBuffer);
        if (!detectedType || !ALLOWED_MIME_TYPES.includes(detectedType.mime)) {
            fs.unlinkSync(req.file.path); // remover arquivo inválido do disco
            return res.status(400).json({
                success: false,
                message: `Tipo de arquivo não permitido: ${detectedType?.mime ?? 'desconhecido'}`,
            });
        }

        const taskForGuard = await prisma.task.findUnique({ where: { id: req.params.id }, select: { projectId: true } });
        if (!taskForGuard) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ success: false, message: 'Task não encontrada' });
        }
        if (await rejectIfCancelled(taskForGuard.projectId, res)) {
            fs.unlinkSync(req.file.path);
            return;
        }

        const attachment = await prisma.attachment.create({
            data: {
                taskId: req.params.id,
                filename: req.file.originalname,
                filepath: `/uploads/attachments/${req.file.filename}`,
                sizeBytes: req.file.size,
                mimeType: req.file.mimetype,
                uploadedById: req.userId!,
            },
            include: { uploadedBy: { select: { id: true, name: true } } },
        });

        res.status(201).json({ success: true, data: attachment });
    } catch (error) {
        console.error('Upload attachment error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// DELETE /api/attachments/:id
router.delete('/attachments/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const attachment = await prisma.attachment.findUnique({ where: { id: req.params.id } });
        if (!attachment) {
            return res.status(404).json({ success: false, message: 'Anexo não encontrado' });
        }

        if (attachment.uploadedById !== req.userId && req.userRole !== 'Administrador') {
            return res.status(403).json({ success: false, message: 'Sem permissão' });
        }

        const fullPath = path.join(config.upload.dir, attachment.filepath.replace('/uploads/', ''));
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }

        await prisma.attachment.delete({ where: { id: req.params.id } });

        res.json({ success: true, message: 'Anexo excluído com sucesso' });
    } catch (error) {
        console.error('Delete attachment error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// ===== TIME ENTRIES =====

// GET /api/tasks/:id/time-entries
router.get('/:id/time-entries', authenticate, async (req, res) => {
    try {
        const entries = await prisma.timeEntry.findMany({
            where: { taskId: req.params.id },
            include: { user: { select: { id: true, name: true } } },
            orderBy: { date: 'desc' },
        });

        res.json({ success: true, data: entries });
    } catch (error) {
        console.error('List time entries error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// POST /api/tasks/:id/time-entries
router.post('/:id/time-entries', authenticate, async (req: AuthRequest, res) => {
    try {
        const { durationMin, description, date } = req.body;

        if (!durationMin || !date) {
            return res.status(400).json({ success: false, message: 'Duração e data são obrigatórios' });
        }

        const taskForGuard = await prisma.task.findUnique({ where: { id: req.params.id }, select: { projectId: true } });
        if (!taskForGuard) return res.status(404).json({ success: false, message: 'Task não encontrada' });
        if (await rejectIfCancelled(taskForGuard.projectId, res)) return;

        const entry = await prisma.timeEntry.create({
            data: {
                taskId: req.params.id,
                userId: req.userId!,
                durationMin,
                description: description || null,
                source: 'MANUAL',
                date: new Date(date),
            },
            include: { user: { select: { id: true, name: true } } },
        });

        res.status(201).json({ success: true, data: entry });
    } catch (error) {
        console.error('Create time entry error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

export default router;
