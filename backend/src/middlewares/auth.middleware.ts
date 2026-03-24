import { Request, Response, NextFunction } from 'express';
import { getAccessTokenForAudience, type AuthAudience } from '../lib/authCookies';
import { verifyAccessToken, type AccessTokenPayload } from '../lib/authTokens';

export type UserRole = 'admin' | 'collaborator' | 'client';

export interface AuthRequest extends Request {
    userId?: string;
    accountingId?: string;
    clientId?: string;
    role?: UserRole;
    authSessionId?: string;
    authAudience?: AuthAudience;
}

const getPayloadFromRequest = (
    req: Request,
    audience: AuthAudience
): AccessTokenPayload | null => {
    const token = getAccessTokenForAudience(req, audience);
    if (!token) {
        return null;
    }

    try {
        const payload = verifyAccessToken(token);
        if (payload.subjectType !== audience) {
            return null;
        }

        return payload;
    } catch {
        return null;
    }
};

const applyPayload = (req: AuthRequest, payload: AccessTokenPayload) => {
    req.role = payload.role;
    req.accountingId = payload.accountingId;
    req.authSessionId = payload.sessionId;
    req.authAudience = payload.subjectType;

    if (payload.subjectType === 'client') {
        req.clientId = payload.clientId;
        req.userId = undefined;
    } else {
        req.userId = payload.userId;
        req.clientId = undefined;
    }
};

const resolveAllowedPayload = (
    req: Request,
    allowedRoles: readonly UserRole[]
): AccessTokenPayload | null => {
    const audiences: AuthAudience[] =
        allowedRoles.includes('client') && allowedRoles.some((role) => role !== 'client')
            ? ['staff', 'client']
            : allowedRoles.includes('client')
                ? ['client', 'staff']
                : ['staff', 'client'];

    for (const audience of audiences) {
        const payload = getPayloadFromRequest(req, audience);
        if (!payload) {
            continue;
        }

        if (!allowedRoles.includes(payload.role as UserRole)) {
            continue;
        }

        return payload;
    }

    return null;
};

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    const payload = getPayloadFromRequest(req, 'staff');
    if (!payload) {
        return res.status(401).json({ message: 'Token nao fornecido' });
    }

    if (payload.role === 'client') {
        return res.status(403).json({ message: 'Acesso negado' });
    }

    applyPayload(req, payload);
    next();
};

export const requireRole = (...allowedRoles: UserRole[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        const payload = resolveAllowedPayload(req, allowedRoles);
        if (!payload) {
            return res.status(401).json({ message: 'Token nao fornecido' });
        }

        if (!allowedRoles.includes(payload.role as UserRole)) {
            return res.status(403).json({ message: 'Acesso negado. Permissao insuficiente.' });
        }

        applyPayload(req, payload);
        next();
    };
};

export const authClientMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    const payload = getPayloadFromRequest(req, 'client');
    if (!payload) {
        return res.status(401).json({ message: 'Token nao fornecido' });
    }

    if (payload.role !== 'client') {
        return res.status(403).json({ message: 'Acesso negado' });
    }

    applyPayload(req, payload);
    next();
};
