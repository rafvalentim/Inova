import { Router } from 'express';
import prisma from '../../config/database';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { createAuditLog } from '../../middleware/auditLog';

const router = Router();

/**
 * Verifica e auto-completa sprints ACTIVE que passaram da data fim.
 * Para cada sprint vencida:
 *  1. Move tasks incompletas para a próxima sprint ACTIVE/PLANNING do projeto (por startDate),
 *     ou para o backlog (sem sprint) se não houver próxima.
 *  2. Marca a sprint como COMPLETED.
 */
async function autoCompleteOverdueSprints(projectId: string) {
    try {
        const now = new Date();
        const overdue = await prisma.sprint.findMany({
            where: { projectId, status: 'ACTIVE', endDate: { lt: now } },
        });

        for (const sprint of overdue) {
            // Próxima sprint ativa ou em planejamento, ordenada por data de início
            const nextSprint = await prisma.sprint.findFirst({
                where: {
                    projectId,
                    id: { not: sprint.id },
                    status: { in: ['ACTIVE', 'PLANNING'] },
                },
                orderBy: { startDate: 'asc' },
            });

            // Busca tasks incompletas desta sprint
            const incompleteTasks = await prisma.sprintTask.findMany({
                where: {
                    sprintId: sprint.id,
                    task: { status: { notIn: ['DONE'] } },
                },
                select: { taskId: true },
            });

            // Remove tarefas incompletas desta sprint e adiciona à próxima (se houver)
            for (const { taskId } of incompleteTasks) {
                // Remove da sprint atual
                await prisma.sprintTask.delete({
                    where: { sprintId_taskId: { sprintId: sprint.id, taskId } },
                });

                // Adiciona à próxima sprint, se existir
                if (nextSprint) {
                    await prisma.sprintTask.upsert({
                        where: { sprintId_taskId: { sprintId: nextSprint.id, taskId } },
                        create: { sprintId: nextSprint.id, taskId },
                        update: {},
                    });
                }
                // Se nextSprint = null, task fica sem sprint (backlog)
            }

            // Marca sprint como COMPLETED
            await prisma.sprint.update({
                where: { id: sprint.id },
                data: { status: 'COMPLETED' },
            });

            console.log(`[autoComplete] Sprint "${sprint.name}" concluída automaticamente. ${incompleteTasks.length} task(s) movida(s).`);
        }
    } catch (e) {
        console.error('autoCompleteOverdueSprints error:', e);
    }
}

/**
 * Atualiza o status do projeto para IN_PROGRESS se houver sprint ativa
 * com tasks em progresso dentro do período da sprint.
 */
async function syncProjectStatus(projectId: string) {
    try {
        const now = new Date();
        const project = await prisma.project.findUnique({ where: { id: projectId }, select: { status: true } });
        if (!project || project.status !== 'PLANNING') return;

        const activeSprint = await prisma.sprint.findFirst({
            where: {
                projectId,
                status: 'ACTIVE',
                startDate: { lte: now },
                endDate: { gte: now },
                tasks: { some: { task: { status: 'IN_PROGRESS' } } },
            },
        });

        if (activeSprint) {
            await prisma.project.update({
                where: { id: projectId },
                data: { status: 'IN_PROGRESS' },
            });
        }
    } catch (e) {
        console.error('syncProjectStatus error:', e);
    }
}

// GET /api/projects/:projectId/sprints
router.get('/projects/:projectId/sprints', authenticate, async (req, res) => {
    try {
        // Auto-completa sprints vencidas antes de retornar
        await autoCompleteOverdueSprints(req.params.projectId);

        const sprints = await prisma.sprint.findMany({
            where: { projectId: req.params.projectId },
            include: { _count: { select: { tasks: true } } },
            orderBy: { startDate: 'desc' },
        });

        res.json({ success: true, data: sprints });
    } catch (error) {
        console.error('List sprints error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// GET /api/sprints/:id
router.get('/:id', authenticate, async (req, res) => {
    try {
        const sprint = await prisma.sprint.findUnique({
            where: { id: req.params.id },
            include: {
                project: { select: { id: true, code: true, name: true } },
                _count: { select: { tasks: true } },
            },
        });

        if (!sprint) {
            return res.status(404).json({ success: false, message: 'Sprint não encontrada' });
        }

        // Auto-completa sprints vencidas deste projeto
        await autoCompleteOverdueSprints(sprint.projectId);

        // Busca tasks da sprint via junction
        const sprintTasks = await prisma.sprintTask.findMany({
            where: { sprintId: req.params.id },
            include: {
                task: {
                    include: {
                        assignees: {
                            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
                        },
                        _count: { select: { comments: true, attachments: true, subtasks: true } },
                    },
                },
            },
            orderBy: { task: { position: 'asc' } },
        });

        const result = {
            ...sprint,
            tasks: sprintTasks.map((st) => st.task),
        };

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Get sprint error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// POST /api/projects/:projectId/sprints
router.post('/projects/:projectId/sprints', authenticate, authorize('sprints', 'create'), async (req: AuthRequest, res) => {
    try {
        const { name, goal, startDate, endDate, capacityPts } = req.body;

        if (!name || !startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'Nome, data início e data fim são obrigatórios' });
        }

        const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
        if (!project) {
            return res.status(404).json({ success: false, message: 'Projeto não encontrado' });
        }

        const sprint = await prisma.sprint.create({
            data: {
                projectId: req.params.projectId,
                name,
                goal: goal || null,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                capacityPts: capacityPts || null,
            },
            include: { _count: { select: { tasks: true } } },
        });

        await createAuditLog(req, 'CREATE', 'sprints', sprint.id, null, { name, projectId: req.params.projectId });

        res.status(201).json({ success: true, data: sprint });
    } catch (error) {
        console.error('Create sprint error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// PUT /api/sprints/:id
router.put('/:id', authenticate, authorize('sprints', 'update'), async (req: AuthRequest, res) => {
    try {
        const { name, goal, startDate, endDate, capacityPts } = req.body;

        const existing = await prisma.sprint.findUnique({ where: { id: req.params.id } });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Sprint não encontrada' });
        }

        const data: any = {};
        if (name) data.name = name;
        if (goal !== undefined) data.goal = goal;
        if (startDate) data.startDate = new Date(startDate);
        if (endDate) data.endDate = new Date(endDate);
        if (capacityPts !== undefined) data.capacityPts = capacityPts;

        const sprint = await prisma.sprint.update({
            where: { id: req.params.id },
            data,
            include: { _count: { select: { tasks: true } } },
        });

        await createAuditLog(req, 'UPDATE', 'sprints', sprint.id, existing, data);

        res.json({ success: true, data: sprint });
    } catch (error) {
        console.error('Update sprint error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// PATCH /api/sprints/:id/status
router.patch('/:id/status', authenticate, authorize('sprints', 'update'), async (req: AuthRequest, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Status inválido' });
        }

        const existing = await prisma.sprint.findUnique({ where: { id: req.params.id } });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Sprint não encontrada' });
        }

        // Apenas uma sprint ativa por projeto
        if (status === 'ACTIVE') {
            const activeSprint = await prisma.sprint.findFirst({
                where: { projectId: existing.projectId, status: 'ACTIVE', id: { not: req.params.id } },
            });
            if (activeSprint) {
                return res.status(400).json({ success: false, message: 'Já existe uma sprint ativa neste projeto' });
            }
        }

        const sprint = await prisma.sprint.update({
            where: { id: req.params.id },
            data: { status },
        });

        await createAuditLog(req, 'UPDATE_STATUS', 'sprints', sprint.id, { status: existing.status }, { status });

        // Ao ativar sprint, verifica se projeto deve ir para IN_PROGRESS
        if (status === 'ACTIVE') {
            await syncProjectStatus(existing.projectId);
        }

        res.json({ success: true, data: sprint });
    } catch (error) {
        console.error('Update sprint status error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// POST /api/sprints/:id/carry-over
router.post('/:id/carry-over', authenticate, authorize('sprints', 'update'), async (req: AuthRequest, res) => {
    try {
        const { targetSprintId } = req.body; // null = backlog

        const sprint = await prisma.sprint.findUnique({ where: { id: req.params.id } });
        if (!sprint) {
            return res.status(404).json({ success: false, message: 'Sprint não encontrada' });
        }

        // Tasks incompletas desta sprint
        const incompleteTasks = await prisma.sprintTask.findMany({
            where: {
                sprintId: req.params.id,
                task: { status: { notIn: ['DONE'] } },
            },
            select: { taskId: true },
        });

        // Remove tasks incompletas da sprint atual
        if (incompleteTasks.length > 0) {
            await prisma.sprintTask.deleteMany({
                where: {
                    sprintId: req.params.id,
                    taskId: { in: incompleteTasks.map((t) => t.taskId) },
                },
            });
        }

        // Adiciona à sprint destino (se informado)
        if (targetSprintId && incompleteTasks.length > 0) {
            await prisma.sprintTask.createMany({
                data: incompleteTasks.map(({ taskId }) => ({ sprintId: targetSprintId, taskId })),
                skipDuplicates: true,
            });
        }
        // Se targetSprintId = null, tasks ficam sem sprint (backlog)

        await createAuditLog(req, 'CARRY_OVER', 'sprints', sprint.id, null, {
            movedTasks: incompleteTasks.length,
            targetSprintId,
        });

        res.json({
            success: true,
            data: { movedTasks: incompleteTasks.length },
            message: `${incompleteTasks.length} task(s) movida(s) com sucesso`,
        });
    } catch (error) {
        console.error('Carry over error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// DELETE /api/sprints/:id
router.delete('/:id', authenticate, authorize('sprints', 'delete'), async (req: AuthRequest, res) => {
    try {
        const sprint = await prisma.sprint.findUnique({ where: { id: req.params.id } });
        if (!sprint) {
            return res.status(404).json({ success: false, message: 'Sprint não encontrada' });
        }

        // SprintTask será deletado por CASCADE ao deletar sprint
        await prisma.sprint.delete({ where: { id: sprint.id } });

        await createAuditLog(req, 'DELETE', 'sprints', sprint.id, sprint, null);

        res.json({ success: true, message: 'Sprint excluída com sucesso (Tasks movidas para o Backlog)' });
    } catch (error) {
        console.error('Delete sprint error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

export default router;
