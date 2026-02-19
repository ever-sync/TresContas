import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
}
const JWT_SECRET = process.env.JWT_SECRET!;

type UserRole = 'admin' | 'collaborator' | 'client';

type TokenPayload = {
    userId?: string;
    accountingId?: string;
    role?: UserRole;
    id?: string;
    clientId?: string;
};

export interface AuthRequest extends Request {
    userId?: string;
    accountingId?: string;
    clientId?: string;
    role?: UserRole;
}

const getToken = (req: Request) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) return null;
    return token;
};

/**
 * Middleware for admin/collaborator users (accounting staff).
 */
export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = getToken(req);
    if (!token) {
        return res.status(401).json({ message: 'Token não fornecido' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
        const role = decoded.role ?? 'admin';

        if (role !== 'admin' && role !== 'collaborator') {
            return res.status(403).json({ message: 'Acesso negado' });
        }

        req.role = role;
        req.userId = decoded.userId || decoded.id;
        req.accountingId = decoded.accountingId;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token inválido' });
    }
};

/**
 * Middleware factory that restricts access to specific roles.
 * Usage: requireRole('admin') or requireRole('admin', 'collaborator')
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        const token = getToken(req);
        if (!token) {
            return res.status(401).json({ message: 'Token não fornecido' });
        }

        try {
            const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
            const role = decoded.role ?? 'admin';

            if (!allowedRoles.includes(role)) {
                return res.status(403).json({ message: 'Acesso negado. Permissão insuficiente.' });
            }

            req.role = role;

            if (role === 'client') {
                req.clientId = decoded.clientId || decoded.id;
                req.accountingId = decoded.accountingId;
            } else {
                req.userId = decoded.userId || decoded.id;
                req.accountingId = decoded.accountingId;
            }

            next();
        } catch (error) {
            return res.status(401).json({ message: 'Token inválido' });
        }
    };
};

/**
 * Middleware for client portal access only.
 */
export const authClientMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = getToken(req);
    if (!token) {
        return res.status(401).json({ message: 'Token não fornecido' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
        if (decoded.role !== 'client') {
            return res.status(403).json({ message: 'Acesso negado' });
        }
        req.role = 'client';
        req.clientId = decoded.clientId || decoded.id;
        req.accountingId = decoded.accountingId;
        if (!req.clientId) {
            return res.status(401).json({ message: 'Token inválido' });
        }
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token inválido' });
    }
};
