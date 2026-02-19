import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
}
const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = '1d';

const isNonEmptyString = (value: unknown) =>
    typeof value === 'string' && value.trim().length > 0;

const isValidEmail = (value: string) => value.includes('@') && value.includes('.');

export const register = async (req: Request, res: Response) => {
    try {
        const name = isNonEmptyString(req.body?.name) ? req.body.name.trim() : '';
        const rawCnpj = isNonEmptyString(req.body?.cnpj) ? req.body.cnpj.trim() : '';
        const email = isNonEmptyString(req.body?.email) ? req.body.email.trim() : '';
        const rawPhone = isNonEmptyString(req.body?.phone) ? req.body.phone.trim() : null;
        const password = isNonEmptyString(req.body?.password) ? req.body.password : '';

        const cnpj = rawCnpj.replace(/\D/g, '');
        const phone = rawPhone ? rawPhone.replace(/\D/g, '') : null;

        if (!name || !cnpj || !email || !password) {
            return res.status(400).json({ message: 'Nome, CNPJ, email e senha são obrigatórios' });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ message: 'Email inválido' });
        }

        if (phone && phone.length < 10) {
            return res.status(400).json({ message: 'Telefone inválido' });
        }

        if (password.length < 8) {
            return res.status(400).json({ message: 'Senha deve ter pelo menos 8 caracteres' });
        }

        // Check if accounting already exists
        const existingAccounting = await prisma.accounting.findFirst({
            where: {
                OR: [{ email }, { cnpj }],
            },
        });

        if (existingAccounting) {
            return res.status(400).json({ message: 'Email ou CNPJ já cadastrado' });
        }

        // Check if email is already used by another user
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return res.status(400).json({ message: 'Email já cadastrado' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        // Create Accounting + Admin User in a transaction
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

        const token = jwt.sign(
            {
                userId: result.user.id,
                accountingId: result.accounting.id,
                role: result.user.role,
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.status(201).json({
            token,
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
    } catch (error: any) {
        console.error('Detailed Registration Error:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ message: 'Email ou CNPJ já cadastrado no banco' });
        }
        res.status(500).json({ message: 'Erro ao realizar cadastro no servidor' });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const rawEmail = isNonEmptyString(req.body?.email) ? req.body.email.trim() : '';
        const email = rawEmail.toLowerCase();
        const password = isNonEmptyString(req.body?.password) ? req.body.password : '';

        if (!email || !password) {
            return res.status(400).json({ message: 'Email e senha são obrigatórios' });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ message: 'Email inválido' });
        }

        // Find user by email (includes admin and collaborator)
        const user = await prisma.user.findUnique({
            where: { email },
            include: { accounting: true },
        });

        if (!user) {
            return res.status(401).json({ message: 'Credenciais inválidas' });
        }

        if (user.status !== 'active') {
            return res.status(403).json({ message: 'Conta inativa. Contacte o administrador.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Credenciais inválidas' });
        }

        const token = jwt.sign(
            {
                userId: user.id,
                accountingId: user.accounting_id,
                role: user.role,
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({
            token,
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
        console.error('Detailed Login Error:', error);
        res.status(500).json({ message: 'Erro ao realizar login no servidor' });
    }
};

export const clientLogin = async (req: Request, res: Response) => {
    try {
        const client_id = isNonEmptyString(req.body?.client_id) ? req.body.client_id.trim() : undefined;
        const rawEmail = isNonEmptyString(req.body?.email) ? req.body.email.trim().toLowerCase() : '';
        const rawCnpj = isNonEmptyString(req.body?.cnpj) ? req.body.cnpj.trim() : '';
        const password = isNonEmptyString(req.body?.password) ? req.body.password : '';

        const cnpj = rawCnpj ? rawCnpj.replace(/\D/g, '') : '';
        const email = rawEmail || '';

        if ((!email && !cnpj) || !password) {
            return res.status(400).json({ message: 'Email/CNPJ e senha são obrigatórios' });
        }

        const whereConditions = [];
        if (email) {
            whereConditions.push({ representative_email: email });
            whereConditions.push({ email });
        }
        if (cnpj) {
            whereConditions.push({ cnpj });
        }

        if (whereConditions.length === 0) {
            return res.status(400).json({ message: 'Email ou CNPJ inválido' });
        }

        const client = await prisma.client.findFirst({
            where: {
                ...(client_id ? { id: client_id } : {}),
                OR: whereConditions as any,
            },
        });

        if (!client) {
            console.warn('Client login: nenhum cliente encontrado para', { email, cnpj: cnpj ? '***' : '', client_id });
            return res.status(401).json({ message: 'Credenciais inválidas' });
        }

        if (!client.password_hash) {
            console.warn('Client login: cliente sem senha definida:', client.id);
            return res.status(401).json({ message: 'Senha não configurada. Solicite à sua contabilidade.' });
        }

        if (client.status !== 'active') {
            return res.status(403).json({ message: 'Conta inativa. Contacte sua contabilidade.' });
        }

        const isPasswordValid = await bcrypt.compare(password, client.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Credenciais inválidas' });
        }

        const token = jwt.sign(
            {
                role: 'client',
                clientId: client.id,
                accountingId: client.accounting_id,
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        res.json({
            token,
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
        console.error('Client Login Error:', error);
        res.status(500).json({ message: 'Erro ao realizar login do cliente' });
    }
};
