import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
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

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = securityConfig.jwtExpiresIn as jwt.SignOptions['expiresIn'];

const getRawPassword = (value: unknown) => (typeof value === 'string' ? value : '');

const signAccessToken = (payload: object) =>
    jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

const getTokenExpiryIsoString = (token: string) => {
    const decoded = jwt.decode(token);

    if (!decoded || typeof decoded === 'string' || typeof decoded.exp !== 'number') {
        throw new Error('Unable to determine JWT expiration.');
    }

    return new Date(decoded.exp * 1000).toISOString();
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
            throw new AppError(400, 'Nome, CNPJ, email e senha são obrigatórios');
        }

        assertValidEmail(email);

        if (phone && phone.length < 10) {
            throw new AppError(400, 'Telefone inválido');
        }

        assertMinimumLength(password, 8, 'Senha deve ter pelo menos 8 caracteres');

        const existingAccounting = await prisma.accounting.findFirst({
            where: {
                OR: [{ email }, { cnpj }],
            },
        });

        if (existingAccounting) {
            throw new AppError(400, 'Email ou CNPJ já cadastrado');
        }

        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            throw new AppError(400, 'Email já cadastrado');
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

        const token = signAccessToken({
            userId: result.user.id,
            accountingId: result.accounting.id,
            role: result.user.role,
        });

        res.status(201).json({
            token,
            expires_at: getTokenExpiryIsoString(token),
            user: {
                id: result.user.id,
                name: result.user.name,
                email: result.user.email,
                role: result.user.role,
                accountingId: result.accounting.id,
                accountingName: result.accounting.name,
                cnpj: result.accounting.cnpj,
            },
        });
    } catch (error: unknown) {
        if (typeof error === 'object' && error && 'code' in error && error.code === 'P2002') {
            return res.status(400).json({ message: 'Email ou CNPJ já cadastrado no banco' });
        }

        return sendErrorResponse(res, error, 'Erro ao realizar cadastro no servidor');
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const email = normalizeEmail(req.body?.email);
        const password = getRawPassword(req.body?.password);

        if (!email || !password) {
            throw new AppError(400, 'Email e senha são obrigatórios');
        }

        assertValidEmail(email);

        const user = await prisma.user.findUnique({
            where: { email },
            include: { accounting: true },
        });

        if (!user) {
            throw new AppError(401, 'Credenciais inválidas');
        }

        if (user.status !== 'active') {
            throw new AppError(403, 'Conta inativa. Contate o administrador.');
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            throw new AppError(401, 'Credenciais inválidas');
        }

        const token = signAccessToken({
            userId: user.id,
            accountingId: user.accounting_id,
            role: user.role,
        });

        res.json({
            token,
            expires_at: getTokenExpiryIsoString(token),
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                accountingId: user.accounting_id,
                accountingName: user.accounting.name,
                cnpj: user.accounting.cnpj,
            },
        });
    } catch (error) {
        return sendErrorResponse(res, error, 'Erro ao realizar login no servidor');
    }
};

export const clientLogin = async (req: Request, res: Response) => {
    try {
        const clientId = toTrimmedString(req.body?.client_id);
        const email = normalizeEmail(req.body?.email);
        const cnpj = normalizeDigits(toTrimmedString(req.body?.cnpj));
        const password = getRawPassword(req.body?.password);

        if ((!email && !cnpj) || !password) {
            throw new AppError(400, 'Email/CNPJ e senha são obrigatórios');
        }

        const emailMatchesClient = (client: {
            email: string | null;
            representative_email: string | null;
        }) => !email || client.email === email || client.representative_email === email;

        let client = null;

        if (clientId) {
            const requestedClient = await prisma.client.findUnique({
                where: { id: clientId },
            });

            if (!requestedClient || (cnpj && requestedClient.cnpj !== cnpj) || !emailMatchesClient(requestedClient)) {
                throw new AppError(401, 'Credenciais inválidas');
            }

            client = requestedClient;
        } else if (cnpj) {
            const requestedClient = await prisma.client.findUnique({
                where: { cnpj },
            });

            if (!requestedClient || !emailMatchesClient(requestedClient)) {
                throw new AppError(401, 'Credenciais inválidas');
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
                throw new AppError(409, 'Mais de um cliente encontrado para este email. Informe também o CNPJ.');
            }

            client = matchedClients[0] || null;
        }

        if (!client) {
            throw new AppError(401, 'Credenciais inválidas');
        }

        if (!client.password_hash) {
            throw new AppError(401, 'Senha não configurada. Solicite o acesso à sua contabilidade.');
        }

        if (client.status !== 'active') {
            throw new AppError(403, 'Conta inativa. Contate sua contabilidade.');
        }

        const isPasswordValid = await bcrypt.compare(password, client.password_hash);

        if (!isPasswordValid) {
            throw new AppError(401, 'Credenciais inválidas');
        }

        const token = signAccessToken({
            role: 'client',
            clientId: client.id,
            accountingId: client.accounting_id,
        });

        res.json({
            token,
            expires_at: getTokenExpiryIsoString(token),
            client: {
                id: client.id,
                name: client.name,
                email: client.email,
                cnpj: client.cnpj,
                status: client.status,
                accounting_id: client.accounting_id,
            },
        });
    } catch (error) {
        return sendErrorResponse(res, error, 'Erro ao realizar login do cliente');
    }
};
