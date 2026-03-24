import type { NextFunction, Request, Response } from 'express';
import { isAppError } from '../lib/http';

export const notFoundHandler = (req: Request, res: Response) => {
    res.status(404).json({ message: `Rota não encontrada: ${req.originalUrl}` });
};

export const errorHandler = (
    error: unknown,
    req: Request,
    res: Response,
    _next: NextFunction
) => {
    const status = isAppError(error) ? error.status : 500;
    const message = isAppError(error) ? error.message : 'Erro interno do servidor';
    const requestId = res.locals.requestId || 'unknown';

    console.error(
        JSON.stringify({
            type: 'request_error',
            requestId,
            method: req.method,
            path: req.originalUrl,
            status,
            message,
        })
    );

    if (res.headersSent) {
        return;
    }

    res.status(status).json({ message });
};
