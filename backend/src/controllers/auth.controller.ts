import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { securityConfig } from '../config/security';
import { AppError, sendErrorResponse } from '../lib/http';
import {
    assertMinimumLength,
    assertValidEmail,
    normalizeDigits,
    normalizeEmail,
    toOptionalTrimmedString,
    toTrimmedString,
} from '../lib/validation';
import {
    createAuthSession,
    findSessionById,
    findSessionByRefreshToken,
    revokeAuthSessionById,
    revokeAuthSessionsByClientId,
    revokeAuthSessionsByUserId,
    rotateAuthSession,
} from '../lib/authSessions';
import {
    clearAuthCookies,
    getAccessTokenForAudience,
    getRefreshTokenForAudience,
    setAuthCookies,
} from '../lib/authCookies';
import { verifyAccessToken, type AuthRole } from '../lib/authTokens';
import {
    buildActionTokenLink,
    consumeAccountActionToken,
    createAccountActionToken,
    findAccountActionTokenByToken,
} from '../lib/accountActionTokens';
import { recordAuditEvent } from '../lib/auditEvents';
import type { AuthRequest } from '../middlewares/auth.middleware';

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
}

const getRawPassword = (value: unknown) => (typeof value === 'string' ? value : '');

const staffUserSelect = {
    id: true,
    name: true,
    email: true,
    role: true,
    status: true,
    phone: true,
    avatar_url: true,
    accounting_id: true,
    created_at: true,
    updated_at: true,
};

const clientSelect = {
    id: true,
    name: true,
    cnpj: true,
    email: true,
    status: true,
    accounting_id: true,
    representative_email: true,
    created_at: true,
    updated_at: true,
};

const buildStaffAuthResponse = (
    user: {
        id: string;
        name: string;
        email: string;
        role: string;
        accounting_id: string;
    },
    accounting: {
        id: string;
        name: string;
        cnpj: string;
    },
    accessExpiresAt: string
) => ({
    expires_at: accessExpiresAt,
    user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        accountingId: accounting.id,
        accountingName: accounting.name,
        cnpj: accounting.cnpj,
    },
});

const buildClientAuthResponse = (
    client: {
        id: string;
        name: string;
        cnpj: string;
        email: string | null;
    },
    accessExpiresAt: string
) => ({
    expires_at: accessExpiresAt,
    client: {
        id: client.id,
        name: client.name,
        cnpj: client.cnpj,
        email: client.email,
    },
});

const getRequestSession = async (req: Request, audience: 'staff' | 'client') => {
    const refreshToken = getRefreshTokenForAudience(req, audience);
    if (refreshToken) {
        return findSessionByRefreshToken(refreshToken);
    }

    const accessToken = getAccessTokenForAudience(req, audience);
    if (!accessToken) {
        return null;
    }

    try {
        const payload = verifyAccessToken(accessToken);
        if (payload.subjectType !== audience) {
            return null;
        }

        return findSessionById(payload.sessionId);
    } catch {
        return null;
    }
};

const clearAudienceCookies = (res: Response, audience: 'staff' | 'client') => {
    clearAuthCookies(res, audience);
};

const revokeAudienceSession = async (req: Request, audience: 'staff' | 'client') => {
    const session = await getRequestSession(req, audience);
    if (!session) {
        return;
    }

    await revokeAuthSessionById(session.id);
};

const setAudienceSession = async (
    req: Request,
    res: Response,
    audience: 'staff' | 'client',
    subject: {
        role: AuthRole;
        accountingId: string;
        userId?: string;
        clientId?: string;
    }
) => {
    const session = await createAuthSession({
        subjectType: audience,
        role: subject.role,
        accountingId: subject.accountingId,
        userId: subject.userId,
        clientId: subject.clientId,
        request: req,
    });

    setAuthCookies(res, audience, session.accessToken, session.refreshToken);

    return session;
};

export const register = async (req: Request, res: Response) => {
    try {
        const name = toTrimmedString(req.body?.name);
        const cnpj = normalizeDigits(toTrimmedString(req.body?.cnpj));
        const email = normalizeEmail(req.body?.email);
        const rawPhone = toOptionalTrimmedString(req.body?.phone);
        const password = getRawPassword(req.body?.password);
        const phone = rawPhone ? normalizeDigits(rawPhone) : null;

        if (!name || !cnpj || !email || !password) {
            throw new AppError(400, 'Nome, CNPJ, email e senha sao obrigatorios');
        }

        assertValidEmail(email);

        if (phone && phone.length < 10) {
            throw new AppError(400, 'Telefone invalido');
        }

        assertMinimumLength(password, 8, 'Senha deve ter pelo menos 8 caracteres');

        const existingAccounting = await prisma.accounting.findFirst({
            where: {
                OR: [{ email }, { cnpj }],
            },
        });

        if (existingAccounting) {
            throw new AppError(400, 'Email ou CNPJ ja cadastrado');
        }

        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            throw new AppError(400, 'Email ja cadastrado');
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const result = await prisma.$transaction(async (tx) => {
            const accounting = await tx.accounting.create({
                data: {
                    name,
                    cnpj,
                    email,
                    phone,
                    plan: 'free',
                },
            });

            const user = await tx.user.create({
                data: {
                    accounting_id: accounting.id,
                    name,
                    email,
                    password_hash: hashedPassword,
                    role: 'admin',
                    status: 'active',
                    phone,
                },
            });

            return { accounting, user };
        });

        const session = await setAudienceSession(
            req,
            res,
            'staff',
            {
                role: result.user.role as AuthRole,
                accountingId: result.accounting.id,
                userId: result.user.id,
            }
        );

        await recordAuditEvent({
            action: 'auth.register',
            entityType: 'accounting',
            entityId: result.accounting.id,
            accountingId: result.accounting.id,
            actorId: result.user.id,
            actorRole: result.user.role,
            request: req,
            metadata: {
                userId: result.user.id,
            },
        });

        res.status(201).json({
            ...buildStaffAuthResponse(result.user, result.accounting, session.accessExpiresAt),
        });
    } catch (error: unknown) {
        if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
            return res.status(400).json({ message: 'Email ou CNPJ ja cadastrado no banco' });
        }

        return sendErrorResponse(res, error, 'Erro ao realizar cadastro no servidor');
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const email = normalizeEmail(req.body?.email);
        const password = getRawPassword(req.body?.password);

        if (!email || !password) {
            throw new AppError(400, 'Email e senha sao obrigatorios');
        }

        assertValidEmail(email);

        const user = await prisma.user.findUnique({
            where: { email },
            include: { accounting: true },
        });

        if (!user) {
            throw new AppError(401, 'Credenciais invalidas');
        }

        if (user.status !== 'active') {
            throw new AppError(403, 'Conta inativa. Contate o administrador.');
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            throw new AppError(401, 'Credenciais invalidas');
        }

        const session = await setAudienceSession(req, res, 'staff', {
            role: user.role as AuthRole,
            accountingId: user.accounting_id,
            userId: user.id,
        });

        await recordAuditEvent({
            action: 'auth.login',
            entityType: 'user',
            entityId: user.id,
            accountingId: user.accounting_id,
            actorId: user.id,
            actorRole: user.role,
            request: req,
        });

        res.json({
            ...buildStaffAuthResponse(user, user.accounting, session.accessExpiresAt),
        });
    } catch (error) {
        return sendErrorResponse(res, error, 'Erro ao realizar login no servidor');
    }
};

export const me = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.userId || !req.accountingId) {
            throw new AppError(401, 'Nao autorizado');
        }

        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            include: { accounting: true },
        });

        if (!user || user.accounting_id !== req.accountingId) {
            throw new AppError(401, 'Sessao invalida');
        }

        if (user.status !== 'active') {
            await revokeAuthSessionById(req.authSessionId || '');
            throw new AppError(403, 'Conta inativa. Contate o administrador.');
        }

        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            accountingId: user.accounting.id,
            accountingName: user.accounting.name,
            cnpj: user.accounting.cnpj,
        });
    } catch (error) {
        return sendErrorResponse(res, error, 'Erro ao buscar sessao');
    }
};

export const refresh = async (req: Request, res: Response) => {
    try {
        const refreshToken = getRefreshTokenForAudience(req, 'staff');
        if (!refreshToken) {
            throw new AppError(401, 'Sessao nao encontrada');
        }

        const session = await findSessionByRefreshToken(refreshToken);
        if (!session || session.subject_type !== 'staff' || session.revoked_at || session.expires_at <= new Date()) {
            throw new AppError(401, 'Sessao invalida');
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user_id || '' },
            include: { accounting: true },
        });

        if (!user || user.status !== 'active' || user.accounting_id !== session.accounting_id) {
            await revokeAuthSessionById(session.id);
            throw new AppError(403, 'Conta inativa. Contate o administrador.');
        }

        const nextSession = await rotateAuthSession({
            subjectType: 'staff',
            role: session.role as AuthRole,
            accountingId: session.accounting_id,
            userId: session.user_id || undefined,
            request: req,
            refreshToken,
        });

        if (!nextSession) {
            throw new AppError(401, 'Sessao invalida');
        }

        setAuthCookies(res, 'staff', nextSession.accessToken, nextSession.refreshToken);

        res.json({
            expires_at: nextSession.accessExpiresAt,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                accountingId: user.accounting.id,
                accountingName: user.accounting.name,
                cnpj: user.accounting.cnpj,
            },
        });
    } catch (error) {
        return sendErrorResponse(res, error, 'Erro ao atualizar sessao');
    }
};

export const logout = async (req: Request, res: Response) => {
    try {
        await revokeAudienceSession(req, 'staff');
        clearAudienceCookies(res, 'staff');
        await recordAuditEvent({
            action: 'auth.logout',
            entityType: 'session',
            entityId: req instanceof Object && 'authSessionId' in req ? (req as AuthRequest).authSessionId || null : null,
            accountingId: (req as AuthRequest).accountingId,
            actorId: (req as AuthRequest).userId,
            actorRole: (req as AuthRequest).role,
            request: req,
        });
        res.status(204).send();
    } catch (error) {
        return sendErrorResponse(res, error, 'Erro ao encerrar sessao');
    }
};

export const forgotPassword = async (req: Request, res: Response) => {
    try {
        const email = normalizeEmail(req.body?.email);
        if (!email) {
            throw new AppError(400, 'Email é obrigatório');
        }

        assertValidEmail(email);

        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                email: true,
                accounting_id: true,
            },
        });

        const client = user
            ? null
            : await prisma.client.findFirst({
                where: {
                    OR: [
                        { email },
                        { representative_email: email },
                    ],
                },
                select: {
                    id: true,
                    email: true,
                    accounting_id: true,
                },
            });

        let debugToken: string | null = null;

        if (user) {
            const token = await createAccountActionToken({
                purpose: 'forgot_password',
                subjectType: 'staff',
                accountingId: user.accounting_id,
                userId: user.id,
                email: user.email,
                request: req,
            });

            debugToken = token.token;
            await recordAuditEvent({
                action: 'auth.forgot_password',
                entityType: 'account_action_token',
                entityId: token.id,
                accountingId: user.accounting_id,
                request: req,
                metadata: { subjectType: 'staff' },
            });
        } else if (client) {
            const token = await createAccountActionToken({
                purpose: 'forgot_password',
                subjectType: 'client',
                accountingId: client.accounting_id,
                clientId: client.id,
                email: client.email,
                request: req,
            });

            debugToken = token.token;
            await recordAuditEvent({
                action: 'auth.forgot_password',
                entityType: 'account_action_token',
                entityId: token.id,
                accountingId: client.accounting_id,
                clientId: client.id,
                request: req,
                metadata: { subjectType: 'client' },
            });
        }

        res.json({
            message: 'Se existir uma conta associada, voce recebera instrucoes para redefinir a senha.',
            ...(debugToken && !securityConfig.isProduction
                ? {
                    debug_token: debugToken,
                    debug_link: buildActionTokenLink('/reset-password', debugToken),
                }
                : {}),
        });
    } catch (error) {
        return sendErrorResponse(res, error, 'Erro ao solicitar redefinicao de senha');
    }
};

export const resetPassword = async (req: Request, res: Response) => {
    try {
        const token = toTrimmedString(req.body?.token);
        const password = getRawPassword(req.body?.password);

        if (!token || !password) {
            throw new AppError(400, 'Token e senha sao obrigatorios');
        }

        assertMinimumLength(password, 8, 'Senha deve ter pelo menos 8 caracteres');

        const actionToken = await findAccountActionTokenByToken(token);
        if (!actionToken || actionToken.purpose !== 'forgot_password' || actionToken.used_at || actionToken.expires_at <= new Date()) {
            throw new AppError(400, 'Token invalido ou expirado');
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        if (actionToken.subject_type === 'staff') {
            if (!actionToken.user_id || !actionToken.accounting_id) {
                throw new AppError(400, 'Token invalido');
            }

            const updatedUser = await prisma.user.update({
                where: { id: actionToken.user_id },
                data: {
                    password_hash: hashedPassword,
                    status: 'active',
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    accounting_id: true,
                    accounting: true,
                },
            });

            await revokeAuthSessionsByUserId(updatedUser.id);
            await consumeAccountActionToken(token);

            await recordAuditEvent({
                action: 'auth.reset_password',
                entityType: 'user',
                entityId: updatedUser.id,
                accountingId: updatedUser.accounting_id,
                request: req,
                metadata: { subjectType: 'staff' },
            });

            res.json({ message: 'Senha atualizada com sucesso.' });
            return;
        }

        if (!actionToken.client_id || !actionToken.accounting_id) {
            throw new AppError(400, 'Token invalido');
        }

        const updatedClient = await prisma.client.update({
            where: { id: actionToken.client_id },
            data: {
                password_hash: hashedPassword,
                status: 'active',
            },
            select: {
                id: true,
                name: true,
                cnpj: true,
                email: true,
                accounting_id: true,
            },
        });

        await revokeAuthSessionsByClientId(updatedClient.id);
        await consumeAccountActionToken(token);

        await recordAuditEvent({
            action: 'auth.reset_password',
            entityType: 'client',
            entityId: updatedClient.id,
            accountingId: updatedClient.accounting_id,
            clientId: updatedClient.id,
            request: req,
            metadata: { subjectType: 'client' },
        });

        res.json({ message: 'Senha atualizada com sucesso.' });
    } catch (error) {
        return sendErrorResponse(res, error, 'Erro ao redefinir senha');
    }
};

export const acceptInvite = async (req: Request, res: Response) => {
    try {
        const token = toTrimmedString(req.body?.token);
        const password = getRawPassword(req.body?.password);

        if (!token || !password) {
            throw new AppError(400, 'Token e senha sao obrigatorios');
        }

        assertMinimumLength(password, 8, 'Senha deve ter pelo menos 8 caracteres');

        const inviteToken = await findAccountActionTokenByToken(token);
        if (!inviteToken || inviteToken.purpose !== 'invite' || inviteToken.used_at || inviteToken.expires_at <= new Date()) {
            throw new AppError(400, 'Token invalido ou expirado');
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        if (inviteToken.subject_type === 'client') {
            if (!inviteToken.client_id || !inviteToken.accounting_id) {
                throw new AppError(400, 'Token invalido');
            }

            const client = await prisma.client.update({
                where: { id: inviteToken.client_id },
                data: {
                    password_hash: hashedPassword,
                    status: 'active',
                },
                select: clientSelect,
            });

            await revokeAuthSessionsByClientId(client.id);
            const session = await setAudienceSession(req, res, 'client', {
                role: 'client',
                clientId: client.id,
                accountingId: client.accounting_id,
            });
            await consumeAccountActionToken(token);

            await recordAuditEvent({
                action: 'auth.accept_invite',
                entityType: 'client',
                entityId: client.id,
                accountingId: client.accounting_id,
                clientId: client.id,
                request: req,
                metadata: { subjectType: 'client' },
            });

            res.json({
                ...buildClientAuthResponse(client, session.accessExpiresAt),
            });
            return;
        }

        if (!inviteToken.user_id || !inviteToken.accounting_id) {
            throw new AppError(400, 'Token invalido');
        }

        const user = await prisma.user.update({
            where: { id: inviteToken.user_id },
            data: {
                password_hash: hashedPassword,
                status: 'active',
            },
            include: { accounting: true },
        });

        await revokeAuthSessionsByUserId(user.id);
        const session = await setAudienceSession(req, res, 'staff', {
            role: user.role as AuthRole,
            accountingId: user.accounting_id,
            userId: user.id,
        });
        await consumeAccountActionToken(token);

        await recordAuditEvent({
            action: 'auth.accept_invite',
            entityType: 'user',
            entityId: user.id,
            accountingId: user.accounting_id,
            request: req,
            metadata: { subjectType: 'staff' },
        });

        res.json({
            ...buildStaffAuthResponse(user, user.accounting, session.accessExpiresAt),
        });
    } catch (error) {
        return sendErrorResponse(res, error, 'Erro ao aceitar convite');
    }
};

export const clientLogin = async (req: Request, res: Response) => {
    try {
        const clientId = toTrimmedString(req.body?.client_id);
        const email = normalizeEmail(req.body?.email);
        const cnpj = normalizeDigits(toTrimmedString(req.body?.cnpj));
        const password = getRawPassword(req.body?.password);

        if ((!email && !cnpj) || !password) {
            throw new AppError(400, 'Email/CNPJ e senha sao obrigatorios');
        }

        const emailMatchesClient = (client: {
            email: string | null;
            representative_email: string | null;
        }) => !email || client.email === email || client.representative_email === email;

        let client = null as null | {
            id: string;
            accounting_id: string;
            name: string;
            cnpj: string;
            email: string | null;
            status: string;
            password_hash: string | null;
            representative_email: string | null;
        };

        if (clientId) {
            const requestedClient = await prisma.client.findUnique({
                where: { id: clientId },
            });

            if (!requestedClient || (cnpj && requestedClient.cnpj !== cnpj) || !emailMatchesClient(requestedClient)) {
                throw new AppError(401, 'Credenciais invalidas');
            }

            client = requestedClient;
        } else if (cnpj) {
            const requestedClient = await prisma.client.findUnique({
                where: { cnpj },
            });

            if (!requestedClient || !emailMatchesClient(requestedClient)) {
                throw new AppError(401, 'Credenciais invalidas');
            }

            client = requestedClient;
        } else {
            assertValidEmail(email);

            const matchedClients = await prisma.client.findMany({
                where: {
                    OR: [{ representative_email: email }, { email }],
                },
                take: 2,
                orderBy: { created_at: 'asc' },
            });

            if (matchedClients.length > 1) {
                throw new AppError(409, 'Mais de um cliente encontrado para este email. Informe tambem o CNPJ.');
            }

            client = matchedClients[0] || null;
        }

        if (!client) {
            throw new AppError(401, 'Credenciais invalidas');
        }

        if (!client.password_hash) {
            throw new AppError(401, 'Senha nao configurada. Solicite o acesso a sua contabilidade.');
        }

        if (client.status !== 'active') {
            throw new AppError(403, 'Conta inativa. Contate sua contabilidade.');
        }

        const isPasswordValid = await bcrypt.compare(password, client.password_hash);

        if (!isPasswordValid) {
            throw new AppError(401, 'Credenciais invalidas');
        }

        const session = await setAudienceSession(req, res, 'client', {
            role: 'client',
            clientId: client.id,
            accountingId: client.accounting_id,
        });

        await recordAuditEvent({
            action: 'client.auth.login',
            entityType: 'client',
            entityId: client.id,
            accountingId: client.accounting_id,
            clientId: client.id,
            request: req,
        });

        res.json({
            ...buildClientAuthResponse(client, session.accessExpiresAt),
        });
    } catch (error) {
        return sendErrorResponse(res, error, 'Erro ao realizar login do cliente');
    }
};

export const clientMe = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.clientId) {
            throw new AppError(401, 'Nao autorizado');
        }

        const client = await prisma.client.findUnique({
            where: { id: req.clientId },
            select: clientSelect,
        });

        if (!client) {
            throw new AppError(404, 'Cliente nao encontrado');
        }

        res.json(client);
    } catch (error) {
        return sendErrorResponse(res, error, 'Erro ao buscar dados do cliente');
    }
};

export const clientRefresh = async (req: Request, res: Response) => {
    try {
        const refreshToken = getRefreshTokenForAudience(req, 'client');
        if (!refreshToken) {
            throw new AppError(401, 'Sessao nao encontrada');
        }

        const session = await findSessionByRefreshToken(refreshToken);
        if (!session || session.subject_type !== 'client' || session.revoked_at || session.expires_at <= new Date()) {
            throw new AppError(401, 'Sessao invalida');
        }

        const client = await prisma.client.findUnique({
            where: { id: session.client_id || '' },
            select: clientSelect,
        });

        if (!client || client.status !== 'active' || client.accounting_id !== session.accounting_id) {
            await revokeAuthSessionById(session.id);
            throw new AppError(403, 'Conta inativa. Contate sua contabilidade.');
        }

        const nextSession = await rotateAuthSession({
            subjectType: 'client',
            role: 'client',
            clientId: session.client_id || undefined,
            accountingId: session.accounting_id,
            request: req,
            refreshToken,
        });

        if (!nextSession) {
            throw new AppError(401, 'Sessao invalida');
        }

        setAuthCookies(res, 'client', nextSession.accessToken, nextSession.refreshToken);

        res.json({
            expires_at: nextSession.accessExpiresAt,
            client: {
                id: client.id,
                name: client.name,
                cnpj: client.cnpj,
                email: client.email,
            },
        });
    } catch (error) {
        return sendErrorResponse(res, error, 'Erro ao atualizar sessao do cliente');
    }
};

export const clientLogout = async (req: Request, res: Response) => {
    try {
        await revokeAudienceSession(req, 'client');
        clearAudienceCookies(res, 'client');
        await recordAuditEvent({
            action: 'client.auth.logout',
            entityType: 'session',
            entityId: (req as AuthRequest).authSessionId || null,
            accountingId: (req as AuthRequest).accountingId,
            clientId: (req as AuthRequest).clientId,
            actorId: (req as AuthRequest).clientId,
            actorRole: 'client',
            request: req,
        });
        res.status(204).send();
    } catch (error) {
        return sendErrorResponse(res, error, 'Erro ao encerrar sessao do cliente');
    }
};
