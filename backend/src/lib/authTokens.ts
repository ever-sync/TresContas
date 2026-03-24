import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { securityConfig } from '../config/security';

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
}

const JWT_SECRET = process.env.JWT_SECRET;

export type AuthAudience = 'staff' | 'client';
export type AuthRole = 'admin' | 'collaborator' | 'client';

export interface AccessTokenPayload {
    sessionId: string;
    subjectType: AuthAudience;
    role: AuthRole;
    userId?: string;
    clientId?: string;
    accountingId: string;
}

export const signAccessToken = (payload: AccessTokenPayload) =>
    jwt.sign(payload, JWT_SECRET, { expiresIn: securityConfig.authAccessTtl as jwt.SignOptions['expiresIn'] });

export const verifyAccessToken = (token: string) => jwt.verify(token, JWT_SECRET) as AccessTokenPayload;

export const createRefreshToken = () => crypto.randomBytes(48).toString('hex');

export const hashToken = (token: string) =>
    crypto.createHash('sha256').update(token).digest('hex');

export const getTokenExpiryIsoString = (token: string) => {
    const decoded = jwt.decode(token);

    if (!decoded || typeof decoded === 'string' || typeof decoded.exp !== 'number') {
        throw new Error('Unable to determine JWT expiration.');
    }

    return new Date(decoded.exp * 1000).toISOString();
};
