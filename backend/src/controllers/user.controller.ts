import { Response } from 'express';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError, sendErrorResponse } from '../lib/http';
import {
    assertMinimumLength,
    assertOneOf,
    assertValidEmail,
    normalizeEmail,
    toOptionalTrimmedString,
    toTrimmedString,
} from '../lib/validation';

const VALID_ROLES = ['admin', 'collaborator'] as const;
const VALID_USER_STATUSES = ['active', 'invited', 'inactive'] as const;

const userSelect = {
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

export const getUsers = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            throw new AppError(401, 'Não autorizado');
        }

        const users = await prisma.user.findMany({
            where: { accounting_id: req.accountingId },
            orderBy: [{ role: 'asc' }, { name: 'asc' }],
            select: userSelect,
        });

        res.json(users);
    } catch (error) {
        return sendErrorResponse(res, error, 'Erro ao buscar usuários');
    }
};

export const getUserById = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            throw new AppError(401, 'Não autorizado');
        }

        const user = await prisma.user.findFirst({
            where: {
                id: String(req.params.id),
                accounting_id: req.accountingId,
            },
            select: userSelect,
        });

        if (!user) {
            throw new AppError(404, 'Usuário não encontrado');
        }

        res.json(user);
    } catch (error) {
        return sendErrorResponse(res, error, 'Erro ao buscar usuário');
    }
};

export const createUser = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            throw new AppError(401, 'Não autorizado');
        }

        const name = toTrimmedString(req.body?.name);
        const email = normalizeEmail(req.body?.email);
        const password = typeof req.body?.password === 'string' ? req.body.password : '';
        const role = toTrimmedString(req.body?.role) || 'collaborator';
        const phone = toOptionalTrimmedString(req.body?.phone);

        if (!name) {
            throw new AppError(400, 'Nome é obrigatório');
        }

        if (!email) {
            throw new AppError(400, 'Email é obrigatório');
        }

        if (!password) {
            throw new AppError(400, 'Senha é obrigatória');
        }

        assertValidEmail(email);
        assertOneOf(role, VALID_ROLES, 'Papel inválido (admin ou collaborator)');
        assertMinimumLength(password, 8, 'Senha deve ter pelo menos 8 caracteres');

        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            throw new AppError(400, 'Email já cadastrado');
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await prisma.user.create({
            data: {
                accounting_id: req.accountingId,
                name,
                email,
                password_hash: hashedPassword,
                role,
                status: 'active',
                phone,
            },
            select: userSelect,
        });

        res.status(201).json(user);
    } catch (error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return res.status(400).json({ message: 'Email já cadastrado' });
        }

        return sendErrorResponse(res, error, 'Erro ao criar usuário');
    }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            throw new AppError(401, 'Não autorizado');
        }

        const id = String(req.params.id);
        const existingUser = await prisma.user.findFirst({
            where: { id, accounting_id: req.accountingId },
        });

        if (!existingUser) {
            throw new AppError(404, 'Usuário não encontrado');
        }

        const data: Record<string, unknown> = {};

        if (req.body.name !== undefined) {
            const name = toTrimmedString(req.body.name);
            if (!name) {
                throw new AppError(400, 'Nome é obrigatório');
            }
            data.name = name;
        }

        if (req.body.email !== undefined) {
            const email = normalizeEmail(req.body.email);
            if (!email) {
                throw new AppError(400, 'Email é obrigatório');
            }
            assertValidEmail(email);
            data.email = email;
        }

        if (req.body.role !== undefined) {
            data.role = assertOneOf(
                toTrimmedString(req.body.role),
                VALID_ROLES,
                'Papel inválido (admin ou collaborator)'
            );
        }

        if (req.body.status !== undefined) {
            data.status = assertOneOf(
                toTrimmedString(req.body.status),
                VALID_USER_STATUSES,
                'Status inválido'
            );
        }

        if (req.body.phone !== undefined) {
            data.phone = toOptionalTrimmedString(req.body.phone);
        }

        if (req.body.password !== undefined) {
            const password = typeof req.body.password === 'string' ? req.body.password : '';
            assertMinimumLength(password, 8, 'Senha deve ter pelo menos 8 caracteres');
            data.password_hash = await bcrypt.hash(password, 12);
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data,
            select: userSelect,
        });

        res.json(updatedUser);
    } catch (error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return res.status(400).json({ message: 'Email já cadastrado' });
        }

        return sendErrorResponse(res, error, 'Erro ao atualizar usuário');
    }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            throw new AppError(401, 'Não autorizado');
        }

        const id = String(req.params.id);

        if (id === req.userId) {
            throw new AppError(400, 'Você não pode excluir sua própria conta');
        }

        const result = await prisma.user.deleteMany({
            where: {
                id,
                accounting_id: req.accountingId,
            },
        });

        if (result.count === 0) {
            throw new AppError(404, 'Usuário não encontrado');
        }

        res.status(204).send();
    } catch (error) {
        return sendErrorResponse(res, error, 'Erro ao excluir usuário');
    }
};
