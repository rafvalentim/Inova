import { Router } from 'express';
import prisma from '../../config/database';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';

const router = Router();

// GET /api/reports/sprint/:id
router.get('/sprint/:id', authenticate, authorize('reports', 'read'), async (req, res) => {
    try {
        const sprint = await prisma.sprint.findUnique({
            where: { id: req.params.id },
            include: {
                project: { select: { id: true, code: true, name: true } },
                tasks: {
                    include: {
                        assignees: {
                            include: { user: { select: { id: true, name: true } } },
                        },
                        timeEntries: true,
                    },
                },
            },
        });

        if (!sprint) {
            return res.status(404).json({ success: false, message: 'Sprint não encontrada' });
        }

        const totalTasks = sprint.tasks.length;
        const tasksByStatus: Record<string, number> = {};
        let totalHours = 0;
        let totalStoryPoints = 0;

        sprint.tasks.forEach((task) => {
            tasksByStatus[task.status] = (tasksByStatus[task.status] || 0) + 1;
            totalStoryPoints += task.storyPoints || 0;
            task.timeEntries.forEach((entry) => {
                totalHours += entry.durationMin / 60;
            });
        });

        res.json({
            success: true,
            data: {
                sprint: {
                    id: sprint.id,
                    name: sprint.name,
                    goal: sprint.goal,
                    startDate: sprint.startDate,
                    endDate: sprint.endDate,
                    status: sprint.status,
                },
                project: sprint.project,
                metrics: {
                    totalTasks,
                    tasksByStatus,
                    totalHours: Math.round(totalHours * 100) / 100,
                    totalStoryPoints,
                    completionRate: totalTasks > 0
                        ? Math.round(((tasksByStatus['DONE'] || 0) / totalTasks) * 100)
                        : 0,
                },
                tasks: sprint.tasks.map((t) => ({
                    id: t.id,
                    title: t.title,
                    status: t.status,
                    priority: t.priority,
                    storyPoints: t.storyPoints,
                    assignees: t.assignees.map((a) => a.user.name),
                    hoursLogged: t.timeEntries.reduce((sum, e) => sum + e.durationMin, 0) / 60,
                })),
            },
        });
    } catch (error) {
        console.error('Sprint report error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// GET /api/reports/project/:id
router.get('/project/:id', authenticate, authorize('reports', 'read'), async (req, res) => {
    try {
        const project = await prisma.project.findUnique({
            where: { id: req.params.id },
            include: {
                members: {
                    include: { user: { select: { id: true, name: true } } },
                },
                sprints: {
                    include: { _count: { select: { tasks: true } } },
                },
                tasks: {
                    include: { timeEntries: true },
                },
            },
        });

        if (!project) {
            return res.status(404).json({ success: false, message: 'Projeto não encontrado' });
        }

        const totalTasks = project.tasks.length;
        const tasksByStatus: Record<string, number> = {};
        let totalHours = 0;

        project.tasks.forEach((task) => {
            tasksByStatus[task.status] = (tasksByStatus[task.status] || 0) + 1;
            task.timeEntries.forEach((entry) => {
                totalHours += entry.durationMin / 60;
            });
        });

        res.json({
            success: true,
            data: {
                project: {
                    id: project.id,
                    code: project.code,
                    name: project.name,
                    description: project.description,
                    status: project.status,
                    startDate: project.startDate,
                    targetDate: project.targetDate,
                },
                team: project.members.map((m) => ({
                    name: m.user.name,
                    roleInProject: m.roleInProject,
                })),
                metrics: {
                    totalSprints: project.sprints.length,
                    totalTasks,
                    tasksByStatus,
                    totalHours: Math.round(totalHours * 100) / 100,
                    completionRate: totalTasks > 0
                        ? Math.round(((tasksByStatus['DONE'] || 0) / totalTasks) * 100)
                        : 0,
                },
                sprints: project.sprints.map((s) => ({
                    id: s.id,
                    name: s.name,
                    status: s.status,
                    startDate: s.startDate,
                    endDate: s.endDate,
                    taskCount: s._count.tasks,
                })),
            },
        });
    } catch (error) {
        console.error('Project report error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// GET /api/reports/hours
router.get('/hours', authenticate, authorize('reports', 'read'), async (req, res) => {
    try {
        const { userId, startDate, endDate } = req.query;

        const where: any = {};
        if (userId) where.userId = userId;
        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = new Date(startDate as string);
            if (endDate) where.date.lte = new Date(endDate as string);
        }

        const entries = await prisma.timeEntry.findMany({
            where,
            include: {
                user: { select: { id: true, name: true } },
                task: { select: { id: true, title: true, project: { select: { code: true, name: true } } } },
            },
            orderBy: { date: 'desc' },
        });

        // Group by user
        const byUser: Record<string, { name: string; totalMinutes: number; entries: any[] }> = {};
        entries.forEach((e) => {
            if (!byUser[e.userId]) {
                byUser[e.userId] = { name: e.user.name, totalMinutes: 0, entries: [] };
            }
            byUser[e.userId].totalMinutes += e.durationMin;
            byUser[e.userId].entries.push({
                date: e.date,
                durationMin: e.durationMin,
                task: e.task.title,
                project: e.task.project.name,
                source: e.source,
            });
        });

        res.json({
            success: true,
            data: Object.entries(byUser).map(([userId, data]) => ({
                userId,
                ...data,
                totalHours: Math.round((data.totalMinutes / 60) * 100) / 100,
            })),
        });
    } catch (error) {
        console.error('Hours report error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

export default router;
