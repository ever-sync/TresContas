import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * POST /api/client-portal/ai-analysis
 * Streaming SSE — analisa os dados financeiros do cliente e retorna insights em tempo real.
 * Body: { year: number, monthIndex: number, dre: object, indicators: object }
 */
export const analyzeFinancials = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.clientId) {
            return res.status(401).json({ message: 'Não autorizado' });
        }

        if (!process.env.GROQ_API_KEY) {
            return res.status(503).json({ message: 'Serviço de IA não configurado' });
        }

        const { year, monthIndex, dre, indicators } = req.body;

        // Buscar nome do cliente
        const client = await prisma.client.findUnique({
            where: { id: req.clientId },
            select: { name: true },
        });

        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const monthName = monthNames[monthIndex] ?? 'mês selecionado';

        const fmt = (v: number) =>
            `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        const pct = (v: number) => `${v.toFixed(1)}%`;

        const prompt = `Você é um consultor financeiro especialista em contabilidade empresarial brasileira.
Analise os dados financeiros abaixo da empresa "${client?.name || 'Cliente'}" referentes a ${monthName}/${year} e forneça insights objetivos e práticos em português.

=== DADOS DO DRE ===
Receita Bruta:          ${fmt(dre.recBruta)}
Deduções:               ${fmt(dre.deducoes)}
Receita Líquida:        ${fmt(dre.recLiquida)}
Custos das Vendas:      ${fmt(dre.custos)}
Custos dos Serviços:    ${fmt(dre.custosServicos)}
Lucro Operacional:      ${fmt(dre.lucroBruto)}
Despesas Administrativas: ${fmt(dre.despAdm)}
Despesas Comerciais:    ${fmt(dre.despCom)}
Despesas Tributárias:   ${fmt(dre.despTrib)}
Receitas Financeiras:   ${fmt(dre.recFin)}
Despesas Financeiras:   ${fmt(dre.despFin)}
LAIR:                   ${fmt(dre.lair)}
IRPJ e CSLL:            ${fmt(dre.irpjCsll)}
Lucro Líquido:          ${fmt(dre.lucroLiq)}
EBITDA:                 ${fmt(dre.ebtida)}

=== INDICADORES ===
Margem Bruta:           ${pct(indicators.margemBruta)}
Margem Líquida:         ${pct(indicators.margemLiq)}
Margem EBITDA:          ${pct(indicators.margemEbtida)}
Liquidez Corrente:      ${indicators.liqCorr.toFixed(2)}
Endividamento:          ${pct(indicators.endividamento)}

Forneça sua análise em 4 seções usando markdown:

## 🎯 Resumo Executivo
Um parágrafo conciso com o panorama geral do mês.

## ✅ Pontos Positivos
Lista de 2-3 aspectos financeiros favoráveis com explicação breve.

## ⚠️ Pontos de Atenção
Lista de 2-3 riscos ou áreas que precisam de atenção com explicação e impacto.

## 💡 Recomendações
Lista de 2-3 ações práticas e objetivas que o empresário pode tomar.

Seja direto, use linguagem acessível para empresários (não apenas contadores), e forneça contexto sobre o que os números significam na prática.`;

        // Configurar SSE
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
        console.error('Erro na análise de IA:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Erro ao processar análise de IA' });
        } else {
            res.write(`data: ${JSON.stringify({ error: 'Erro ao processar análise' })}\n\n`);
            res.end();
        }
    }
};
