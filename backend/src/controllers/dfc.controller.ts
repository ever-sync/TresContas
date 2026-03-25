import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';
import { getDfcConfig, getDfcReport, saveDfcConfig } from '../services/dfc.service';

const verifyClientOwnership = async (clientId: string, accountingId: string) => {
    const client = await prisma.client.findFirst({
        where: { id: clientId, accounting_id: accountingId },
        select: { id: true },
    });
    return client !== null;
};

export const getClientDfcConfig = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) return res.status(401).json({ message: 'Não autorizado' });

        const clientId = String(req.params.clientId);
        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }

        const config = await getDfcConfig(req.accountingId, clientId);
        res.json(config);
    } catch (error: any) {
        console.error('Erro ao buscar configuração DFC:', error);
        res.status(error?.status || 500).json({
            message: error?.message || 'Erro ao buscar configuração DFC',
        });
    }
};

export const putClientDfcConfig = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) return res.status(401).json({ message: 'Não autorizado' });

        const clientId = String(req.params.clientId);
        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }

        const mappings = Array.isArray(req.body?.mappings) ? req.body.mappings : [];
        const config = await saveDfcConfig(req.accountingId, mappings);
        res.json(config);
    } catch (error: any) {
        console.error('Erro ao salvar configuração DFC:', error);
        res.status(error?.status || 500).json({
            message: error?.message || 'Erro ao salvar configuração DFC',
        });
    }
};

export const getClientDfcReport = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) return res.status(401).json({ message: 'Não autorizado' });

        const clientId = String(req.params.clientId);
        if (!await verifyClientOwnership(clientId, req.accountingId)) {
            return res.status(404).json({ message: 'Cliente não encontrado' });
        }

        const year = parseInt(String(req.query.year || ''), 10) || new Date().getFullYear();
        const report = await getDfcReport(clientId, year);
        res.json(report);
    } catch (error: any) {
        console.error('Erro ao calcular DFC:', error);
        res.status(error?.status || 500).json({
            message: error?.message || 'Erro ao calcular DFC',
        });
    }
};

export const getAccountingDfcConfig = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) return res.status(401).json({ message: 'Não autorizado' });

        const config = await getDfcConfig(req.accountingId);
        res.json(config);
    } catch (error: any) {
        console.error('Erro ao buscar configuração DFC global:', error);
        res.status(error?.status || 500).json({
            message: error?.message || 'Erro ao buscar configuração DFC',
        });
    }
};

export const putAccountingDfcConfig = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.accountingId) return res.status(401).json({ message: 'Não autorizado' });

        const mappings = Array.isArray(req.body?.mappings) ? req.body.mappings : [];
        const config = await saveDfcConfig(req.accountingId, mappings);
        res.json(config);
    } catch (error: any) {
        console.error('Erro ao salvar configuração DFC global:', error);
        res.status(error?.status || 500).json({
            message: error?.message || 'Erro ao salvar configuração DFC',
        });
    }
};

export const getPortalDfcReport = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.clientId) return res.status(401).json({ message: 'Não autorizado' });

        const year = parseInt(String(req.query.year || ''), 10) || new Date().getFullYear();
        const report = await getDfcReport(req.clientId, year);
        res.json(report);
    } catch (error: any) {
        console.error('Erro ao calcular DFC do portal:', error);
        res.status(error?.status || 500).json({
            message: error?.message || 'Erro ao calcular DFC',
        });
    }
};
