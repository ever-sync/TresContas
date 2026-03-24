import { Response } from 'express';
import { AppError, sendErrorResponse } from '../lib/http';
import { listAuditEvents } from '../lib/auditEvents';
import { AuthRequest } from '../middlewares/auth.middleware';

export const getAuditEvents = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            throw new AppError(401, 'Não autorizado');
        }

        const limit = Number(req.query.limit || 100);
        const offset = Number(req.query.offset || 0);
        const from = typeof req.query.from === 'string' && req.query.from ? new Date(req.query.from) : null;
        const to = typeof req.query.to === 'string' && req.query.to ? new Date(req.query.to) : null;

        const events = await listAuditEvents({
            accountingId: req.accountingId,
            actorId: typeof req.query.actorId === 'string' ? req.query.actorId : null,
            clientId: typeof req.query.clientId === 'string' ? req.query.clientId : null,
            action: typeof req.query.action === 'string' ? req.query.action : null,
            entityType: typeof req.query.entityType === 'string' ? req.query.entityType : null,
            entityId: typeof req.query.entityId === 'string' ? req.query.entityId : null,
            from: from && !Number.isNaN(from.getTime()) ? from : null,
            to: to && !Number.isNaN(to.getTime()) ? to : null,
            limit: Number.isFinite(limit) ? limit : 100,
            offset: Number.isFinite(offset) ? offset : 0,
        });

        res.json(events);
    } catch (error) {
        return sendErrorResponse(res, error, 'Erro ao listar auditoria');
    }
};
