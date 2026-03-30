import prisma from '../config/database';
import { AuthRequest } from './auth';

export const createAuditLog = async (
    req: AuthRequest,
    action: string,
    resource: string,
    resourceId?: string,
    oldValue?: unknown,
    newValue?: unknown
) => {
    try {
        if (!req.userId) return;
        await prisma.auditLog.create({
            data: {
                userId: req.userId,
                action,
                resource,
                resourceId: resourceId || null,
                oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
                newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
                ipAddress: req.ip || req.socket.remoteAddress || null,
            },
        });
    } catch (error) {
        console.error('Erro ao criar audit log:', error);
    }
};
