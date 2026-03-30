import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

export const config = {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

    database: {
        url: process.env.DATABASE_URL || 'postgresql://inova:inova123@localhost:5432/inova',
    },

    jwt: {
        secret: process.env.JWT_SECRET || 'dev-secret-change-me',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me',
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },

    upload: {
        dir: process.env.UPLOAD_DIR || './uploads',
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
    },

    smtp: {
        host: process.env.SMTP_HOST || '',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.SMTP_FROM || 'noreply@inova.local',
    },

    clockify: {
        apiKey: process.env.CLOCKIFY_API_KEY || '',
        workspaceId: process.env.CLOCKIFY_WORKSPACE_ID || '',
    },

    bcryptRounds: 12,
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 15,
    rateLimit: {
        windowMs: 60 * 1000,
        max: 100,
    },
};
