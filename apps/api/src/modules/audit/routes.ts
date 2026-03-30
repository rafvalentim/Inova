import { Router } from 'express';
import prisma from '../../config/database';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';

const router = Router();

// GET /api/audit-logs
router.get('/', authenticate, authorize('audit_logs', 'read'), async (req: AuthRequest, res) => {
    try {
        const { userId, action, resource, startDate, endDate, page = '1', pageSize = '50' } = req.query;
        const skip = (parseInt(page as string) - 1) * parseInt(pageSize as string);
        const take = parseInt(pageSize as string);

        const where: any = {};
        if (userId) where.userId = userId;
        if (action) where.action = { contains: action as string, mode: 'insensitive' };
        if (resource) where.resource = resource;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate as string);
            if (endDate) where.createdAt.lte = new Date(endDate as string);
        }

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                include: { user: { select: { id: true, name: true } } },
                skip,
                take,
                orderBy: { createdAt: 'desc' },
            }),
            prisma.auditLog.count({ where }),
        ]);

        res.json({
            success: true,
            data: {
                items: logs,
                total,
                page: parseInt(page as string),
                pageSize: take,
                totalPages: Math.ceil(total / take),
            },
        });
    } catch (error) {
        console.error('List audit logs error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

export default router;
