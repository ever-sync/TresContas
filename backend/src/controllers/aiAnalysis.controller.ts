import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const verifyClientOwnership = async (clientId: string, accountingId: string) => {
    const client = await prisma.client.findFirst({
        where: { id: clientId, accounting_id: accountingId },
        select: { id: true },
    });
    return client !== null;
};

/**
 * POST /api/client-portal/ai-analysis
 * Streaming SSE - analisa os dados financeiros do cliente e retorna insights em tempo real.
 * Body: { year: number, monthIndex: number, dre: object, indicators: object, clientId?: string }
 */
export const analyzeFinancials = async (req: AuthRequest, res: Response) => {
    try {
        const requestedClientId = typeof req.body?.clientId === 'string' ? req.body.clientId.trim() : '';
        const clientId = req.clientId || requestedClientId;

        if (!clientId) {
            return res.status(401).json({ message: 'Nao autorizado' });
        }

        if (!req.clientId) {
            if (!req.accountingId) {
                return res.status(401).json({ message: 'Nao autorizado' });
            }
            if (!await verifyClientOwnership(clientId, req.accountingId)) {
                return res.status(404).json({ message: 'Cliente nao encontrado' });
            }
        }

        if (!process.env.GROQ_API_KEY) {
            return res.status(503).json({ message: 'Servico de IA nao configurado' });
        }

        const { year, monthIndex, dre, indicators } = req.body;

        const client = await prisma.client.findUnique({
            where: { id: clientId },
            select: { name: true },
        });

        const monthNames = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const monthName = monthNames[monthIndex] ?? 'mes selecionado';

        const fmt = (value: number) =>
            `R$ ${Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        const pct = (value: number) => `${value.toFixed(1)}%`;

        const prompt = `Voce e um consultor financeiro especialista em contabilidade empresarial brasileira.
Analise os dados financeiros abaixo da empresa "${client?.name || 'Cliente'}" referentes a ${monthName}/${year} e forneca insights objetivos e praticos em portugues.

=== DADOS DO DRE ===
Receita Bruta:          ${fmt(dre.recBruta)}
Deducoes:               ${fmt(dre.deducoes)}
Receita Liquida:        ${fmt(dre.recLiquida)}
Custos das Vendas:      ${fmt(dre.custos)}
Custos dos Servicos:    ${fmt(dre.custosServicos)}
Lucro Operacional:      ${fmt(dre.lucroBruto)}
Despesas Administrativas: ${fmt(dre.despAdm)}
Despesas Comerciais:    ${fmt(dre.despCom)}
Despesas Tributarias:   ${fmt(dre.despTrib)}
Receitas Financeiras:   ${fmt(dre.recFin)}
Despesas Financeiras:   ${fmt(dre.despFin)}
LAIR:                   ${fmt(dre.lair)}
IRPJ e CSLL:            ${fmt(dre.irpjCsll)}
Lucro Liquido:          ${fmt(dre.lucroLiq)}
EBITDA:                 ${fmt(dre.ebtida)}

=== INDICADORES ===
Margem Bruta:           ${pct(indicators.margemBruta)}
Margem Liquida:         ${pct(indicators.margemLiq)}
Margem EBITDA:          ${pct(indicators.margemEbtida)}
Liquidez Corrente:      ${indicators.liqCorr.toFixed(2)}
Endividamento:          ${pct(indicators.endividamento)}

Forneca sua analise em 4 secoes usando markdown:

## Resumo Executivo
Um paragrafo conciso com o panorama geral do mes.

## Pontos Positivos
Lista de 2-3 aspectos financeiros favoraveis com explicacao breve.

## Pontos de Atencao
Lista de 2-3 riscos ou areas que precisam de atencao com explicacao e impacto.

## Recomendacoes
Lista de 2-3 acoes praticas e objetivas que o empresario pode tomar.

Seja direto, use linguagem acessivel para empresarios (nao apenas contadores), e forneca contexto sobre o que os numeros significam na pratica.`;

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.flushHeaders();

        const stream = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            stream: true,
            max_tokens: 1024,
            temperature: 0.7,
        });

        for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? '';
            if (text) {
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
        }

        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error: any) {
        console.error('Erro na analise de IA:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Erro ao processar analise de IA' });
        } else {
            res.write(`data: ${JSON.stringify({ error: 'Erro ao processar analise' })}\n\n`);
            res.end();
        }
    }
};
