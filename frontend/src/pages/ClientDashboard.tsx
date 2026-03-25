import React, { Suspense, lazy, useMemo, useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Download,
    Upload,
    Calendar,
    BarChart3,
    ArrowLeft,
    Calculator,
    FileSpreadsheet,
    PlusIcon,
    LifeBuoy,
    MessageSquare,
    Bell,
    Clock,
    TrendingUp,
    Filter,
    CalendarDays,
    Loader2,
    LogOut,
    Ticket,
    FileText,
    LayoutList,
    Sparkles,
    RefreshCw,
    ChevronRight,
    Settings2,
} from 'lucide-react';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip,
    PieChart as RechartsPie, Pie, Cell, Legend,
    LineChart, Line,
    BarChart, Bar,
} from 'recharts';
import axios from 'axios';
import api from '../services/api';
import { authService } from '../services/authService';
import { clientService } from '../services/clientService';
import type { Client } from '../services/clientService';
import { clientPortalService } from '../services/clientPortalService';
import { chartOfAccountsService, clientChartOfAccountsService } from '../services/chartOfAccountsService';
import type { ImportAccount } from '../services/chartOfAccountsService';
import { movementService } from '../services/movementService';
import type { MovementRow } from '../services/movementService';
import { resolveApiBaseUrl } from '../services/baseUrl';
import toast from 'react-hot-toast';
import { useClientAuthStore } from '../stores/useClientAuthStore';
import { TooltipCurrency, TooltipPercent } from '../components/client-dashboard/ChartTooltips';
import type { DreMonthData } from '../components/client-dashboard/constants';

type ClientDashboardProfile = Pick<Client, 'id' | 'name' | 'cnpj' | 'email' | 'status' | 'accounting_id'>;

const formatLocaleNumber = (number: number) => {
    return Math.abs(number).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const formatSignedLocaleNumber = (number: number) => {
    return number.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

interface Account {
    classification: string;
    reduced_code?: string;
    name: string;
    values: string[];
    total: string;
    level: number;
    category: string;
    alias?: string;
    report_category?: string;
    id?: number;
}

const EMPTY_DRE_MONTH_DATA: DreMonthData = {
    recBruta: 0,
    deducoes: 0,
    recLiquida: 0,
    custos: 0,
    custosServicos: 0,
    lucroBruto: 0,
    despAdm: 0,
    despCom: 0,
    despTrib: 0,
    partSocietarias: 0,
    outrasReceitas: 0,
    recFin: 0,
    despFin: 0,
    lair: 0,
    irpjCsll: 0,
    lucroLiq: 0,
    depreciacao: 0,
    resultFin: 0,
    ebtida: 0,
};

let spreadsheetModulePromise: Promise<typeof import('xlsx')> | null = null;
let pdfModulePromise: Promise<[typeof import('html2canvas'), typeof import('jspdf')]> | null = null;

const loadSpreadsheetModule = () => {
    if (!spreadsheetModulePromise) {
        spreadsheetModulePromise = import('xlsx');
    }

    return spreadsheetModulePromise;
};

const loadPdfModules = () => {
    if (!pdfModulePromise) {
        pdfModulePromise = Promise.all([import('html2canvas'), import('jspdf')]);
    }

    return pdfModulePromise;
};

const ClientDfcSection = lazy(() => import('../components/ClientDfcSection'));
const ClientDreConfigPanel = lazy(() => import('../components/ClientDreConfigPanel'));
const ClientPatConfigPanel = lazy(() => import('../components/ClientPatConfigPanel'));
const ClientDocumentUploadPanel = lazy(() => import('../components/ClientDocumentUploadPanel'));
const SupportTicketDetailPanel = lazy(() => import('../components/support/SupportTicketDetailPanel'));

// Estrutura fixa do Balanço Patrimonial — grupos e seus itens filhos
const PAT_STRUCTURE = [
    {
        id: 'ativo_circ', groupLabel: 'ATIVO CIRCULANTE', displayLabel: 'Ativo Circulante', type: 'section' as const,
        children: ['Disponível', 'Clientes', 'Adiantamentos', 'Estoques', 'Tributos A CompensarCP', 'Outras Contas a Receber', 'Despesas Antecipadas'],
    },
    {
        id: 'ativo_nao', groupLabel: 'ATIVO NÃO CIRCULANTE', displayLabel: 'Ativo Não Circulante', type: 'section' as const,
        children: ['Contas A Receber Lp', 'Processos Judiciais', 'Partes Relacionadas A Receber', 'Outras Contas A Receber Lp', 'Tributos a RecuperarLP', 'Investimentos', 'Imobilizado', 'Intangível'],
    },
    {
        id: 'total_ativo', groupLabel: '', displayLabel: 'TOTAL DO ATIVO', type: 'total' as const,
        children: [] as string[],
    },
    {
        id: 'pass_circ', groupLabel: 'PASSIVO CIRCULANTE', displayLabel: 'Passivo Circulante', type: 'section' as const,
        children: ['Fornecedores', 'Emprestimos E Financiamentos Cp', 'Obrigacoes Trabalhistas', 'Obrigacoes Tributarias', 'Contas A Pagar Cp', 'Parcelamentos Cp', 'Processos A Pagar Cp'],
    },
    {
        id: 'pass_nao', groupLabel: 'PASSIVO NÃO CIRCULANTE', displayLabel: 'Passivo Não Circulante', type: 'section' as const,
        children: ['Emprestimos E Financiamentos Lp', 'Conta Corrente Dos Socios', 'Emprestimos Partes Relacionadas', 'Parcelamentos Lp', 'Processos A Pagar Lp', 'Impostos Diferidos', 'Outras Contas A Pagar Lp', 'Receita de Exercicio Futuro Lp', 'Provisao Para Contingencias'],
    },
    {
        id: 'pat_liq', groupLabel: 'PATRIMÔNIO LÍQUIDO', displayLabel: 'Patrimônio Líquido', type: 'section' as const,
        children: ['Capital Social', 'Reserva De Capital', 'Reserva De Lucros', 'Resultado Do Exercicio', 'Distribuicao De Lucros'],
    },
    {
        id: 'total_passivo', groupLabel: '', displayLabel: 'TOTAL DO PASSIVO', type: 'total' as const,
        children: [] as string[],
    },
] as const;

// Estrutura do DFC — Método Indireto
// type: 'section' = cabeçalho de grupo, 'item' = linha de dado, 'result' = linha de resultado, 'separator' = espaço visual
const DFC_STRUCTURE: { type: 'section' | 'item' | 'result' | 'separator'; label?: string; key?: string }[] = [
    { type: 'section', label: 'RESULTADO CONTÁBIL' },
    { type: 'item',    label: 'AJUSTES',                              key: 'ajustes' },
    { type: 'item',    label: '(+) DEPRECIAÇÃO',                      key: 'depreciacao' },
    { type: 'item',    label: '(+) PROVISÕES DIVERSAS',               key: 'provisoesDiversas' },
    { type: 'item',    label: '(+) PDD',                              key: 'pdd' },
    { type: 'item',    label: '(-) LUCRO/PERDA VENDA IMOBILIZADO',    key: 'lucroPerdaImob' },
    { type: 'item',    label: '(+/-) AJUSTE TRANSF. IMOBILIZADO',     key: 'ajusteTransfImob' },
    { type: 'result',  label: 'LUCRO AJUSTADO',                       key: 'lucroAjustado' },

    { type: 'section', label: 'AUMENTO/DIMINUIÇÃO DO CAIXA' },
    { type: 'item',    label: 'Variação Ativo',                       key: 'variacaoAtivo' },
    { type: 'item',    label: 'Variação Passivo',                     key: 'variacaoPassivo' },
    { type: 'result',  label: 'RESULTADO OPERACIONAL',                key: 'resultadoOperacional' },

    { type: 'section', label: 'AUMENTO/DIMINUIÇÃO DO CAIXA' },
    { type: 'item',    label: 'Venda de Imobilizado',                 key: 'vendaImob' },
    { type: 'item',    label: 'Consórcio',                            key: 'consorcio' },
    { type: 'item',    label: 'Aquisição Imobilizado',                key: 'aquisicaoImob' },
    { type: 'item',    label: 'Outros Investimentos',                 key: 'outrosInvestimentos' },
    { type: 'result',  label: 'RESULTADO DE INVESTIMENTO',            key: 'resultadoInvestimento' },

    { type: 'section', label: 'AUMENTO/DIMINUIÇÃO DO CAIXA' },
    { type: 'item',    label: 'Partes Relacionadas',                  key: 'partesRelacionadas' },
    { type: 'item',    label: 'Empréstimos Tomados/Pagos',            key: 'emprestimos' },
    { type: 'item',    label: 'Distribuição de Lucros',               key: 'distribuicaoLucros' },
    { type: 'result',  label: 'RESULTADO FINANCEIRO',                 key: 'resultadoFinanceiro' },

    { type: 'separator' },
    { type: 'section', label: 'RESULTADO DA GERAÇÃO DE CAIXA' },
    { type: 'item',    label: 'SALDO INICIAL DISPONÍVEL',             key: 'saldoInicial' },
    { type: 'item',    label: 'SALDO FINAL DISPONÍVEL',               key: 'saldoFinal' },
    { type: 'result',  label: 'RESULTADO GERAÇÃO DE CAIXA',           key: 'resultadoGeracaoCaixa' },
];

type DreSubTab = 'dre' | 'patrimonial' | 'contas' | 'dfc';
type ReportViewMode = 'lista' | 'graficos' | 'fechado';
type DashboardOverviewTab = 'inicio' | 'financeiro' | 'contabil' | 'fiscal' | 'servicos';

const DRE_TABS: Array<{ id: DreSubTab; label: string; show: boolean }> = [
    { id: 'dre', label: 'DRE', show: true },
    { id: 'patrimonial', label: 'Patrimonial', show: true },
    { id: 'dfc', label: 'DFC', show: true },
];

const DASHBOARD_OVERVIEW_TABS: Array<{ id: DashboardOverviewTab; label: string }> = [
    { id: 'inicio', label: 'INICIO' },
    { id: 'financeiro', label: 'Financeiro' },
    { id: 'contabil', label: 'Contábil' },
    { id: 'fiscal', label: 'Fiscal' },
    { id: 'servicos', label: 'Serviços' },
];

const CLIENT_TAB_LABELS: Record<string, string> = {
    dashboard: 'Dashboard',
    financeiro: 'Financeiro',
    contabil: 'Contábil',
    fiscal: 'Fiscal',
    arquivos: 'Documentos',
    servicos: 'Serviços',
    suporte: 'Atendimento',
    movimentacoes: 'Movimentações',
    fluxoCaixa: 'Fluxo de Caixa',
    conciliacaoBancaria: 'Conciliação Bancária',
    dre: 'DRE',
    dfc: 'DFC',
    balancoPatrimonial: 'Balanço Patrimonial',
    impostos: 'Impostos',
    guias: 'Guias',
    folhaPagamento: 'Folha de Pagamento',
    obrigacoes: 'Obrigações',
    servicosContratados: 'Serviços Contratados',
};

const CLIENT_COMING_SOON_COPY: Record<string, { title: string; description: string }> = {};

const LazySectionFallback = ({ label }: { label: string }) => (
    <div className="bg-[#0d1829]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-10 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400/70">{label}</p>
                <p className="text-sm text-white/30 mt-1">Carregando modulo sob demanda.</p>
            </div>
        </div>
    </div>
);

const ComingSoonSection = ({ title, description }: { title: string; description: string }) => (
    <div className="space-y-6 pb-12">
        <div className="flex items-start justify-between gap-4">
            <div>
                <h3 className="text-3xl font-bold text-white tracking-tight">{title}</h3>
                <p className="text-white/40 text-sm mt-2 max-w-2xl">{description}</p>
            </div>
            <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-white/40">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold uppercase tracking-[0.2em]">Em breve</span>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#0d1829]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-6">
                <p className="text-white/40 text-xs font-black uppercase tracking-widest">Status</p>
                <p className="text-white text-2xl font-bold mt-2">Em construção</p>
            </div>
            <div className="bg-[#0d1829]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-6">
                <p className="text-white/40 text-xs font-black uppercase tracking-widest">Escopo</p>
                <p className="text-white text-2xl font-bold mt-2">Navegação pronta</p>
            </div>
            <div className="bg-[#0d1829]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-6">
                <p className="text-white/40 text-xs font-black uppercase tracking-widest">Próximo passo</p>
                <p className="text-white text-2xl font-bold mt-2">Implementação</p>
            </div>
        </div>
    </div>
);

const DeferredChartContainer = ({
    className,
    children,
}: {
    className?: string;
    children: React.ReactNode;
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isReady, setIsReady] = useState(false);

    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el || typeof ResizeObserver === 'undefined') {
            setIsReady(true);
            return;
        }

        const update = () => {
            const { width, height } = el.getBoundingClientRect();
            setIsReady(width > 0 && height > 0);
        };

        update();
        const observer = new ResizeObserver(update);
        observer.observe(el);

        return () => observer.disconnect();
    }, []);

    return (
        <div ref={containerRef} className={className}>
            {isReady ? children : <div className="h-full w-full" />}
        </div>
    );
};

type ModuleTone = 'cyan' | 'emerald' | 'amber' | 'rose' | 'violet';
type StatusTone = 'ok' | 'warn' | 'info';

type MockModuleCard = {
    label: string;
    value: string;
    hint: string;
    tone: ModuleTone;
};

type MockModuleStatus = {
    label: string;
    value: string;
    tone: StatusTone;
};

type MockModuleAction = {
    label: string;
    detail: string;
};

type MockModuleSectionGroup = {
    title: string;
    items: MockModuleAction[];
};

type MockModuleInsight = {
    title: string;
    detail: string;
    tone: ModuleTone;
};

type MockChartFormat = 'currency' | 'number' | 'percent';

type MockModuleChartMetric = {
    dataKey: string;
    label: string;
    color: string;
    strokeWidth?: number;
};

type MockModuleLineChart = {
    type: 'line';
    title: string;
    description: string;
    format: MockChartFormat;
    data: Array<Record<string, string | number>>;
    metrics: MockModuleChartMetric[];
};

type MockModulePieSlice = {
    name: string;
    value: number;
    color: string;
};

type MockModulePieChart = {
    type: 'pie';
    title: string;
    description: string;
    format: MockChartFormat;
    data: MockModulePieSlice[];
};

type MockModuleChart = MockModuleLineChart | MockModulePieChart;

type MockModule = {
    title: string;
    description: string;
    cards: MockModuleCard[];
    statuses: MockModuleStatus[];
    actions: MockModuleAction[];
    sections?: MockModuleSectionGroup[];
    insights?: MockModuleInsight[];
    charts?: MockModuleChart[];
    note: string;
};

const MODULE_CARD_TONES: Record<ModuleTone, string> = {
    cyan: 'from-cyan-500/20 to-blue-600/20 border-cyan-500/20',
    emerald: 'from-emerald-500/20 to-green-600/20 border-emerald-500/20',
    amber: 'from-amber-500/20 to-orange-600/20 border-amber-500/20',
    rose: 'from-rose-500/20 to-red-600/20 border-rose-500/20',
    violet: 'from-violet-500/20 to-fuchsia-600/20 border-violet-500/20',
};

const STATUS_TONES: Record<StatusTone, string> = {
    ok: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    warn: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    info: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
};

const formatMockChartValue = (value: number, format: MockChartFormat) => {
    switch (format) {
        case 'currency':
            return value.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
            });
        case 'percent':
            return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%`;
        case 'number':
        default:
            return value.toLocaleString('pt-BR');
    }
};

const CLIENT_MODULE_MOCKS: Record<string, MockModule> = {
    financeiro: {
        title: 'Financeiro',
        description: 'Visão consolidada do dinheiro da operação, com foco em fluxo de caixa, contas do ciclo e conciliação.',
        cards: [
            { label: 'Saldo consolidado', value: 'R$ 1,84 mi', hint: 'caixa disponível entre bancos e conta principal', tone: 'cyan' },
            { label: 'Entradas do período', value: 'R$ 2,20 mi', hint: 'recebimentos previstos e confirmados', tone: 'emerald' },
            { label: 'Saídas do período', value: 'R$ 1,91 mi', hint: 'fornecedores, folha e tributos', tone: 'rose' },
            { label: 'Fluxo projetado', value: '+R$ 290 mil', hint: 'estimativa até o fechamento do mês', tone: 'amber' },
        ],
        statuses: [
            { label: 'Conciliação bancária', value: 'Pendente', tone: 'warn' },
            { label: 'Contas a pagar', value: '18 títulos', tone: 'info' },
            { label: 'Contas a receber', value: '12 títulos', tone: 'ok' },
            { label: 'Distribuição de despesas', value: 'Atualizada', tone: 'ok' },
        ],
        actions: [
            { label: 'Maior saída prevista', detail: 'Folha, fornecedores e impostos concentram 61% das saídas dos próximos 10 dias.' },
            { label: 'Maior entrada prevista', detail: 'Contrato recorrente principal liquida no fim do mês e reforça o caixa.' },
            { label: 'Ponto de atenção', detail: 'Dois pagamentos relevantes vencem antes da baixa de um recebível estratégico.' },
        ],
        charts: [
            {
                type: 'line',
                title: 'Fluxo de caixa do mês',
                description: 'Entradas, saídas e saldo líquido por semana.',
                format: 'currency',
                data: [
                    { name: 'Sem 1', entradas: 420000, saidas: 310000, saldo: 110000 },
                    { name: 'Sem 2', entradas: 510000, saidas: 455000, saldo: 55000 },
                    { name: 'Sem 3', entradas: 580000, saidas: 490000, saldo: 90000 },
                    { name: 'Sem 4', entradas: 690000, saidas: 655000, saldo: 35000 },
                ],
                metrics: [
                    { dataKey: 'entradas', label: 'Entradas', color: '#22c55e' },
                    { dataKey: 'saidas', label: 'Saídas', color: '#fb7185' },
                    { dataKey: 'saldo', label: 'Saldo líquido', color: '#38bdf8', strokeWidth: 2 },
                ],
            },
            {
                type: 'pie',
                title: 'Distribuição das despesas',
                description: 'Composição simulada dos gastos do período.',
                format: 'percent',
                data: [
                    { name: 'Folha', value: 32, color: '#38bdf8' },
                    { name: 'Fornecedores', value: 24, color: '#22c55e' },
                    { name: 'Tributos', value: 18, color: '#f59e0b' },
                    { name: 'Fretes', value: 14, color: '#fb7185' },
                    { name: 'Operação', value: 12, color: '#a78bfa' },
                ],
            },
        ],
        sections: [
            {
                title: 'Fluxo de caixa',
                items: [
                    { label: 'Saldo inicial', detail: 'R$ 1,55 mi no primeiro dia útil do mês.' },
                    { label: 'Pico de entrada', detail: 'Dia 28 com liquidação de contratos recorrentes.' },
                    { label: 'Pico de saída', detail: 'Dia 05 com folha, aluguel e tributos em sequência.' },
                ],
            },
            {
                title: 'Contas do ciclo',
                items: [
                    { label: 'A pagar', detail: '7 vencimentos críticos nos próximos 10 dias.' },
                    { label: 'A receber', detail: 'Carteira saudável com inadimplência estimada abaixo de 2%.' },
                    { label: 'Conciliação', detail: '7 lançamentos aguardam validação do cliente.' },
                ],
            },
            {
                title: 'Leitura operacional',
                items: [
                    { label: 'Despesas mais pesadas', detail: 'Folha, frete e serviços de terceiros lideram a distribuição.' },
                    { label: 'Caixa disponível', detail: 'Cobre 22 dias de operação sem novas entradas.' },
                    { label: 'Evolução do caixa', detail: 'Trajetória estável nas três últimas semanas.' },
                ],
            },
        ],
        insights: [
            { title: 'Resumo executivo', detail: 'O caixa segue positivo, mas a folga depende da cadência de recebimentos no fim do mês.', tone: 'cyan' },
            { title: 'Alerta', detail: 'Despesas administrativas cresceram 12% frente ao mês anterior.', tone: 'rose' },
            { title: 'Recomendação', detail: 'Antecipar aprovações de pagamentos e revisar o cronograma dos recebíveis de maior valor.', tone: 'emerald' },
        ],
        note: 'A aba Financeiro já prepara o terreno para evoluir sem retrabalho para movimentações, fluxo de caixa, contas do ciclo e conciliação bancária.',
    },
    contabil: {
        title: 'Contábil',
        description: 'Fotografia contábil do negócio com foco em DRE, DFC, balanço patrimonial, balancete e indicadores técnicos.',
        cards: [
            { label: 'DRE do mês', value: 'R$ 428 mil', hint: 'resultado líquido simulado do período', tone: 'emerald' },
            { label: 'EBITDA', value: '18,4%', hint: 'margem operacional antes de efeitos financeiros', tone: 'cyan' },
            { label: 'Patrimônio líquido', value: 'R$ 6,9 mi', hint: 'posição consolidada do balanço', tone: 'violet' },
            { label: 'Balancete fechado', value: '97%', hint: 'lançamentos revisados até agora', tone: 'amber' },
        ],
        statuses: [
            { label: 'DRE', value: 'Atualizada', tone: 'ok' },
            { label: 'DFC', value: 'Em revisão', tone: 'warn' },
            { label: 'Balanço patrimonial', value: 'Pré-fechado', tone: 'info' },
            { label: 'Balancete', value: 'Disponível', tone: 'ok' },
        ],
        actions: [
            { label: 'Fechamento do mês', detail: 'Conferência final concentrada em provisões e lançamentos de competência.' },
            { label: 'Ajuste em aberto', detail: 'Duas classificações patrimoniais aguardam validação da contabilidade.' },
            { label: 'Próximo marco', detail: 'Publicar pacote contábil consolidado até o terceiro dia útil.' },
        ],
        charts: [
            {
                type: 'line',
                title: 'Evolução contábil recente',
                description: 'Receita líquida, despesas e resultado nos últimos meses.',
                format: 'currency',
                data: [
                    { name: 'Jan', receita: 3580000, despesas: 3010000, resultado: 365000 },
                    { name: 'Fev', receita: 3720000, despesas: 3095000, resultado: 401000 },
                    { name: 'Mar', receita: 3890000, despesas: 3180000, resultado: 428000 },
                    { name: 'Abr', receita: 4010000, despesas: 3270000, resultado: 446000 },
                ],
                metrics: [
                    { dataKey: 'receita', label: 'Receita líquida', color: '#38bdf8' },
                    { dataKey: 'despesas', label: 'Despesas', color: '#fb7185' },
                    { dataKey: 'resultado', label: 'Resultado líquido', color: '#22c55e', strokeWidth: 2 },
                ],
            },
            {
                type: 'pie',
                title: 'Estrutura patrimonial',
                description: 'Fotografia resumida da composição do balanço.',
                format: 'percent',
                data: [
                    { name: 'Ativo circulante', value: 41, color: '#38bdf8' },
                    { name: 'Ativo não circulante', value: 29, color: '#6366f1' },
                    { name: 'Passivo CP', value: 14, color: '#f59e0b' },
                    { name: 'Passivo LP', value: 6, color: '#fb7185' },
                    { name: 'Patrimônio líquido', value: 10, color: '#22c55e' },
                ],
            },
        ],
        sections: [
            {
                title: 'Relatórios disponíveis',
                items: [
                    { label: 'DRE consolidado', detail: 'Versão mensal pronta para leitura executiva.' },
                    { label: 'DFC', detail: 'Estrutura preparada para análise de geração de caixa.' },
                    { label: 'Balanço e balancete', detail: 'Base técnica pronta para aprofundar a leitura patrimonial.' },
                ],
            },
            {
                title: 'Indicadores contábeis',
                items: [
                    { label: 'Margem líquida', detail: '9,8% no fechamento simulado do período.' },
                    { label: 'Endividamento', detail: 'Alavancagem controlada, mas com pressão no curto prazo.' },
                    { label: 'Liquidez corrente', detail: '1,42x na fotografia patrimonial mais recente.' },
                ],
            },
            {
                title: 'Histórico mensal',
                items: [
                    { label: 'Janeiro', detail: 'Fechado e conciliado sem ressalvas.' },
                    { label: 'Fevereiro', detail: 'Fechado com ajuste de provisão comercial.' },
                    { label: 'Março', detail: 'Em consolidação com foco no fechamento técnico.' },
                ],
            },
        ],
        insights: [
            { title: 'Resumo executivo', detail: 'A operação mantém resultado líquido positivo e patrimônio saudável.', tone: 'emerald' },
            { title: 'Alerta', detail: 'A fotografia patrimonial pede atenção na concentração de passivos de curto prazo.', tone: 'amber' },
            { title: 'Recomendação', detail: 'Cruzar DRE, DFC e balanço na mesma rotina mensal para reduzir interpretações isoladas.', tone: 'cyan' },
        ],
        note: 'Essa aba consolida a visão técnica do negócio e pode virar a casa natural de DRE, DFC, balanço patrimonial, balancete e razão/diário no futuro.',
    },
    fiscal: {
        title: 'Fiscal',
        description: 'Controle dos tributos do mês, guias emitidas, obrigações entregues e alertas do calendário fiscal.',
        cards: [
            { label: 'Impostos do período', value: 'R$ 156 mil', hint: 'estimativa consolidada do mês', tone: 'amber' },
            { label: 'Guias emitidas', value: '12', hint: 'documentos prontos para pagamento', tone: 'cyan' },
            { label: 'Impostos pagos', value: '9', hint: 'liquidados sem divergência', tone: 'emerald' },
            { label: 'Pendências fiscais', value: '3', hint: 'dependem de documento ou aprovação', tone: 'rose' },
        ],
        statuses: [
            { label: 'Apuração fiscal', value: 'Concluída', tone: 'ok' },
            { label: 'Calendário fiscal', value: '2 prazos próximos', tone: 'warn' },
            { label: 'Obrigações acessórias', value: 'Em dia', tone: 'ok' },
            { label: 'Alertas fiscais', value: '1 ponto crítico', tone: 'info' },
        ],
        actions: [
            { label: 'Próximo vencimento', detail: 'DARF principal previsto para o dia 20 deste mês.' },
            { label: 'Pendência principal', detail: 'Falta anexar uma NF de serviço para fechar a apuração sem ressalva.' },
            { label: 'Risco mapeado', detail: 'Sem multa atual, mas com um prazo apertado na próxima semana.' },
        ],
        charts: [
            {
                type: 'line',
                title: 'Ritmo fiscal do período',
                description: 'Guias emitidas, pagas e pendentes ao longo do mês.',
                format: 'number',
                data: [
                    { name: 'Sem 1', emitidas: 3, pagas: 2, pendentes: 1 },
                    { name: 'Sem 2', emitidas: 4, pagas: 3, pendentes: 1 },
                    { name: 'Sem 3', emitidas: 2, pagas: 2, pendentes: 1 },
                    { name: 'Sem 4', emitidas: 3, pagas: 2, pendentes: 1 },
                ],
                metrics: [
                    { dataKey: 'emitidas', label: 'Emitidas', color: '#38bdf8' },
                    { dataKey: 'pagas', label: 'Pagas', color: '#22c55e' },
                    { dataKey: 'pendentes', label: 'Pendentes', color: '#fb7185', strokeWidth: 2 },
                ],
            },
            {
                type: 'pie',
                title: 'Carga tributária simulada',
                description: 'Distribuição estimada dos tributos do mês.',
                format: 'currency',
                data: [
                    { name: 'ICMS', value: 52000, color: '#38bdf8' },
                    { name: 'Retenções', value: 34000, color: '#f59e0b' },
                    { name: 'Folha', value: 28000, color: '#22c55e' },
                    { name: 'IRPJ/CSLL', value: 24000, color: '#a78bfa' },
                    { name: 'Outros', value: 18000, color: '#fb7185' },
                ],
            },
        ],
        sections: [
            {
                title: 'Calendário fiscal',
                items: [
                    { label: 'Dia 20', detail: 'Pagamento da guia principal do período.' },
                    { label: 'Dia 25', detail: 'Prazo de envio de documentos complementares.' },
                    { label: 'Dia 30', detail: 'Fechamento final das obrigações do mês.' },
                ],
            },
            {
                title: 'Obrigações entregues',
                items: [
                    { label: 'SPED / obrigação mensal', detail: 'Protocolada dentro do prazo.' },
                    { label: 'Guias recorrentes', detail: 'Emitidas e encaminhadas ao cliente.' },
                    { label: 'Histórico do período', detail: 'Sem rejeições ou retorno de malha até agora.' },
                ],
            },
            {
                title: 'Alertas e atenção',
                items: [
                    { label: 'Documento pendente', detail: 'Extrato complementar ainda não foi anexado.' },
                    { label: 'Imposto mais relevante', detail: 'ICMS e retenções representam o maior bloco financeiro.' },
                    { label: 'Ação prática', detail: 'Priorizar a aprovação das guias antes do fechamento da semana.' },
                ],
            },
        ],
        insights: [
            { title: 'Resumo executivo', detail: 'O mês está bem encaminhado no fiscal, com apuração concluída e baixa taxa de pendência.', tone: 'emerald' },
            { title: 'Alerta', detail: 'A proximidade de vencimentos exige resposta rápida do cliente em um documento específico.', tone: 'rose' },
            { title: 'Recomendação', detail: 'Usar esta área como central única de impostos, guias, obrigações e calendário.', tone: 'cyan' },
        ],
        note: 'A aba Fiscal já nasce alinhada ao que mais gera valor percebido para o cliente: o que está pago, o que vence agora e o que ainda depende de ação.',
    },
    servicos: {
        title: 'Serviços',
        description: 'Visão da contabilidade como prestadora, com status do fechamento, documentos solicitados, execução e atendimento.',
        cards: [
            { label: 'Serviços ativos', value: '7', hint: 'escopo contratado no plano atual', tone: 'cyan' },
            { label: 'Fechamento do mês', value: 'Em andamento', hint: 'rotina central da operação', tone: 'amber' },
            { label: 'Documentos solicitados', value: '4', hint: 'itens aguardando envio do cliente', tone: 'rose' },
            { label: 'Chamados em aberto', value: '2', hint: 'atendimento ativo no período', tone: 'violet' },
        ],
        statuses: [
            { label: 'Fechamento contábil', value: 'Em andamento', tone: 'warn' },
            { label: 'Conciliação bancária', value: 'Pendente', tone: 'warn' },
            { label: 'Apuração fiscal', value: 'Concluída', tone: 'ok' },
            { label: 'Folha de pagamento', value: 'Concluída', tone: 'ok' },
            { label: 'SLA geral', value: '96%', tone: 'info' },
        ],
        actions: [
            { label: 'Documento crítico', detail: 'Extrato bancário de janeiro ainda é a principal pendência do cliente.' },
            { label: 'Entrega seguinte', detail: 'Pacote mensal consolidado previsto para envio após o fechamento técnico.' },
            { label: 'Atendimento', detail: 'Equipe já sinalizou dúvidas em um chamado sobre pró-labore.' },
        ],
        charts: [
            {
                type: 'line',
                title: 'Operação de atendimento',
                description: 'Chamados, documentos e entregas acompanhados por semana.',
                format: 'number',
                data: [
                    { name: 'Sem 1', chamados: 3, documentos: 5, entregas: 2 },
                    { name: 'Sem 2', chamados: 2, documentos: 4, entregas: 3 },
                    { name: 'Sem 3', chamados: 4, documentos: 3, entregas: 4 },
                    { name: 'Sem 4', chamados: 2, documentos: 2, entregas: 5 },
                ],
                metrics: [
                    { dataKey: 'chamados', label: 'Chamados', color: '#a78bfa' },
                    { dataKey: 'documentos', label: 'Documentos', color: '#fb7185' },
                    { dataKey: 'entregas', label: 'Entregas', color: '#22c55e', strokeWidth: 2 },
                ],
            },
            {
                type: 'pie',
                title: 'Pipeline dos serviços',
                description: 'Status atual da operação simulada do cliente.',
                format: 'percent',
                data: [
                    { name: 'Concluído', value: 44, color: '#22c55e' },
                    { name: 'Em andamento', value: 27, color: '#38bdf8' },
                    { name: 'Aguardando cliente', value: 18, color: '#f59e0b' },
                    { name: 'Agendado', value: 11, color: '#a78bfa' },
                ],
            },
        ],
        sections: [
            {
                title: 'Serviços contratados',
                items: [
                    { label: 'Escrituração contábil', detail: 'Rotina principal com fechamento mensal em andamento.' },
                    { label: 'Apuração fiscal', detail: 'Fluxo operacional concluído no período atual.' },
                    { label: 'Suporte consultivo', detail: 'Acompanhamento recorrente com reuniões mensais.' },
                ],
            },
            {
                title: 'Documentos solicitados',
                items: [
                    { label: 'Extrato bancário de janeiro', detail: 'Necessário para finalizar a conciliação.' },
                    { label: 'Nota fiscal de serviço', detail: 'Falta anexar um documento para completar o fechamento.' },
                    { label: 'Aprovação de pró-labore', detail: 'Validação pendente para concluir a folha societária.' },
                ],
            },
            {
                title: 'Histórico de atendimento',
                items: [
                    { label: 'Reunião mensal', detail: 'Agendada para o dia 27 às 10h25.' },
                    { label: 'Último chamado', detail: 'Solicitação sobre calendário fiscal respondida em 4h.' },
                    { label: 'Próximo contato', detail: 'Follow-up automático após a entrega do fechamento.' },
                ],
            },
        ],
        insights: [
            { title: 'Resumo executivo', detail: 'A operação contábil está ativa e com boa percepção de serviço, mas depende de poucos itens do cliente para finalizar.', tone: 'cyan' },
            { title: 'Alerta', detail: 'A ausência de documentos trava a conciliação e pode atrasar o pacote mensal.', tone: 'rose' },
            { title: 'Recomendação', detail: 'Concentrar aqui status operacionais, documentos, SLA e histórico de atendimento.', tone: 'emerald' },
        ],
        note: 'Essa aba deixa claro o que a contabilidade está fazendo agora e ajuda a transformar serviço percebido em produto visível.',
    },
    movimentacoes: {
        title: 'Movimentações',
        description: 'Resumo operacional dos lançamentos e da fila de tratamento contábil.',
        cards: [
            { label: 'Lançamentos do mês', value: '384', hint: '+12% vs mês anterior', tone: 'cyan' },
            { label: 'Débitos', value: 'R$ 4,8 mi', hint: 'parcelas, impostos e despesas', tone: 'rose' },
            { label: 'Créditos', value: 'R$ 5,3 mi', hint: 'receitas e estornos', tone: 'emerald' },
            { label: 'Pendentes', value: '17', hint: 'aguardando conciliação', tone: 'amber' },
        ],
        statuses: [
            { label: 'Importação bancária', value: 'Concluída', tone: 'ok' },
            { label: 'Classificação contábil', value: 'Em revisão', tone: 'warn' },
            { label: 'Lançamentos sem centro de custo', value: '4', tone: 'info' },
        ],
        actions: [
            { label: 'Ultima importação', detail: 'Extrato OFX de janeiro processado há 2 dias.' },
            { label: 'Movimentações sem categoria', detail: '7 itens aguardando tratamento manual.' },
            { label: 'Histórico recente', detail: 'Concentração maior em folha, fornecedores e tributos.' },
        ],
        note: 'O módulo de movimentações aqui é o ponto de entrada para conciliação e classificação futura.',
    },
    fluxoCaixa: {
        title: 'Fluxo de Caixa',
        description: 'Visão de entradas, saídas e projeção para os próximos dias.',
        cards: [
            { label: 'Saldo consolidado', value: 'R$ 1,84 mi', hint: 'disponível em caixa e bancos', tone: 'cyan' },
            { label: 'Entradas previstas', value: 'R$ 2,20 mi', hint: 'recebimentos e antecipações', tone: 'emerald' },
            { label: 'Saídas previstas', value: 'R$ 1,91 mi', hint: 'pagamentos e impostos', tone: 'rose' },
            { label: 'Janela crítica', value: '7 dias', hint: 'maior volume de saídas', tone: 'amber' },
        ],
        statuses: [
            { label: 'Caixa projetado', value: 'Positivo', tone: 'ok' },
            { label: 'Cobertura de despesas', value: '22 dias', tone: 'info' },
            { label: 'Alertas de caixa', value: '2', tone: 'warn' },
        ],
        actions: [
            { label: 'Maior saída prevista', detail: 'Folha e tributos concentram 48% das saídas do mês.' },
            { label: 'Maior entrada prevista', detail: 'Recebimentos recorrentes do contrato principal.' },
            { label: 'Ponto de atenção', detail: 'Revisar saldo mínimo antes do quinto dia útil.' },
        ],
        note: 'Esse painel ajuda a responder se o caixa do cliente aguenta a operação sem susto.',
    },
    conciliacaoBancaria: {
        title: 'Conciliação Bancária',
        description: 'Acompanhamento do que já foi batido e do que ainda precisa ser reconciliado.',
        cards: [
            { label: 'Extratos processados', value: '6', hint: 'bancos ativos no período', tone: 'cyan' },
            { label: 'Itens conciliados', value: '342', hint: 'movimentos batidos', tone: 'emerald' },
            { label: 'Itens pendentes', value: '18', hint: 'diferenças e divergências', tone: 'rose' },
            { label: 'Alertas', value: '3', hint: 'transações fora do padrão', tone: 'amber' },
        ],
        statuses: [
            { label: 'Banco principal', value: '96% conciliado', tone: 'ok' },
            { label: 'Conta secundária', value: 'Em validação', tone: 'warn' },
            { label: 'Diferenças antigas', value: '2 lançamentos', tone: 'info' },
        ],
        actions: [
            { label: 'Último ajuste', detail: 'Diferença de tarifa bancária ajustada manualmente.' },
            { label: 'Transação crítica', detail: 'PIX duplicado em análise para reversão.' },
            { label: 'Fila de revisão', detail: '5 itens precisam de conferência do cliente.' },
        ],
        note: 'Quando essa tela virar real, ela deve reduzir retrabalho no fechamento mensal.',
    },
    impostos: {
        title: 'Impostos',
        description: 'Painel de apuração, vencimento e acompanhamento fiscal do período.',
        cards: [
            { label: 'Impostos estimados', value: 'R$ 156 mil', hint: 'projeção do mês', tone: 'amber' },
            { label: 'Guias emitidas', value: '12', hint: 'documentos prontos', tone: 'cyan' },
            { label: 'Vencidos', value: '1', hint: 'aguardando regularização', tone: 'rose' },
            { label: 'Pagos', value: '9', hint: 'liquidados no período', tone: 'emerald' },
        ],
        statuses: [
            { label: 'Apuração fiscal', value: 'Concluída', tone: 'ok' },
            { label: 'Pendências de documentação', value: '3', tone: 'warn' },
            { label: 'Alertas de vencimento', value: '2', tone: 'info' },
        ],
        actions: [
            { label: 'Próximo vencimento', detail: 'IRPJ previsto para o dia 20.' },
            { label: 'Maior tributo', detail: 'ICMS e retenções representam o maior bloco do mês.' },
            { label: 'Situação', detail: 'Sem alerta de multa, mas com documentos pendentes.' },
        ],
        note: 'Essa área deve virar o centro de controle fiscal do cliente.',
    },
    guias: {
        title: 'Guias',
        description: 'Emissão, conferência e histórico de guias tributárias e trabalhistas.',
        cards: [
            { label: 'Guias emitidas', value: '14', hint: 'no mês atual', tone: 'cyan' },
            { label: 'Pagas', value: '11', hint: 'liquidadas com sucesso', tone: 'emerald' },
            { label: 'Aguardando assinatura', value: '2', hint: 'cliente precisa aprovar', tone: 'amber' },
            { label: 'Atrasadas', value: '1', hint: 'em acompanhamento', tone: 'rose' },
        ],
        statuses: [
            { label: 'INSS / FGTS', value: 'Em dia', tone: 'ok' },
            { label: 'Guias de imposto', value: '2 pendentes', tone: 'warn' },
            { label: 'Histórico de emissão', value: 'Completo', tone: 'info' },
        ],
        actions: [
            { label: 'Última guia emitida', detail: 'DARF de retenções liberado ontem.' },
            { label: 'Pendência', detail: 'Uma guia depende de aprovação do cliente.' },
            { label: 'Controle', detail: 'Reemissão disponível caso haja divergência.' },
        ],
        note: 'Útil para o cliente entender o que já saiu e o que ainda depende de ação.',
    },
    folhaPagamento: {
        title: 'Folha de Pagamento',
        description: 'Visão de folha, pró-labore, encargos e status da rotina trabalhista.',
        cards: [
            { label: 'Colaboradores', value: '84', hint: 'ativos no período', tone: 'cyan' },
            { label: 'Folha total', value: 'R$ 1,2 mi', hint: 'bruto estimado', tone: 'emerald' },
            { label: 'Pró-labore', value: 'R$ 48 mil', hint: 'sócios e administradores', tone: 'amber' },
            { label: 'Pendências', value: '3', hint: 'documentos ou aprovações', tone: 'rose' },
        ],
        statuses: [
            { label: 'Processamento', value: 'Concluído', tone: 'ok' },
            { label: 'Encargos', value: 'Em apuração', tone: 'warn' },
            { label: 'Aprovação do cliente', value: '1 pendente', tone: 'info' },
        ],
        actions: [
            { label: 'Fechamento da folha', detail: 'Programado para o quinto dia útil.' },
            { label: 'Encargo relevante', detail: 'INSS e FGTS concentram o maior impacto.' },
            { label: 'Ação pendente', detail: 'Aprovar pró-labore do sócio principal.' },
        ],
        note: 'Quando virar real, essa área pode reduzir muito o vai-e-volta com o cliente.',
    },
    obrigacoes: {
        title: 'Obrigações',
        description: 'Calendário de obrigações acessórias, entregas e documentos pendentes.',
        cards: [
            { label: 'Obrigações do mês', value: '11', hint: 'entregas previstas', tone: 'cyan' },
            { label: 'Entregues', value: '8', hint: 'já protocoladas', tone: 'emerald' },
            { label: 'Pendentes', value: '3', hint: 'em preparação', tone: 'amber' },
            { label: 'Alertas', value: '2', hint: 'prazo próximo', tone: 'rose' },
        ],
        statuses: [
            { label: 'SPED', value: 'Concluído', tone: 'ok' },
            { label: 'Documentos faltantes', value: '5 itens', tone: 'warn' },
            { label: 'Entrega crítica', value: 'Próxima semana', tone: 'info' },
        ],
        actions: [
            { label: 'Obrigação mais próxima', detail: 'EFD/ECF dependendo do regime do cliente.' },
            { label: 'Regra de negócio', detail: 'Sem documento, a obrigação fica em aguardando.' },
            { label: 'Status geral', detail: 'Fechamento operacional em andamento.' },
        ],
        note: 'Esse módulo funciona bem como checklist operacional da contabilidade.',
    },
    servicosContratados: {
        title: 'Serviços Contratados',
        description: 'Escopo contratado, entregas recorrentes e status da operação contábil.',
        cards: [
            { label: 'Serviços ativos', value: '7', hint: 'no contrato atual', tone: 'cyan' },
            { label: 'Em execução', value: '3', hint: 'em andamento nesta semana', tone: 'amber' },
            { label: 'SLA', value: '96%', hint: 'cumprimento estimado', tone: 'emerald' },
            { label: 'Reuniões', value: '2', hint: 'agendadas no mês', tone: 'violet' },
        ],
        statuses: [
            { label: 'Fechamento contábil', value: 'Em andamento', tone: 'warn' },
            { label: 'Revisão de documentos', value: 'Concluída', tone: 'ok' },
            { label: 'Entregas recorrentes', value: 'Prontas', tone: 'info' },
        ],
        actions: [
            { label: 'Serviço principal', detail: 'Escrituração e fechamento mensal seguem como prioridade.' },
            { label: 'Ação em curso', detail: 'Validação de documentos e ajustes de relatórios.' },
            { label: 'Próxima entrega', detail: 'Pacote mensal consolidado para o cliente.' },
        ],
        note: 'Esse bloco ajuda a explicar o que a contabilidade está entregando agora.',
    },
};

const MockModuleSection = ({
    module,
    reportRef,
}: {
    module: MockModule;
    reportRef?: React.RefObject<HTMLDivElement | null>;
}) => {
    const sectionsGridClass =
        !module.sections || module.sections.length <= 1
            ? 'grid-cols-1'
            : module.sections.length === 2
                ? 'grid-cols-1 xl:grid-cols-2'
                : 'grid-cols-1 xl:grid-cols-3';
    const lineChart = module.charts?.find((chart): chart is MockModuleLineChart => chart.type === 'line');
    const pieChart = module.charts?.find((chart): chart is MockModulePieChart => chart.type === 'pie');
    const heroStatuses = module.statuses.slice(0, 3);
    const heroActions = module.actions.slice(0, 3);
    const heroCards = module.cards.slice(0, 3);

    return (
        <div ref={reportRef} className="space-y-6 pb-12">
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                <div className="xl:col-span-3 relative overflow-hidden rounded-[28px] border border-cyan-500/15 bg-linear-to-br from-[#12304d] via-[#0d1829] to-[#101f35] p-7 shadow-2xl shadow-black/20">
                    <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
                    <div className="absolute -bottom-20 left-12 h-52 w-52 rounded-full bg-blue-500/10 blur-3xl" />
                    <div className="relative z-10 space-y-6">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-cyan-300">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Módulo estratégico
                                </div>
                                <h3 className="mt-4 text-3xl font-black tracking-tight text-white">{module.title}</h3>
                                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/55">{module.description}</p>
                            </div>
                            <div className="hidden md:flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-white/40">
                                <Sparkles className="w-4 h-4 text-cyan-400" />
                                <span className="text-xs font-bold uppercase tracking-[0.2em]">Mockado</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {heroCards.map((card) => (
                                <div key={`hero-${card.label}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-sm">
                                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/35">{card.label}</p>
                                    <p className="mt-2 text-xl font-black tracking-tight text-white">{card.value}</p>
                                    <p className="mt-2 text-xs leading-relaxed text-white/40">{card.hint}</p>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-wrap gap-3">
                            {heroStatuses.map((status) => (
                                <div key={`hero-status-${status.label}`} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                                    <span className={`h-2.5 w-2.5 rounded-full ${status.tone === 'ok' ? 'bg-emerald-400' : status.tone === 'warn' ? 'bg-amber-400' : 'bg-cyan-400'}`} />
                                    <span className="text-xs font-bold text-white/70">{status.label}</span>
                                    <span className="text-xs text-white/35">{status.value}</span>
                                </div>
                            ))}
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/35">Leitura rápida</p>
                            <p className="mt-2 text-sm leading-relaxed text-white/65">{module.note}</p>
                        </div>
                    </div>
                </div>

                <div className="xl:col-span-2 rounded-[28px] border border-white/10 bg-[#0d1829]/90 p-6 shadow-2xl shadow-black/20">
                    <div className="flex items-start justify-between gap-4 mb-6">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300/70">Pulso operacional</p>
                            <h4 className="mt-2 text-xl font-black tracking-tight text-white">Prioridades desta aba</h4>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-cyan-300">
                            <BarChart3 className="h-5 w-5" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        {heroActions.map((action, index) => (
                            <div key={`hero-action-${action.label}`} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-bold text-white">{action.label}</p>
                                    <span className="text-[10px] font-black uppercase tracking-[0.24em] text-white/25">0{index + 1}</span>
                                </div>
                                <p className="mt-2 text-xs leading-relaxed text-white/45">{action.detail}</p>
                                <div className="mt-4 h-2 rounded-full bg-white/5">
                                    <div
                                        className="h-2 rounded-full bg-linear-to-r from-cyan-400 via-blue-500 to-emerald-400"
                                        style={{ width: `${92 - index * 18}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {module.cards.map((card) => (
                    <div key={card.label} className={`group relative overflow-hidden bg-linear-to-br ${MODULE_CARD_TONES[card.tone]} backdrop-blur-xl border rounded-2xl p-5`}>
                        <div className="absolute inset-x-0 top-0 h-1 bg-white/20" />
                        <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-white/10 blur-2xl transition-opacity group-hover:opacity-100" />
                        <p className="relative text-white/60 text-xs font-black uppercase tracking-widest mb-2">{card.label}</p>
                        <h4 className="relative text-white text-2xl font-black tracking-tight">{card.value}</h4>
                        <p className="relative text-white/45 text-xs mt-2">{card.hint}</p>
                    </div>
                ))}
            </div>

            {(lineChart || pieChart) ? (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {lineChart ? (
                        <div className={`${pieChart ? 'xl:col-span-2' : 'xl:col-span-3'} bg-[#0d1829]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-6`}>
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-5">
                                <div>
                                    <h4 className="text-white font-bold text-lg">{lineChart.title}</h4>
                                    <p className="text-white/40 text-sm mt-1">{lineChart.description}</p>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    {lineChart.metrics.map((metric) => (
                                        <div key={metric.dataKey} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: metric.color }} />
                                            <span className="text-xs font-bold text-white/60">{metric.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <DeferredChartContainer className="h-72 -mx-3">
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                    <LineChart data={lineChart.data}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff08" />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }}
                                        />
                                        <YAxis hide />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#0f172a',
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                borderRadius: '16px',
                                                boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.2)',
                                                backdropFilter: 'blur(12px)',
                                            }}
                                            itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                                            labelStyle={{ color: '#ffffff70', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 'black' }}
                                            formatter={(value, name) => {
                                                const numericValue = typeof value === 'string' ? Number(value) : value ?? 0;
                                                const metricName = typeof name === 'string' ? name : '';
                                                const metric = lineChart.metrics.find((item) => item.dataKey === metricName);
                                                return [formatMockChartValue(Number(numericValue), lineChart.format), metric?.label ?? metricName];
                                            }}
                                        />
                                        {lineChart.metrics.map((metric) => (
                                            <Line
                                                key={metric.dataKey}
                                                type="monotone"
                                                dataKey={metric.dataKey}
                                                stroke={metric.color}
                                                strokeWidth={metric.strokeWidth ?? 3}
                                                dot={false}
                                                activeDot={{ r: 4, stroke: metric.color, strokeWidth: 2, fill: '#0d1829' }}
                                            />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </DeferredChartContainer>
                        </div>
                    ) : null}

                    {pieChart ? (
                        <div className="bg-[#0d1829]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-6">
                            <div className="mb-5">
                                <h4 className="text-white font-bold text-lg">{pieChart.title}</h4>
                                <p className="text-white/40 text-sm mt-1">{pieChart.description}</p>
                            </div>
                            <DeferredChartContainer className="h-64">
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                    <RechartsPie>
                                        <Pie
                                            data={pieChart.data}
                                            dataKey="value"
                                            nameKey="name"
                                            innerRadius={58}
                                            outerRadius={92}
                                            paddingAngle={3}
                                            stroke="transparent"
                                        >
                                            {pieChart.data.map((slice) => (
                                                <Cell key={slice.name} fill={slice.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#0f172a',
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                borderRadius: '16px',
                                                boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.2)',
                                                backdropFilter: 'blur(12px)',
                                            }}
                                            itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                                            labelStyle={{ color: '#ffffff70', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 'black' }}
                                            formatter={(value) => {
                                                const numericValue = typeof value === 'string' ? Number(value) : value ?? 0;
                                                return [formatMockChartValue(Number(numericValue), pieChart.format), 'Valor'];
                                            }}
                                        />
                                    </RechartsPie>
                                </ResponsiveContainer>
                            </DeferredChartContainer>
                            <div className="mt-4 space-y-3">
                                {pieChart.data.map((slice) => (
                                    <div key={slice.name} className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: slice.color }} />
                                            <span className="text-sm font-semibold text-white">{slice.name}</span>
                                        </div>
                                        <span className="text-xs font-bold text-white/60">{formatMockChartValue(slice.value, pieChart.format)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : null}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 bg-[#0d1829]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h4 className="text-white font-bold text-lg">Situação do mês</h4>
                        <span className="text-xs text-white/30 uppercase tracking-[0.2em] font-black">Dados simulados</span>
                    </div>
                    <div className="space-y-3">
                        {module.statuses.map((status) => (
                            <div key={status.label} className="flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
                                <div>
                                    <p className="text-white font-semibold">{status.label}</p>
                                </div>
                                <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${STATUS_TONES[status.tone]}`}>
                                    {status.value}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-[#0d1829]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h4 className="text-white font-bold text-lg">Pendências e próximos passos</h4>
                        <LifeBuoy className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="space-y-4">
                        {module.actions.map((action) => (
                            <div key={action.label} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                                <p className="text-white font-semibold text-sm">{action.label}</p>
                                <p className="text-white/40 text-xs mt-1 leading-relaxed">{action.detail}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {module.sections?.length ? (
                <div className={`grid ${sectionsGridClass} gap-6`}>
                    {module.sections.map((section) => (
                        <div key={section.title} className="bg-[#0d1829]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-5">
                                <h4 className="text-white font-bold text-lg">{section.title}</h4>
                                <div className="w-2 h-2 rounded-full bg-cyan-400/70" />
                            </div>
                            <div className="space-y-4">
                                {section.items.map((item) => (
                                    <div key={`${section.title}-${item.label}`} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                                        <p className="text-white font-semibold text-sm">{item.label}</p>
                                        <p className="text-white/40 text-xs mt-1 leading-relaxed">{item.detail}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}

            {module.insights?.length ? (
                <div className="bg-[#0d1829]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-6">
                    <div className="flex items-center justify-between gap-4 mb-5">
                        <div>
                            <p className="text-white/40 text-xs font-black uppercase tracking-widest">Análise inteligente</p>
                            <p className="text-white text-lg font-bold mt-2">Resumo executivo, alertas e recomendações</p>
                        </div>
                        <div className="hidden lg:flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-[0.2em]">
                            <Sparkles className="w-4 h-4" />
                            Simulado
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {module.insights.map((insight) => (
                            <div key={insight.title} className={`bg-linear-to-br ${MODULE_CARD_TONES[insight.tone]} backdrop-blur-xl border rounded-2xl p-5`}>
                                <p className="text-white/60 text-xs font-black uppercase tracking-widest mb-2">{insight.title}</p>
                                <p className="text-white text-sm leading-relaxed">{insight.detail}</p>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            <div className="bg-[#0d1829]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="text-white/40 text-xs font-black uppercase tracking-widest">Nota de produto</p>
                        <p className="text-white text-sm mt-2">{module.note}</p>
                    </div>
                    <div className="hidden lg:flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-[0.2em]">
                        <Sparkles className="w-4 h-4" />
                        Prova de conceito
                    </div>
                </div>
            </div>
        </div>
    );
};

const ClientDashboard = () => {
    const { id: clientId } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // State Declarations
    const [activeTab, setActiveTab] = useState('dashboard');
    const [dashboardTab, setDashboardTab] = useState<DashboardOverviewTab>('inicio');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [dreSubTab, setDreSubTab] = useState<DreSubTab>('dre');
    const [dreViewMode, setDreViewMode] = useState<ReportViewMode>('lista');
    const [dreConfigMode, setDreConfigMode] = useState(false);
    const [dreMappings, setDreMappings] = useState<Array<{ account_code: string; category: string }>>([]);
    const [patViewMode, setPatViewMode] = useState<ReportViewMode>('lista');
    const [patConfigMode, setPatConfigMode] = useState(false);
    const [expandedPatGroups, setExpandedPatGroups] = useState<Set<string>>(
        new Set(['ativo_circ', 'ativo_nao', 'pass_circ', 'pass_nao', 'pat_liq'])
    );
    const togglePatGroup = (id: string) => setExpandedPatGroups(prev => {
        const next = new Set(prev);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        return next;
    });
    const [selectedMonthIndex, setSelectedMonthIndex] = useState(0); // Jan by default
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSupportOpen, setIsSupportOpen] = useState(false);
    const [searchTerm] = useState('');
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const reportRef = useRef<HTMLDivElement>(null);
    const sidebarScrollRef = useRef<HTMLDivElement>(null);
    const contentScrollRef = useRef<HTMLDivElement>(null);
    const dreImportInputRef = useRef<HTMLInputElement>(null);
    const patrimonialImportInputRef = useRef<HTMLInputElement>(null);

    // Estado do card de IA
    const [aiText, setAiText] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState('');

    const handleExportPDF = async (title: string) => {
        const el = reportRef.current;
        if (!el) return;
        try {
            const [{ default: html2canvas }, { default: jsPDF }] = await loadPdfModules();
            const canvas = await html2canvas(el, {
                backgroundColor: '#0a1628',
                scale: 2,
                useCORS: true,
                logging: false,
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
                unit: 'px',
                format: [canvas.width, canvas.height],
            });
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`${title}_${months[selectedMonthIndex]}_${selectedYear}.pdf`);
        } catch (err) {
            console.error('Erro ao gerar PDF:', err);
        }
    };

    const [supportForm, setSupportForm] = useState({
        subject: '',
        message: '',
        priority: 'medium',
    });
    const [supportSubmitting, setSupportSubmitting] = useState(false);
    const [supportError, setSupportError] = useState<string | null>(null);
    const [selectedSupportTicketId, setSelectedSupportTicketId] = useState<string | null>(null);
    const [supportReplyDraft, setSupportReplyDraft] = useState('');
    const [isSubmittingSupportReply, setIsSubmittingSupportReply] = useState(false);
    const clientLogout = useClientAuthStore((state) => state.logout);
    const isAccountingView = Boolean(clientId);
    const isClientView = !isAccountingView;
    const isReadOnly = isClientView;
    const showDrePatConfigButtons = Date.now() < 0;

    const [accounts, setAccounts] = useState<Account[]>([]);
    const [dreMovements, setDreMovements] = useState<MovementRow[]>([]); // balancete DRE (resultado)
    const [patrimonialMovements, setPatrimonialMovements] = useState<MovementRow[]>([]); // balancete Patrimonial

    const [newAccount, setNewAccount] = useState<Omit<Account, 'total'>>({
        classification: '',
        name: '',
        category: '',
        values: Array(12).fill('0,00'),
        level: 5
    });

    const months = useMemo(() => [
        'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
        'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ], []);
    const availableYears = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return Array.from({ length: 8 }, (_, index) => currentYear + 1 - index);
    }, []);
    const showLegacyDfc = false;

    const scrollPageToTop = () => {
        if (typeof window === 'undefined') return;
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
    };

    useLayoutEffect(() => {
        if (typeof window === 'undefined') return;
        window.history.scrollRestoration = 'manual';
    }, []);

    useLayoutEffect(() => {
        if (activeTab === 'dfc') {
            setDreSubTab('dfc');
        } else if (activeTab === 'balancoPatrimonial') {
            setDreSubTab('patrimonial');
        } else if (activeTab === 'dre') {
            setDreSubTab('dre');
        }
        scrollPageToTop();
    }, [activeTab]);

    useEffect(() => {
        if (sidebarScrollRef.current) {
            sidebarScrollRef.current.scrollTop = 0;
        }
    }, []);

    useLayoutEffect(() => {
        setActiveTab('dashboard');
        setDashboardTab('inicio');
        scrollPageToTop();
    }, [clientId]);

    const sidebarItems = [
        { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
        { id: 'movimentacoes', icon: FileSpreadsheet, label: 'Movimentações' },
        { id: 'fluxoCaixa', icon: TrendingUp, label: 'Fluxo de Caixa' },
        { id: 'conciliacaoBancaria', icon: RefreshCw, label: 'Conciliação Bancária' },
        { id: 'dre', icon: Calculator, label: 'DRE' },
        { id: 'dfc', icon: FileText, label: 'DFC' },
        { id: 'balancoPatrimonial', icon: FileText, label: 'Balanço Patrimonial' },
        { id: 'impostos', icon: CalendarDays, label: 'Impostos' },
        { id: 'guias', icon: FileText, label: 'Guias' },
        { id: 'folhaPagamento', icon: LayoutList, label: 'Folha de Pagamento' },
        { id: 'obrigacoes', icon: Sparkles, label: 'Obrigações' },
        { id: 'arquivos', icon: Upload, label: 'Documentos' },
        { id: 'servicosContratados', icon: Settings2, label: 'Serviços Contratados' },
        { id: 'suporte', icon: Ticket, label: 'Atendimento' },
    ] as const;

    const activeSidebarLabel = CLIENT_TAB_LABELS[activeTab] ?? 'Dashboard';
    const moduleMock = CLIENT_MODULE_MOCKS[activeTab];
    const activeDashboardModule = dashboardTab === 'inicio' ? null : CLIENT_MODULE_MOCKS[dashboardTab];
    const comingSoonCopy = CLIENT_COMING_SOON_COPY[activeTab];
    const isComingSoonTab = Boolean(comingSoonCopy);
    const sidebarWidth = isSidebarOpen ? 256 : 80;
    const isReportTab = activeTab === 'dre' || activeTab === 'dfc' || activeTab === 'balancoPatrimonial';
    const exportLabel = activeTab === 'dre'
        ? 'DRE'
        : activeTab === 'dfc'
            ? 'DFC'
            : activeTab === 'balancoPatrimonial'
                ? 'Balanco_Patrimonial'
                : 'Relatorio';

    const clientQuery = useQuery<ClientDashboardProfile>({
        queryKey: ['client-dashboard-client', clientId ?? 'self'],
        queryFn: async () => {
            if (isAccountingView && clientId) {
                return clientService.getById(clientId);
            }

            return clientPortalService.getMe();
        },
        enabled: (isAccountingView && Boolean(clientId)) || isClientView,
        staleTime: 60_000,
    });
    const client = clientQuery.data ?? null;
    const isClientLoading = clientQuery.isPending;

    const chartAccountsQuery = useQuery({
        queryKey: isAccountingView ? ['staff-chart-of-accounts'] : ['client-dashboard-chart-accounts', 'self'],
        queryFn: async () => {
            if (isAccountingView && clientId) {
                return chartOfAccountsService.getSharedAll();
            }

            if (isClientView) {
                return clientChartOfAccountsService.getAll();
            }

            return [];
        },
        enabled: (isAccountingView && Boolean(clientId)) || isClientView,
        staleTime: 300_000,
    });

    const dreMappingsQuery = useQuery({
        queryKey: ['global-dre-mappings'],
        queryFn: async () => {
            if (!isAccountingView || !clientId) return [];

            const { data } = await api.get('/accounting/dre-mappings');
            return Array.isArray(data) ? data : [];
        },
        enabled: isAccountingView && Boolean(clientId),
        staleTime: 300_000,
    });

    const dreMovementsQuery = useQuery({
        queryKey: ['client-dashboard-dre-movements', clientId ?? 'self', selectedYear, isAccountingView ? 'accounting' : 'client'],
        queryFn: async () => {
            if (isAccountingView && clientId) {
                return movementService.getAll(clientId, selectedYear, 'dre');
            }

            if (isClientView) {
                const data = await clientPortalService.getMovements(selectedYear, 'dre');
                return data.map((movement) => ({ ...movement, category: movement.category ?? undefined })) as MovementRow[];
            }

            return [];
        },
        enabled: (isAccountingView && Boolean(clientId)) || isClientView,
        staleTime: 30_000,
    });

    const patrimonialMovementsQuery = useQuery({
        queryKey: ['client-dashboard-patrimonial-movements', clientId ?? 'self', selectedYear, isAccountingView ? 'accounting' : 'client'],
        queryFn: async () => {
            if (isAccountingView && clientId) {
                return movementService.getAll(clientId, selectedYear, 'patrimonial');
            }

            if (isClientView) {
                const data = await clientPortalService.getMovements(selectedYear, 'patrimonial');
                return data.map((movement) => ({ ...movement, category: movement.category ?? undefined })) as MovementRow[];
            }

            return [];
        },
        enabled: (isAccountingView && Boolean(clientId)) || isClientView,
        staleTime: 30_000,
    });

    // Mock data
    const documentAlerts = [
        { id: 1, title: 'Extrato Bancário PDF/OFX', period: 'Jan/2026', status: 'Pendente', priority: 'high' },
        { id: 2, title: 'Notas Fiscais de Entrada', period: 'Fev/2026', status: 'Processando', priority: 'medium' },
        { id: 3, title: 'Comprovantes de Despesa', period: 'Fev/2026', status: 'Pendente', priority: 'high' },
    ];

    const monthlyReports = [
        { id: 1, name: 'Balanço Patrimonial', month: 'Dezembro 2025', size: '1.2 MB', type: 'PDF' },
        { id: 2, name: 'DRE Consolidado', month: 'Novembro 2025', size: '850 KB', type: 'PDF' },
        { id: 3, name: 'Demonstrativo de Fluxo', month: 'Outubro 2025', size: '920 KB', type: 'PDF' },
        { id: 4, name: 'Relatório de Impostos', month: 'Setembro 2025', size: '1.5 MB', type: 'PDF' },
    ];




    useEffect(() => {
        if (chartAccountsQuery.data === undefined) return;

        const mapped: Account[] = chartAccountsQuery.data.map((account) => ({
            classification: account.code,
            reduced_code: account.reduced_code || undefined,
            name: account.name.trim(),
            values: Array(12).fill('0,00'),
            total: '0,00',
            level: account.level,
            category: account.report_type || '',
            alias: account.alias || undefined,
            report_category: account.report_category || undefined,
        }));
        setAccounts(mapped);
    }, [chartAccountsQuery.data]);

    useEffect(() => {
        if (!isAccountingView || !clientId) {
            setDreMappings([]);
            return;
        }

        setDreMappings(dreMappingsQuery.data ?? []);
    }, [clientId, isAccountingView, dreMappingsQuery.data]);

    useEffect(() => {
        setDreMovements(dreMovementsQuery.data ?? []);
    }, [dreMovementsQuery.data]);

    useEffect(() => {
        setPatrimonialMovements(patrimonialMovementsQuery.data ?? []);
    }, [patrimonialMovementsQuery.data]);

    const supportTicketsQuery = useQuery({
        queryKey: ['client-support-tickets', clientId ?? 'self'],
        queryFn: () => clientPortalService.getSupportTickets(),
        enabled: isClientView && activeTab === 'suporte',
        staleTime: 30_000,
    });
    const supportTickets = useMemo(() => supportTicketsQuery.data ?? [], [supportTicketsQuery.data]);
    const isTicketsLoading = supportTicketsQuery.isPending;

    useEffect(() => {
        if (!isClientView || activeTab !== 'suporte') return;

        if (supportTickets.length === 0) {
            setSelectedSupportTicketId(null);
            return;
        }

        setSelectedSupportTicketId((current) => {
            if (current && supportTickets.some((ticket) => ticket.id === current)) return current;
            return supportTickets[0]?.id || null;
        });
    }, [isClientView, activeTab, supportTickets]);

    const supportMessagesQuery = useQuery({
        queryKey: ['client-support-messages', selectedSupportTicketId],
        queryFn: () => clientPortalService.getSupportTicketMessages(selectedSupportTicketId as string),
        enabled: isClientView && activeTab === 'suporte' && Boolean(selectedSupportTicketId),
        staleTime: 15_000,
    });
    const supportMessages = useMemo(() => supportMessagesQuery.data ?? [], [supportMessagesQuery.data]);
    const isSupportMessagesLoading = supportMessagesQuery.isPending;

    useEffect(() => {
        setSupportReplyDraft('');
    }, [selectedSupportTicketId]);

    // Remove acentos e normaliza string para comparação à prova de encoding
    const stripAccents = (s: string): string =>
        s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

    const detectDreValueMode = (movements: Array<{ values: Array<number | string> }>): 'raw' | 'cumulative' => {
        let cumulativeSignals = 0;
        let rawSignals = 0;

        for (const movement of movements) {
            const numericValues = movement.values
                .map((value) => typeof value === 'number' ? value : Number(String(value).replace(/\./g, '').replace(',', '.')))
                .filter((value) => Number.isFinite(value));
            const nonZeroValues = numericValues.filter((value) => Math.abs(value) > 0.0001);

            if (nonZeroValues.length < 2) continue;

            const firstSign = Math.sign(nonZeroValues[0]);
            const sameSign = nonZeroValues.every((value) => Math.sign(value) === firstSign);
            const absNonDecreasing = nonZeroValues
                .slice(1)
                .every((value, index) => Math.abs(value) + 0.0001 >= Math.abs(nonZeroValues[index]));
            const hasRelevantDecrease = nonZeroValues
                .slice(1)
                .some((value, index) => Math.abs(value) < Math.abs(nonZeroValues[index]) * 0.8);

            if (sameSign && absNonDecreasing) cumulativeSignals += 1;
            if (hasRelevantDecrease) rawSignals += 1;
        }

        return cumulativeSignals > rawSignals ? 'cumulative' : 'raw';
    };

    // Mapeamento de aliases usando chave SEM acento para matching robusto
    const CATEGORY_ALIASES: Record<string, string[]> = {
        'deducoes de vendas':        ['deducoes', 'deducoes de vendas'],
        'custos das vendas':         ['custos das vendas'],
        'despesas tributarias':      ['despesas tributarias'],
        'despesas financeiras':      ['despesas financeiras'],
        'receitas financeiras':      ['receitas financeiras'],
        'irpj e csll':               ['irpj e csll'],
        'depreciacao e amortizacao': ['depreciacao e amortizacao'],
        'outras despesas':                         ['outras despesas'],
        'outras receitas':                         ['outras receitas'],
        'despesas administrativas':                ['despesas administrativas'],
        'despesas comerciais':                     ['despesas comerciais'],
        'receita bruta':                           ['receita bruta'],
        'custos dos servicos':                     ['custos dos servicos', 'custos de servicos', 'custos dos servicos'],
        'resultado participacoes societarias':     ['resultado participacoes societarias', 'participacoes societarias', 'resultado de participacoes societarias'],
    };

    const getLeafMovements = (rows: MovementRow[]) => {
        const allCodes = rows.map((row) => row.code);
        return rows.filter((row) =>
            !allCodes.some((code) => code !== row.code && code.startsWith(`${row.code}.`))
        );
    };

    const sortMovementsByCode = (rows: MovementRow[]) =>
        rows.slice().sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true }));

    const getConfiguredCodesForReportCategory = (reportCategory: string) => {
        const normalize = (s: string) => stripAccents(s);
        const cat = normalize(reportCategory);
        const aliases = CATEGORY_ALIASES[cat] ?? [cat];
        return dreMappings
            .filter((mapping) => mapping.category && aliases.includes(normalize(mapping.category)))
            .map((mapping) => String(mapping.account_code).trim());
    };

    const getConfiguredRowsForReportCategory = (
        reportCategory: string,
        movementsData: MovementRow[],
        mode: 'exact' | 'withDescendants' = 'withDescendants'
    ) => {
        const configuredCodes = getConfiguredCodesForReportCategory(reportCategory);

        if (configuredCodes.length === 0) return [];

        const exactRows = sortMovementsByCode(
            movementsData.filter((movement) => configuredCodes.includes(movement.code))
        );
        if (mode === 'exact') return exactRows;

        const descendantRows = sortMovementsByCode(
            movementsData.filter((movement) =>
                configuredCodes.some((code) => movement.code.startsWith(`${code}.`))
            )
        );

        if (exactRows.length === 0) return descendantRows;

        const exactCodes = new Set(exactRows.map((movement) => movement.code));
        return [...exactRows, ...descendantRows.filter((movement) => !exactCodes.has(movement.code))];
    };

    const splitPrimaryAndChildRows = (rows: MovementRow[]) => {
        if (rows.length === 0) {
            return { primaryRows: [] as MovementRow[], childRows: [] as MovementRow[] };
        }

        const getDepth = (code: string) => code.trim().split('.').filter(Boolean).length;
        const primaryDepth = Math.min(...rows.map((row) => getDepth(row.code)));
        return {
            primaryRows: rows.filter((row) => getDepth(row.code) === primaryDepth),
            childRows: rows.filter((row) => getDepth(row.code) !== primaryDepth),
        };
    };

    // Função DE-PARA: soma movimentações pela coluna category (DE-PARA do balancete)
    // Com fallback para cruzar com Plano de Contas se o balancete não tiver DE-PARA
    const getSumByReportCategory = (categoryName: string, monthIdx: number, movementsData: MovementRow[]): number => {
        const normalize = (s: string) => stripAccents(s);
        const cat = normalize(categoryName);
        const aliases = CATEGORY_ALIASES[cat] ?? [cat];

        const configuredCodes = getConfiguredCodesForReportCategory(categoryName);
        if (configuredCodes.length > 0) {
            const exactConfiguredRows = getConfiguredRowsForReportCategory(categoryName, movementsData, 'exact');
            if (exactConfiguredRows.length > 0) {
                return getLeafMovements(exactConfiguredRows).reduce((sum, movement) => sum + (movement.values[monthIdx] || 0), 0);
            }

            const descendantConfiguredRows = getConfiguredRowsForReportCategory(categoryName, movementsData, 'withDescendants');
            return getLeafMovements(descendantConfiguredRows).reduce((sum, movement) => sum + (movement.values[monthIdx] || 0), 0);
        }

        const matched = movementsData.filter((movement) =>
            movement.category && aliases.includes(normalize(movement.category))
        );
        if (matched.length > 0) {
            return getLeafMovements(matched).reduce((sum, movement) => sum + (movement.values[monthIdx] || 0), 0);
        }

        const codesInCategory = new Set(
            accounts
                .filter((account) => account.report_category && aliases.includes(normalize(account.report_category)))
                .map((account) => account.classification)
        );
        if (codesInCategory.size === 0) return 0;

        const matchedByCode = movementsData.filter((movement) => codesInCategory.has(movement.code));
        return getLeafMovements(matchedByCode).reduce((sum, movement) => sum + (movement.values[monthIdx] || 0), 0);
    };

    // Busca contas-filhas de um report_category para drill-down
    const getChildAccounts = (reportCategory: string, movementsData: MovementRow[]) => {
        const normalize = (s: string) => stripAccents(s);
        const cat = normalize(reportCategory);
        const aliases = CATEGORY_ALIASES[cat] ?? [cat];

        const configuredRows = getConfiguredRowsForReportCategory(reportCategory, movementsData, 'withDescendants');
        if (configuredRows.length > 0) return configuredRows;

        const byCategory = movementsData.filter((movement) =>
            movement.category && aliases.includes(normalize(movement.category))
        );
        if (byCategory.length > 0) return sortMovementsByCode(byCategory);

        const codesInCategory = new Set(
            accounts
                .filter((account) => account.report_category && aliases.includes(normalize(account.report_category)))
                .map((account) => account.classification)
        );
        return sortMovementsByCode(movementsData.filter((movement) => codesInCategory.has(movement.code)));
    };

    // Estado para drill-down no DRE
    const [expandedDreRow, setExpandedDreRow] = useState<string | null>(null);
    const [expandedDreChildrenRows, setExpandedDreChildrenRows] = useState<Record<string, boolean>>({});

    // Comentários do DRE
    const [dreComments, setDreComments] = useState<Record<string, string>>({});

    const calcDreForMonth = (monthIdx: number): DreMonthData => {
        // Normaliza sinais: usa Math.abs() e aplica sinal explícito.
        // O CSV tem sinais INCONSISTENTES entre categorias — não depender do sinal do CSV.
        // Ex: Deduções chega negativo (-487.353), mas Custos chega positivo (+874.361).
        const pos = (cat: string) =>  Math.abs(getSumByReportCategory(cat, monthIdx, dreMovements));
        const neg = (cat: string) => -Math.abs(getSumByReportCategory(cat, monthIdx, dreMovements));

        const recBruta        = pos('Receita Bruta');
        const deducoes        = neg('Deduções de Vendas');
        const recLiquida      = recBruta + deducoes;
        const custos          = neg('Custos das Vendas');
        const custosServicos  = neg('Custos Dos Serviços');
        const lucroBruto      = recLiquida + custos + custosServicos;
        const despAdm         = neg('Despesas Administrativas');
        const despCom         = neg('Despesas Comerciais');
        const despTrib        = neg('Despesas Tributárias');
        const partSocietarias = pos('Resultado Participações Societárias');
        const outrasReceitas  = pos('Outras Receitas');
        const recFin          = pos('Receitas Financeiras');
        const despFin         = neg('Despesas Financeiras');
        const lair            = lucroBruto + despAdm + despCom + despTrib
                                + partSocietarias + outrasReceitas + recFin + despFin;
        const irpjCsll        = neg('IRPJ e CSLL');
        const lucroLiq        = lair + irpjCsll;
        const depreciacao     = neg('Depreciação e Amortização');
        const resultFin       = recFin + despFin;
        const ebtida          = lair + Math.abs(depreciacao) + resultFin;
        return { recBruta, deducoes, recLiquida, custos, custosServicos, lucroBruto,
                 despAdm, despCom, despTrib, partSocietarias, outrasReceitas,
                 recFin, despFin, lair, irpjCsll, lucroLiq, depreciacao, resultFin, ebtida };
    };

    // Definição das linhas do DRE — category corresponde ao report_category do plano de contas
    const dreLinesDef = [
        { id: 'rec_bruta',      name: 'Receita Bruta',                       key: 'recBruta',        type: 'main',      category: 'Receita Bruta' },
        { id: 'deducoes',       name: 'Deduções',                            key: 'deducoes',        type: 'negative',  category: 'Deduções de Vendas' },
        { id: 'rec_liquida',    name: 'RECEITA LÍQUIDA',                    key: 'recLiquida',      type: 'main',      category: '' },
        { id: 'custos',         name: 'Custos das Vendas',                   key: 'custos',          type: 'negative',  category: 'Custos das Vendas' },
        { id: 'custos_serv',    name: 'Custos dos Serviços',                 key: 'custosServicos',  type: 'negative',  category: 'Custos Dos Serviços' },
        { id: 'lucro_bruto',    name: 'LUCRO OPERACIONAL',                   key: 'lucroBruto',      type: 'main',      category: '' },
        { id: 'desp_adm',       name: 'Despesas Administrativas',            key: 'despAdm',         type: 'negative',  category: 'Despesas Administrativas' },
        { id: 'desp_com',       name: 'Despesas Comerciais',                 key: 'despCom',         type: 'negative',  category: 'Despesas Comerciais' },
        { id: 'desp_trib',      name: 'Despesas Tributárias',               key: 'despTrib',        type: 'negative',  category: 'Despesas Tributárias' },
        { id: 'part_soc',       name: 'Resultado Participações Societárias', key: 'partSocietarias', type: 'positive',  category: 'Resultado Participações Societárias' },
        { id: 'outras_receitas',name: 'Outras Receitas',                     key: 'outrasReceitas',  type: 'positive',  category: 'Outras Receitas' },
        { id: 'rec_fin',        name: 'Receitas Financeiras',                key: 'recFin',          type: 'positive',  category: 'Receitas Financeiras' },
        { id: 'desp_fin',       name: 'Despesas Financeiras',                key: 'despFin',         type: 'negative',  category: 'Despesas Financeiras' },
        { id: 'lair',           name: 'LUCRO ANTES DO IRPJ E CSLL',         key: 'lair',            type: 'main',      category: '' },
        { id: 'irpj_csll',      name: 'IRPJ e CSLL',                        key: 'irpjCsll',        type: 'negative',  category: 'IRPJ e CSLL' },
        { id: 'lucro_liq',      name: 'LUCRO/PREJUÍZO LÍQUIDO',             key: 'lucroLiq',        type: 'highlight', category: '' },
        { id: 'ebtida_lair',    name: 'LUCRO ANTES DO IRPJ E CSLL',         key: 'lair',            type: 'sub',       category: '' },
        { id: 'ebtida_dep',     name: '(+) Depreciação',                    key: 'depreciacao',     type: 'sub',       category: 'Depreciação e Amortização' },
        { id: 'ebtida_fin',     name: '(+) Resultado Financeiro',           key: 'resultFin',       type: 'sub',       category: '' },
        { id: 'ebtida',         name: 'RESULTADO EBITDA',                  key: 'ebtida',          type: 'highlight', category: '' },
    ];

    const reportItems = useMemo(() => {
        const data = calcDreForMonth(selectedMonthIndex);
        const format = (val: number) => {
            const formatted = formatLocaleNumber(val);
            return val < 0 ? `- ${formatted}` : formatted;
        };
        const calcPct = (val: number) => {
            if (data.recBruta === 0) return '0%';
            return `${Math.round((val / data.recBruta) * 100)}%`;
        };

        return dreLinesDef.map(line => ({
            ...line,
            val: format(data[line.key as keyof typeof data]),
            rawVal: data[line.key as keyof typeof data],
            pct: line.id === 'rec_bruta' ? '100%' : calcPct(data[line.key as keyof typeof data]),
        }));
    }, [selectedMonthIndex, dreMovements, dreMappings, accounts]);

    // Dados do DRE para todos os meses (para tabela mês a mês)
    const allMonthsDre = useMemo(
        () => months.map((_, idx) => calcDreForMonth(idx)),
        [months, dreMovements, dreMappings, accounts]
    );

    const monthlyReportData = useMemo(() => {
        const monthsData: Array<DreMonthData & { month: string; lucroLiquido: number }> = allMonthsDre.map((d, i) => ({
            month: months[i].substring(0, 3),
            ...d,
            lucroLiquido: d.lucroLiq,
        }));

        const mapToChart = (key: keyof DreMonthData | 'lucroLiquido') =>
            monthsData.map((d) => ({ name: d.month, value: d[key] }));

        return {
            recBruta:       mapToChart('recBruta'),
            deducoes:       mapToChart('deducoes'),
            recLiquida:     mapToChart('recLiquida'),
            custos:         mapToChart('custos'),
            custosServicos: mapToChart('custosServicos'),
            lucroBruto:     mapToChart('lucroBruto'),
            despAdm:        mapToChart('despAdm'),
            despCom:        mapToChart('despCom'),
            despTrib:       mapToChart('despTrib'),
            partSocietarias: mapToChart('partSocietarias'),
            outrasReceitas: mapToChart('outrasReceitas'),
            recFin:         mapToChart('recFin'),
            despFin:        mapToChart('despFin'),
            lair:           mapToChart('lair'),
            irpjCsll:       mapToChart('irpjCsll'),
            lucroLiquido:   mapToChart('lucroLiq'),
            depreciacao:    mapToChart('depreciacao'),
            resultFin:      mapToChart('resultFin'),
            ebtida:         mapToChart('ebtida'),
        };
    }, [allMonthsDre, months]);

    // Factory para criar handler de upload de movimentação (DRE ou Patrimonial)
    const createMovementUploadHandler = (
        movType: 'dre' | 'patrimonial',
        setMovFn: React.Dispatch<React.SetStateAction<MovementRow[]>>
    ) => {
        return async (e: React.ChangeEvent<HTMLInputElement>) => {
            const chosenImportYear = selectedYear;
            const file = e.target.files?.[0];
            if (!file) return;
            // Reset input para permitir re-upload do mesmo arquivo
            e.target.value = '';

            const label = movType === 'dre' ? 'Balancete DRE' : 'Balancete Patrimonial';
            const toastId = `import-mov-${movType}`;

            const isCSV = file.name.toLowerCase().endsWith('.csv');
            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const XLSX = await loadSpreadsheetModule();
                    const fileContent = evt.target?.result;
                    let wb;
                    if (isCSV) {
                        // CSV: lido como texto UTF-8 -> preserva acentos
                        // raw: true evita que XLSX converta "556.777,78" para número JS errado
                        wb = XLSX.read(fileContent as string, { type: 'string', raw: true });
                    } else {
                        // XLSX/XLS: lido como ArrayBuffer → números nativos já corretos
                        const data8 = new Uint8Array(fileContent as ArrayBuffer);
                        wb = XLSX.read(data8, { type: 'array' });
                    }
                    const wsname = wb.SheetNames[0];
                    const ws = wb.Sheets[wsname];
                    const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as (string | number | undefined)[][];

                    // Auto-detectar ano a partir dos cabeçalhos (ex: "01/2025", "02/2025")
                    const headerRow = data[0] || [];
                    const detectedYear = (() => {
                        for (let ci = 2; ci <= 13 && ci < headerRow.length; ci++) {
                            const colHeader = String(headerRow[ci] || '').trim();
                            const yearMatch = colHeader.match(/(\d{1,2})\/(\d{4})/);
                            if (yearMatch) return parseInt(yearMatch[2], 10);
                        }
                        return null;
                    })();
                    const importYear = chosenImportYear;
                    if (detectedYear && detectedYear !== chosenImportYear) {
                        toast(`Arquivo indica ${detectedYear}, mas a importação será feita em ${chosenImportYear}.`, {
                            icon: 'ℹ️',
                            duration: 5000,
                        });
                    }

                    // Col 0 = Classificação, Col 1 = Nome, Cols 2-13 = Jan-Dez
                    // Col 14 = Total (ignorado), Col 15 = NÍVEL, Col 16 = DE-PARA
                    const parseBrNumber = (v: unknown): number => {
                        if (typeof v === 'number') return v; // .xlsx: número JS já correto
                        let s = String(v || '0').trim();
                        if (s === '' || s === '-') return 0;
                        // Detectar negativo: parênteses = negativo no formato contábil BR
                        let negative = false;
                        if (s.startsWith('(') && s.endsWith(')')) {
                            negative = true;
                            s = s.slice(1, -1).trim();
                        } else if (s.startsWith('-')) {
                            negative = true;
                            s = s.slice(1).trim();
                        }
                        // Formato BR: remove pontos de milhar, troca vírgula decimal por ponto
                        const cleaned = s.replace(/\./g, '').replace(',', '.');
                        const result = parseFloat(cleaned);
                        if (isNaN(result)) return 0;
                        return negative ? -result : result;
                    };

                    const allParsedRows = (data.map(row => {
                        const code = row[0]?.toString().trim() || '';
                        if (!code || !/^\d/.test(code)) return null;

                        const name = row[1]?.toString().trim() || '';
                        const values = row.slice(2, 14).map(parseBrNumber);
                        // Garantir exatamente 12 valores
                        while (values.length < 12) values.push(0);

                        // Col 15 = NÍVEL do CSV (1, 4, 7, 10, 15), fallback para contagem de pontos
                        const csvLevel = parseInt(String(row[15] || '0'));
                        const level = csvLevel > 0 ? csvLevel : code.split('.').length;

                        // Col 16 = DE-PARA (categoria para DRE)
                        const rawCategory = row[16]?.toString().trim() || '';
                        const category = (rawCategory && rawCategory !== '#REF!' && rawCategory !== '#REF') ? rawCategory : undefined;

                        return { code, name, level, values: values.slice(0, 12), category };
                    }).filter(m => m !== null)) as MovementRow[];

                    if (allParsedRows.length === 0) {
                        toast.error('Nenhuma movimentação encontrada no arquivo');
                        return;
                    }

                    // Detectar se é um "comparativo" (mistura patrimonial 01/02 + DRE 03/04)
                    const hasPat = allParsedRows.some(m => m.code.startsWith('01') || m.code.startsWith('02'));
                    const hasDre = allParsedRows.some(m => m.code.startsWith('03') || m.code.startsWith('04'));
                    const isComparativo = hasPat && hasDre;

                    // Separar contas por tipo
                    let parsedMovements: MovementRow[];
                    let patrimonialFromComparativo: MovementRow[] = [];

                    if (movType === 'dre' && isComparativo) {
                        // Filtrar apenas contas DRE (03.x, 04.x)
                        parsedMovements = allParsedRows.filter(m => m.code.startsWith('03') || m.code.startsWith('04'));
                        // Separar contas patrimoniais para auto-importar
                        patrimonialFromComparativo = allParsedRows.filter(m => m.code.startsWith('01') || m.code.startsWith('02'));
                        toast(`Comparativo detectado: ${parsedMovements.length} contas DRE + ${patrimonialFromComparativo.length} contas patrimoniais`, {
                            icon: 'ℹ️',
                            duration: 5000,
                        });
                    } else {
                        parsedMovements = allParsedRows;
                    }

                    // Verifica categorias DE-PARA não reconhecidas pelo sistema (apenas para DRE)
                    if (movType === 'dre') {
                        const knownCategories = new Set([
                            // Categorias DRE (todas sem acento para matching robusto)
                            'receita bruta', 'deducoes', 'deducoes de vendas',
                            'custos das vendas', 'despesas administrativas', 'despesas comerciais',
                            'despesas tributarias', 'despesas financeiras',
                            'receitas financeiras', 'irpj e csll', 'outras despesas', 'outras receitas',
                            'depreciacao e amortizacao',
                            // Categorias Patrimonial/PL (esperadas no arquivo mas ignoradas pelo DRE)
                            'adiantamentos', 'clientes', 'contas a pagar cp', 'despesas antecipadas',
                            'disponivel', 'emprestimos e financiamentos cp', 'estoques', 'fornecedores',
                            'imobilizado', 'intangivel', 'obrigacoes trabalhistas', 'obrigacoes tributarias',
                            'outras contas a pagar lp', 'outras contas a receber lp', 'parcelamentos cp',
                            'parcelamentos lp', 'processos judiciais', 'reserva de lucros',
                            'resultado do exercicio', 'tributos a compensarcp',
                        ]);
                        const withCategory = parsedMovements.filter(m => m.category);
                        const unknownCats = [...new Set(
                            withCategory
                                .filter(m => !knownCategories.has(stripAccents(m.category!)))
                                .map(m => m.category!)
                        )];
                        if (unknownCats.length > 0) {
                            const sample = unknownCats.slice(0, 3).join(', ');
                            const extra = unknownCats.length > 3 ? ` e mais ${unknownCats.length - 3}` : '';
                            toast(`${unknownCats.length} categoria(s) DE-PARA não reconhecida(s): ${sample}${extra}`, {
                                duration: 8000,
                                icon: '⚠️',
                            });
                        }
                    }

                    // Salvar no banco (persistência)
                    const targetClientId = clientId || client?.id;
                    if (isAccountingView && targetClientId) {
                        toast.loading(`Salvando ${parsedMovements.length} linhas (${label})...`, { id: toastId });
                        const dreValueMode = movType === 'dre' && isComparativo
                            ? detectDreValueMode(parsedMovements)
                            : 'raw';
                        const result = await movementService.bulkImport(targetClientId, importYear, parsedMovements, movType, dreValueMode);
                        toast.success(`${result.count} linhas importadas para ${importYear} (${label})!`, { id: toastId });

                        // Re-fetch do banco para obter categorias resolvidas pelo backend (plano de contas)
                        const savedData = await movementService.getAll(targetClientId, importYear, movType);

                        // Auto-importar patrimonial se comparativo detectado
                        let savedPatData: MovementRow[] | null = null;
                        if (patrimonialFromComparativo.length > 0) {
                            toast.loading(`Salvando ${patrimonialFromComparativo.length} contas patrimoniais...`, { id: 'import-pat-auto' });
                            const patResult = await movementService.bulkImport(targetClientId, importYear, patrimonialFromComparativo, 'patrimonial', 'raw');
                            toast.success(`${patResult.count} contas patrimoniais importadas automaticamente!`, { id: 'import-pat-auto' });
                            // Re-fetch patrimonial com dados resolvidos
                            savedPatData = await movementService.getAll(targetClientId, importYear, 'patrimonial') as MovementRow[];
                        }

                        // Atualiza estado e selectedYear juntos — após todos os saves,
                        // evitando que o useEffect dispare fetch antes dos dados estarem prontos
                        setMovFn(savedData as MovementRow[]);
                        if (savedPatData) setPatrimonialMovements(savedPatData);
                        await Promise.all([
                            queryClient.invalidateQueries({ queryKey: ['client-dashboard-dre-movements', clientId ?? 'self'] }),
                            queryClient.invalidateQueries({ queryKey: ['client-dashboard-patrimonial-movements', clientId ?? 'self'] }),
                        ]);
                        if (importYear !== selectedYear) setSelectedYear(importYear);
                    } else {
                        // Sem persistência: usar dados raw
                        setMovFn(parsedMovements);
                        if (importYear !== selectedYear) setSelectedYear(importYear);
                    }
                } catch (error) {
                    console.error(`Erro ao importar ${label}:`, error);
                    toast.error(`Erro ao importar ${label}`, { id: toastId });
                }
            };
            if (isCSV) {
                reader.readAsText(file, 'UTF-8');
            } else {
                reader.readAsArrayBuffer(file);
            }
        };
    };

    const handleDreFileUpload = createMovementUploadHandler('dre', setDreMovements);

    const handlePatrimonialRawFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const chosenImportYear = selectedYear;
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        const toastId = 'import-patrimonial-raw';
        const isCSV = file.name.toLowerCase().endsWith('.csv');

        const parseBrNumber = (v: unknown): number => {
            if (typeof v === 'number') return v;
            let s = String(v || '').trim();
            if (!s || s === '-' || s.startsWith('#')) return 0;
            // Detectar negativo: parênteses = negativo no formato contábil BR
            let negative = false;
            if (s.startsWith('(') && s.endsWith(')')) {
                negative = true;
                s = s.slice(1, -1).trim();
            } else if (s.startsWith('-')) {
                negative = true;
                s = s.slice(1).trim();
            }
            const cleaned = s.replace(/\./g, '').replace(',', '.');
            const result = parseFloat(cleaned);
            if (isNaN(result)) return 0;
            return negative ? -result : result;
        };

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const XLSX = await loadSpreadsheetModule();
                const fileContent = evt.target?.result;
                let wb;
                if (isCSV) {
                    wb = XLSX.read(fileContent as string, { type: 'string', raw: true });
                } else {
                    const data8 = new Uint8Array(fileContent as ArrayBuffer);
                    wb = XLSX.read(data8, { type: 'array' });
                }
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as Array<Array<string | number>>;

                // Auto-detectar ano a partir dos cabeçalhos (ex: "01/2025", "02/2025")
                const patHeaderRow = rows[0] || [];
                const detectedPatImportYear = (() => {
                    for (let ci = 2; ci <= 13 && ci < patHeaderRow.length; ci++) {
                        const colHeader = String(patHeaderRow[ci] || '').trim();
                        const yearMatch = colHeader.match(/(\d{1,2})\/(\d{4})/);
                        if (yearMatch) return parseInt(yearMatch[2], 10);
                    }
                    return null;
                })();
                const patImportYear = chosenImportYear;
                if (detectedPatImportYear && detectedPatImportYear !== chosenImportYear) {
                    toast(`Arquivo indica ${detectedPatImportYear}, mas a importação será feita em ${chosenImportYear}.`, {
                        icon: 'ℹ️',
                        duration: 5000,
                    });
                }

                const reducedCodeByClassification = new Map(
                    accounts.map((account) => [account.classification, account.reduced_code || null])
                );

                const movements = rows
                    .map((row): MovementRow | null => {
                        const code = String(row[0] || '').trim();
                        if (!code || !/^\d/.test(code)) return null;
                        if (!code.startsWith('01') && !code.startsWith('02')) return null;

                        const name = String(row[1] || '').trim();
                        const values = row.slice(2, 14).map(parseBrNumber);
                        while (values.length < 12) values.push(0);

                        const csvLevel = parseInt(String(row[15] || '0'));
                        const level = csvLevel > 0 ? csvLevel : code.split('.').length;
                        const rawCategory = String(row[16] || '').trim();
                        const category = rawCategory && !rawCategory.startsWith('#') ? rawCategory : undefined;

                        return {
                            code,
                            reduced_code: reducedCodeByClassification.get(code) || null,
                            name,
                            level,
                            category,
                            values: values.slice(0, 12),
                        };
                    })
                    .filter((movement): movement is MovementRow => movement !== null);

                if (movements.length === 0) {
                    toast.error('Nenhuma conta patrimonial encontrada. Verifique se o arquivo possui contas iniciando com 01 ou 02.');
                    return;
                }

                const targetClientId = clientId || client?.id;
                if (isAccountingView && targetClientId) {
                    toast.loading(`Salvando ${movements.length} contas (Patrimonial)...`, { id: toastId });
                    const result = await movementService.bulkImport(targetClientId, patImportYear, movements, 'patrimonial', 'raw');
                    toast.success(`${result.count} contas importadas (Patrimonial ${patImportYear})!`, { id: toastId });
                } else {
                    toast.success(`${movements.length} contas patrimoniais carregadas!`);
                }

                setPatrimonialMovements(movements);
                if (patImportYear !== selectedYear) setSelectedYear(patImportYear);
                await queryClient.invalidateQueries({ queryKey: ['client-dashboard-patrimonial-movements', clientId ?? 'self'] });
            } catch (error) {
                console.error('Erro ao importar Patrimonial bruto:', error);
                toast.error('Erro ao importar Patrimonial', { id: toastId });
            }
        };
        if (isCSV) {
            reader.readAsText(file, 'UTF-8');
        } else {
            reader.readAsArrayBuffer(file);
        }
    };

    function normalizePatrimonialText(value: string): string {
        return value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toUpperCase()
            .replace(/\s+/g, ' ');
    }

    function getPatrimonialSectionFromCode(code: string): string | null {
        if (code.startsWith('01.1')) return 'ATIVO CIRCULANTE';
        if (code.startsWith('01.2')) return 'ATIVO NÃO CIRCULANTE';
        if (code.startsWith('02.1')) return 'PASSIVO CIRCULANTE';
        if (code.startsWith('02.2') || code.startsWith('02.3')) return 'PASSIVO NÃO CIRCULANTE';
        if (code.startsWith('02.4')) return 'PATRIMÔNIO LÍQUIDO';
        return null;
    }

    function getPatrimonialLeafRows(rows: MovementRow[]): MovementRow[] {
        const numericRows = rows.filter((row) => /^\d/.test(row.code));
        if (numericRows.length === 0) return rows;
        return numericRows.filter(
            (row) =>
                !numericRows.some(
                    (candidate) =>
                        candidate.code !== row.code &&
                        candidate.code.startsWith(`${row.code}.`)
                )
        );
    }

    function getPatrimonialRowsByCategory(categoryLabel: string): MovementRow[] {
        const normalizedCategory = normalizePatrimonialText(categoryLabel);
        const codesFromPlan = new Set(
            accounts
                .filter(
                    (account) =>
                        account.report_category &&
                        normalizePatrimonialText(account.report_category) === normalizedCategory
                )
                .map((account) => account.classification)
        );

        const rawMatches = patrimonialMovements.filter(
            (movement) =>
                /^\d/.test(movement.code) &&
                (
                    (movement.category &&
                        normalizePatrimonialText(movement.category) === normalizedCategory) ||
                    codesFromPlan.has(movement.code)
                )
        );
        if (rawMatches.length > 0) return getPatrimonialLeafRows(rawMatches);

        return patrimonialMovements.filter(
            (movement) =>
                !/^\d/.test(movement.code) &&
                normalizePatrimonialText(movement.name).includes(normalizedCategory)
        );
    }

    function getPatrimonialValueByCategory(categoryLabel: string, monthIdx: number): number {
        return getPatrimonialRowsByCategory(categoryLabel)
            .reduce((sum, movement) => sum + (movement.values[monthIdx] || 0), 0);
    }

    function getSumByGroup(groupLabel: string, monthIdx: number): number {
        const normalizedGroup = normalizePatrimonialText(groupLabel);
        const numericRows = patrimonialMovements.filter((movement) => /^\d/.test(movement.code));

        if (numericRows.length > 0) {
            return getPatrimonialLeafRows(
                numericRows.filter(
                    (movement) =>
                        normalizePatrimonialText(getPatrimonialSectionFromCode(movement.code) || '') === normalizedGroup
                )
            ).reduce((sum, movement) => sum + (movement.values[monthIdx] || 0), 0);
        }

        return patrimonialMovements
            .filter(
                (movement) =>
                    movement.level === 2 &&
                    normalizePatrimonialText(movement.category || '') === normalizedGroup
            )
            .reduce((sum, movement) => sum + (movement.values[monthIdx] || 0), 0);
    }

    // Importar Plano de Contas (CSV com colunas: CLASSIFICADOR, NÍVEL, TIPO, DESCRIÇÃO, Apelido, Relatório, DESCRIÇÃO RELATÓRIO)
    const patMonthlyDataByGroup = useMemo(() => {
        const mapGroup = (groupLabel: string) =>
            months.map((month, monthIdx) => ({
                name: month.substring(0, 3),
                value: getSumByGroup(groupLabel, monthIdx),
            }));

        return {
            ativoCirc: mapGroup('ATIVO CIRCULANTE'),
            ativoNaoCirc: mapGroup('ATIVO NÃO CIRCULANTE'),
            totalAtivo: months.map((month, monthIdx) => ({
                name: month.substring(0, 3),
                value: getSumByGroup('ATIVO CIRCULANTE', monthIdx) + getSumByGroup('ATIVO NÃO CIRCULANTE', monthIdx),
            })),
            passivoCirc: mapGroup('PASSIVO CIRCULANTE'),
            passivoNaoCirc: mapGroup('PASSIVO NÃO CIRCULANTE'),
            patrimonioLiq: mapGroup('PATRIMÔNIO LÍQUIDO'),
            totalPassivo: months.map((month, monthIdx) => ({
                name: month.substring(0, 3),
                value: getSumByGroup('PASSIVO CIRCULANTE', monthIdx) + getSumByGroup('PASSIVO NÃO CIRCULANTE', monthIdx) + getSumByGroup('PATRIMÔNIO LÍQUIDO', monthIdx),
            })),
        };
    }, [months, patrimonialMovements, accounts]);

    const selectedDashboardDre = allMonthsDre[selectedMonthIndex] ?? EMPTY_DRE_MONTH_DATA;
    const pendingDocumentAlertsCount = documentAlerts.filter((alert) => alert.status === 'Pendente').length;

    const revenueCompositionData = useMemo(() => ([
        { name: 'Custo de Venda', value: Math.abs(selectedDashboardDre.custos) },
        { name: 'Impostos', value: Math.abs(selectedDashboardDre.deducoes + selectedDashboardDre.irpjCsll) },
        {
            name: 'Desp. Operac.',
            value: Math.abs(
                selectedDashboardDre.despAdm +
                selectedDashboardDre.despCom +
                selectedDashboardDre.despTrib +
                selectedDashboardDre.despFin
            ),
        },
        { name: 'Lucro', value: Math.max(selectedDashboardDre.lucroLiq, 0) },
    ].filter((point) => point.value > 0)), [selectedDashboardDre]);

    const revenueExpenseData = useMemo(() => months.map((month, index) => {
        const dreMonth = allMonthsDre[index] ?? EMPTY_DRE_MONTH_DATA;

        return {
            name: month.substring(0, 3),
            receita: dreMonth.recBruta || 0,
            despesa:
                (dreMonth.custos || 0) +
                (dreMonth.despAdm || 0) +
                (dreMonth.despCom || 0) +
                (dreMonth.despTrib || 0) +
                (dreMonth.despFin || 0),
        };
    }), [allMonthsDre, months]);

    const marginEvolutionData = useMemo(() => allMonthsDre.map((dreMonth, index) => ({
        name: months[index].substring(0, 3),
        margemBruta: dreMonth.recLiquida !== 0 ? parseFloat(((dreMonth.lucroBruto / dreMonth.recLiquida) * 100).toFixed(2)) : 0,
        margemLiq: dreMonth.recBruta !== 0 ? parseFloat(((dreMonth.lucroLiq / dreMonth.recBruta) * 100).toFixed(2)) : 0,
        margemEbtida: dreMonth.recLiquida !== 0 ? parseFloat(((dreMonth.ebtida / dreMonth.recLiquida) * 100).toFixed(2)) : 0,
    })), [allMonthsDre, months]);

    const allocationData = useMemo(() => allMonthsDre.map((dreMonth, index) => ({
        name: months[index].substring(0, 3),
        deducoes: Math.abs(dreMonth.deducoes),
        custos: Math.abs(dreMonth.custos) + Math.abs(dreMonth.custosServicos),
        despOper: Math.abs(dreMonth.despAdm) + Math.abs(dreMonth.despCom) + Math.abs(dreMonth.despTrib),
        irpj: Math.abs(dreMonth.irpjCsll),
        lucro: Math.max(dreMonth.lucroLiq, 0),
    })), [allMonthsDre, months]);

    const dreChartIndicators = useMemo(() => ([
        { title: 'Receita Bruta', data: monthlyReportData.recBruta, color: '#0ea5e9' },
        { title: 'Deduções', data: monthlyReportData.deducoes, color: '#f43f5e' },
        { title: 'Receita Líquida', data: monthlyReportData.recLiquida, color: '#2563eb' },
        { title: 'Custos das Vendas', data: monthlyReportData.custos, color: '#f59e0b' },
        { title: 'Custos dos Serviços', data: monthlyReportData.custosServicos, color: '#f97316' },
        { title: 'Lucro Operacional', data: monthlyReportData.lucroBruto, color: '#3b82f6' },
        { title: 'Despesas Adm.', data: monthlyReportData.despAdm, color: '#ec4899' },
        { title: 'Despesas Com.', data: monthlyReportData.despCom, color: '#d946ef' },
        { title: 'Despesas Trib.', data: monthlyReportData.despTrib, color: '#a855f7' },
        { title: 'Result. Participações Soc.', data: monthlyReportData.partSocietarias, color: '#14b8a6' },
        { title: 'Outras Receitas', data: monthlyReportData.outrasReceitas, color: '#22c55e' },
        { title: 'Receitas Fin.', data: monthlyReportData.recFin, color: '#10b981' },
        { title: 'Despesas Fin.', data: monthlyReportData.despFin, color: '#fb7185' },
        { title: 'LAIR', data: monthlyReportData.lair, color: '#6366f1' },
        { title: 'IRPJ/CSLL', data: monthlyReportData.irpjCsll, color: '#ef4444' },
        { title: 'Lucro Líquido', data: monthlyReportData.lucroLiquido, color: '#059669' },
        { title: 'EBITDA', data: monthlyReportData.ebtida, color: '#8b5cf6' },
    ]), [monthlyReportData]);

    const patChartIndicators = useMemo(() => ([
        { title: 'Ativo Circulante', data: patMonthlyDataByGroup.ativoCirc, color: '#0ea5e9' },
        { title: 'Ativo Não Circulante', data: patMonthlyDataByGroup.ativoNaoCirc, color: '#2563eb' },
        { title: 'Total do Ativo', data: patMonthlyDataByGroup.totalAtivo, color: '#06b6d4' },
        { title: 'Passivo Circulante', data: patMonthlyDataByGroup.passivoCirc, color: '#f43f5e' },
        { title: 'Passivo Não Circulante', data: patMonthlyDataByGroup.passivoNaoCirc, color: '#f59e0b' },
        { title: 'Patrimônio Líquido', data: patMonthlyDataByGroup.patrimonioLiq, color: '#10b981' },
        { title: 'Total do Passivo', data: patMonthlyDataByGroup.totalPassivo, color: '#8b5cf6' },
    ]), [patMonthlyDataByGroup]);

    void dreChartIndicators;
    void patChartIndicators;

    const normalizeSpreadsheetHeader = (value: unknown) =>
        String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase();

    const findSpreadsheetColumn = (headers: string[], aliases: string[]) => {
        const normalizedAliases = aliases.map(normalizeSpreadsheetHeader);
        return headers.findIndex((header) =>
            normalizedAliases.some((alias) => header === alias || header.includes(alias))
        );
    };

    const looksLikeAccountClassifier = (value: unknown) =>
        /^\d+(?:\.\d+)+$/.test(String(value || '').trim());

    const looksLikeReducedAccountCode = (value: unknown) =>
        /^\d+$/.test(String(value || '').trim());

    const handleImportPlanoDeContas = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const isTitleType = (value: unknown) => {
            const normalized = String(value || 'A')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .trim()
                .toUpperCase();

            return (
                normalized === 'T' ||
                normalized === 'S' ||
                normalized === 'TOTAL' ||
                normalized.includes('SINT') ||
                normalized.includes('TIT')
            );
        };

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const XLSX = await loadSpreadsheetModule();
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as (string | number | undefined)[][];

                const rawHeaders = (data[0] || []).map(normalizeSpreadsheetHeader);
                const rows = data.slice(1);

                const codeColumn = findSpreadsheetColumn(rawHeaders, [
                    'classificador',
                    'classificacao',
                    'codigo da conta',
                    'conta contabil',
                    'codigo contabil',
                    'codigo',
                ]);
                const reducedCodeColumn = findSpreadsheetColumn(rawHeaders, [
                    'codigo reduzido',
                    'cod reduzido',
                    'reduzido',
                    'reduced_code',
                ]);
                const levelColumn = findSpreadsheetColumn(rawHeaders, ['nivel']);
                const typeColumn = findSpreadsheetColumn(rawHeaders, ['tipo']);
                const nameColumn = findSpreadsheetColumn(rawHeaders, [
                    'descricao',
                    'nome',
                    'descricao da conta',
                    'conta',
                ]);
                const aliasColumn = findSpreadsheetColumn(rawHeaders, ['apelido', 'alias']);
                const reportTypeColumn = findSpreadsheetColumn(rawHeaders, [
                    'relatorio',
                    'tipo relatorio',
                    'report_type',
                ]);
                const reportCategoryColumn = findSpreadsheetColumn(rawHeaders, [
                    'descricao relatorio',
                    'categoria relatorio',
                    'report_category',
                    'categoria',
                ]);

                const importAccounts = rows
                    .map<ImportAccount | null>((row) => {
                        const cells = row.map((cell) => String(cell || '').trim());
                        const pickColumnValue = (columnIndex: number) =>
                            columnIndex >= 0 ? cells[columnIndex] || '' : '';

                        const inferredCode = cells.find(looksLikeAccountClassifier) || '';
                        const rawCode = pickColumnValue(codeColumn) || inferredCode;
                        if (!rawCode || !/^\d/.test(rawCode)) {
                            return null;
                        }

                        const inferredReducedCode = cells.find((cell) =>
                            looksLikeReducedAccountCode(cell) && cell !== rawCode
                        );
                        const reducedCode = pickColumnValue(reducedCodeColumn) || inferredReducedCode || undefined;

                        const rawAlias = pickColumnValue(aliasColumn);
                        const rawName = pickColumnValue(nameColumn);
                        const fallbackName = cells.find((cell) =>
                            Boolean(cell) &&
                            cell !== rawCode &&
                            cell !== reducedCode &&
                            !looksLikeAccountClassifier(cell) &&
                            !looksLikeReducedAccountCode(cell) &&
                            !isTitleType(cell)
                        ) || '';
                        const name = [rawName, rawAlias, fallbackName].find((value) => value && value !== rawCode) || '';

                        const explicitLevel = parseInt(pickColumnValue(levelColumn), 10);
                        const level = Number.isFinite(explicitLevel) && explicitLevel > 0
                            ? explicitLevel
                            : rawCode.split('.').length;

                        const inferredType = cells.find((cell) => isTitleType(cell));

                        return {
                            code: rawCode,
                            reduced_code: reducedCode,
                            name,
                            level,
                            type: isTitleType(pickColumnValue(typeColumn) || inferredType) ? 'T' : 'A',
                            alias: rawAlias || undefined,
                            report_type: pickColumnValue(reportTypeColumn) || undefined,
                            report_category: pickColumnValue(reportCategoryColumn) || undefined,
                        };
                    })
                    .filter((account): account is ImportAccount => Boolean(account && account.code && account.name));

                if (importAccounts.length === 0) {
                    toast.error('Nenhuma conta encontrada no arquivo');
                    return;
                }

                // Enviar para o backend
                const targetClientId = clientId || client?.id;
                if (!targetClientId) {
                    toast.error('Cliente não identificado');
                    return;
                }

                toast.loading(`Importando ${importAccounts.length} contas...`, { id: 'import-coa' });

                const result = await chartOfAccountsService.bulkImport(targetClientId, importAccounts);

                toast.success(`${result.count} contas importadas com sucesso!`, { id: 'import-coa' });

                // Recarregar do banco
                const dbAccounts = await chartOfAccountsService.getAll(targetClientId);
                const mapped: Account[] = dbAccounts.map(a => ({
                    classification: a.code,
                    reduced_code: a.reduced_code || undefined,
                    name: a.name.trim(),
                    values: Array(12).fill('0,00'),
                    total: '0,00',
                    level: a.level,
                    category: a.report_type || '',
                    alias: a.alias || undefined,
                    report_category: a.report_category || undefined,
                }));
                setAccounts(mapped);
                await Promise.all([
                    queryClient.invalidateQueries({ queryKey: ['client-dashboard-chart-accounts', targetClientId] }),
                    queryClient.invalidateQueries({ queryKey: ['accounting-dre-mappings', targetClientId] }),
                ]);
            } catch (error) {
                console.error('Erro ao importar plano de contas:', error);
                toast.error('Erro ao importar plano de contas', { id: 'import-coa' });
            }
        };
        reader.readAsBinaryString(file);
        // Reset input para permitir re-upload do mesmo arquivo
        e.target.value = '';
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const total = newAccount.values.reduce((acc, curr) => {
            const val = parseFloat(curr.replace('.', '').replace(',', '.')) || 0;
            return acc + val;
        }, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

        const accountToAdd: Account = { ...newAccount, total };
        setAccounts([accountToAdd, ...accounts]);
        setIsModalOpen(false);
        setNewAccount({
            classification: '',
            name: '',
            category: '',
            values: Array(12).fill('0,00'),
            level: 5
        });
    };

    const handleSupportSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isClientView && !clientId) return;
        try {
            setSupportSubmitting(true);
            setSupportError(null);
            const createdTicket = await clientPortalService.createSupportTicket({
                subject: supportForm.subject,
                message: supportForm.message,
                priority: supportForm.priority as 'low' | 'medium' | 'high',
            });
            setIsSupportOpen(false);
            setSupportForm({ subject: '', message: '', priority: 'medium' });
            setSelectedSupportTicketId(createdTicket.id);
            await queryClient.invalidateQueries({ queryKey: ['client-support-tickets', clientId ?? 'self'] });
        } catch (error) {
            const message = axios.isAxiosError(error)
                ? error.response?.data?.message || 'Erro ao abrir chamado'
                : 'Erro ao abrir chamado';
            setSupportError(message);
        } finally {
            setSupportSubmitting(false);
        }
    };

    const selectedSupportTicket = supportTickets.find((ticket) => ticket.id === selectedSupportTicketId) || null;

    const handleSupportReply = async () => {
        if (!selectedSupportTicketId || !supportReplyDraft.trim()) {
            toast.error('Escreva a sua mensagem antes de enviar');
            return;
        }

        try {
            setIsSubmittingSupportReply(true);
            await clientPortalService.replySupportTicket(selectedSupportTicketId, supportReplyDraft.trim());
            setSupportReplyDraft('');
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['client-support-tickets', clientId ?? 'self'] }),
                queryClient.invalidateQueries({ queryKey: ['client-support-messages', selectedSupportTicketId] }),
            ]);
            toast.success('Mensagem enviada');
        } catch (error) {
            console.error('Erro ao responder chamado:', error);
            toast.error('Erro ao enviar mensagem');
        } finally {
            setIsSubmittingSupportReply(false);
        }
    };

    return (
        <>
            <div className="min-h-screen text-slate-200 font-sans selection:bg-cyan-500/30 overflow-x-hidden relative" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #0a1628 100%)' }}>
            {/* Ambient Background Glows */}
            <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-600/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="flex min-h-screen min-w-0">
            {/* Sidebar Navigation */}
            <div className={`fixed top-0 left-0 shrink-0 h-screen bg-[#0d1829]/80 backdrop-blur-xl border-r border-white/5 flex flex-col py-8 z-50 transition-all duration-300 overflow-hidden relative ${isSidebarOpen ? 'w-64 items-start px-3' : 'w-20 items-center px-0'}`}>
                <button
                    type="button"
                    onClick={() => setIsSidebarOpen((prev) => !prev)}
                    aria-label={isSidebarOpen ? 'Fechar sidebar' : 'Abrir sidebar'}
                    title={isSidebarOpen ? 'Fechar sidebar' : 'Abrir sidebar'}
                    className="absolute -right-3 top-8 z-50 h-8 w-8 rounded-full border border-white/10 bg-[#0d1829] text-slate-300 shadow-lg shadow-black/30 flex items-center justify-center hover:bg-white/10 hover:text-white transition-all"
                >
                    <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${isSidebarOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className={`flex items-center gap-3 mb-8 mt-2 ${isSidebarOpen ? 'w-full px-2 justify-start' : 'w-full justify-center'}`}>
                    <div className="w-12 h-12 bg-linear-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
                        <BarChart3 className="w-7 h-7" />
                    </div>
                    {isSidebarOpen && (
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-white leading-none">TresContas</p>
                            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500 mt-1">Portal do Cliente</p>
                        </div>
                    )}
                </div>
                <div ref={sidebarScrollRef} className={`scrollbar-hide flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto ${isSidebarOpen ? 'items-stretch w-full pr-1' : 'items-center'}`}>
                    {sidebarItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`group relative transition-all duration-300 ${activeTab === item.id ? 'bg-linear-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'} ${isSidebarOpen ? 'w-full flex items-center gap-3 px-4 py-4 rounded-2xl justify-start' : 'p-4 rounded-2xl'}`}
                        >
                            <item.icon className="w-6 h-6 shrink-0" />
                            {isSidebarOpen ? (
                                <span className="text-sm font-medium truncate">{item.label}</span>
                            ) : (
                                <span className="absolute left-full ml-4 px-3 py-1 bg-slate-800 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap z-50 border border-white/10">
                                    {item.label}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                <div className={`space-y-6 ${isSidebarOpen ? 'w-full px-1' : ''}`}>
                    {isClientView && (
                        <button
                            onClick={() => setIsSupportOpen(true)}
                            className={`text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 transition-all relative group ${isSidebarOpen ? 'w-full flex items-center gap-3 px-4 py-4 rounded-2xl justify-start' : 'p-4 rounded-2xl'}`}
                        >
                            <MessageSquare className="w-6 h-6 shrink-0" />
                            {isSidebarOpen ? (
                                <span className="text-sm font-medium truncate">Novo Chamado</span>
                            ) : (
                                <span className="absolute left-full ml-4 px-3 py-1 bg-slate-800 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap z-50 border border-white/10">
                                    Novo Chamado
                                </span>
                            )}
                        </button>
                    )}
                    {!isAccountingView && (
                        <button className={`text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all ${isSidebarOpen ? 'w-full flex items-center gap-3 px-4 py-4 rounded-2xl justify-start' : 'p-4 rounded-2xl'}`}>
                            <LifeBuoy className="w-6 h-6" />
                            {isSidebarOpen && <span className="text-sm font-medium truncate">Ajuda</span>}
                        </button>
                    )}
                    {isClientView && (
                        <button
                            onClick={async () => {
                                try {
                                    await authService.logoutClientSession();
                                } catch {
                                    // Ignore transport errors and clear local session anyway.
                                } finally {
                                    clientLogout();
                                    navigate('/client-login');
                                }
                            }}
                            className={`text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all relative group ${isSidebarOpen ? 'w-full flex items-center gap-3 px-4 py-4 rounded-2xl justify-start' : 'p-4 rounded-2xl'}`}
                        >
                            <LogOut className="w-6 h-6 shrink-0" />
                            {isSidebarOpen ? (
                                <span className="text-sm font-medium truncate">Sair</span>
                            ) : (
                                <span className="absolute left-full ml-4 px-3 py-1 bg-slate-800 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap z-50 border border-white/10">
                                    Sair
                                </span>
                            )}
                        </button>
                    )}
                </div>
            </div>

            <input
                ref={dreImportInputRef}
                type="file"
                className="hidden"
                accept=".xlsx, .xls, .csv"
                onChange={handleDreFileUpload}
            />
            <input
                ref={patrimonialImportInputRef}
                type="file"
                className="hidden"
                accept=".xlsx, .xls, .csv"
                onChange={handlePatrimonialRawFileUpload}
            />

            {/* Main Content */}
            <div
                ref={contentScrollRef}
                className="relative z-10 min-h-screen min-w-0 flex-1 transition-[margin] duration-300"
                style={{ marginLeft: sidebarWidth }}
            >
                {/* Modern Header */}
                <header className="sticky top-0 z-40 bg-[#0a1628]/80 backdrop-blur-2xl border-b border-white/5 px-4 md:px-12 h-20 flex items-center justify-between transition-all duration-300">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            {isAccountingView && (
                                <button
                                    onClick={() => navigate('/dashboard')}
                                    className="p-2 -ml-2 text-white/40 hover:text-white transition-colors"
                                >
                                    <ArrowLeft className="w-5 h-5" />
                                </button>
                            )}
                            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                                {isClientLoading ? (
                                    <div className="w-48 h-8 bg-white/5 animate-pulse rounded-lg" />
                                ) : (
                                    <>TresContas <span className="text-cyan-400">{activeSidebarLabel}</span></>
                                )}
                            </h2>
                            {isReadOnly && (
                                <span className="ml-3 px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                                    Somente Leitura
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black">{client?.name || 'Portal Financeiro'}</p>
                    </div>

                    <div className="flex items-center gap-4 md:gap-8">
                        <div className="hidden lg:flex items-center gap-4 px-6 py-2.5 bg-white/5 rounded-xl border border-white/10">
                            <div className="flex items-center gap-2">
                                <CalendarDays className="w-4 h-4 text-cyan-400" />
                                <span className="text-sm font-bold text-white/80">{months[selectedMonthIndex]}/{selectedYear}</span>
                            </div>
                            <div className="w-px h-4 bg-white/10" />
                            <select
                                className="bg-transparent outline-none cursor-pointer text-xs font-bold text-white/40 hover:text-white transition-colors"
                                value={selectedMonthIndex}
                                onChange={(e) => setSelectedMonthIndex(parseInt(e.target.value))}
                            >
                                {months.map((m, i) => (
                                    <option key={i} value={i} className="bg-[#0d1829]">{m}</option>
                                ))}
                            </select>
                            <div className="w-px h-4 bg-white/10" />
                            <select
                                className="bg-transparent outline-none cursor-pointer text-xs font-bold text-white/40 hover:text-white transition-colors"
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            >
                                {availableYears.map(y => (
                                    <option key={y} value={y} className="bg-[#0d1829]">{y}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 md:gap-4">
                            <button className="p-3 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all relative">
                                <Bell className="w-5 h-5" />
                                <div className="absolute top-3 right-3 w-2 h-2 bg-cyan-500 rounded-full border-2 border-[#0a1628]" />
                            </button>
                            {isReportTab && (
                                <button onClick={() => handleExportPDF(exportLabel)} className="flex items-center gap-2 bg-linear-to-r from-cyan-500 to-blue-600 text-white px-5 py-3 rounded-xl text-sm font-bold shadow-lg shadow-cyan-500/20 hover:opacity-90 transition-all group">
                                    <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                                    <span className="hidden md:inline">Exportar PDF</span>
                                </button>
                            )}
                        </div>
                    </div>
                </header>

                <div className="py-6 px-4 md:px-12 relative z-10 transition-all duration-500">
                    <div className="w-full" key={activeTab}>
                        {activeTab === 'dashboard' && (
                            <div className="space-y-6 pb-12" key={dashboardTab}>
                                <div className="flex flex-wrap gap-3 rounded-[24px] border border-white/10 bg-[#0d1829]/80 p-3 backdrop-blur-xl shadow-2xl shadow-black/20">
                                    {DASHBOARD_OVERVIEW_TABS.map((tab) => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setDashboardTab(tab.id)}
                                            className={`rounded-2xl px-5 py-3 text-sm font-bold transition-all ${
                                                dashboardTab === tab.id
                                                    ? 'bg-linear-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                                                    : 'text-white/45 hover:bg-white/5 hover:text-white'
                                            }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>

                                {dashboardTab === 'inicio' ? (
                                <>
                                {/* Hero Section: Company & Meeting */}
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
                                    <div className="md:col-span-9 bg-[#0d1829]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex items-center gap-6 group hover:border-cyan-500/20 transition-all shadow-2xl shadow-black/20">
                                        <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-cyan-500/20">
                                            {client?.name?.substring(0, 2).toUpperCase() || 'VC'}
                                        </div>
                                        <div>
                                            <h5 className="text-2xl font-black text-white tracking-tight">{client?.name || 'VEIBRAS IMPORTACAO E COMERCIO LTDA'}</h5>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 text-[10px] font-black uppercase tracking-widest rounded-md border border-cyan-500/20">Cliente Premium</span>
                                                <span className="text-white/20 text-[10px] uppercase font-bold tracking-widest">ID: #TC-2026-001</span>
                                            </div>
                                        </div>
                                        <div className="ml-auto flex gap-2">
                                            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                                            <div className="w-2 h-2 rounded-full bg-cyan-500/20" />
                                            <div className="w-2 h-2 rounded-full bg-cyan-500/20" />
                                        </div>
                                    </div>

                                    <div className="md:col-span-3 bg-linear-to-br from-cyan-500 to-blue-600 border border-white/10 rounded-2xl p-5 relative overflow-hidden group shadow-lg shadow-cyan-500/10">
                                        <div className="absolute inset-0 bg-linear-to-br from-cyan-500 to-blue-700" />
                                        <div className="relative z-10 flex flex-col justify-between h-full">
                                            <div className="flex justify-between items-start">
                                                <h5 className="text-4xl font-bold text-white">27</h5>
                                                <button className="p-2 border border-white/20 rounded-xl">
                                                    <Calendar className="w-4 h-4 text-white" />
                                                </button>
                                            </div>
                                            <div className="mt-4">
                                                <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Sabado</p>
                                                <h6 className="text-white font-bold text-sm">Reuniao Mensal</h6>
                                                <p className="text-white/40 text-[10px] mt-1 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> 10:25 am - 30 mins
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                        {/* Resumo Financeiro DRE - 4 Cards */}
                        {(() => {
                            const dreData = calcDreForMonth(selectedMonthIndex);
                            const prevData = selectedMonthIndex > 0 ? calcDreForMonth(selectedMonthIndex - 1) : null;
                            const calcGrowth = (curr: number, prev: number | null) => {
                                if (!prev || prev === 0) return null;
                                return ((curr - prev) / Math.abs(prev)) * 100;
                            };
                            const summaryCards = [
                                { label: 'Receita Bruta', value: dreData.recBruta, prev: prevData?.recBruta ?? null, color: 'from-cyan-500/20 to-blue-600/20', border: 'border-cyan-500/20', },
                                { label: 'Custos + Despesas', value: dreData.custos + dreData.despAdm + dreData.despCom + dreData.despTrib + dreData.despFin, prev: prevData ? prevData.custos + prevData.despAdm + prevData.despCom + prevData.despTrib + prevData.despFin : null, color: 'from-rose-500/20 to-red-600/20', border: 'border-rose-500/20', },
                                { label: 'Resultado Líquido', value: dreData.lucroLiq, prev: prevData?.lucroLiq ?? null, color: dreData.lucroLiq >= 0 ? 'from-emerald-500/20 to-green-600/20' : 'from-rose-500/20 to-red-600/20', border: dreData.lucroLiq >= 0 ? 'border-emerald-500/20' : 'border-rose-500/20', },
                                { label: 'IRPJ / CSLL', value: dreData.irpjCsll, prev: prevData?.irpjCsll ?? null, color: 'from-amber-500/20 to-orange-600/20', border: 'border-amber-500/20', },
                            ];
                            return (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                                    {summaryCards.map((card, i) => {
                                        const growth = calcGrowth(card.value, card.prev);
                                        return (
                                            <div key={i} className={`bg-linear-to-br ${card.color} backdrop-blur-xl border ${card.border} rounded-2xl p-6 relative overflow-hidden`}>
                                                <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-2">{card.label}</p>
                                                <h3 className="text-white text-2xl font-black tracking-tighter">R$ {formatLocaleNumber(card.value)}</h3>
                                                {growth !== null && (
                                                    <div className="flex items-center gap-1 mt-2">
                                                        <TrendingUp className={`w-3 h-3 ${growth >= 0 ? 'text-emerald-400' : 'text-rose-400 rotate-180'}`} />
                                                        <span className={`text-xs font-black ${growth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
                                                        </span>
                                                        <span className="text-white/20 text-[10px] ml-1">vs mês anterior</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}

                        {/* Pizza Composição + Receita vs Despesa + Relatórios */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
                            {/* Pizza: Composição do Faturamento */}
                            <div className="md:col-span-4">
                                <div className="bg-[#0d1829]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-6 h-full flex flex-col">
                                    <h4 className="text-white font-bold mb-1">Composição - {months[selectedMonthIndex]}</h4>
                                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-4">Distribuição do faturamento</p>
                                    {(() => {
                                        const PIE_COLORS = ['#f59e0b', '#ef4444', '#a855f7', '#10b981'];
                                        const pieData = revenueCompositionData;
                                        return (
                                            <div className="flex-1 min-h-[220px]">
                                                <DeferredChartContainer className="h-full w-full min-w-0">
                                                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                                        <RechartsPie>
                                                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                                                                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />)}
                                                            </Pie>
                                                            <Tooltip content={<TooltipCurrency />} />
                                                            <Legend verticalAlign="bottom" formatter={(value: string) => <span className="text-white/60 text-xs">{value}</span>} />
                                                        </RechartsPie>
                                                    </ResponsiveContainer>
                                                </DeferredChartContainer>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Receita vs Despesa - Gráfico de Área */}
                            <div className="md:col-span-5">
                                <div className="bg-[#0d1829]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-6 h-full flex flex-col">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h4 className="text-white font-bold">Receita vs Despesa</h4>
                                            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">Evolução mensal</p>
                                        </div>
                                    </div>
                                    <div className="flex-1 min-h-[220px]">
                                        <DeferredChartContainer className="h-full w-full min-w-0">
                                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                                <AreaChart data={revenueExpenseData}>
                                                    <defs>
                                                        <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/><stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/></linearGradient>
                                                        <linearGradient id="colorDesp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/><stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/></linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 'bold'}} />
                                                    <YAxis hide />
                                                    <Tooltip content={<TooltipCurrency />} />
                                                    <Area type="monotone" dataKey="receita" name="Receita" stroke="#06b6d4" strokeWidth={2} fill="url(#colorRec)" fillOpacity={1} />
                                                    <Area type="monotone" dataKey="despesa" name="Despesa" stroke="#f43f5e" strokeWidth={2} fill="url(#colorDesp)" fillOpacity={1} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </DeferredChartContainer>
                                    </div>
                                    <div className="flex items-center gap-6 mt-4">
                                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-cyan-500" /><span className="text-white/60 text-xs font-bold">Receita</span></div>
                                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-rose-500" /><span className="text-white/60 text-xs font-bold">Despesa</span></div>
                                    </div>
                                </div>
                            </div>

                            {/* Relatórios e Pendências */}
                            <div className="md:col-span-3">
                                <div className="bg-[#0d1829]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-6 h-full flex flex-col">
                                    <div className="flex items-center justify-between mb-6">
                                        <h4 className="text-white font-bold">Relatórios</h4>
                                        <div className="p-2 bg-white/5 rounded-xl text-white/40 hover:text-white transition-colors cursor-pointer"><Filter className="w-4 h-4" /></div>
                                    </div>
                                    <div className="space-y-3 flex-1 overflow-auto pr-1">
                                        {monthlyReports.map((report) => (
                                            <div key={report.id} className="group flex items-center gap-3 bg-white/5 hover:bg-white/10 p-3 rounded-xl transition-all cursor-pointer border border-transparent hover:border-cyan-500/20">
                                                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 shrink-0"><FileText className="w-5 h-5" /></div>
                                                <div className="flex-1 overflow-hidden">
                                                    <h5 className="text-white font-bold text-xs truncate">{report.name}</h5>
                                                    <p className="text-white/40 text-[10px] uppercase font-black tracking-widest">{report.month}</p>
                                                </div>
                                                <Download className="w-4 h-4 text-white/20 group-hover:text-cyan-400 transition-colors" />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-white/5">
                                        <div className="flex items-center gap-3 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                                            <Upload className="w-5 h-5 text-amber-500" />
                                            <div>
                                                <p className="text-white font-bold text-xs">Pendências</p>
                                                <p className="text-white/40 text-[10px]">{pendingDocumentAlertsCount} documentos pendentes</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ─── BLOCO 1: Segunda linha de KPI cards (Margens + EBITDA) ─── */}
                        {(() => {
                            const d = calcDreForMonth(selectedMonthIndex);
                            const pd = selectedMonthIndex > 0 ? calcDreForMonth(selectedMonthIndex - 1) : null;
                            const margemLiq   = d.recBruta !== 0 ? (d.lucroLiq  / d.recBruta)   * 100 : 0;
                            const margemBruta = d.recLiquida !== 0 ? (d.lucroBruto / d.recLiquida) * 100 : 0;
                            const margemEbtida = d.recLiquida !== 0 ? (d.ebtida  / d.recLiquida) * 100 : 0;
                            const pMargemLiq   = pd && pd.recBruta   !== 0 ? (pd.lucroLiq  / pd.recBruta)   * 100 : null;
                            const pMargemBruta = pd && pd.recLiquida !== 0 ? (pd.lucroBruto / pd.recLiquida) * 100 : null;
                            const pMargemEbtida = pd && pd.recLiquida !== 0 ? (pd.ebtida   / pd.recLiquida) * 100 : null;
                            const pEbtida = pd?.ebtida ?? null;
                            const delta = (curr: number, prev: number | null) =>
                                prev !== null && prev !== 0 ? ((curr - prev) / Math.abs(prev)) * 100 : null;
                            const kpiCards = [
                                { label: 'Margem Líquida',  value: margemLiq,    prevVal: pMargemLiq,   fmt: (v: number) => `${v.toFixed(1)}%`, color: margemLiq >= 0 ? 'from-emerald-500/20 to-green-600/20' : 'from-rose-500/20 to-red-600/20', border: margemLiq >= 0 ? 'border-emerald-500/20' : 'border-rose-500/20' },
                                { label: 'EBITDA',          value: d.ebtida,     prevVal: pEbtida,      fmt: (v: number) => `R$ ${formatLocaleNumber(v)}`, color: d.ebtida >= 0 ? 'from-violet-500/20 to-purple-600/20' : 'from-rose-500/20 to-red-600/20', border: d.ebtida >= 0 ? 'border-violet-500/20' : 'border-rose-500/20' },
                                { label: 'Margem Bruta',    value: margemBruta,  prevVal: pMargemBruta,  fmt: (v: number) => `${v.toFixed(1)}%`, color: margemBruta >= 0 ? 'from-teal-500/20 to-cyan-600/20' : 'from-rose-500/20 to-red-600/20', border: margemBruta >= 0 ? 'border-teal-500/20' : 'border-rose-500/20' },
                                { label: 'Margem EBITDA',   value: margemEbtida, prevVal: pMargemEbtida, fmt: (v: number) => `${v.toFixed(1)}%`, color: margemEbtida >= 0 ? 'from-indigo-500/20 to-blue-600/20' : 'from-rose-500/20 to-red-600/20', border: margemEbtida >= 0 ? 'border-indigo-500/20' : 'border-rose-500/20' },
                            ];
                            return (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                                    {kpiCards.map((card, i) => {
                                        const growth = delta(card.value, card.prevVal);
                                        return (
                                            <div key={i} className={`bg-linear-to-br ${card.color} backdrop-blur-xl border ${card.border} rounded-2xl p-6 relative overflow-hidden`}>
                                                <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-2">{card.label}</p>
                                                <h3 className="text-white text-2xl font-black tracking-tighter">{card.fmt(card.value)}</h3>
                                                {growth !== null && (
                                                    <div className="flex items-center gap-1 mt-2">
                                                        <TrendingUp className={`w-3 h-3 ${growth >= 0 ? 'text-emerald-400' : 'text-rose-400 rotate-180'}`} />
                                                        <span className={`text-xs font-black ${growth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {growth >= 0 ? '+' : ''}{growth.toFixed(1)}%
                                                        </span>
                                                        <span className="text-white/20 text-[10px] ml-1">vs mês anterior</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}

                        {/* ─── BLOCO 2: Gráfico de Evolução das Margens (%) ─── */}
                        <div className="bg-[#0d1829]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-6 mb-8">
                            <h4 className="text-white font-bold mb-1">Evolução das Margens</h4>
                            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-4">Margem bruta, líquida e EBITDA ao longo do ano (%)</p>
                            <div className="h-[260px]">
                                <DeferredChartContainer className="h-full w-full min-w-0">
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                        <LineChart data={marginEvolutionData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 'bold' }} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
                                            <Tooltip content={<TooltipPercent />} />
                                            <Line type="monotone" dataKey="margemBruta"  stroke="#22c55e" strokeWidth={2} dot={false} name="Margem Bruta" />
                                            <Line type="monotone" dataKey="margemLiq"    stroke="#06b6d4" strokeWidth={2} dot={false} name="Margem Líquida" />
                                            <Line type="monotone" dataKey="margemEbtida" stroke="#a855f7" strokeWidth={2} dot={false} name="Margem EBITDA" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </DeferredChartContainer>
                            </div>
                            <div className="flex items-center gap-6 mt-4">
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500" /><span className="text-white/60 text-xs font-bold">Margem Bruta</span></div>
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-cyan-500" /><span className="text-white/60 text-xs font-bold">Margem Líquida</span></div>
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500" /><span className="text-white/60 text-xs font-bold">Margem EBITDA</span></div>
                            </div>
                        </div>

                        {/* ─── BLOCO 3: Stacked Bar "Para onde vai o dinheiro" ─── */}
                        <div className="bg-[#0d1829]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-6 mb-8">
                            <h4 className="text-white font-bold mb-1">Para onde vai o dinheiro</h4>
                            <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-4">Distribuição da receita bruta por mês</p>
                            <div className="h-[280px]">
                                <DeferredChartContainer className="h-full w-full min-w-0">
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                        <BarChart data={allocationData} barSize={22}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 'bold' }} />
                                            <YAxis hide />
                                            <Tooltip content={<TooltipCurrency />} />
                                            <Bar dataKey="deducoes"  name="Deduções"         stackId="a" fill="#f97316" radius={[0, 0, 0, 0]} />
                                            <Bar dataKey="custos"    name="Custos"           stackId="a" fill="#ef4444" />
                                            <Bar dataKey="despOper"  name="Desp. Operac."    stackId="a" fill="#8b5cf6" />
                                            <Bar dataKey="irpj"      name="IRPJ/CSLL"        stackId="a" fill="#f59e0b" />
                                            <Bar dataKey="lucro"     name="Lucro Líquido"    stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </DeferredChartContainer>
                            </div>
                            <div className="flex items-center flex-wrap gap-4 mt-4">
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500" /><span className="text-white/60 text-xs font-bold">Deduções</span></div>
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /><span className="text-white/60 text-xs font-bold">Custos</span></div>
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-violet-500" /><span className="text-white/60 text-xs font-bold">Desp. Operacionais</span></div>
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500" /><span className="text-white/60 text-xs font-bold">IRPJ/CSLL</span></div>
                                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500" /><span className="text-white/60 text-xs font-bold">Lucro Líquido</span></div>
                            </div>
                        </div>

                        {/* ─── BLOCO 4: Painel Semáforo de Saúde Financeira ─── */}
                        {(() => {
                            const d = calcDreForMonth(selectedMonthIndex);
                            const idx = selectedMonthIndex;
                            const ativoCirc     = patMonthlyDataByGroup.ativoCirc[idx]?.value    || 0;
                            const passivoCirc   = patMonthlyDataByGroup.passivoCirc[idx]?.value  || 0;
                            const passivoNaoC   = patMonthlyDataByGroup.passivoNaoCirc[idx]?.value || 0;
                            const totalAtivo    = patMonthlyDataByGroup.totalAtivo[idx]?.value   || 0;
                            const liqCorr       = passivoCirc !== 0 ? ativoCirc / passivoCirc : 0;
                            const endividamento = totalAtivo  !== 0 ? ((passivoCirc + passivoNaoC) / totalAtivo) * 100 : 0;
                            const margemLiq     = d.recBruta  !== 0 ? (d.lucroLiq  / d.recBruta)   * 100 : 0;
                            const margemEbtida  = d.recLiquida !== 0 ? (d.ebtida   / d.recLiquida)  * 100 : 0;
                            type SemaforoStatus = 'green' | 'yellow' | 'red';
                            const getStatus = (val: number, thresholds: [number, number], higherIsBetter = true): SemaforoStatus => {
                                const [low, high] = thresholds;
                                if (higherIsBetter) {
                                    if (val >= high) return 'green';
                                    if (val >= low)  return 'yellow';
                                    return 'red';
                                } else {
                                    if (val <= low)  return 'green';
                                    if (val <= high) return 'yellow';
                                    return 'red';
                                }
                            };
                            const statusColor: Record<SemaforoStatus, string> = { green: 'bg-emerald-500', yellow: 'bg-amber-400', red: 'bg-rose-500' };
                            const statusLabel: Record<SemaforoStatus, string> = { green: 'Saudável', yellow: 'Atenção', red: 'Crítico' };
                            const statusBorder: Record<SemaforoStatus, string> = { green: 'border-emerald-500/20', yellow: 'border-amber-400/20', red: 'border-rose-500/20' };
                            const indicators = [
                                { label: 'Liquidez Corrente', value: liqCorr.toFixed(2),   fmt: liqCorr.toFixed(2),   status: getStatus(liqCorr, [1.0, 1.5]) },
                                { label: 'Margem Líquida',    value: margemLiq,             fmt: `${margemLiq.toFixed(1)}%`,  status: getStatus(margemLiq, [5, 10]) },
                                { label: 'Margem EBITDA',     value: margemEbtida,          fmt: `${margemEbtida.toFixed(1)}%`, status: getStatus(margemEbtida, [8, 15]) },
                                { label: 'Endividamento',     value: endividamento,         fmt: `${endividamento.toFixed(1)}%`, status: getStatus(endividamento, [40, 60], false) },
                            ];
                            return (
                                <div className="mb-8">
                                    <h4 className="text-white font-bold mb-1">Saúde Financeira</h4>
                                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-4">Indicadores-chave — {months[selectedMonthIndex]}</p>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {indicators.map((ind, i) => (
                                            <div key={i} className={`bg-[#0d1829]/80 backdrop-blur-xl border ${statusBorder[ind.status]} rounded-2xl p-5 flex flex-col gap-3`}>
                                                <div className="flex items-center justify-between">
                                                    <p className="text-white/60 text-xs font-bold uppercase tracking-widest">{ind.label}</p>
                                                    <div className={`w-2.5 h-2.5 rounded-full ${statusColor[ind.status]} shadow-lg`} />
                                                </div>
                                                <h3 className="text-white text-2xl font-black tracking-tighter">{ind.fmt}</h3>
                                                <span className={`text-xs font-black ${ind.status === 'green' ? 'text-emerald-400' : ind.status === 'yellow' ? 'text-amber-400' : 'text-rose-400'}`}>
                                                    {statusLabel[ind.status]}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* ─── CARD DE IA: Análise Financeira Inteligente ─── */}
                        <div className="bg-[#0d1829]/80 backdrop-blur-xl border border-violet-500/20 rounded-2xl p-6 mb-8">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                                        <Sparkles className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-bold">Análise Inteligente</h4>
                                        <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">IA financeira — {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][selectedMonthIndex]}/{selectedYear}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={async () => {
                                        setAiText('');
                                        setAiError('');
                                        setAiLoading(true);
                                        const d = calcDreForMonth(selectedMonthIndex);
                                        const idx = selectedMonthIndex;
                                        const ativoCirc   = patMonthlyDataByGroup.ativoCirc[idx]?.value    || 0;
                                        const passivoCirc = patMonthlyDataByGroup.passivoCirc[idx]?.value  || 0;
                                        const passivoNaoC = patMonthlyDataByGroup.passivoNaoCirc[idx]?.value || 0;
                                        const totalAtivo  = patMonthlyDataByGroup.totalAtivo[idx]?.value   || 0;
                                        const body: Record<string, unknown> = {
                                            year: selectedYear,
                                            monthIndex: selectedMonthIndex,
                                            dre: d,
                                            indicators: {
                                                margemBruta:   d.recLiquida  !== 0 ? (d.lucroBruto / d.recLiquida) * 100 : 0,
                                                margemLiq:     d.recBruta    !== 0 ? (d.lucroLiq   / d.recBruta)   * 100 : 0,
                                                margemEbtida:  d.recLiquida  !== 0 ? (d.ebtida     / d.recLiquida) * 100 : 0,
                                                liqCorr:       passivoCirc   !== 0 ? ativoCirc / passivoCirc : 0,
                                                endividamento: totalAtivo    !== 0 ? ((passivoCirc + passivoNaoC) / totalAtivo) * 100 : 0,
                                            },
                                        };
                                        // Quando contador acessa o dashboard de um cliente, envia clientId no body
                                        if (isAccountingView && clientId) body.clientId = clientId;
                                        try {
                                            if (isAccountingView) {
                                                await authService.getStaffMe();
                                            } else {
                                                await authService.getClientMe();
                                            }

                                            const baseUrl = resolveApiBaseUrl();
                                            const apiUrl = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
                                            const response = await fetch(`${apiUrl}/client-portal/ai-analysis`, {
                                                method: 'POST',
                                                credentials: 'include',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify(body),
                                            });
                                            if (!response.ok || !response.body) {
                                                const errorBody = await response.json().catch(() => null) as { message?: string } | null;
                                                setAiError(errorBody?.message || 'Erro ao conectar com a IA');
                                                setAiLoading(false);
                                                return;
                                            }
                                            const reader = response.body.getReader();
                                            const decoder = new TextDecoder();
                                            let buffer = '';
                                            while (true) {
                                                const { done, value } = await reader.read();
                                                if (done) break;
                                                buffer += decoder.decode(value, { stream: true });
                                                const lines = buffer.split('\n');
                                                buffer = lines.pop() ?? '';
                                                for (const line of lines) {
                                                    if (!line.startsWith('data: ')) continue;
                                                    const payload = line.slice(6).trim();
                                                    if (payload === '[DONE]') break;
                                                    try {
                                                        const parsed = JSON.parse(payload) as { text?: string; error?: string };
                                                        if (parsed.text) setAiText(prev => prev + parsed.text);
                                                        if (parsed.error) setAiError(parsed.error);
                                                    } catch { /* ignorar */ }
                                                }
                                            }
                                        } catch (err: unknown) {
                                            setAiError(err instanceof Error ? err.message : 'Erro inesperado');
                                        } finally {
                                            setAiLoading(false);
                                        }
                                    }}
                                    disabled={aiLoading}
                                    className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-violet-500/20"
                                >
                                    {aiLoading
                                        ? <><RefreshCw className="w-4 h-4 animate-spin" /> Analisando...</>
                                        : <><Sparkles className="w-4 h-4" /> Analisar com IA</>
                                    }
                                </button>
                            </div>

                            {!aiText && !aiLoading && !aiError && (
                                <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                                    <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                                        <Sparkles className="w-8 h-8 text-violet-400" />
                                    </div>
                                    <p className="text-white/60 text-sm">Clique em <strong className="text-white">Analisar com IA</strong> para receber uma análise financeira personalizada do mês selecionado.</p>
                                    <p className="text-white/30 text-xs">Powered by Groq · Llama 3.3 70B</p>
                                </div>
                            )}

                            {aiLoading && !aiText && (
                                <div className="flex items-center gap-3 py-6">
                                    <RefreshCw className="w-4 h-4 text-violet-400 animate-spin" />
                                    <span className="text-white/50 text-sm">Analisando dados financeiros...</span>
                                </div>
                            )}

                            {aiError && (
                                <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
                                    {aiError}
                                </div>
                            )}

                            {aiText && (
                                <div className="space-y-1">
                                    {aiText.split('\n').map((line, i) => {
                                        if (line.startsWith('## ')) return <h3 key={i} className="text-white font-bold text-base mt-4 mb-2">{line.slice(3)}</h3>;
                                        if (line.startsWith('- ') || line.startsWith('* ')) return <p key={i} className="text-white/80 text-sm ml-4 mb-1">• {line.slice(2).replace(/\*\*(.*?)\*\*/g, '$1')}</p>;
                                        if (line.trim() === '') return <div key={i} className="h-2" />;
                                        return <p key={i} className="text-white/80 text-sm mb-1">{line.replace(/\*\*(.*?)\*\*/g, '$1')}</p>;
                                    })}
                                    {aiLoading && <span className="inline-block w-1.5 h-4 bg-violet-400 animate-pulse rounded-sm" />}
                                </div>
                            )}
                        </div>
                            </>
                        ) : activeDashboardModule ? (
                            <MockModuleSection module={activeDashboardModule} reportRef={reportRef} />
                        ) : null}

                    </div>
                )}

                {(activeTab === 'dre' || activeTab === 'dfc' || activeTab === 'balancoPatrimonial') && (
                    <div className="space-y-2 pb-2" key={dreSubTab}>
                        <div className="flex gap-4 p-2 bg-white/5 backdrop-blur-xl border border-white/10 w-fit rounded-[20px]">
                            {DRE_TABS.filter((tab) => tab.show).map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setDreSubTab(tab.id)}
                                    className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all ${dreSubTab === tab.id ? 'bg-linear-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {dreSubTab === 'dre' ? (
                            <div ref={reportRef} className="bg-[#0d1829]/80 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl overflow-hidden">
                                <div className="p-8 border-b border-white/5 flex flex-wrap justify-between items-center gap-4 bg-white/5">
                                    <div>
                                        <h3 className="text-2xl font-bold text-white tracking-tight">Relatório Gerencial DRE</h3>
                                        <p className="text-sm text-white/40">Resultado Consolidado • {months[selectedMonthIndex]}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-4">
                                        <div className="flex p-1 bg-black/40 border border-white/5 rounded-2xl">
                                            {[
                                                { id: 'lista', icon: FileSpreadsheet, label: 'Lista' },
                                                { id: 'graficos', icon: BarChart3, label: 'Gráficos' },
                                                { id: 'fechado', icon: LayoutList, label: 'Fechado' },
                                            ].map(mode => (
                                                <button
                                                    key={mode.id}
                                                    onClick={() => { setDreConfigMode(false); setDreViewMode(mode.id as ReportViewMode); }}
                                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${!dreConfigMode && dreViewMode === mode.id ? 'bg-slate-800 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                                                >
                                                    <mode.icon className="w-4 h-4" />
                                                    {mode.label}
                                                </button>
                                            ))}
                                            {showDrePatConfigButtons && !isReadOnly && (
                                                <button
                                                    onClick={() => setDreConfigMode(!dreConfigMode)}
                                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${dreConfigMode ? 'bg-slate-800 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                                                >
                                                    <Settings2 className="w-4 h-4" />
                                                    Configuração
                                                </button>
                                            )}
                                        </div>
                                        {!dreConfigMode && !isReadOnly && (
                                            <label className="flex items-center gap-2 bg-linear-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white px-6 py-3 rounded-2xl cursor-pointer transition-all font-bold shadow-lg shadow-cyan-500/20">
                                                <Upload className="w-5 h-5" />
                                                Importar Balancete {selectedYear}
                                                <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleDreFileUpload} />
                                            </label>
                                        )}
                                        {!dreConfigMode && (
                                            <button onClick={() => handleExportPDF('DRE')} className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all text-white/40 hover:text-white" title="Exportar PDF">
                                                <Download className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {dreConfigMode ? (
                                    <Suspense fallback={<LazySectionFallback label="Configuracao DRE" />}>
                                        <ClientDreConfigPanel
                                            clientId={clientId!}
                                            selectedYear={selectedYear}
                                            onSaved={async () => {
                                                await Promise.all([
                                                    queryClient.invalidateQueries({ queryKey: ['client-dashboard-chart-accounts', clientId ?? 'self'] }),
                                                    queryClient.invalidateQueries({ queryKey: ['accounting-dre-mappings', clientId ?? 'self'] }),
                                                ]);
                                            }}
                                        />
                                    </Suspense>
                                ) : dreViewMode === 'lista' ? (
                                    <div className="overflow-x-auto" ref={tableContainerRef}>
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-white/5 border-b border-white/5">
                                                    <th className="p-4 px-6 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] min-w-[260px] sticky left-0 z-20 bg-[#0a1628]">Indicador</th>
                                                    {months.map((m, i) => (
                                                        <th key={m} className={`p-4 px-3 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] text-right min-w-[100px] ${i === selectedMonthIndex ? 'bg-cyan-500/10 text-cyan-400' : ''}`}>{m}</th>
                                                    ))}
                                                    <th className="p-4 px-3 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] text-right min-w-[110px] bg-white/5 sticky right-[100px] z-20 shadow-[-4px_0_10px_rgba(0,0,0,0.3)]">Acumulado</th>
                                                    <th className="p-4 px-3 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] text-right min-w-[70px] sticky right-0 z-20 bg-[#0a1628] shadow-[-4px_0_10px_rgba(0,0,0,0.3)]">%</th>
                                                    <th className="p-4 px-3 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] min-w-[180px]">Comentário</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {reportItems.map((item, idx) => {
                                                    const isSub = item.type === 'sub';
                                                    const hasChildren = !isSub && Boolean(item.category);
                                                    const isExpanded = expandedDreRow === item.id;
                                                    const childAccounts = hasChildren ? getChildAccounts(item.category, dreMovements) : [];
                                                    const { primaryRows, childRows } = hasChildren
                                                        ? splitPrimaryAndChildRows(childAccounts)
                                                        : { primaryRows: [], childRows: [] };
                                                    const showChildRows = Boolean(expandedDreChildrenRows[item.id]);
                                                    const acumulado = allMonthsDre.reduce((sum, d) => sum + (d[item.key as keyof typeof d] as number), 0);

                                                    // Linhas auxiliares sub (base EBITDA) — sem interação, visual diferenciado
                                                    if (isSub) return (
                                                        <tr key={idx} className="border-t border-white/5">
                                                            <td className="p-3 px-6 text-xs text-white/40 italic sticky left-0 z-10 bg-[#0a1628] pl-10">
                                                                {item.name}
                                                            </td>
                                                            {months.map((_, mi) => {
                                                                const monthVal = allMonthsDre[mi]?.[item.key as keyof typeof allMonthsDre[0]] as number || 0;
                                                                return (
                                                                    <td key={mi} className={`p-3 px-3 text-xs text-right font-mono text-white/30 ${mi === selectedMonthIndex ? 'bg-cyan-500/5' : ''}`}>
                                                                        {formatLocaleNumber(monthVal)}
                                                                    </td>
                                                                );
                                                            })}
                                                            <td className="p-3 px-3 text-xs text-right font-mono text-white/30 bg-white/5 sticky right-[100px] z-10">{formatLocaleNumber(acumulado)}</td>
                                                            <td className="p-3 px-3 text-xs text-right sticky right-0 z-10 bg-[#0a1628] text-white/20">-</td>
                                                            <td className="p-3 px-3" />
                                                        </tr>
                                                    );

                                                    return (
                                                        <React.Fragment key={idx}>
                                                            <tr
                                                                className={`hover:bg-white/5 group transition-colors cursor-pointer
                                                                    ${item.type === 'main' ? 'bg-white/5 font-bold text-white' : 'text-white/60'}
                                                                    ${item.type === 'highlight' ? 'bg-cyan-500/10 font-black text-white' : ''}
                                                                `}
                                                                onClick={() => {
                                                                    if (!hasChildren) return;
                                                                    if (isExpanded) {
                                                                        setExpandedDreRow(null);
                                                                        setExpandedDreChildrenRows((prev) => {
                                                                            const next = { ...prev };
                                                                            delete next[item.id];
                                                                            return next;
                                                                        });
                                                                        return;
                                                                    }
                                                                    setExpandedDreRow(item.id);
                                                                }}
                                                            >
                                                                <td className="p-4 px-6 text-sm flex items-center gap-2 sticky left-0 z-10 bg-[#0a1628]">
                                                                    {hasChildren && (
                                                                        <ChevronRight className={`w-3 h-3 text-cyan-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                                                                    )}
                                                                    <div className={`w-2 h-2 rounded-full shrink-0 ${item.type === 'positive' ? 'bg-emerald-500' :
                                                                        item.type === 'negative' ? 'bg-rose-500' :
                                                                            item.type === 'main' ? 'bg-cyan-400' : 'bg-white/10'
                                                                        }`} />
                                                                    {item.name}
                                                                </td>
                                                                {months.map((_, mi) => {
                                                                    const monthVal = allMonthsDre[mi]?.[item.key as keyof typeof allMonthsDre[0]] as number || 0;
                                                                    const displayMonthVal = item.type === 'negative' ? Math.abs(monthVal) : monthVal;
                                                                    return (
                                                                        <td key={mi} className={`p-4 px-3 text-xs text-right font-mono font-bold ${
                                                                            mi === selectedMonthIndex ? 'bg-cyan-500/5' : ''
                                                                        } ${item.type === 'negative' ? 'text-rose-400' :
                                                                            item.type === 'positive' ? 'text-emerald-400' : 'text-white/80'
                                                                        }`}>
                                                                            {formatSignedLocaleNumber(displayMonthVal)}
                                                                        </td>
                                                                    );
                                                                })}
                                                                <td className={`p-4 px-3 text-xs text-right font-mono font-bold bg-white/5 sticky right-[100px] z-10 shadow-[-4px_0_10px_rgba(0,0,0,0.3)] ${
                                                                    item.type === 'highlight' ? 'text-cyan-400' : 'text-white'
                                                                }`}>
                                                                    {formatSignedLocaleNumber(item.type === 'negative' ? Math.abs(acumulado) : acumulado)}
                                                                </td>
                                                                <td className={`p-4 px-3 text-xs text-right font-black sticky right-0 z-10 bg-[#0a1628] shadow-[-4px_0_10px_rgba(0,0,0,0.3)] ${item.pct.startsWith('-') ? 'text-rose-400' : 'text-cyan-400'}`}>
                                                                    {item.pct}
                                                                </td>
                                                                <td className="p-2 px-3">
                                                                    {!isReadOnly ? (
                                                                        <input
                                                                            className="w-full bg-white/5 border border-white/5 rounded-lg px-2 py-1 text-[11px] text-white/60 outline-none focus:ring-1 focus:ring-cyan-500/30 focus:border-cyan-500/30 transition-all placeholder:text-white/10"
                                                                            placeholder="Nota..."
                                                                            value={dreComments[item.id] || ''}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            onChange={(e) => setDreComments(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                                        />
                                                                    ) : (
                                                                        <span className="text-white/30 text-[11px]">{dreComments[item.id] || '-'}</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                            {/* Drill-down: contas da movimentacao mapeadas para essa linha do DRE */}
                                                            {/* Drill-down: contas da movimentacao mapeadas para essa linha do DRE */}
                                                            {isExpanded && primaryRows.map((child, ci) => {
                                                                const childTotal = child.values.reduce((s, v) => s + v, 0);
                                                                return (
                                                                    <tr key={`${idx}-primary-child-${ci}`} className="bg-white/[0.02] text-white/40 text-xs">
                                                                        <td className="p-3 px-6 sticky left-0 z-10 bg-[#0b1520]">
                                                                            <div className="flex items-center gap-2" style={{ paddingLeft: `${(child.level - 1) * 12}px` }}>
                                                                                <span className="text-cyan-400/60 font-mono text-[10px]">{child.code}</span>
                                                                                <span className="truncate">{child.name}</span>
                                                                            </div>
                                                                        </td>
                                                                        {months.map((_, mi) => (
                                                                            <td key={mi} className={`p-3 px-3 text-right font-mono ${mi === selectedMonthIndex ? 'bg-cyan-500/5' : ''}`}>
                                                                                {formatLocaleNumber(child.values[mi] || 0)}
                                                                            </td>
                                                                        ))}
                                                                        <td className="p-3 px-3 text-right font-mono bg-white/5 sticky right-[100px] z-10 shadow-[-4px_0_10px_rgba(0,0,0,0.3)]">{formatLocaleNumber(childTotal)}</td>
                                                                        <td className="p-3 px-3 text-right sticky right-0 z-10 bg-[#0b1520] shadow-[-4px_0_10px_rgba(0,0,0,0.3)]">-</td>
                                                                        <td className="p-3 px-3" />
                                                                    </tr>
                                                                );
                                                            })}
                                                            {isExpanded && childRows.length > 0 && (
                                                                <tr className="bg-white/[0.02] text-white/50 text-xs">
                                                                    <td className="p-3 px-6 sticky left-0 z-10 bg-[#0b1520]">
                                                                        <button
                                                                            type="button"
                                                                            className="text-cyan-300 hover:text-cyan-200 transition-colors font-semibold"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setExpandedDreChildrenRows((prev) => ({
                                                                                    ...prev,
                                                                                    [item.id]: !prev[item.id],
                                                                                }));
                                                                            }}
                                                                        >
                                                                            {showChildRows ? `Ocultar filhas (${childRows.length})` : `Mostrar filhas (${childRows.length})`}
                                                                        </button>
                                                                    </td>
                                                                    {months.map((_, mi) => (
                                                                        <td key={mi} className={`p-3 px-3 ${mi === selectedMonthIndex ? 'bg-cyan-500/5' : ''}`} />
                                                                    ))}
                                                                    <td className="p-3 px-3 bg-white/5 sticky right-[100px] z-10 shadow-[-4px_0_10px_rgba(0,0,0,0.3)]" />
                                                                    <td className="p-3 px-3 sticky right-0 z-10 bg-[#0b1520] shadow-[-4px_0_10px_rgba(0,0,0,0.3)]" />
                                                                    <td className="p-3 px-3" />
                                                                </tr>
                                                            )}
                                                            {isExpanded && showChildRows && childRows.map((child, ci) => {
                                                                const childTotal = child.values.reduce((s, v) => s + v, 0);
                                                                return (
                                                                    <tr key={`${idx}-child-${ci}`} className="bg-white/[0.02] text-white/40 text-xs">
                                                                        <td className="p-3 px-6 sticky left-0 z-10 bg-[#0b1520]">
                                                                            <div className="flex items-center gap-2" style={{ paddingLeft: `${(child.level - 1) * 12}px` }}>
                                                                                <span className="text-cyan-400/60 font-mono text-[10px]">{child.code}</span>
                                                                                <span className="truncate">{child.name}</span>
                                                                            </div>
                                                                        </td>
                                                                        {months.map((_, mi) => (
                                                                            <td key={mi} className={`p-3 px-3 text-right font-mono ${mi === selectedMonthIndex ? 'bg-cyan-500/5' : ''}`}>
                                                                                {formatLocaleNumber(child.values[mi] || 0)}
                                                                            </td>
                                                                        ))}
                                                                        <td className="p-3 px-3 text-right font-mono bg-white/5 sticky right-[100px] z-10 shadow-[-4px_0_10px_rgba(0,0,0,0.3)]">{formatLocaleNumber(childTotal)}</td>
                                                                        <td className="p-3 px-3 text-right sticky right-0 z-10 bg-[#0b1520] shadow-[-4px_0_10px_rgba(0,0,0,0.3)]">-</td>
                                                                        <td className="p-3 px-3" />
                                                                    </tr>
                                                                );
                                                            })}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : dreViewMode === 'graficos' ? (
                                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 animate-in zoom-in-95 duration-500 overflow-y-auto max-h-[70vh]">
                                        {[
                                            { title: 'Receita Bruta',                    data: monthlyReportData.recBruta,        color: '#0ea5e9' },
                                            { title: 'Deduções',                         data: monthlyReportData.deducoes,        color: '#f43f5e' },
                                            { title: 'Receita Líquida',                  data: monthlyReportData.recLiquida,      color: '#2563eb' },
                                            { title: 'Custos das Vendas',                data: monthlyReportData.custos,          color: '#f59e0b' },
                                            { title: 'Custos dos Serviços',              data: monthlyReportData.custosServicos,  color: '#f97316' },
                                            { title: 'Lucro Operacional',                data: monthlyReportData.lucroBruto,      color: '#3b82f6' },
                                            { title: 'Despesas Adm.',                    data: monthlyReportData.despAdm,         color: '#ec4899' },
                                            { title: 'Despesas Com.',                    data: monthlyReportData.despCom,         color: '#d946ef' },
                                            { title: 'Despesas Trib.',                   data: monthlyReportData.despTrib,        color: '#a855f7' },
                                            { title: 'Result. Participações Soc.',       data: monthlyReportData.partSocietarias, color: '#14b8a6' },
                                            { title: 'Outras Receitas',                  data: monthlyReportData.outrasReceitas,  color: '#22c55e' },
                                            { title: 'Receitas Fin.',                    data: monthlyReportData.recFin,          color: '#10b981' },
                                            { title: 'Despesas Fin.',                    data: monthlyReportData.despFin,         color: '#fb7185' },
                                            { title: 'LAIR',                             data: monthlyReportData.lair,            color: '#6366f1' },
                                            { title: 'IRPJ/CSLL',                        data: monthlyReportData.irpjCsll,        color: '#ef4444' },
                                            { title: 'Lucro Líquido',                    data: monthlyReportData.lucroLiquido,    color: '#059669' },
                                            { title: 'EBITDA',                           data: monthlyReportData.ebtida,          color: '#8b5cf6' },
                                        ].map((indicator, i) => {
                                            const currentVal = indicator.data[selectedMonthIndex]?.value || 0;
                                            const prevVal = selectedMonthIndex > 0 ? indicator.data[selectedMonthIndex - 1]?.value : null;
                                            const diff = prevVal !== null ? currentVal - prevVal : 0;
                                            const trendPct = prevVal && prevVal !== 0 ? (diff / Math.abs(prevVal)) * 100 : 0;

                                            return (
                                                <div key={i} className="bg-linear-to-br from-[#0d2847]/40 to-[#0a1f3a]/40 border border-white/10 rounded-2xl p-6 hover:border-cyan-500/30 transition-all group shadow-xl shadow-black/20">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div>
                                                            <h4 className="text-white/60 text-sm font-bold uppercase tracking-widest mb-1">{indicator.title}</h4>
                                                            <div className="flex items-baseline gap-2">
                                                                <span className="text-xl font-bold text-white tracking-tight">
                                                                    R$ {currentVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </span>
                                                                {prevVal !== null && (
                                                                    <span className={`text-[10px] font-black ${trendPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                                        {trendPct >= 0 ? '↑' : '↓'} {Math.abs(trendPct).toFixed(1)}%
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/20 group-hover:bg-white/10 transition-colors`}>
                                                            <TrendingUp className="w-4 h-4" />
                                                        </div>
                                                    </div>
                                                    
                                                    <DeferredChartContainer className="h-32 -mx-2">
                                                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                                            <AreaChart data={indicator.data}>
                                                                <defs>
                                                                    <linearGradient id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                                                                        <stop offset="5%" stopColor={indicator.color} stopOpacity={0.4}/>
                                                                        <stop offset="95%" stopColor={indicator.color} stopOpacity={0}/>
                                                                    </linearGradient>
                                                                </defs>
                                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                                                                <XAxis
                                                                    dataKey="name"
                                                                    axisLine={false}
                                                                    tickLine={false}
                                                                    tick={{ fill: '#ffffff40', fontSize: 13, fontWeight: 700 }}
                                                                    interval={1}
                                                                />
                                                                <YAxis hide />
                                                                <Tooltip
                                                                    contentStyle={{
                                                                        backgroundColor: '#0f172a',
                                                                        border: '1px solid #ffffff10',
                                                                        borderRadius: '16px',
                                                                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                                                                        backdropFilter: 'blur(12px)'
                                                                    }}
                                                                    itemStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                                                                    labelStyle={{ color: '#ffffff40', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 'black' }}
                                                                    formatter={(val: number | string | undefined) => {
                                                                        const numericVal = typeof val === 'string' ? parseFloat(val) : val;
                                                                        return [`R$ ${numericVal?.toLocaleString('pt-BR') || '0,00'}`, 'Valor'];
                                                                    }}
                                                                />
                                                                <Area
                                                                    type="monotone"
                                                                    dataKey="value"
                                                                    stroke={indicator.color}
                                                                    strokeWidth={3}
                                                                    fillOpacity={1}
                                                                    fill={`url(#grad-${i})`}
                                                                    activeDot={{ r: 4, fill: '#fff', stroke: indicator.color, strokeWidth: 2 }}
                                                                />
                                                            </AreaChart>
                                                        </ResponsiveContainer>
                                                    </DeferredChartContainer>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="p-8 flex flex-col gap-3 animate-in slide-in-from-bottom duration-300">
                                        {reportItems
                                            .filter(item => item.type === 'main' || item.type === 'highlight')
                                            .map((item, i) => (
                                                <div key={i} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                                                    item.type === 'highlight'
                                                        ? 'bg-cyan-500/10 border-cyan-500/20'
                                                        : 'bg-white/5 border-white/5'
                                                }`}>
                                                    <span className={`text-sm font-bold tracking-wide ${item.type === 'highlight' ? 'text-cyan-400' : 'text-white'}`}>
                                                        {item.name}
                                                    </span>
                                                    <div className="flex items-center gap-6">
                                                        <span className="text-xs text-white/30 font-mono">{item.pct}</span>
                                                        <span className={`font-mono font-bold text-sm min-w-[100px] text-right ${item.rawVal < 0 ? 'text-red-400' : item.type === 'highlight' ? 'text-cyan-400' : 'text-white'}`}>
                                                            {item.val}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))
                                        }
                                    </div>
                                )}
                            </div>
                        ) : dreSubTab === 'patrimonial' ? (
                            <div ref={reportRef} className="bg-[#0d1829] border border-white/5 rounded-2xl shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 overflow-visible">
                                {/* Header Patrimonial */}
                                <div className="p-8 h-28 border-b border-white/5 flex justify-between items-center bg-[#0d1829] sticky top-20 z-50 rounded-t-2xl">
                                    <div>
                                        <h3 className="text-2xl font-bold text-white tracking-tight">Balanço Patrimonial</h3>
                                        <p className="text-sm text-white/40">Resultado Consolidado • {months[selectedMonthIndex]}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-4">
                                        <div className="flex p-1 bg-black/40 border border-white/5 rounded-2xl">
                                            {[
                                                { id: 'lista', icon: FileSpreadsheet, label: 'Lista' },
                                                { id: 'graficos', icon: BarChart3, label: 'Gráficos' },
                                                { id: 'fechado', icon: LayoutList, label: 'Fechado' },
                                            ].map(mode => (
                                                <button
                                                    key={mode.id}
                                                    onClick={() => { setPatConfigMode(false); setPatViewMode(mode.id as ReportViewMode); }}
                                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${!patConfigMode && patViewMode === mode.id ? 'bg-slate-800 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                                                >
                                                    <mode.icon className="w-4 h-4" />
                                                    {mode.label}
                                                </button>
                                            ))}
                                            {showDrePatConfigButtons && !isReadOnly && (
                                                <button
                                                    onClick={() => setPatConfigMode(!patConfigMode)}
                                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${patConfigMode ? 'bg-slate-800 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                                                >
                                                    <Settings2 className="w-4 h-4" />
                                                    Configuração
                                                </button>
                                            )}
                                        </div>
                                        {!patConfigMode && !isReadOnly && (
                                            <label className="flex items-center gap-2 bg-linear-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white px-6 py-3 rounded-2xl cursor-pointer transition-all font-bold shadow-lg shadow-cyan-500/20">
                                                <Upload className="w-5 h-5" />
                                                Importar Saldo {selectedYear}
                                                <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handlePatrimonialRawFileUpload} />
                                            </label>
                                        )}
                                        {!patConfigMode && (
                                            <button onClick={() => handleExportPDF('Balanco_Patrimonial')} className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all text-white/40 hover:text-white" title="Exportar PDF">
                                                <Download className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {patConfigMode ? (
                                    <Suspense fallback={<LazySectionFallback label="Configuracao patrimonial" />}>
                                        <ClientPatConfigPanel clientId={clientId!} selectedYear={selectedYear} />
                                    </Suspense>
                                ) : <>
                                {/* Render Patrimonial — usa getSumByGroup (por nome de grupo textual) */}
                                {(() => {
                                    // Valores para o mês selecionado
                                    const ativoCirc      = getSumByGroup('ATIVO CIRCULANTE',      selectedMonthIndex);
                                    const ativoNaoCirc   = getSumByGroup('ATIVO NÃO CIRCULANTE',  selectedMonthIndex);
                                    const totalAtivo     = ativoCirc + ativoNaoCirc;
                                    const passivoCirc    = getSumByGroup('PASSIVO CIRCULANTE',     selectedMonthIndex);
                                    const passivoNaoCirc = getSumByGroup('PASSIVO NÃO CIRCULANTE', selectedMonthIndex);
                                    const patrimonioLiq  = getSumByGroup('PATRIMÔNIO LÍQUIDO',    selectedMonthIndex);
                                    const totalPassivo   = passivoCirc + passivoNaoCirc + patrimonioLiq;

                                    const patItems = [
                                        { id: 'ativo_circ',    label: 'Ativo Circulante',       group: 'ATIVO CIRCULANTE',      val: ativoCirc,      type: 'section' as const },
                                        { id: 'ativo_nao',     label: 'Ativo Não Circulante',   group: 'ATIVO NÃO CIRCULANTE',  val: ativoNaoCirc,   type: 'section' as const },
                                        { id: 'total_ativo',   label: 'TOTAL DO ATIVO',         group: '',                      val: totalAtivo,     type: 'total'   as const },
                                        { id: 'pass_circ',     label: 'Passivo Circulante',     group: 'PASSIVO CIRCULANTE',    val: passivoCirc,    type: 'section' as const },
                                        { id: 'pass_nao',      label: 'Passivo Não Circulante', group: 'PASSIVO NÃO CIRCULANTE',val: passivoNaoCirc, type: 'section' as const },
                                        { id: 'pat_liq',       label: 'Patrimônio Líquido',     group: 'PATRIMÔNIO LÍQUIDO',    val: patrimonioLiq,  type: 'section' as const },
                                        { id: 'total_passivo', label: 'TOTAL DO PASSIVO',       group: '',                      val: totalPassivo,   type: 'total'   as const },
                                    ];

                                    // Acumulado anual de um grupo
                                    const getGrpAccum = (grp: string) =>
                                        months.reduce((s, _, mi) => s + getSumByGroup(grp, mi), 0);

                                    // Valor mensal de um item
                                    const getItemMonthVal = (item: typeof patItems[0], mi: number): number => {
                                        if (item.type === 'total') {
                                            if (item.id === 'total_ativo')   return getSumByGroup('ATIVO CIRCULANTE', mi) + getSumByGroup('ATIVO NÃO CIRCULANTE', mi);
                                            return getSumByGroup('PASSIVO CIRCULANTE', mi) + getSumByGroup('PASSIVO NÃO CIRCULANTE', mi) + getSumByGroup('PATRIMÔNIO LÍQUIDO', mi);
                                        }
                                        return getSumByGroup(item.group, mi);
                                    };

                                    // Indicadores Financeiros (calculados para o mês selecionado)
                                    const getChildVal = (childName: string): number =>
                                        getPatrimonialValueByCategory(childName, selectedMonthIndex);
                                    const estoques      = getChildVal('Estoques');
                                    const disponivel    = getChildVal('Disponivel');
                                    const clientes      = getChildVal('Clientes');
                                    const fornecedores  = getChildVal('Fornecedores');
                                    const liquidezCorr  = passivoCirc !== 0 ? ativoCirc / passivoCirc : 0;
                                    const liquidezImed  = passivoCirc !== 0 ? disponivel / passivoCirc : 0;
                                    const liquidezSeca  = passivoCirc !== 0 ? (ativoCirc - estoques) / passivoCirc : 0;
                                    const liquidezGeral = (passivoCirc + passivoNaoCirc) !== 0 ? (ativoCirc + ativoNaoCirc) / (passivoCirc + passivoNaoCirc) : 0;
                                    const partTerc      = totalAtivo !== 0 ? (passivoCirc + passivoNaoCirc) / totalAtivo : 0;
                                    const dreMonth      = allMonthsDre[selectedMonthIndex];
                                    const roe           = patrimonioLiq !== 0 ? (dreMonth?.lucroLiq || 0) / patrimonioLiq : 0;
                                    const roa           = totalAtivo !== 0 ? (dreMonth?.lucroLiq || 0) / totalAtivo : 0;
                                    const margemLiq     = (dreMonth?.recBruta || 0) !== 0 ? (dreMonth?.lucroLiq || 0) / (dreMonth?.recBruta || 1) : 0;
                                    // Novos indicadores
                                    const giroAtivo       = totalAtivo !== 0 ? (dreMonth?.recLiquida || 0) / totalAtivo : 0;
                                    const roic            = totalAtivo !== 0 ? (dreMonth?.lair || 0) / totalAtivo : 0;
                                    const rotEstoques     = estoques !== 0 ? Math.abs(dreMonth?.custos || 0) / estoques : 0;
                                    const prazoEstoque    = rotEstoques !== 0 ? 360 / rotEstoques : 0;
                                    const pmc             = (dreMonth?.recLiquida || 0) !== 0 ? (clientes / Math.abs(dreMonth?.recLiquida || 1)) * 360 : 0;
                                    const pmp             = Math.abs(dreMonth?.custos || 0) !== 0 ? (fornecedores / Math.abs(dreMonth?.custos || 1)) * 360 : 0;
                                    const cicloFinanceiro = pmc - pmp;

                                    const indicadorGroups = [
                                        {
                                            title: 'Liquidez',
                                            items: [
                                                { label: 'Liquidez Corrente',     val: liquidezCorr,  fmt: 'ratio' },
                                                { label: 'Liquidez Imediata',      val: liquidezImed,  fmt: 'ratio' },
                                                { label: 'Liquidez Seca',          val: liquidezSeca,  fmt: 'ratio' },
                                                { label: 'Liquidez Geral',         val: liquidezGeral, fmt: 'ratio' },
                                                { label: 'Participação Terceiros', val: partTerc,      fmt: 'pct'   },
                                            ],
                                        },
                                        {
                                            title: 'Rentabilidade',
                                            items: [
                                                { label: 'Margem Líquida (ML)',    val: margemLiq,              fmt: 'pct'   },
                                                { label: 'ROE',                    val: roe,                    fmt: 'pct'   },
                                                { label: 'ROA',                    val: roa,                    fmt: 'pct'   },
                                                { label: 'ROIC',                   val: roic,                   fmt: 'pct'   },
                                                { label: 'Giro do Ativo (GA)',     val: giroAtivo,              fmt: 'ratio' },
                                                { label: 'EBITDA',                 val: dreMonth?.ebtida || 0,  fmt: 'money' },
                                            ],
                                        },
                                        {
                                            title: 'Atividade / Prazos',
                                            items: [
                                                { label: 'Rotação Estoques (RE)',  val: rotEstoques,     fmt: 'ratio' },
                                                { label: 'Prazo Médio Estoque',    val: prazoEstoque,    fmt: 'days'  },
                                                { label: 'PMC (dias)',             val: pmc,             fmt: 'days'  },
                                                { label: 'PMP (dias)',             val: pmp,             fmt: 'days'  },
                                                { label: 'Ciclo Financeiro',       val: cicloFinanceiro, fmt: 'days'  },
                                            ],
                                        },
                                    ];

                                    const fmtIndicador = (val: number, fmt: string) => {
                                        if (fmt === 'pct')   return `${(val * 100).toFixed(1)}%`;
                                        if (fmt === 'money') return `R$ ${formatLocaleNumber(val)}`;
                                        if (fmt === 'days')  return `${val.toFixed(0)} dias`;
                                        return val.toFixed(2);
                                    };

                                    // ── MODO LISTA ──
                                    if (patViewMode === 'lista') return (
                                        <div className="flex flex-col">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-white/5 border-b border-white/5">
                                                            <th className="p-4 px-6 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] min-w-[260px] sticky left-0 z-20 bg-[#0a1628]">Grupo</th>
                                                            {months.map((m, i) => (
                                                                <th key={m} className={`p-4 px-3 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] text-right min-w-[100px] ${i === selectedMonthIndex ? 'bg-cyan-500/10 text-cyan-400' : ''}`}>{m}</th>
                                                            ))}
                                                            <th className="p-4 px-3 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] text-right min-w-[110px] bg-white/5 sticky right-[70px] z-20 shadow-[-4px_0_10px_rgba(0,0,0,0.3)]">Acum.</th>
                                                            <th className="p-4 px-3 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] text-right min-w-[70px] sticky right-0 z-20 bg-[#0a1628] shadow-[-4px_0_10px_rgba(0,0,0,0.3)]">%</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {patItems.map((item, idx) => {
                                                            const isTotal    = item.type === 'total';
                                                            const patGrpDef  = PAT_STRUCTURE.find(g => g.groupLabel === item.group);
                                                            const hasChildren = (patGrpDef?.children.length ?? 0) > 0;
                                                            const acumulado  = isTotal
                                                                ? (item.id === 'total_ativo'
                                                                    ? months.reduce((s, _, mi) => s + getSumByGroup('ATIVO CIRCULANTE', mi) + getSumByGroup('ATIVO NÃO CIRCULANTE', mi), 0)
                                                                    : months.reduce((s, _, mi) => s + getSumByGroup('PASSIVO CIRCULANTE', mi) + getSumByGroup('PASSIVO NÃO CIRCULANTE', mi) + getSumByGroup('PATRIMÔNIO LÍQUIDO', mi), 0))
                                                                : getGrpAccum(item.group);
                                                            const pct = totalAtivo !== 0 ? `${Math.round((item.val / totalAtivo) * 100)}%` : '0%';
                                                            return (
                                                                <React.Fragment key={idx}>
                                                                    <tr
                                                                        className={`hover:bg-white/5 transition-colors ${isTotal ? 'bg-cyan-500/10 font-black text-white cursor-default' : 'bg-white/5 font-bold text-white/80 cursor-pointer'}`}
                                                                        onClick={() => hasChildren && togglePatGroup(item.id)}
                                                                    >
                                                                        <td className="p-4 px-6 text-sm sticky left-0 z-10 bg-[#0a1628]">
                                                                            <div className="flex items-center gap-2">
                                                                                {hasChildren && (
                                                                                    <ChevronRight className={`w-3 h-3 text-cyan-400 transition-transform duration-200 ${expandedPatGroups.has(item.id) ? 'rotate-90' : ''}`} />
                                                                                )}
                                                                                <div className={`w-2 h-2 rounded-full shrink-0 ${isTotal ? 'bg-cyan-400' : 'bg-white/30'}`} />
                                                                                {item.label}
                                                                            </div>
                                                                        </td>
                                                                        {months.map((_, mi) => (
                                                                            <td key={mi} className={`p-4 px-3 text-xs text-right font-mono font-bold ${mi === selectedMonthIndex ? 'bg-cyan-500/5' : ''} ${isTotal ? 'text-cyan-400' : 'text-white/80'}`}>
                                                                                {formatLocaleNumber(getItemMonthVal(item, mi))}
                                                                            </td>
                                                                        ))}
                                                                        <td className={`p-4 px-3 text-xs text-right font-mono font-bold bg-white/5 sticky right-[70px] z-10 shadow-[-4px_0_10px_rgba(0,0,0,0.3)] ${isTotal ? 'text-cyan-400' : 'text-white'}`}>
                                                                            {formatLocaleNumber(acumulado)}
                                                                        </td>
                                                                        <td className="p-4 px-3 text-xs text-right font-black sticky right-0 z-10 bg-[#0a1628] text-cyan-400 shadow-[-4px_0_10px_rgba(0,0,0,0.3)]">
                                                                            {isTotal ? '100%' : pct}
                                                                        </td>
                                                                    </tr>
                                                                    {expandedPatGroups.has(item.id) && (patGrpDef?.children ?? []).map((childName, ci) => {
                                                                        const childVals = months.map((_, mi) => getPatrimonialValueByCategory(childName, mi));
                                                                        const childAccum = childVals.reduce((s, v) => s + v, 0);
                                                                        return (
                                                                            <tr key={`${idx}-child-${ci}`} className="bg-white/[0.02] text-white/40 text-xs">
                                                                                <td className="p-3 px-6 sticky left-0 z-10 bg-[#0b1520]">
                                                                                    <div className="flex items-center gap-2 pl-6">
                                                                                        <span className="truncate">{childName}</span>
                                                                                    </div>
                                                                                </td>
                                                                                {months.map((_, mi) => (
                                                                                    <td key={mi} className={`p-3 px-3 text-right font-mono ${mi === selectedMonthIndex ? 'bg-cyan-500/5' : ''}`}>
                                                                                        {formatLocaleNumber(childVals[mi])}
                                                                                    </td>
                                                                                ))}
                                                                                <td className="p-3 px-3 text-right font-mono bg-white/5 sticky right-[70px] z-10 shadow-[-4px_0_10px_rgba(0,0,0,0.3)]">{formatLocaleNumber(childAccum)}</td>
                                                                                <td className="p-3 px-3 text-right sticky right-0 z-10 bg-[#0b1520] shadow-[-4px_0_10px_rgba(0,0,0,0.3)]">-</td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                            {/* Indicadores Financeiros */}
                                            <div className="p-6 border-t border-white/5">
                                                <h4 className="text-xs font-black text-white/40 uppercase tracking-[0.2em] mb-6">BALANÇO PATRIMONIAL E INDICADORES FINANCEIROS {selectedYear}</h4>
                                                {indicadorGroups.map((group, gi) => (
                                                    <div key={gi} className="mb-6 last:mb-0">
                                                        <p className="text-[10px] font-black text-cyan-400/60 uppercase tracking-[0.2em] mb-3 border-b border-white/5 pb-2">{group.title}</p>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                            {group.items.map((ind, i) => (
                                                                <div key={i} className="bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col gap-1">
                                                                    <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">{ind.label}</span>
                                                                    <span className={`text-lg font-black font-mono ${ind.fmt === 'days' && ind.val < 0 ? 'text-rose-400' : 'text-white'}`}>{fmtIndicador(ind.val, ind.fmt)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );

                                    // ── MODO GRÁFICOS ──
                                    if (patViewMode === 'graficos') return (
                                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 animate-in zoom-in-95 duration-500 overflow-y-auto max-h-[70vh]">
                                            {[
                                                { title: 'Ativo Circulante',       data: patMonthlyDataByGroup.ativoCirc,     color: '#0ea5e9' },
                                                { title: 'Ativo Não Circulante',   data: patMonthlyDataByGroup.ativoNaoCirc,  color: '#2563eb' },
                                                { title: 'Total do Ativo',         data: patMonthlyDataByGroup.totalAtivo,    color: '#06b6d4' },
                                                { title: 'Passivo Circulante',     data: patMonthlyDataByGroup.passivoCirc,   color: '#f43f5e' },
                                                { title: 'Passivo Não Circulante', data: patMonthlyDataByGroup.passivoNaoCirc, color: '#f59e0b' },
                                                { title: 'Patrimônio Líquido',     data: patMonthlyDataByGroup.patrimonioLiq, color: '#10b981' },
                                                { title: 'Total do Passivo',       data: patMonthlyDataByGroup.totalPassivo,  color: '#8b5cf6' },
                                            ].map((indicator, i) => {
                                                const currentVal = indicator.data[selectedMonthIndex]?.value || 0;
                                                const prevVal = selectedMonthIndex > 0 ? indicator.data[selectedMonthIndex - 1]?.value : null;
                                                const diff = prevVal !== null ? currentVal - prevVal : 0;
                                                const trendPct = prevVal && prevVal !== 0 ? (diff / Math.abs(prevVal)) * 100 : 0;
                                                return (
                                                    <div key={i} className="bg-linear-to-br from-[#0d2847]/40 to-[#0a1f3a]/40 border border-white/10 rounded-2xl p-6 hover:border-cyan-500/30 transition-all group shadow-xl shadow-black/20">
                                                        <div className="flex justify-between items-start mb-4">
                                                            <div>
                                                                <h4 className="text-white/60 text-sm font-bold uppercase tracking-widest mb-1">{indicator.title}</h4>
                                                                <div className="flex items-baseline gap-2">
                                                                    <span className="text-xl font-bold text-white tracking-tight">
                                                                        R$ {currentVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </span>
                                                                    {prevVal !== null && (
                                                                        <span className={`text-[10px] font-black ${trendPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                                            {trendPct >= 0 ? '↑' : '↓'} {Math.abs(trendPct).toFixed(1)}%
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/20 group-hover:bg-white/10 transition-colors">
                                                                <TrendingUp className="w-4 h-4" />
                                                            </div>
                                                        </div>
                                                        <DeferredChartContainer className="h-32 -mx-2">
                                                            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                                                <AreaChart data={indicator.data}>
                                                                    <defs>
                                                                        <linearGradient id={`pat-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                                                                            <stop offset="5%" stopColor={indicator.color} stopOpacity={0.4}/>
                                                                            <stop offset="95%" stopColor={indicator.color} stopOpacity={0}/>
                                                                        </linearGradient>
                                                                    </defs>
                                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff05" />
                                                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#ffffff40', fontSize: 13, fontWeight: 700 }} interval={1} />
                                                                    <YAxis hide />
                                                                    <Tooltip
                                                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff10', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', backdropFilter: 'blur(12px)' }}
                                                                        itemStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                                                                        labelStyle={{ color: '#ffffff40', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 'black' }}
                                                                        formatter={(val: number | string | undefined) => {
                                                                            const numericVal = typeof val === 'string' ? parseFloat(val) : val;
                                                                            return [`R$ ${numericVal?.toLocaleString('pt-BR') || '0,00'}`, 'Valor'];
                                                                        }}
                                                                    />
                                                                    <Area type="monotone" dataKey="value" stroke={indicator.color} strokeWidth={3} fillOpacity={1} fill={`url(#pat-grad-${i})`} activeDot={{ r: 4, fill: '#fff', stroke: indicator.color, strokeWidth: 2 }} />
                                                                </AreaChart>
                                                            </ResponsiveContainer>
                                                        </DeferredChartContainer>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );

                                    // ── MODO FECHADO ──
                                    return (
                                        <div className="p-8 flex flex-col gap-4 animate-in slide-in-from-bottom duration-300">
                                            <div className="flex flex-col gap-3">
                                                {patItems
                                                    .filter(item => item.type === 'total' || item.id === 'pat_liq')
                                                    .map((item, i) => (
                                                        <div key={i} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                                                            item.type === 'total' ? 'bg-cyan-500/10 border-cyan-500/20' : 'bg-white/5 border-white/5'
                                                        }`}>
                                                            <span className={`text-sm font-bold tracking-wide ${item.type === 'total' ? 'text-cyan-400' : 'text-white'}`}>
                                                                {item.label}
                                                            </span>
                                                            <span className={`font-mono font-bold text-sm ${item.type === 'total' ? 'text-cyan-400' : 'text-white'}`}>
                                                                R$ {formatLocaleNumber(item.val)}
                                                            </span>
                                                        </div>
                                                    ))
                                                }
                                            </div>
                                            {/* Indicadores compactos */}
                                            <div className="border-t border-white/5 pt-4">
                                                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-3">Indicadores</p>
                                                {indicadorGroups.map((group, gi) => (
                                                    <div key={gi} className="mb-4 last:mb-0">
                                                        <p className="text-[9px] font-black text-cyan-400/40 uppercase tracking-[0.2em] mb-2">{group.title}</p>
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                            {group.items.map((ind, i) => (
                                                                <div key={i} className="bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col gap-1">
                                                                    <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">{ind.label}</span>
                                                                    <span className={`text-base font-black font-mono ${ind.fmt === 'days' && ind.val < 0 ? 'text-rose-400' : 'text-white'}`}>{fmtIndicador(ind.val, ind.fmt)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}
                                </>}
                            </div>
                        ) : dreSubTab === 'dfc' ? (
                            <Suspense fallback={<LazySectionFallback label="Secao DFC" />}>
                                <ClientDfcSection
                                    clientId={clientId || client?.id}
                                    isAccountingView={isAccountingView}
                                    selectedYear={selectedYear}
                                    selectedMonthIndex={selectedMonthIndex}
                                    months={months}
                                    reportRef={reportRef}
                                    onExport={() => handleExportPDF('DFC')}
                                />
                            </Suspense>
                        ) : showLegacyDfc ? (
                            <div ref={reportRef} className="bg-[#0d1829]/80 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl animate-in slide-in-from-right duration-500">
                                {/* Cabeçalho */}
                                <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
                                    <div>
                                        <h3 className="text-2xl font-bold text-white tracking-tight">Demonstração do Fluxo de Caixa</h3>
                                        <p className="text-sm text-white/40">Método Indireto • {selectedYear}</p>
                                    </div>
                                    <button onClick={() => handleExportPDF('DFC')} className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all text-white/40 hover:text-white" title="Exportar PDF">
                                        <Download className="w-5 h-5" />
                                    </button>
                                </div>
                                {/* Tabela Jan–Dez */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-white/5 border-b border-white/5">
                                                <th className="p-4 px-6 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] min-w-[300px] sticky left-0 z-20 bg-[#0a1628]">EMPRESA</th>
                                                {months.map((m, i) => (
                                                    <th key={m} className={`p-4 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-right min-w-[100px] ${i === selectedMonthIndex ? 'bg-cyan-500/10 text-cyan-400' : 'text-white/40'}`}>{m}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {DFC_STRUCTURE.map((row, i) => {
                                                if (row.type === 'separator') {
                                                    return <tr key={i}><td colSpan={13} className="h-4 bg-transparent" /></tr>;
                                                }
                                                if (row.type === 'section') {
                                                    return (
                                                        <tr key={i} className="border-t-2 border-white/10">
                                                            <td className="p-4 px-6 text-[11px] font-black text-white/60 uppercase tracking-[0.15em] sticky left-0 z-10 bg-[#0d1829]">{row.label}</td>
                                                            {months.map((_, mi) => (
                                                                <td key={mi} className={`p-4 px-3 text-xs text-right font-mono text-white/20 ${mi === selectedMonthIndex ? 'bg-cyan-500/5' : 'bg-[#0d1829]'}`}>—</td>
                                                            ))}
                                                        </tr>
                                                    );
                                                }
                                                if (row.type === 'result') {
                                                    return (
                                                        <tr key={i} className="bg-cyan-500/10 border-t border-white/10">
                                                            <td className="p-4 px-6 text-sm font-black text-white uppercase tracking-wide sticky left-0 z-10 bg-[#0a1e2e]">{row.label}</td>
                                                            {months.map((_, mi) => (
                                                                <td key={mi} className={`p-4 px-3 text-sm text-right font-mono font-black text-cyan-400 ${mi === selectedMonthIndex ? 'bg-cyan-500/10' : ''}`}>—</td>
                                                            ))}
                                                        </tr>
                                                    );
                                                }
                                                // type === 'item'
                                                return (
                                                    <tr key={i} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                                                        <td className="p-3 px-8 text-sm text-white/55 sticky left-0 z-10 bg-[#0a1628]">{row.label}</td>
                                                        {months.map((_, mi) => (
                                                            <td key={mi} className={`p-3 px-3 text-sm text-right font-mono text-white/35 ${mi === selectedMonthIndex ? 'bg-cyan-500/5' : ''}`}>—</td>
                                                        ))}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-[#0d1829]/80 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl animate-in slide-in-from-right duration-500">
                                <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
                                    <div>
                                        <h3 className="text-2xl font-bold text-white tracking-tight">Plano de Contas</h3>
                                        <p className="text-white/40 text-sm">{accounts.length > 0 ? `${accounts.length} contas cadastradas` : 'Importe o plano de contas da empresa'}</p>
                                    </div>
                                    {!isReadOnly && (
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 bg-linear-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white px-6 py-3 rounded-2xl cursor-pointer transition-all font-bold shadow-lg shadow-cyan-500/20">
                                                <Upload className="w-5 h-5" />
                                                Importar Plano de Contas
                                                <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleImportPlanoDeContas} />
                                            </label>
                                        </div>
                                    )}
                                </div>
                                {accounts.length === 0 ? (
                                    <div className="p-16 text-center">
                                        <FileSpreadsheet className="w-16 h-16 text-white/10 mx-auto mb-4" />
                                        <h4 className="text-lg font-bold text-white/40 mb-2">Nenhum plano de contas</h4>
                                        <p className="text-sm text-white/20">Importe um arquivo CSV ou XLSX com o plano de contas da empresa</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="sticky top-0 z-10">
                                                <tr className="bg-[#0a1628] border-b border-white/5">
                                                    <th className="p-4 px-6 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] min-w-[160px]">Código</th>
                                                    <th className="p-4 px-3 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] min-w-[50px]">Nív</th>
                                                    <th className="p-4 px-3 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] min-w-[50px]">Tipo</th>
                                                    <th className="p-4 px-6 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] min-w-[300px]">Descrição</th>
                                                    <th className="p-4 px-3 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] min-w-[100px]">Apelido</th>
                                                    <th className="p-4 px-3 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] min-w-[120px]">Relatório</th>
                                                    <th className="p-4 px-3 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] min-w-[160px]">Desc. Relatório</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {accounts
                                                    .filter(a => !searchTerm || a.classification.includes(searchTerm) || a.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                                    .map((item, idx) => {
                                                        const isTotalizador = item.level <= 10 && item.category;
                                                        return (
                                                            <tr key={idx} className={`hover:bg-white/5 transition-colors ${
                                                                item.level === 1 ? 'bg-white/10 font-black text-white' :
                                                                item.level <= 7 ? 'bg-white/5 font-bold text-white' :
                                                                isTotalizador ? 'font-semibold text-white/80' : 'text-white/50'
                                                            }`}>
                                                                <td className="p-3 px-6 text-xs font-mono text-cyan-400">{item.classification}</td>
                                                                <td className="p-3 px-3 text-xs text-center text-white/30">{item.level}</td>
                                                                <td className="p-3 px-3 text-xs text-center">
                                                                    {isTotalizador ? (
                                                                        <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded-md text-[10px] font-bold">T</span>
                                                                    ) : (
                                                                        <span className="text-white/20">A</span>
                                                                    )}
                                                                </td>
                                                                <td className="p-3 px-6 text-sm">
                                                                    <div style={{ paddingLeft: `${Math.min((item.level - 1) * 8, 80)}px` }}>
                                                                        {item.name}
                                                                    </div>
                                                                </td>
                                                                <td className="p-3 px-3 text-[10px] text-white/30 font-mono">{item.alias || '-'}</td>
                                                                <td className="p-3 px-3 text-[10px] text-white/30">{item.category || '-'}</td>
                                                                <td className="p-3 px-3 text-[10px] text-white/30">{item.report_category || '-'}</td>
                                                            </tr>
                                                        );
                                                    })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Aba de Suporte - visível apenas para clientes */}
                {moduleMock ? (
                    <MockModuleSection module={moduleMock} reportRef={reportRef} />
                ) : isComingSoonTab ? (
                    <ComingSoonSection
                        title={comingSoonCopy?.title ?? activeSidebarLabel}
                        description={comingSoonCopy?.description ?? 'Conteúdo em preparação.'}
                    />
                ) : null}

                {activeTab === 'arquivos' && isClientView && (
                    <Suspense fallback={<LazySectionFallback label="Documentos do cliente" />}>
                        <ClientDocumentUploadPanel />
                    </Suspense>
                )}

                {activeTab === 'suporte' && isClientView && (
                    <div className="space-y-6 pb-12">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-bold text-white tracking-tight">Meus Chamados</h3>
                                <p className="text-white/40 text-sm">Acompanhe o andamento e continue a conversa no mesmo chamado.</p>
                            </div>
                            <button
                                onClick={() => setIsSupportOpen(true)}
                                className="flex items-center gap-2 bg-linear-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white px-6 py-3 rounded-2xl transition-all font-bold shadow-lg shadow-cyan-500/20"
                            >
                                <PlusIcon className="w-5 h-5" />
                                Novo Chamado
                            </button>
                        </div>

                        {isTicketsLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
                            </div>
                        ) : supportTickets.length === 0 ? (
                            <div className="bg-[#0d1829]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-16 text-center">
                                <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center text-white/20 mx-auto mb-4">
                                    <Ticket className="w-8 h-8" />
                                </div>
                                <h4 className="text-white/60 text-lg font-bold mb-2">Nenhum chamado</h4>
                                <p className="text-white/30 text-sm">Voce ainda nao abriu nenhum chamado de suporte.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {supportTickets.map((ticket) => (
                                    <button
                                        key={ticket.id}
                                        type="button"
                                        onClick={() => setSelectedSupportTicketId(ticket.id)}
                                        className={`w-full text-left bg-[#0d1829]/80 backdrop-blur-xl border rounded-2xl p-6 transition-all ${
                                            ticket.id === selectedSupportTicketId
                                                ? 'border-cyan-500/30 bg-cyan-500/10'
                                                : 'border-white/5 hover:bg-white/5'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <h4 className="text-white font-bold text-lg">{ticket.subject}</h4>
                                                <p className="text-white/40 text-sm mt-1 line-clamp-2">{ticket.message}</p>
                                            </div>
                                            <div className="flex items-center gap-3 ml-4">
                                                <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${
                                                    ticket.priority === 'high' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                    ticket.priority === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                    'bg-green-500/10 text-green-400 border-green-500/20'
                                                }`}>
                                                    {ticket.priority === 'high' ? 'Alta' : ticket.priority === 'medium' ? 'Media' : 'Baixa'}
                                                </span>
                                                <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${
                                                    ticket.status === 'open' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                                                    ticket.status === 'in_progress' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                    'bg-green-500/10 text-green-400 border-green-500/20'
                                                }`}>
                                                    {ticket.status === 'open' ? 'Aberto' : ticket.status === 'in_progress' ? 'Em Andamento' : 'Resolvido'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-white/20 text-xs">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                Atualizado em {new Date(ticket.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        <Suspense fallback={<LazySectionFallback label="Detalhe do chamado" />}>
                            <SupportTicketDetailPanel
                                ticket={selectedSupportTicket}
                                messages={supportMessages}
                                isLoadingMessages={isSupportMessagesLoading}
                                replyDraft={supportReplyDraft}
                                isSubmittingReply={isSubmittingSupportReply}
                                onReplyDraftChange={setSupportReplyDraft}
                                onReplySubmit={handleSupportReply}
                                metadata={selectedSupportTicket ? (
                                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                                        <span>{client?.name || 'Cliente'}</span>
                                        <span>Abertura em {new Date(selectedSupportTicket.created_at).toLocaleString('pt-BR')}</span>
                                        {selectedSupportTicket.closed_at && (
                                            <span>Fechado em {new Date(selectedSupportTicket.closed_at).toLocaleString('pt-BR')}</span>
                                        )}
                                    </div>
                                ) : undefined}
                                emptyTitle="Selecione um chamado"
                                emptyDescription="Escolha um ticket para acompanhar a conversa com a contabilidade e enviar novas mensagens."
                                replyLabel="Nova mensagem para a contabilidade"
                            />
                        </Suspense>
                    </div>
                )}
            </div>
        </div>
    </div>
</div>

            {/* Support Modal (Dark Glass) */}
            {isSupportOpen && (
                <div className="fixed inset-0 bg-[#0a1628]/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-[#0d1829]/95 backdrop-blur-xl border border-white/10 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-10 border-b border-white/5 flex justify-between items-center bg-white/5">
                            <div>
                                <h3 className="text-2xl font-bold text-white tracking-tight">Solicitar Suporte</h3>
                                <p className="text-sm text-white/40">Nossa equipe de especialistas está pronta para ajudar</p>
                            </div>
                            <button onClick={() => setIsSupportOpen(false)} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-white/40 hover:text-white">
                                <PlusIcon className="w-6 h-6 rotate-45" />
                            </button>
                        </div>
                        <form onSubmit={handleSupportSubmit} className="p-10 space-y-6">
                            {supportError && (
                                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 px-4 py-3 text-sm flex items-center gap-2">
                                    <Bell className="w-4 h-4 shrink-0" />
                                    {supportError}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-white/60 ml-1">Assunto</label>
                                <input
                                    value={supportForm.subject}
                                    onChange={(e) => setSupportForm({ ...supportForm, subject: e.target.value })}
                                    placeholder="Ex: Dúvida sobre o fechamento mensal"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all placeholder:text-white/20"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-white/60 ml-1">Prioridade</label>
                                    <select
                                        value={supportForm.priority}
                                        onChange={(e) => setSupportForm({ ...supportForm, priority: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="low" className="bg-[#0d1829]">Baixa</option>
                                        <option value="medium" className="bg-[#0d1829]">Média</option>
                                        <option value="high" className="bg-[#0d1829]">Alta</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-white/60 ml-1">Empresa</label>
                                    <input
                                        value={client?.name || ''}
                                        disabled
                                        className="w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-white/40 cursor-not-allowed"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-white/60 ml-1">Descrição do Problema</label>
                                <textarea
                                    value={supportForm.message}
                                    onChange={(e) => setSupportForm({ ...supportForm, message: e.target.value })}
                                    placeholder="Detalhe sua solicitação aqui..."
                                    className="w-full min-h-[160px] bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all placeholder:text-white/20 resize-none"
                                    required
                                />
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsSupportOpen(false)}
                                    className="flex-1 px-8 py-4 border border-white/10 text-white/60 font-bold rounded-2xl hover:bg-white/5 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={supportSubmitting}
                                    className="flex-2 bg-linear-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white font-bold px-8 py-4 rounded-2xl shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {supportSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enviar Solicitação'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Manual Entry Modal (Dark Glass) */}
            {isModalOpen && !isReadOnly && (
                <div className="fixed inset-0 bg-[#0a1628]/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-[#0d1829]/95 backdrop-blur-xl border border-white/10 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-10 border-b border-white/5 flex justify-between items-center bg-white/5">
                            <div>
                                <h3 className="text-2xl font-bold text-white tracking-tight">Novo Lançamento</h3>
                                <p className="text-sm text-white/40">Inserção manual de dados contábeis</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-white/40 hover:text-white">
                                <PlusIcon className="w-6 h-6 rotate-45" />
                            </button>
                        </div>
                        <form onSubmit={handleManualSubmit} className="p-10 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-white/60 ml-1">Classificação</label>
                                    <input
                                        placeholder="ex: 04.1.01"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all placeholder:text-white/10"
                                        value={newAccount.classification}
                                        onChange={e => setNewAccount({ ...newAccount, classification: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-white/60 ml-1">Nome da Conta</label>
                                    <input
                                        placeholder="Descrição da conta"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all placeholder:text-white/10"
                                        value={newAccount.name}
                                        onChange={e => setNewAccount({ ...newAccount, name: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="bg-white/5 rounded-2xl p-8 border border-white/5">
                                <h4 className="text-xs font-black text-white/40 uppercase tracking-[0.2em] mb-6">Saldos Mensais</h4>
                                <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                                    {months.map((m, i) => (
                                        <div key={m} className="space-y-1.5">
                                            <label className="text-[10px] font-black text-white/20 uppercase tracking-tighter ml-1">{m}</label>
                                            <input
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all text-right font-mono"
                                                value={newAccount.values[i]}
                                                onChange={e => {
                                                    const updatedValues = [...newAccount.values];
                                                    updatedValues[i] = e.target.value;
                                                    setNewAccount({ ...newAccount, values: updatedValues });
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <button type="submit" className="w-full py-4 bg-linear-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white font-bold rounded-2xl shadow-lg shadow-cyan-500/20 transition-all">
                                Salvar Lançamento
                            </button>
                        </form>
                    </div>
                </div>
            )}
            </div>

            {/* Floating Support Button */}
            <button 
                onClick={() => setIsSupportOpen(true)}
                className="fixed bottom-8 right-8 z-50 w-16 h-16 bg-linear-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-cyan-500/40 hover:scale-110 active:scale-95 transition-all group"
            >
                <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full border-2 border-[#0a1628] animate-pulse" />
                <MessageSquare className="w-8 h-8 group-hover:rotate-12 transition-transform" />
            </button>
        </>
    );
};

export default ClientDashboard;
