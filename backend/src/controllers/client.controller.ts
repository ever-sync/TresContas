import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';

const isNonEmptyString = (value: unknown) =>
    typeof value === 'string' && value.trim().length > 0;

const isValidEmail = (value: string) => value.includes('@') && value.includes('.');

const isValidTaxRegime = (value: string) =>
    ['simples', 'presumido', 'real', 'mei'].includes(value);

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
            return res.status(401).json({ message: 'Não autorizado' });
        }
        const clients = await prisma.client.findMany({
            where: { accounting_id: req.accountingId },
            orderBy: { name: 'asc' },
            select: clientSelect,
        });

        res.json(clients);
    } catch (error) {
        console.error('Error fetching clients:', error);
        res.status(500).json({ message: 'Erro ao buscar clientes' });
    }
};

export const getClientById = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const { id } = req.params;
        const client = await prisma.client.findFirst({
            where: {
                id: String(id),
                accounting_id: req.accountingId,
            },
            select: clientSelect,
        });

        if (!client) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }

        res.json(client);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar cliente' });
    }
};

export const createClient = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        const name = isNonEmptyString(req.body?.name) ? req.body.name.trim() : '';
        const rawCnpj = isNonEmptyString(req.body?.cnpj) ? req.body.cnpj.trim() : '';
        const cnpj = rawCnpj.replace(/\D/g, ''); // Armazena CNPJ apenas com digitos
        const email = isNonEmptyString(req.body?.email) ? req.body.email.trim().toLowerCase() : null;
        const phone = isNonEmptyString(req.body?.phone) ? req.body.phone.trim() : null;
        const industry = isNonEmptyString(req.body?.industry) ? req.body.industry.trim() : null;
        const address = isNonEmptyString(req.body?.address) ? req.body.address.trim() : null;
        const password = isNonEmptyString(req.body?.password) ? req.body.password : '';
        const tax_regime = isNonEmptyString(req.body?.tax_regime) ? req.body.tax_regime.trim() : null;
        const representative_email = isNonEmptyString(req.body?.representative_email)
            ? req.body.representative_email.trim().toLowerCase()
            : null;
        const representative_name = isNonEmptyString(req.body?.representative_name)
            ? req.body.representative_name.trim()
            : null;

        const errors: string[] = [];

        if (!name) errors.push('Nome é obrigatório');
        if (!cnpj) errors.push('CNPJ é obrigatório');
        if (email && !isValidEmail(email)) errors.push('Email inválido');
        if (representative_email && !isValidEmail(representative_email)) {
            errors.push('Email do representante inválido');
        }
        if (phone && phone.replace(/\D/g, '').length < 10) {
            errors.push('Telefone inválido');
        }
        if (tax_regime && !isValidTaxRegime(tax_regime)) {
            errors.push('Regime tributário inválido');
        }
        if (!password || password.length < 6) {
            errors.push('Senha é obrigatória e deve ter pelo menos 6 caracteres');
        }

        if (errors.length > 0) {
            return res.status(400).json({ message: errors[0], errors });
        }

        let password_hash = null;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            password_hash = await bcrypt.hash(password, salt);
        }

        const client = await prisma.client.create({
            data: {
                name,
                cnpj,
                email,
                phone,
                industry,
                address,
                password_hash,
                tax_regime,
                representative_email,
                representative_name,
                status: 'active',
                accounting_id: req.accountingId!,
            },
            select: clientSelect,
        });

        res.status(201).json(client);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return res.status(400).json({ message: 'CNPJ já cadastrado' });
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
            console.error('Foreign key constraint failed. Check if accounting_id exists:', req.accountingId);
            return res.status(400).json({ message: 'Usuário administrador não encontrado no banco' });
        }
        console.error('Detailed error creating client:', error);
        res.status(500).json({ message: 'Erro ao criar cliente' });
    }
};

export const updateClient = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }
        const { id } = req.params;
        const {
            name,
            cnpj,
            email,
            phone,
            industry,
            address,
            tax_regime,
            representative_email,
            representative_name,
            status,
            password,
        } = req.body;

        // Check ownership
        const existingClient = await prisma.client.findFirst({
            where: { id: String(id), accounting_id: req.accountingId },
        });

        if (!existingClient) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }

        const data: Prisma.ClientUpdateInput = {};

        if (name !== undefined) data.name = name;
        if (cnpj !== undefined) data.cnpj = cnpj.replace(/\D/g, '');
        if (email !== undefined) data.email = email ? email.trim().toLowerCase() : email;
        if (phone !== undefined) data.phone = phone;
        if (industry !== undefined) data.industry = industry;
        if (address !== undefined) data.address = address;
        if (tax_regime !== undefined) data.tax_regime = tax_regime;
        if (representative_email !== undefined) data.representative_email = representative_email ? representative_email.trim().toLowerCase() : representative_email;
        if (representative_name !== undefined) data.representative_name = representative_name;
        if (status !== undefined) data.status = status;

        // Atualizar senha se fornecida
        if (password && password.length >= 6) {
            const salt = await bcrypt.genSalt(10);
            data.password_hash = await bcrypt.hash(password, salt);
        }

        const updatedClient = await prisma.client.update({
            where: { id: String(id) },
            data,
            select: clientSelect,
        });

        res.json(updatedClient);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return res.status(400).json({ message: 'CNPJ já cadastrado' });
        }
        console.error('Detailed error updating client:', error);
        res.status(500).json({ message: 'Erro ao atualizar cliente' });
    }
};

export const deleteClient = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }
        const { id } = req.params;

        const result = await prisma.client.deleteMany({
            where: {
                id: String(id),
                accounting_id: req.accountingId
            },
        });

        if (result.count === 0) {
            return res.status(404).json({ message: 'Cliente não encontrado ou não autorizado' });
        }

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: 'Erro ao excluir cliente' });
    }
};
