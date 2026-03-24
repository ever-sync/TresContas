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
    normalizeDigits,
    normalizeEmail,
    toOptionalTrimmedString,
    toTrimmedString,
} from '../lib/validation';

const VALID_TAX_REGIMES = ['simples', 'presumido', 'real', 'mei'] as const;
const VALID_CLIENT_STATUSES = ['active', 'inactive'] as const;

const clientSelect = {
    id: true,
    name: true,
    cnpj: true,
    email: true,
    phone: true,
    industry: true,
    address: true,
    status: true,
    tax_regime: true,
    representative_email: true,
    representative_name: true,
    accounting_id: true,
    created_at: true,
    updated_at: true,
};

export const getClients = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            throw new AppError(401, 'Não autorizado');
        }

        const clients = await prisma.client.findMany({
            where: { accounting_id: req.accountingId },
            orderBy: { name: 'asc' },
            select: clientSelect,
        });

        res.json(clients);
    } catch (error) {
        return sendErrorResponse(res, error, 'Erro ao buscar clientes');
    }
};

export const getClientById = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            throw new AppError(401, 'Não autorizado');
        }

        const client = await prisma.client.findFirst({
            where: {
                id: String(req.params.id),
                accounting_id: req.accountingId,
            },
            select: clientSelect,
        });

        if (!client) {
            throw new AppError(404, 'Cliente não encontrado');
        }

        res.json(client);
    } catch (error) {
        return sendErrorResponse(res, error, 'Erro ao buscar cliente');
    }
};

export const createClient = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            throw new AppError(401, 'Não autorizado');
        }

        const name = toTrimmedString(req.body?.name);
        const cnpj = normalizeDigits(toTrimmedString(req.body?.cnpj));
        const email = normalizeEmail(req.body?.email) || null;
        const rawPhone = toOptionalTrimmedString(req.body?.phone);
        const phone = rawPhone ? normalizeDigits(rawPhone) : null;
        const industry = toOptionalTrimmedString(req.body?.industry);
        const address = toOptionalTrimmedString(req.body?.address);
        const password = typeof req.body?.password === 'string' ? req.body.password : '';
        const taxRegime = toOptionalTrimmedString(req.body?.tax_regime);
        const representativeEmail = normalizeEmail(req.body?.representative_email) || null;
        const representativeName = toOptionalTrimmedString(req.body?.representative_name);

        if (!name) {
            throw new AppError(400, 'Nome é obrigatório');
        }

        if (!cnpj) {
            throw new AppError(400, 'CNPJ é obrigatório');
        }

        if (email) {
            assertValidEmail(email);
        }

        if (representativeEmail) {
            assertValidEmail(representativeEmail, 'Email do representante');
        }

        if (phone && phone.length < 10) {
            throw new AppError(400, 'Telefone inválido');
        }

        if (taxRegime) {
            assertOneOf(taxRegime, VALID_TAX_REGIMES, 'Regime tributário inválido');
        }

        assertMinimumLength(password, 6, 'Senha é obrigatória e deve ter pelo menos 6 caracteres');

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const client = await prisma.client.create({
            data: {
                name,
                cnpj,
                email,
                phone,
                industry,
                address,
                password_hash: passwordHash,
                tax_regime: taxRegime,
                representative_email: representativeEmail,
                representative_name: representativeName,
                status: 'active',
                accounting_id: req.accountingId,
            },
            select: clientSelect,
        });

        res.status(201).json(client);
    } catch (error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return res.status(400).json({ message: 'CNPJ já cadastrado' });
        }

        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
            return res.status(400).json({ message: 'Usuário administrador não encontrado no banco' });
        }

        return sendErrorResponse(res, error, 'Erro ao criar cliente');
    }
};

export const updateClient = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            throw new AppError(401, 'Não autorizado');
        }

        const id = String(req.params.id);
        const existingClient = await prisma.client.findFirst({
            where: { id, accounting_id: req.accountingId },
        });

        if (!existingClient) {
            throw new AppError(404, 'Cliente não encontrado');
        }

        const data: Record<string, unknown> = {};

        if (req.body.name !== undefined) {
            const name = toTrimmedString(req.body.name);
            if (!name) {
                throw new AppError(400, 'Nome é obrigatório');
            }
            data.name = name;
        }

        if (req.body.cnpj !== undefined) {
            const cnpj = normalizeDigits(toTrimmedString(req.body.cnpj));
            if (!cnpj) {
                throw new AppError(400, 'CNPJ é obrigatório');
            }
            data.cnpj = cnpj;
        }

        if (req.body.email !== undefined) {
            const email = normalizeEmail(req.body.email);
            if (email) {
                assertValidEmail(email);
                data.email = email;
            } else {
                data.email = null;
            }
        }

        if (req.body.phone !== undefined) {
            const rawPhone = toOptionalTrimmedString(req.body.phone);
            const phone = rawPhone ? normalizeDigits(rawPhone) : null;
            if (phone && phone.length < 10) {
                throw new AppError(400, 'Telefone inválido');
            }
            data.phone = phone;
        }

        if (req.body.industry !== undefined) data.industry = toOptionalTrimmedString(req.body.industry);
        if (req.body.address !== undefined) data.address = toOptionalTrimmedString(req.body.address);

        if (req.body.tax_regime !== undefined) {
            const taxRegime = toOptionalTrimmedString(req.body.tax_regime);
            if (taxRegime) {
                assertOneOf(taxRegime, VALID_TAX_REGIMES, 'Regime tributário inválido');
                data.tax_regime = taxRegime;
            } else {
                data.tax_regime = null;
            }
        }

        if (req.body.representative_email !== undefined) {
            const representativeEmail = normalizeEmail(req.body.representative_email);
            if (representativeEmail) {
                assertValidEmail(representativeEmail, 'Email do representante');
                data.representative_email = representativeEmail;
            } else {
                data.representative_email = null;
            }
        }

        if (req.body.representative_name !== undefined) {
            data.representative_name = toOptionalTrimmedString(req.body.representative_name);
        }

        if (req.body.status !== undefined) {
            const status = toTrimmedString(req.body.status);
            data.status = assertOneOf(status, VALID_CLIENT_STATUSES, 'Status inválido');
        }

        if (req.body.password !== undefined) {
            const password = typeof req.body.password === 'string' ? req.body.password : '';
            assertMinimumLength(password, 6, 'Senha deve ter pelo menos 6 caracteres');
            const salt = await bcrypt.genSalt(10);
            data.password_hash = await bcrypt.hash(password, salt);
        }

        const updatedClient = await prisma.client.update({
            where: { id },
            data,
            select: clientSelect,
        });

        res.json(updatedClient);
    } catch (error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return res.status(400).json({ message: 'CNPJ já cadastrado' });
        }

        return sendErrorResponse(res, error, 'Erro ao atualizar cliente');
    }
};

export const deleteClient = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            throw new AppError(401, 'Não autorizado');
        }

        const result = await prisma.client.deleteMany({
            where: {
                id: String(req.params.id),
                accounting_id: req.accountingId,
            },
        });

        if (result.count === 0) {
            throw new AppError(404, 'Cliente não encontrado ou não autorizado');
        }

        res.status(204).send();
    } catch (error) {
        return sendErrorResponse(res, error, 'Erro ao excluir cliente');
    }
};
