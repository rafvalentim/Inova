import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
    statusCode: number;
    isOperational: boolean;

    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
        });
    }

    console.error('Unhandled error:', err);
    return res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
    });
};

export const notFoundHandler = (_req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        message: 'Rota não encontrada',
    });
};
