import type { Response } from 'express';

export class AppError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'AppError';
        this.status = status;
    }
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError;

export const sendErrorResponse = (
    res: Response,
    error: unknown,
    fallbackMessage = 'Erro interno do servidor'
) => {
    if (isAppError(error)) {
        return res.status(error.status).json({ message: error.message });
    }

    console.error('Unhandled controller error:', error);
    return res.status(500).json({ message: fallbackMessage });
};
