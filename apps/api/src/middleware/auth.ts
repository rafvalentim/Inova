import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import prisma from '../config/database';

export interface AuthRequest extends Request {
    userId?: string;
    userRole?: string;
    userPermissions?: Record<string, string[]>;
}

interface JwtPayload {
    userId: string;
    role: string;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        // Prioriza cookie httpOnly (RNF-008); aceita Bearer como fallback (dev/tooling)
        const cookieToken = req.cookies?.accessToken;
        const authHeader = req.headers.authorization;
        const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
        const token = cookieToken || bearerToken;

        if (!token) {
            return res.status(401).json({ success: false, message: 'Token não fornecido' });
        }
        const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            include: { role: true },
        });

        if (!user || user.status !== 'ACTIVE') {
            return res.status(401).json({ success: false, message: 'Usuário não encontrado ou inativo' });
        }

        req.userId = user.id;
        req.userRole = user.role.name;
        req.userPermissions = user.role.permissions as Record<string, string[]>;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Token inválido ou expirado' });
    }
};

export const authorize = (resource: string, action: string) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        const permissions = req.userPermissions;
        if (!permissions) {
            return res.status(403).json({ success: false, message: 'Permissões não encontradas' });
        }

        // Administrador tem acesso total
        if (req.userRole === 'Administrador') {
            return next();
        }

        const resourcePermissions = permissions[resource];
        if (!resourcePermissions || !resourcePermissions.includes(action)) {
            return res.status(403).json({ success: false, message: 'Sem permissão para esta ação' });
        }

        next();
    };
};
