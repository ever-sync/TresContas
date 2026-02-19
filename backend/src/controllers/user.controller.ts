import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';

const isNonEmptyString = (value: unknown) =>
    typeof value === 'string' && value.trim().length > 0;

const isValidEmail = (value: string) => value.includes('@') && value.includes('.');

const isValidRole = (value: string) => ['admin', 'collaborator'].includes(value);

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

/**
 * List all users (team members) of the accounting firm.
 * Accessible by: admin, collaborator
 */
export const getUsers = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const users = await prisma.user.findMany({
            where: { accounting_id: req.accountingId },
            orderBy: [{ role: 'asc' }, { name: 'asc' }],
            select: userSelect,
        });

        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Erro ao buscar usuários', error: String(error) });
    }
};

/**
 * Get a single user by ID.
 * Accessible by: admin, collaborator
 */
export const getUserById = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const { id } = req.params;
        const user = await prisma.user.findFirst({
            where: {
                id: String(id),
                accounting_id: req.accountingId,
            },
            select: userSelect,
        });

        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ message: 'Erro ao buscar usuário' });
    }
};

/**
 * Create a new collaborator/admin user.
 * Accessible by: admin only
 */
export const createUser = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const name = isNonEmptyString(req.body?.name) ? req.body.name.trim() : '';
        const email = isNonEmptyString(req.body?.email) ? req.body.email.trim().toLowerCase() : '';
        const password = isNonEmptyString(req.body?.password) ? req.body.password : '';
        const role = isNonEmptyString(req.body?.role) ? req.body.role.trim() : 'collaborator';
        const phone = isNonEmptyString(req.body?.phone) ? req.body.phone.trim() : null;

        const errors: string[] = [];

        if (!name) errors.push('Nome é obrigatório');
        if (!email) errors.push('Email é obrigatório');
        if (!password) errors.push('Senha é obrigatória');
        if (email && !isValidEmail(email)) errors.push('Email inválido');
        if (!isValidRole(role)) errors.push('Papel inválido (admin ou collaborator)');
        if (password && password.length < 8) errors.push('Senha deve ter pelo menos 8 caracteres');

        if (errors.length > 0) {
            return res.status(400).json({ message: errors[0], errors });
        }

        // Check if email already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return res.status(400).json({ message: 'Email já cadastrado' });
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
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return res.status(400).json({ message: 'Email já cadastrado' });
        }
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Erro ao criar usuário' });
    }
};

/**
 * Update an existing user.
 * Accessible by: admin only
 */
export const updateUser = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const { id } = req.params;

        // Verify user belongs to same accounting
        const existingUser = await prisma.user.findFirst({
            where: { id: String(id), accounting_id: req.accountingId },
        });

        if (!existingUser) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        const data: Prisma.UserUpdateInput = {};

        if (req.body.name !== undefined) data.name = req.body.name;
        if (req.body.email !== undefined) data.email = req.body.email.toLowerCase();
        if (req.body.role !== undefined && isValidRole(req.body.role)) data.role = req.body.role;
        if (req.body.status !== undefined) data.status = req.body.status;
        if (req.body.phone !== undefined) data.phone = req.body.phone;

        // If password is being changed
        if (isNonEmptyString(req.body?.password)) {
            if (req.body.password.length < 8) {
                return res.status(400).json({ message: 'Senha deve ter pelo menos 8 caracteres' });
            }
            data.password_hash = await bcrypt.hash(req.body.password, 12);
        }

        const updatedUser = await prisma.user.update({
            where: { id: String(id) },
            data,
            select: userSelect,
        });

        res.json(updatedUser);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return res.status(400).json({ message: 'Email já cadastrado' });
        }
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Erro ao atualizar usuário' });
    }
};

/**
 * Delete a user.
 * Accessible by: admin only
 * Admin cannot delete themselves.
 */
export const deleteUser = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const { id } = req.params;

        // Prevent self-deletion
        if (id === req.userId) {
            return res.status(400).json({ message: 'Você não pode excluir sua própria conta' });
        }

        const result = await prisma.user.deleteMany({
            where: {
                id: String(id),
                accounting_id: req.accountingId,
            },
        });

        if (result.count === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        res.status(204).send();
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Erro ao excluir usuário' });
    }
};
