import { Router } from 'express';
import prisma from '../../config/database';
import { authenticate, AuthRequest } from '../../middleware/auth';

const router = Router();

const buildTaskFilter = (query: any) => {
    const { projectId, sprintId, userId, startDate, endDate } = query;
    const filter: any = {};

    if (projectId) filter.projectId = projectId as string;
    // Many-to-many: filtra por sprint via junction table
    if (sprintId) filter.sprints = { some: { sprintId: sprintId as string } };
    if (userId) filter.assignees = { some: { userId: userId as string } };
    if (startDate || endDate) {
        filter.updatedAt = {};
        if (startDate) filter.updatedAt.gte = new Date(startDate as string);
        if (endDate) filter.updatedAt.lte = new Date(endDate as string);
    }
    return filter;
};

// GET /api/dashboard/summary
router.get('/summary', authenticate, async (req: AuthRequest, res) => {
    try {
        const filters = buildTaskFilter(req.query);

        const projectWhere = req.query.projectId ? { id: req.query.projectId as string } : {};

        // Filtro de tasks DONE no período para somar horas estimadas concluídas
        const doneTaskFilter: any = { ...filters, status: 'DONE' };
        if (req.query.startDate || req.query.endDate) {
            doneTaskFilter.updatedAt = {};
            if (req.query.startDate) doneTaskFilter.updatedAt.gte = new Date(req.query.startDate as string);
            if (req.query.endDate) doneTaskFilter.updatedAt.lte = new Date(req.query.endDate as string);
        } else {
            doneTaskFilter.updatedAt = { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
        }

        const [activeProjects, tasksInProgress, overdueTasks, doneTasksHours] = await Promise.all([
            req.query.projectId
                ? prisma.project.count({ where: { id: req.query.projectId as string, status: 'IN_PROGRESS' } })
                : prisma.project.count({ where: { status: 'IN_PROGRESS' } }),
            prisma.task.count({ where: { ...filters, status: 'IN_PROGRESS' } }),
            prisma.task.count({
                where: {
                    ...filters,
                    status: { notIn: ['DONE'] },
                    dueDate: { lt: new Date() },
                },
            }),
            prisma.task.aggregate({
                where: doneTaskFilter,
                _sum: { estimatedHours: true },
            }),
        ]);

        const hoursThisWeek = doneTasksHours._sum.estimatedHours ?? 0;

        res.json({
            success: true,
            data: {
                activeProjects,
                tasksInProgress,
                overdueTasks,
                hoursThisWeek,
                hoursCapacity: 175,
            },
        });
    } catch (error) {
        console.error('Dashboard summary error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// GET /api/dashboard/projects-progress
router.get('/projects-progress', authenticate, async (req, res) => {
    try {
        const { projectId } = req.query;
        // Sem restrição de status — permite filtrar qualquer projeto
        const projectWhere: any = {};
        if (projectId) {
            projectWhere.id = projectId as string;
        } else {
            // Sem filtro de projeto: mostra apenas IN_PROGRESS e PLANNING
            projectWhere.status = { in: ['IN_PROGRESS', 'PLANNING'] };
        }

        const projects = await prisma.project.findMany({
            where: projectWhere,
            select: {
                id: true,
                name: true,
                code: true,
                totalEstimatedHours: true,
                _count: { select: { tasks: true } },
            },
        });

        const taskFilters = buildTaskFilter(req.query);

        const progress = await Promise.all(
            projects.map(async (p) => {
                const [doneTasks, totalTasksInFilter, doneTasksHours, allTasksHours] = await Promise.all([
                    prisma.task.count({ where: { ...taskFilters, projectId: p.id, status: 'DONE' } }),
                    prisma.task.count({ where: { ...taskFilters, projectId: p.id } }),
                    prisma.task.aggregate({
                        where: { ...taskFilters, projectId: p.id, status: 'DONE' },
                        _sum: { estimatedHours: true },
                    }),
                    prisma.task.aggregate({
                        where: { ...taskFilters, projectId: p.id },
                        _sum: { estimatedHours: true },
                    }),
                ]);

                const denominator = totalTasksInFilter > 0 ? totalTasksInFilter : p._count.tasks;
                const completedHours = doneTasksHours._sum.estimatedHours ?? 0;
                const totalHoursFromTasks = allTasksHours._sum.estimatedHours ?? 0;

                // Progresso por horas: usa totalEstimatedHours do projeto se definido,
                // caso contrário usa soma das estimativas das tasks
                const hoursBase = p.totalEstimatedHours ?? totalHoursFromTasks;
                const hoursPercentage = hoursBase > 0 ? Math.min(100, Math.round((completedHours / hoursBase) * 100)) : 0;

                return {
                    id: p.id,
                    name: p.name,
                    code: p.code,
                    totalTasks: denominator,
                    doneTasks,
                    percentage: denominator > 0 ? Math.round((doneTasks / denominator) * 100) : 0,
                    totalEstimatedHours: p.totalEstimatedHours,
                    completedHours,
                    hoursPercentage,
                };
            })
        );

        res.json({ success: true, data: progress });
    } catch (error) {
        console.error('Projects progress error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// GET /api/dashboard/task-distribution
router.get('/task-distribution', authenticate, async (req, res) => {
    try {
        const filters = buildTaskFilter(req.query);

        const statuses = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const;
        const distribution = await Promise.all(
            statuses.map(async (status) => ({
                status,
                count: await prisma.task.count({ where: { ...filters, status } }),
            }))
        );

        res.json({ success: true, data: distribution });
    } catch (error) {
        console.error('Task distribution error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// GET /api/dashboard/member-workload
router.get('/member-workload', authenticate, async (req, res) => {
    try {
        const { userId, projectId } = req.query;

        let memberIds: string[] | null = null;

        if (projectId) {
            // Filtra apenas membros do projeto selecionado (excluindo Administradores)
            const projectMembers = await prisma.projectMember.findMany({
                where: { projectId: projectId as string },
                include: {
                    user: {
                        include: { role: { select: { name: true } } },
                    },
                },
            });
            memberIds = projectMembers
                .filter((m) => m.user.role.name !== 'Administrador')
                .map((m) => m.userId);

            if (userId) {
                memberIds = memberIds.filter((id) => id === userId);
            }
        }

        const memberWhere: any = {
            status: 'ACTIVE',
            role: { name: { not: 'Administrador' } },
        };
        if (userId) memberWhere.id = userId as string;
        if (memberIds !== null) memberWhere.id = { in: memberIds };

        const members = await prisma.user.findMany({
            where: memberWhere,
            select: { id: true, name: true, avatarUrl: true },
        });

        const taskFilters = buildTaskFilter(req.query);

        const workload = await Promise.all(
            members.map(async (m) => {
                const userTaskFilter = {
                    ...taskFilters,
                    assignees: { some: { userId: m.id } },
                };

                const [totalTasks, completedTasks, overdueTasks] = await Promise.all([
                    prisma.task.count({ where: userTaskFilter }),
                    prisma.task.count({ where: { ...userTaskFilter, status: 'DONE' } }),
                    prisma.task.count({
                        where: {
                            ...userTaskFilter,
                            status: { notIn: ['DONE'] },
                            dueDate: { lt: new Date() },
                        },
                    }),
                ]);

                return {
                    userId: m.id,
                    name: m.name,
                    avatarUrl: m.avatarUrl,
                    totalTasks,
                    completedTasks,
                    overdueTasks,
                };
            })
        );

        const activeWorkload = workload.filter((w) => w.totalTasks > 0);

        res.json({ success: true, data: activeWorkload });
    } catch (error) {
        console.error('Member workload error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

export default router;
