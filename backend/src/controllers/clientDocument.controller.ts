import { Response } from 'express';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

const MAX_DOCUMENT_SIZE_BYTES = 12 * 1024 * 1024;

type BaseDocumentRow = {
    id: string;
    original_name: string;
    display_name: string;
    category: string;
    mime_type: string;
    size_bytes: number;
    created_at: Date;
    updated_at: Date;
};

type StaffDocumentRow = BaseDocumentRow & {
    client_id: string;
    client_name: string;
    client_cnpj: string;
};

type DownloadDocumentRow = {
    original_name: string;
    mime_type: string;
    size_bytes: number;
    content: Buffer;
};

const parseBase64Content = (value: unknown) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized) return null;
    try {
        return Buffer.from(normalized, 'base64');
    } catch {
        return null;
    }
};

const isNonEmptyString = (value: unknown) =>
    typeof value === 'string' && value.trim().length > 0;

const setDownloadHeaders = (
    res: Response,
    fileName: string,
    mimeType: string,
    sizeBytes: number
) => {
    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', sizeBytes);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
};

const mapBaseDocument = (row: BaseDocumentRow) => ({
    id: row.id,
    original_name: row.original_name,
    display_name: row.display_name,
    category: row.category,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    created_at: row.created_at,
    updated_at: row.updated_at,
});

const mapStaffDocument = (row: StaffDocumentRow) => ({
    ...mapBaseDocument(row),
    client: {
        id: row.client_id,
        name: row.client_name,
        cnpj: row.client_cnpj,
    },
});

export const listClientDocuments = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            return res.status(401).json({ message: 'Nao autorizado' });
        }

        const documents = await prisma.$queryRaw<StaffDocumentRow[]>(Prisma.sql`
            SELECT
                d.id,
                d.original_name,
                d.display_name,
                d.category,
                d.mime_type,
                d.size_bytes,
                d.created_at,
                d.updated_at,
                c.id AS client_id,
                c.name AS client_name,
                c.cnpj AS client_cnpj
            FROM "ClientDocument" d
            INNER JOIN "Client" c ON c.id = d.client_id
            WHERE d.accounting_id = ${req.accountingId}
            ORDER BY d.created_at DESC
        `);

        res.json(documents.map(mapStaffDocument));
    } catch (error) {
        console.error('Erro ao listar documentos dos clientes:', error);
        res.status(500).json({ message: 'Erro ao listar documentos' });
    }
};

export const downloadClientDocument = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) {
            return res.status(401).json({ message: 'Nao autorizado' });
        }

        const id = String(req.params.id);
        const documents = await prisma.$queryRaw<DownloadDocumentRow[]>(Prisma.sql`
            SELECT original_name, mime_type, size_bytes, content
            FROM "ClientDocument"
            WHERE id = ${id} AND accounting_id = ${req.accountingId}
            LIMIT 1
        `);
        const document = documents[0];

        if (!document) {
            return res.status(404).json({ message: 'Documento nao encontrado' });
        }

        setDownloadHeaders(res, document.original_name, document.mime_type, document.size_bytes);
        res.send(document.content);
    } catch (error) {
        console.error('Erro ao baixar documento do cliente:', error);
        res.status(500).json({ message: 'Erro ao baixar documento' });
    }
};

export const getClientPortalDocuments = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.clientId) {
            return res.status(401).json({ message: 'Nao autorizado' });
        }

        const documents = await prisma.$queryRaw<BaseDocumentRow[]>(Prisma.sql`
            SELECT
                id,
                original_name,
                display_name,
                category,
                mime_type,
                size_bytes,
                created_at,
                updated_at
            FROM "ClientDocument"
            WHERE client_id = ${req.clientId}
            ORDER BY created_at DESC
        `);

        res.json(documents.map(mapBaseDocument));
    } catch (error) {
        console.error('Erro ao listar documentos do cliente:', error);
        res.status(500).json({ message: 'Erro ao listar documentos' });
    }
};

export const createClientPortalDocument = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.clientId || !req.accountingId) {
            return res.status(401).json({ message: 'Nao autorizado' });
        }

        const originalName = isNonEmptyString(req.body?.original_name) ? req.body.original_name.trim() : '';
        const displayName = isNonEmptyString(req.body?.display_name) ? req.body.display_name.trim() : '';
        const category = isNonEmptyString(req.body?.category) ? req.body.category.trim() : '';
        const mimeType = isNonEmptyString(req.body?.mime_type) ? req.body.mime_type.trim() : 'application/octet-stream';
        const content = parseBase64Content(req.body?.content_base64);

        if (!originalName || !displayName || !category || !content) {
            return res.status(400).json({ message: 'Nome, categoria e arquivo sao obrigatorios' });
        }

        if (content.byteLength > MAX_DOCUMENT_SIZE_BYTES) {
            return res.status(400).json({ message: 'Arquivo excede o limite de 12 MB' });
        }

        const documents = await prisma.$queryRaw<BaseDocumentRow[]>(Prisma.sql`
            INSERT INTO "ClientDocument" (
                id,
                accounting_id,
                client_id,
                original_name,
                display_name,
                category,
                mime_type,
                size_bytes,
                content
            )
            VALUES (
                ${randomUUID()},
                ${req.accountingId},
                ${req.clientId},
                ${originalName},
                ${displayName},
                ${category},
                ${mimeType},
                ${content.byteLength},
                ${content}
            )
            RETURNING
                id,
                original_name,
                display_name,
                category,
                mime_type,
                size_bytes,
                created_at,
                updated_at
        `);

        res.status(201).json(mapBaseDocument(documents[0]));
    } catch (error) {
        console.error('Erro ao criar documento do cliente:', error);
        res.status(500).json({ message: 'Erro ao enviar documento' });
    }
};

export const downloadClientPortalDocument = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.clientId) {
            return res.status(401).json({ message: 'Nao autorizado' });
        }

        const id = String(req.params.id);
        const documents = await prisma.$queryRaw<DownloadDocumentRow[]>(Prisma.sql`
            SELECT original_name, mime_type, size_bytes, content
            FROM "ClientDocument"
            WHERE id = ${id} AND client_id = ${req.clientId}
            LIMIT 1
        `);
        const document = documents[0];

        if (!document) {
            return res.status(404).json({ message: 'Documento nao encontrado' });
        }

        setDownloadHeaders(res, document.original_name, document.mime_type, document.size_bytes);
        res.send(document.content);
    } catch (error) {
        console.error('Erro ao baixar documento do portal:', error);
        res.status(500).json({ message: 'Erro ao baixar documento' });
    }
};
