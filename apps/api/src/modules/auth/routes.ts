import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../config/database';
import { config } from '../../config';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { createAuditLog } from '../../middleware/auditLog';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email e senha são obrigatórios' });
        }

        const user = await prisma.user.findUnique({
            where: { email },
            include: { role: true },
        });

        if (!user) {
            return res.status(401).json({ success: false, message: 'Credenciais inválidas' });
        }

        // Check if account is locked
        if (user.lockedUntil && user.lockedUntil > new Date()) {
            return res.status(423).json({
                success: false,
                message: 'Conta bloqueada. Tente novamente em 15 minutos.',
            });
        }

        // Check if user is inactive
        if (user.status === 'INACTIVE') {
            return res.status(401).json({ success: false, message: 'Conta desativada' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            // Increment failed attempts
            const failedAttempts = user.failedAttempts + 1;
            const updateData: any = { failedAttempts };

            if (failedAttempts >= config.maxLoginAttempts) {
                updateData.lockedUntil = new Date(Date.now() + config.lockoutDurationMinutes * 60 * 1000);
                updateData.status = 'BLOCKED';
            }

            await prisma.user.update({ where: { id: user.id }, data: updateData });

            // Audit log - login failure
            await prisma.auditLog.create({
                data: {
                    userId: user.id,
                    action: 'LOGIN_FAILED',
                    resource: 'auth',
                    ipAddress: req.ip || req.socket.remoteAddress || null,
                },
            });

            return res.status(401).json({ success: false, message: 'Credenciais inválidas' });
        }

        // Reset failed attempts on successful login
        await prisma.user.update({
            where: { id: user.id },
            data: { failedAttempts: 0, lockedUntil: null, status: user.status === 'BLOCKED' ? 'ACTIVE' : user.status },
        });

        // Generate tokens
        const accessToken = jwt.sign(
            { userId: user.id, role: user.role.name },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn as any }
        );

        const refreshTokenValue = uuidv4();
        const refreshExpiresAt = new Date();
        refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7);

        await prisma.refreshToken.create({
            data: {
                token: refreshTokenValue,
                userId: user.id,
                expiresAt: refreshExpiresAt,
            },
        });

        // Audit log - login success
        await prisma.auditLog.create({
            data: {
                userId: user.id,
                action: 'LOGIN_SUCCESS',
                resource: 'auth',
                ipAddress: req.ip || req.socket.remoteAddress || null,
            },
        });

        // Armazenar tokens em httpOnly cookies (RNF-008)
        const isProduction = config.nodeEnv === 'production';

        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: isProduction,       // HTTPS only em produção
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000,     // 15 minutos (igual ao JWT)
            path: '/',
        });

        res.cookie('refreshToken', refreshTokenValue, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
            path: '/api/auth',          // Restringir ao endpoint de refresh
        });

        res.json({
            success: true,
            data: {
                // accessToken retorna no body para armazenamento em memória (não em localStorage)
                // refreshToken fica apenas no httpOnly cookie (RNF-008)
                accessToken,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    avatarUrl: user.avatarUrl,
                    status: user.status,
                    firstLogin: user.firstLogin,
                    role: {
                        id: user.role.id,
                        name: user.role.name,
                        permissions: user.role.permissions,
                    },
                },
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
    try {
        // Aceita token do cookie httpOnly (produção) ou do body (compatibilidade/dev)
        const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({ success: false, message: 'Refresh token não encontrado' });
        }

        const storedToken = await prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: { include: { role: true } } },
        });

        if (!storedToken || storedToken.expiresAt < new Date()) {
            if (storedToken) {
                await prisma.refreshToken.delete({ where: { id: storedToken.id } });
            }
            // Limpar cookies inválidos
            res.clearCookie('accessToken');
            res.clearCookie('refreshToken', { path: '/api/auth' });
            return res.status(401).json({ success: false, message: 'Refresh token inválido ou expirado' });
        }

        const user = storedToken.user;
        if (user.status !== 'ACTIVE') {
            return res.status(401).json({ success: false, message: 'Usuário inativo' });
        }

        // Gerar novo access token
        const accessToken = jwt.sign(
            { userId: user.id, role: user.role.name },
            config.jwt.secret,
            { expiresIn: config.jwt.expiresIn as any }
        );

        // Rotacionar refresh token
        const newRefreshToken = uuidv4();
        const newExpiresAt = new Date();
        newExpiresAt.setDate(newExpiresAt.getDate() + 7);

        await prisma.refreshToken.update({
            where: { id: storedToken.id },
            data: { token: newRefreshToken, expiresAt: newExpiresAt },
        });

        const isProduction = config.nodeEnv === 'production';

        // Atualizar cookies com novos tokens
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000,
            path: '/',
        });

        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/api/auth',
        });

        res.json({
            success: true,
            data: {
                // accessToken retorna no body para atualização em memória no frontend
                // refreshToken rotacionado está no novo httpOnly cookie
                accessToken,
            },
        });
    } catch (error) {
        console.error('Refresh error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req: AuthRequest, res) => {
    try {
        // Invalida todos os refresh tokens do usuário no banco
        await prisma.refreshToken.deleteMany({ where: { userId: req.userId } });

        await createAuditLog(req, 'LOGOUT', 'auth');

        // Limpar cookies httpOnly no cliente
        res.clearCookie('accessToken', { path: '/' });
        res.clearCookie('refreshToken', { path: '/api/auth' });

        res.json({ success: true, message: 'Logout realizado com sucesso' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        // Always return success (don't reveal if email exists)
        const genericMessage = 'Se o email estiver cadastrado, você receberá um link de recuperação.';

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email é obrigatório' });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (user) {
            const token = uuidv4();
            await prisma.passwordResetToken.create({
                data: {
                    token,
                    email,
                    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
                },
            });

            // In a real app, send email here
            console.log(`[DEV] Password reset token for ${email}: ${token}`);
        }

        res.json({ success: true, message: genericMessage });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ success: false, message: 'Token e nova senha são obrigatórios' });
        }

        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'A senha deve ter pelo menos 8 caracteres' });
        }

        const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } });

        if (!resetToken || resetToken.used || resetToken.expiresAt < new Date()) {
            return res.status(400).json({ success: false, message: 'Token inválido ou expirado' });
        }

        const hashedPassword = await bcrypt.hash(password, config.bcryptRounds);

        await prisma.user.update({
            where: { email: resetToken.email },
            data: { password: hashedPassword, failedAttempts: 0, lockedUntil: null, status: 'ACTIVE' },
        });

        await prisma.passwordResetToken.update({
            where: { id: resetToken.id },
            data: { used: true },
        });

        res.json({ success: true, message: 'Senha alterada com sucesso' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

// PUT /api/auth/change-password
router.put('/change-password', authenticate, async (req: AuthRequest, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Senha atual e nova senha são obrigatórias' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, message: 'A nova senha deve ter pelo menos 8 caracteres' });
        }

        const user = await prisma.user.findUnique({ where: { id: req.userId } });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }

        const isCurrentValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentValid) {
            return res.status(400).json({ success: false, message: 'Senha atual incorreta' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, config.bcryptRounds);
        await prisma.user.update({
            where: { id: req.userId },
            data: { password: hashedPassword, firstLogin: false },
        });

        await createAuditLog(req, 'CHANGE_PASSWORD', 'users', req.userId);

        res.json({ success: true, message: 'Senha alterada com sucesso' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, message: 'Erro interno do servidor' });
    }
});

export default router;
