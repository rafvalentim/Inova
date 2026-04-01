import prisma from '../config/database';
import { Response } from 'express';

/**
 * Retorna 422 se o projeto estiver CANCELLED.
 * Uso: if (await rejectIfCancelled(projectId, res)) return;
 */
export async function rejectIfCancelled(projectId: string, res: Response): Promise<boolean> {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { status: true },
    });
    if (project?.status === 'CANCELLED') {
        res.status(422).json({
            success: false,
            message: 'Não é permitido modificar um projeto cancelado.',
        });
        return true;
    }
    return false;
}
