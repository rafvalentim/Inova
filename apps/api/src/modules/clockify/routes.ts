import { Router } from 'express';
import cron from 'node-cron';
import prisma from '../../config/database';
import { authenticate, authorize, AuthRequest } from '../../middleware/auth';
import { createAuditLog } from '../../middleware/auditLog';

const router = Router();

// ===== HELPERS =====

/** Parse ISO 8601 duration (PT1H30M) para minutos */
function parseDuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    return hours * 60 + minutes;
}

/**
 * Motor de sincronização com o Clockify.
 * Busca time entries dos últimos N dias e vincula ao task pelo campo `code` (TASK-001).
 * Retorna { synced, errors }.
 */
export async function runClockifySync(cfg: { id: string; apiKey: string; workspaceId: string }, lookbackDays = 1): Promise<{ synced: number; errors: number }> {
    const start = new Date();
    start.setDate(start.getDate() - lookbackDays);
    const startISO = start.toISOString();

    const url = `https://api.clockify.me/api/v1/workspaces/${cfg.workspaceId}/time-entries?start=${startISO}&page-size=200`;

    const response = await fetch(url, {
        headers: {
            'X-Api-Key': cfg.apiKey,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Clockify API retornou ${response.status}`);
    }

    const entries: any[] = (await response.json()) as any[];
    let synced = 0;
    let errors = 0;

    for (const entry of entries) {
        try {
            // Evita duplicatas (idempotente via clockifyId unique)
            const alreadyExists = await prisma.timeEntry.findUnique({
                where: { clockifyId: entry.id },
            });
            if (alreadyExists) continue;

            // Extrai o code da task (TASK-001) da descrição — P0-2 fix
            const match = entry.description?.match(/\bTASK-(\d+)\b/i);
            if (!match) continue;
            const taskCode = `TASK-${match[1].padStart(3, '0')}`;

            // Busca task pelo campo code (não mais por UUID)
            const task = await prisma.task.findFirst({
                where: { code: taskCode },
            });
            if (!task) continue;

            // Busca usuário pelo clockifyId
            const user = await prisma.user.findFirst({
                where: { clockifyId: entry.userId },
            });
            if (!user) continue;

            const duration = entry.timeInterval?.duration
                ? parseDuration(entry.timeInterval.duration)
                : 0;
            if (duration === 0) continue;

            await prisma.timeEntry.create({
                data: {
                    taskId: task.id,
                    userId: user.id,
                    durationMin: duration,
                    description: entry.description || null,
                    source: 'CLOCKIFY',
                    clockifyId: entry.id,
                    date: new Date(entry.timeInterval?.start || new Date()),
                },
            });
            synced++;
        } catch (entryError) {
            console.error(`[Clockify Sync] Erro ao processar entry ${entry.id}:`, entryError);
            errors++;
        }
    }

    return { synced, errors };
}

// ===== CRON JOB — sync automático a cada 15 minutos (P0-3) =====
// Roda somente se houver configuração ativa
cron.schedule('*/15 * * * *', async () => {
    console.log('[Clockify Cron] Iniciando sync automático...');
    try {
        const cfg = await prisma.clockifyConfig.findFirst();
        if (!cfg) {
            console.log('[Clockify Cron] Sem configuração. Pulando.');
            return;
        }

        await prisma.clockifyConfig.update({
            where: { id: cfg.id },
            data: { syncStatus: 'SYNCING' },
        });

        const { synced, errors } = await runClockifySync(cfg, 1); // lookback: último 1 dia

        await prisma.clockifyConfig.update({
            where: { id: cfg.id },
            data: {
                syncStatus: errors > 0 && synced === 0 ? 'ERROR' : 'SUCCESS',
                lastSyncAt: new Date(),
            },
        });

        console.log(`[Clockify Cron] Concluído — ${synced} sincronizadas, ${errors} erros.`);
    } catch (err) {
        console.error('[Clockify Cron] Falha no sync automático:', err);
        try {
            const cfg = await prisma.clockifyConfig.findFirst();
            if (cfg) {
                await prisma.clockifyConfig.update({
                    where: { id: cfg.id },
                    data: { syncStatus: 'ERROR', lastSyncAt: new Date() },
                });
            }
        } catch (_) { /* silencioso */ }
    }
});

// ===== ROUTES =====

// GET /api/clockify/config
router.get('/config', authenticate, authorize('clockify', 'read'), async (_req, res) => {
    try {
        const cfg = await prisma.clockifyConfig.findFirst();
        res.json({
            success: true,
            data: cfg
                ? {
                    workspaceId: cfg.workspaceId,
                    lastSyncAt: cfg.lastSyncAt,
                    syncStatus: cfg.syncStatus,
                    hasApiKey: !!cfg.apiKey,
                }
                : null,
        });
    } catch (error) {
        console.error('Get clockify config error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// PUT /api/clockify/config
router.put('/config', authenticate, authorize('clockify', 'update'), async (req: AuthRequest, res) => {
    try {
        const { apiKey, workspaceId } = req.body;

        if (!apiKey || !workspaceId) {
            return res.status(400).json({ success: false, message: 'API Key e Workspace ID são obrigatórios' });
        }

        const existing = await prisma.clockifyConfig.findFirst();

        let cfg;
        if (existing) {
            cfg = await prisma.clockifyConfig.update({
                where: { id: existing.id },
                data: { apiKey, workspaceId },
            });
        } else {
            cfg = await prisma.clockifyConfig.create({
                data: { apiKey, workspaceId },
            });
        }

        await createAuditLog(req, 'UPDATE', 'clockify_config', cfg.id);

        res.json({
            success: true,
            data: {
                workspaceId: cfg.workspaceId,
                lastSyncAt: cfg.lastSyncAt,
                syncStatus: cfg.syncStatus,
                hasApiKey: true,
            },
        });
    } catch (error) {
        console.error('Update clockify config error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// POST /api/clockify/sync  — trigger manual
router.post('/sync', authenticate, authorize('clockify', 'update'), async (req: AuthRequest, res) => {
    try {
        const cfg = await prisma.clockifyConfig.findFirst();
        if (!cfg) {
            return res.status(400).json({ success: false, message: 'Clockify não configurado' });
        }

        await prisma.clockifyConfig.update({
            where: { id: cfg.id },
            data: { syncStatus: 'SYNCING', lastSyncAt: new Date() },
        });

        try {
            // lookback de 7 dias no sync manual (mais abrangente que o automático)
            const { synced, errors } = await runClockifySync(cfg, 7);

            const finalStatus = errors > 0 && synced === 0 ? 'ERROR' : 'SUCCESS';
            await prisma.clockifyConfig.update({
                where: { id: cfg.id },
                data: { syncStatus: finalStatus, lastSyncAt: new Date() },
            });

            res.json({
                success: true,
                data: { syncedEntries: synced, errors },
                message: `${synced} entrada(s) sincronizada(s)${errors > 0 ? `, ${errors} erro(s)` : ''}`,
            });
        } catch (apiError: any) {
            await prisma.clockifyConfig.update({
                where: { id: cfg.id },
                data: { syncStatus: 'ERROR' },
            });

            const isNetworkError = apiError?.message?.includes('Clockify API retornou');
            res.status(isNetworkError ? 502 : 500).json({
                success: false,
                message: isNetworkError
                    ? 'Erro ao conectar com Clockify API. Verifique API Key e Workspace ID.'
                    : 'Clockify indisponível. Use o registro manual de horas.',
            });
        }
    } catch (error) {
        console.error('Clockify sync error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// GET /api/clockify/status
router.get('/status', authenticate, async (_req, res) => {
    try {
        const cfg = await prisma.clockifyConfig.findFirst();
        res.json({
            success: true,
            data: cfg
                ? { lastSyncAt: cfg.lastSyncAt, syncStatus: cfg.syncStatus }
                : { lastSyncAt: null, syncStatus: 'NOT_CONFIGURED' },
        });
    } catch (error) {
        console.error('Clockify status error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

export default router;
