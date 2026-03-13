import React, { useMemo, useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip,
    PieChart as RechartsPie, Pie, Cell, Legend,
    LineChart, Line,
    BarChart, Bar,
} from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import axios from 'axios';
import { clientService } from '../services/clientService';
import type { Client } from '../services/clientService';
import { clientPortalService } from '../services/clientPortalService';
import type { SupportTicket } from '../services/clientPortalService';
import { chartOfAccountsService, clientChartOfAccountsService } from '../services/chartOfAccountsService';
import type { ImportAccount } from '../services/chartOfAccountsService';
import { movementService } from '../services/movementService';
import type { MovementRow } from '../services/movementService';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/useAuthStore';
import { useClientAuthStore } from '../stores/useClientAuthStore';
import ClientDfcSection from '../components/ClientDfcSection';
import { TooltipCurrency, TooltipPercent } from '../components/client-dashboard/ChartTooltips';
import type { DreMonthData } from '../components/client-dashboard/constants';

const formatLocaleNumber = (number: number) => {
    return Math.abs(number).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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

const DRE_TABS: Array<{ id: DreSubTab; label: string; show: boolean }> = [
    { id: 'dre', label: 'DRE', show: true },
    { id: 'patrimonial', label: 'Patrimonial', show: true },
    { id: 'dfc', label: 'DFC', show: true },
    { id: 'contas', label: 'Plano de Contas', show: true },
];

const ClientDashboard = () => {
    const { id: clientId } = useParams();
    const navigate = useNavigate();

    // State Declarations
    const [activeTab, setActiveTab] = useState('dashboard');
    const [dreSubTab, setDreSubTab] = useState<DreSubTab>('dre');
    const [dreViewMode, setDreViewMode] = useState<ReportViewMode>('lista');
    const [patViewMode, setPatViewMode] = useState<ReportViewMode>('lista');
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

    // Estado do card de IA
    const [aiText, setAiText] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState('');

    const handleExportPDF = async (title: string) => {
        const el = reportRef.current;
        if (!el) return;
        try {
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

    const [client, setClient] = useState<Client | null>(null);
    const [isClientLoading, setIsClientLoading] = useState(true);
    const [supportForm, setSupportForm] = useState({
        subject: '',
        message: '',
        priority: 'medium',
    });
    const [supportSubmitting, setSupportSubmitting] = useState(false);
    const [supportError, setSupportError] = useState<string | null>(null);
    const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
    const [isTicketsLoading, setIsTicketsLoading] = useState(false);
    const accountingToken = useAuthStore((state) => state.token);
    const clientToken = useClientAuthStore((state) => state.token);
    const clientLogout = useClientAuthStore((state) => state.logout);
    const isAccountingView = Boolean(accountingToken);
    const isClientView = Boolean(clientToken) && !isAccountingView;
    const isReadOnly = isClientView;

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
    const showLegacyDfc = false;

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
        const loadClient = async () => {
            try {
                setIsClientLoading(true);
                if (isAccountingView && clientId) {
                    // Staff visualizando um cliente especifico
                    const data = await clientService.getById(clientId);
                    setClient(data);
                } else if (isClientView) {
                    // Cliente logado no portal - busca dados via token
                    const data = await clientPortalService.getMe();
                    setClient(data as Client);
                }
            } catch (error) {
                if (axios.isAxiosError(error) && error.response?.status === 401) {
                    if (isClientView) {
                        clientLogout();
                        navigate('/client-login');
                    } else {
                        navigate('/login');
                    }
                    return;
                }
                console.error('Error fetching client:', error);
            } finally {
                setIsClientLoading(false);
            }
        };
        if ((isAccountingView && clientId) || isClientView) {
            loadClient();
        }
    }, [clientId, navigate, isAccountingView, isClientView, clientLogout]);

    // Carregar plano de contas do banco de dados
    useEffect(() => {
        const loadChartOfAccounts = async () => {
            try {
                let dbAccounts;
                if (isAccountingView && clientId) {
                    dbAccounts = await chartOfAccountsService.getAll(clientId);
                } else if (isClientView) {
                    dbAccounts = await clientChartOfAccountsService.getAll();
                }
                if (dbAccounts && dbAccounts.length > 0) {
                    // Converter formato do banco para formato do frontend (Account interface)
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
                }
            } catch (error) {
                // Silencioso - se não há plano de contas, não exibe erro
                console.error('Erro ao carregar plano de contas:', error);
            }
        };
        if ((isAccountingView && clientId) || isClientView) {
            loadChartOfAccounts();
        }
    }, [clientId, isAccountingView, isClientView]);

    // Carregar movimentações DRE do banco de dados
    useEffect(() => {
        const loadDreMovements = async () => {
            try {
                if (isAccountingView && clientId) {
                    const data = await movementService.getAll(clientId, selectedYear, 'dre');
                    setDreMovements(data);
                } else if (isClientView) {
                    const data = await clientPortalService.getMovements(selectedYear, 'dre');
                    setDreMovements(data.map(d => ({ ...d, category: d.category ?? undefined })) as MovementRow[]);
                }
            } catch (error) {
                console.error('Erro ao carregar movimentações DRE:', error);
            }
        };
        if ((isAccountingView && clientId) || isClientView) {
            loadDreMovements();
        }
    }, [clientId, isAccountingView, isClientView, selectedYear]);

    // Carregar movimentações Patrimonial do banco de dados
    useEffect(() => {
        const loadPatrimonialMovements = async () => {
            try {
                if (isAccountingView && clientId) {
                    const data = await movementService.getAll(clientId, selectedYear, 'patrimonial');
                    setPatrimonialMovements(data);
                } else if (isClientView) {
                    const data = await clientPortalService.getMovements(selectedYear, 'patrimonial');
                    setPatrimonialMovements(data.map(d => ({ ...d, category: d.category ?? undefined })) as MovementRow[]);
                }
            } catch (error) {
                console.error('Erro ao carregar movimentações Patrimonial:', error);
            }
        };
        if ((isAccountingView && clientId) || isClientView) {
            loadPatrimonialMovements();
        }
    }, [clientId, isAccountingView, isClientView, selectedYear]);

    // Carregar tickets de suporte quando o cliente acessa a aba suporte
    useEffect(() => {
        const loadTickets = async () => {
            if (!isClientView || activeTab !== 'suporte') return;
            try {
                setIsTicketsLoading(true);
                const tickets = await clientPortalService.getSupportTickets();
                setSupportTickets(tickets);
            } catch (error) {
                console.error('Erro ao carregar tickets:', error);
            } finally {
                setIsTicketsLoading(false);
            }
        };
        loadTickets();
    }, [isClientView, activeTab]);

    // Remove acentos e normaliza string para comparação à prova de encoding
    const stripAccents = (s: string): string =>
        s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

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

    // Função DE-PARA: soma movimentações pela coluna category (DE-PARA do balancete)
    // Com fallback para cruzar com Plano de Contas se o balancete não tiver DE-PARA
    const getSumByReportCategory = (categoryName: string, monthIdx: number, movementsData: MovementRow[]): number => {
        const normalize = (s: string) => stripAccents(s);
        const cat = normalize(categoryName);

        // Resolve aliases: se a categoria tem aliases, aceita qualquer um deles
        const aliases = CATEGORY_ALIASES[cat] ?? [cat];

        // 1. Tenta pelo DE-PARA dos próprios movements (coluna category do balancete)
        const matched = movementsData.filter(m =>
            m.category && aliases.includes(normalize(m.category))
        );

        if (matched.length > 0) {
            // Soma apenas contas-folha: contas que NÃO são prefixo de nenhuma outra
            // Isso evita dupla contagem quando pai e filhas têm a mesma categoria DE-PARA
            const allCodes = matched.map(m => m.code);
            const leaves = matched.filter(m =>
                !allCodes.some(c => c !== m.code && c.startsWith(m.code + '.'))
            );
            return leaves.reduce((sum, m) => sum + (m.values[monthIdx] || 0), 0);
        }

        // 2. Fallback: cruzar com Plano de Contas pelo report_category (também usa aliases)
        const codesInCategory = new Set(
            accounts
                .filter(a => a.report_category && aliases.includes(normalize(a.report_category)))
                .map(a => a.classification)
        );
        if (codesInCategory.size === 0) return 0;
        // Filtrar por contas-folha no fallback também
        const matchedByCode = movementsData.filter(m => codesInCategory.has(m.code));
        const allFallbackCodes = matchedByCode.map(m => m.code);
        const fallbackLeaves = matchedByCode.filter(m =>
            !allFallbackCodes.some(c => c !== m.code && c.startsWith(m.code + '.'))
        );
        return fallbackLeaves.reduce((sum, m) => sum + (m.values[monthIdx] || 0), 0);
    };

    // Busca contas-filhas de um report_category para drill-down
    const getChildAccounts = (reportCategory: string, movementsData: MovementRow[]) => {
        const normalize = (s: string) => stripAccents(s);
        const cat = normalize(reportCategory);
        const aliases = CATEGORY_ALIASES[cat] ?? [cat];

        // Tenta primeiro pelo DE-PARA direto dos movements
        const byCategory = movementsData.filter(m =>
            m.category && aliases.includes(normalize(m.category))
        );
        if (byCategory.length > 0) return byCategory;

        // Fallback: cruza com plano de contas
        const codesInCategory = new Set(
            accounts
                .filter(a => a.report_category && aliases.includes(normalize(a.report_category)))
                .map(a => a.classification)
        );
        return movementsData.filter(m => codesInCategory.has(m.code));
    };

    // Estado para drill-down no DRE
    const [expandedDreRow, setExpandedDreRow] = useState<string | null>(null);

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
        { id: 'rec_liquida',    name: 'RECEITA LIQUIDA',                     key: 'recLiquida',      type: 'main',      category: '' },
        { id: 'custos',         name: 'Custos Das Vendas',                   key: 'custos',          type: 'negative',  category: 'Custos das Vendas' },
        { id: 'custos_serv',    name: 'Custos Dos Serviços',                 key: 'custosServicos',  type: 'negative',  category: 'Custos Dos Serviços' },
        { id: 'lucro_bruto',    name: 'LUCRO OPERACIONAL',                   key: 'lucroBruto',      type: 'main',      category: '' },
        { id: 'desp_adm',       name: 'Despesas Administrativas',            key: 'despAdm',         type: 'negative',  category: 'Despesas Administrativas' },
        { id: 'desp_com',       name: 'Despesas Comerciais',                 key: 'despCom',         type: 'negative',  category: 'Despesas Comerciais' },
        { id: 'desp_trib',      name: 'Despesas Tributarias',                key: 'despTrib',        type: 'negative',  category: 'Despesas Tributárias' },
        { id: 'part_soc',       name: 'Resultado Participações Societárias', key: 'partSocietarias', type: 'positive',  category: 'Resultado Participações Societárias' },
        { id: 'outras_receitas',name: 'Outras Receitas',                     key: 'outrasReceitas',  type: 'positive',  category: 'Outras Receitas' },
        { id: 'rec_fin',        name: 'Receitas Financeiras',                key: 'recFin',          type: 'positive',  category: 'Receitas Financeiras' },
        { id: 'desp_fin',       name: 'Despesas Financeiras',                key: 'despFin',         type: 'negative',  category: 'Despesas Financeiras' },
        { id: 'lair',           name: 'LUCRO ANTES DO IRPJ E CSLL',         key: 'lair',            type: 'main',      category: '' },
        { id: 'irpj_csll',      name: 'Irpj E Csll',                        key: 'irpjCsll',        type: 'negative',  category: 'IRPJ e CSLL' },
        { id: 'lucro_liq',      name: 'LUCRO/PREJUÍZO LIQUIDO',             key: 'lucroLiq',        type: 'highlight', category: '' },
        { id: 'ebtida_lair',    name: 'LUCRO ANTES DO IRPJ E CSLL',         key: 'lair',            type: 'sub',       category: '' },
        { id: 'ebtida_dep',     name: '(+) Depreciação',                    key: 'depreciacao',     type: 'sub',       category: 'Depreciação e Amortização' },
        { id: 'ebtida_fin',     name: '(+) Resultado Financeiro',           key: 'resultFin',       type: 'sub',       category: '' },
        { id: 'ebtida',         name: 'RESULTADO EBTIDA',                   key: 'ebtida',          type: 'highlight', category: '' },
    ];

    const reportItems = (() => {
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
    })();

    // Dados do DRE para todos os meses (para tabela mês a mês)
    const allMonthsDre = months.map((_, idx) => calcDreForMonth(idx));

    const monthlyReportData = (() => {
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
    })();

    // Factory para criar handler de upload de movimentação (DRE ou Patrimonial)
    const createMovementUploadHandler = (
        movType: 'dre' | 'patrimonial',
        setMovFn: React.Dispatch<React.SetStateAction<MovementRow[]>>
    ) => {
        return async (e: React.ChangeEvent<HTMLInputElement>) => {
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
                    const fileContent = evt.target?.result;
                    let wb;
                    if (isCSV) {
                        // CSV: lido como texto UTF-8 → preserva acentos (Deduções, não DeduÃ§Ãµes)
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

                    // Col 0 = Classificação, Col 1 = Nome, Cols 2-13 = Jan-Dez
                    // Col 14 = Total (ignorado), Col 15 = NÍVEL, Col 16 = DE-PARA
                    const parseBrNumber = (v: unknown): number => {
                        if (typeof v === 'number') return v; // .xlsx: número JS já correto
                        const s = String(v || '0').trim();
                        if (s === '' || s === '-') return 0;
                        // Formato BR: remove pontos de milhar, troca vírgula decimal por ponto
                        const cleaned = s.replace(/\./g, '').replace(',', '.');
                        const result = parseFloat(cleaned);
                        return isNaN(result) ? 0 : result;
                    };

                    const parsedMovements = (data.map(row => {
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

                    if (parsedMovements.length === 0) {
                        toast.error('Nenhuma movimentação encontrada no arquivo');
                        return;
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
                        const result = await movementService.bulkImport(targetClientId, selectedYear, parsedMovements, movType);
                        toast.success(`${result.count} linhas importadas para ${selectedYear} (${label})!`, { id: toastId });
                    }

                    // Atualizar estado local
                    setMovFn(parsedMovements);
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
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        const toastId = 'import-patrimonial-raw';
        const isCSV = file.name.toLowerCase().endsWith('.csv');

        const parseBrNumber = (v: unknown): number => {
            if (typeof v === 'number') return v;
            const s = String(v || '').trim();
            if (!s || s === '-' || s.startsWith('#')) return 0;
            const cleaned = s.replace(/\./g, '').replace(',', '.');
            const result = parseFloat(cleaned);
            return isNaN(result) ? 0 : result;
        };

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
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
                    const result = await movementService.bulkImport(targetClientId, selectedYear, movements, 'patrimonial');
                    toast.success(`${result.count} contas importadas (Patrimonial ${selectedYear})!`, { id: toastId });
                } else {
                    toast.success(`${movements.length} contas patrimoniais carregadas!`);
                }

                setPatrimonialMovements(movements);
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
    const patMonthlyDataByGroup = (() => {
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
    })();

    const handleImportPlanoDeContas = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as (string | number | undefined)[][];

                // Pular header (primeira linha)
                const rows = data.slice(1);

                const importAccounts: ImportAccount[] = rows
                    .filter(row => {
                        const code = row[0]?.toString().trim();
                        return code && /^\d/.test(code);
                    })
                    .map(row => ({
                        code: row[0]!.toString().trim(),
                        reduced_code: row[7]?.toString().trim() || undefined,
                        name: (row[3]?.toString().trim() || row[1]?.toString().trim() || ''),
                        level: parseInt(row[1]?.toString() || '1') || 1,
                        type: row[2]?.toString().trim() === 'T' ? 'T' : 'A',
                        alias: row[4]?.toString().trim() || undefined,
                        report_type: row[5]?.toString().trim() || undefined,
                        report_category: row[6]?.toString().trim() || undefined,
                    }));

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
        if (!clientId) return;
        try {
            setSupportSubmitting(true);
            setSupportError(null);
            await clientPortalService.createSupportTicket({
                subject: supportForm.subject,
                message: supportForm.message,
                priority: supportForm.priority as 'low' | 'medium' | 'high',
            });
            setIsSupportOpen(false);
            setSupportForm({ subject: '', message: '', priority: 'medium' });
            // Recarregar tickets se estiver na aba suporte
            if (activeTab === 'suporte' && isClientView) {
                try {
                    const tickets = await clientPortalService.getSupportTickets();
                    setSupportTickets(tickets);
                } catch { /* silently ignore */ }
            }
        } catch (error) {
            const message = axios.isAxiosError(error)
                ? error.response?.data?.message || 'Erro ao abrir chamado'
                : 'Erro ao abrir chamado';
            setSupportError(message);
        } finally {
            setSupportSubmitting(false);
        }
    };

    // Se nao esta autenticado como staff nem cliente, redireciona
    if (!isAccountingView && !isClientView) {
        navigate('/client-login');
        return null;
    }

    // Se staff acessou /portal sem clientId, redireciona ao dashboard
    if (isAccountingView && !clientId) {
        navigate('/dashboard');
        return null;
    }

    return (
        <>
            <div className="min-h-screen text-slate-200 font-sans selection:bg-cyan-500/30 overflow-x-hidden relative" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #0a1628 100%)' }}>
            {/* Ambient Background Glows */}
            <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-600/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />

            {/* Sidebar Navigation */}
            <div className="fixed left-0 top-0 h-full w-20 bg-[#0d1829]/80 backdrop-blur-xl border-r border-white/5 flex flex-col items-center py-8 z-50 transition-all duration-500">
                <div className="w-12 h-12 bg-linear-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 mb-12">
                    <BarChart3 className="w-7 h-7" />
                </div>

                <div className="flex-1 flex flex-col gap-4">
                    {[
                        { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
                        { id: 'dre', icon: Calculator, label: 'DRE' },
                        ...(isClientView ? [{ id: 'suporte', icon: Ticket, label: 'Suporte' }] : []),
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`group relative p-4 rounded-2xl transition-all duration-300 ${activeTab === item.id ? 'bg-linear-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                        >
                            <item.icon className="w-6 h-6" />
                            <span className="absolute left-full ml-4 px-3 py-1 bg-slate-800 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap z-50 border border-white/10">
                                {item.label}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="space-y-6">
                    {isClientView && (
                        <button
                            onClick={() => setIsSupportOpen(true)}
                            className="p-4 rounded-2xl text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 transition-all relative group"
                        >
                            <MessageSquare className="w-6 h-6" />
                            <span className="absolute left-full ml-4 px-3 py-1 bg-slate-800 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap z-50 border border-white/10">
                                Novo Chamado
                            </span>
                        </button>
                    )}
                    {!isAccountingView && (
                        <button className="p-4 rounded-2xl text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all">
                            <LifeBuoy className="w-6 h-6" />
                        </button>
                    )}
                    <div className="w-12 h-12 rounded-full bg-linear-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white font-bold shadow-lg">
                        {client?.name?.charAt(0) || 'U'}
                    </div>
                    {isClientView && (
                        <button
                            onClick={() => { clientLogout(); navigate('/client-login'); }}
                            className="p-4 rounded-2xl text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-all relative group"
                        >
                            <LogOut className="w-6 h-6" />
                            <span className="absolute left-full ml-4 px-3 py-1 bg-slate-800 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all whitespace-nowrap z-50 border border-white/10">
                                Sair
                            </span>
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="ml-20 min-h-screen relative z-10">
                {/* Modern Header - Fixed at Top */}
                <header className="fixed top-0 left-20 right-0 z-50 bg-[#0a1628]/80 backdrop-blur-2xl border-b border-white/5 px-4 md:px-12 h-20 flex items-center justify-between">
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
                                    <>TresContas <span className="text-cyan-400">{activeTab === 'suporte' ? 'Suporte' : activeTab}</span></>
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
                                {[2024, 2025, 2026].map(y => (
                                    <option key={y} value={y} className="bg-[#0d1829]">{y}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 md:gap-4">
                            <button className="p-3 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all relative">
                                <Bell className="w-5 h-5" />
                                <div className="absolute top-3 right-3 w-2 h-2 bg-cyan-500 rounded-full border-2 border-[#0a1628]" />
                            </button>
                            <button onClick={() => handleExportPDF(dreSubTab?.toUpperCase() || 'Relatorio')} className="flex items-center gap-2 bg-linear-to-r from-cyan-500 to-blue-600 text-white px-5 py-3 rounded-xl text-sm font-bold shadow-lg shadow-cyan-500/20 hover:opacity-90 transition-all group">
                                <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                                <span className="hidden md:inline">Exportar PDF</span>
                            </button>
                        </div>
                    </div>
                </header>

                <div className="px-4 pt-24 pb-4 relative z-10 transition-all duration-500">
                    <div className="max-w-full mx-auto">
                        {activeTab === 'dashboard' && (
                            <div className="space-y-6 animate-in fade-in duration-500 pb-12">
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
                                        const d = calcDreForMonth(selectedMonthIndex);
                                        const PIE_COLORS = ['#f59e0b', '#ef4444', '#a855f7', '#10b981'];
                                        const pieData = [
                                            { name: 'Custo de Venda', value: Math.abs(d.custos) },
                                            { name: 'Impostos', value: Math.abs(d.deducoes + d.irpjCsll) },
                                            { name: 'Desp. Operac.', value: Math.abs(d.despAdm + d.despCom + d.despTrib + d.despFin) },
                                            { name: 'Lucro', value: Math.max(d.lucroLiq, 0) },
                                        ].filter(p => p.value > 0);
                                        return (
                                            <div className="flex-1 min-h-[220px]">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <RechartsPie>
                                                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                                                            {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />)}
                                                        </Pie>
                                                        <Tooltip content={<TooltipCurrency />} />
                                                        <Legend verticalAlign="bottom" formatter={(value: string) => <span className="text-white/60 text-xs">{value}</span>} />
                                                    </RechartsPie>
                                                </ResponsiveContainer>
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
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={months.map((m, i) => {
                                                const d = allMonthsDre[i];
                                                return { name: m.substring(0, 3), receita: d?.recBruta || 0, despesa: (d?.custos || 0) + (d?.despAdm || 0) + (d?.despCom || 0) + (d?.despTrib || 0) + (d?.despFin || 0) };
                                            })}>
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
                                                <p className="text-white/40 text-[10px]">{documentAlerts.filter(a => a.status === 'Pendente').length} documentos pendentes</p>
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
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={allMonthsDre.map((d, i) => ({
                                        name: months[i].substring(0, 3),
                                        margemBruta:  d.recLiquida !== 0 ? parseFloat(((d.lucroBruto / d.recLiquida) * 100).toFixed(2)) : 0,
                                        margemLiq:    d.recBruta   !== 0 ? parseFloat(((d.lucroLiq  / d.recBruta)   * 100).toFixed(2)) : 0,
                                        margemEbtida: d.recLiquida !== 0 ? parseFloat(((d.ebtida    / d.recLiquida) * 100).toFixed(2)) : 0,
                                    }))}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 'bold' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
                                        <Tooltip content={<TooltipPercent />} />
                                        <Line type="monotone" dataKey="margemBruta"  stroke="#22c55e" strokeWidth={2} dot={false} name="Margem Bruta" />
                                        <Line type="monotone" dataKey="margemLiq"    stroke="#06b6d4" strokeWidth={2} dot={false} name="Margem Líquida" />
                                        <Line type="monotone" dataKey="margemEbtida" stroke="#a855f7" strokeWidth={2} dot={false} name="Margem EBITDA" />
                                    </LineChart>
                                </ResponsiveContainer>
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
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={allMonthsDre.map((d, i) => ({
                                        name: months[i].substring(0, 3),
                                        deducoes:  Math.abs(d.deducoes),
                                        custos:    Math.abs(d.custos) + Math.abs(d.custosServicos),
                                        despOper:  Math.abs(d.despAdm) + Math.abs(d.despCom) + Math.abs(d.despTrib),
                                        irpj:      Math.abs(d.irpjCsll),
                                        lucro:     Math.max(d.lucroLiq, 0),
                                    }))} barSize={22}>
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
                                            const token = clientToken || accountingToken;
                                            const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/+$/, '');
                                            const apiUrl = baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
                                            const response = await fetch(`${apiUrl}/client-portal/ai-analysis`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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

                    </div>
                )}

                {activeTab === 'dre' && (
                    <div className="space-y-2 animate-in fade-in duration-500 pb-2">
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
                                <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
                                    <div>
                                        <h3 className="text-2xl font-bold text-white tracking-tight">Relatório Gerencial DRE</h3>
                                        <p className="text-sm text-white/40">Resultado Consolidado • {months[selectedMonthIndex]}</p>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="flex p-1 bg-black/40 border border-white/5 rounded-2xl">
                                            {[
                                                { id: 'lista', icon: FileSpreadsheet, label: 'Lista' },
                                                { id: 'graficos', icon: BarChart3, label: 'Gráficos' },
                                                { id: 'fechado', icon: LayoutList, label: 'Fechado' },
                                            ].map(mode => (
                                                <button
                                                    key={mode.id}
                                                    onClick={() => setDreViewMode(mode.id as ReportViewMode)}
                                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${dreViewMode === mode.id ? 'bg-slate-800 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                                                >
                                                    <mode.icon className="w-4 h-4" />
                                                    {mode.label}
                                                </button>
                                            ))}
                                        </div>
                                        {!isReadOnly && (
                                            <label className="flex items-center gap-2 bg-linear-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white px-6 py-3 rounded-2xl cursor-pointer transition-all font-bold shadow-lg shadow-cyan-500/20">
                                                <Upload className="w-5 h-5" />
                                                Importar Balancete
                                                <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handleDreFileUpload} />
                                            </label>
                                        )}
                                        <button onClick={() => handleExportPDF('DRE')} className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all text-white/40 hover:text-white" title="Exportar PDF">
                                            <Download className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                {dreViewMode === 'lista' ? (
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
                                                                onClick={() => hasChildren && setExpandedDreRow(isExpanded ? null : item.id)}
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
                                                                    return (
                                                                        <td key={mi} className={`p-4 px-3 text-xs text-right font-mono font-bold ${
                                                                            mi === selectedMonthIndex ? 'bg-cyan-500/5' : ''
                                                                        } ${item.type === 'negative' ? 'text-rose-400' :
                                                                            item.type === 'positive' ? 'text-emerald-400' : 'text-white/80'
                                                                        }`}>
                                                                            {formatLocaleNumber(monthVal)}
                                                                        </td>
                                                                    );
                                                                })}
                                                                <td className={`p-4 px-3 text-xs text-right font-mono font-bold bg-white/5 sticky right-[100px] z-10 shadow-[-4px_0_10px_rgba(0,0,0,0.3)] ${
                                                                    item.type === 'highlight' ? 'text-cyan-400' : 'text-white'
                                                                }`}>
                                                                    {formatLocaleNumber(acumulado)}
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
                                                            {/* Drill-down: contas da movimentação mapeadas para essa linha do DRE */}
                                                            {isExpanded && childAccounts.map((child, ci) => {
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
                                                                </tr>);
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
                                            { title: 'Custos Das Vendas',                data: monthlyReportData.custos,          color: '#f59e0b' },
                                            { title: 'Custos Dos Serviços',              data: monthlyReportData.custosServicos,  color: '#f97316' },
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
                                            { title: 'EBTIDA',                           data: monthlyReportData.ebtida,          color: '#8b5cf6' },
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
                                                    
                                                    <div className="h-32 -mx-2">
                                                        <ResponsiveContainer width="100%" height="100%">
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
                                                    </div>
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
                                    <div className="flex gap-4">
                                        <div className="flex p-1 bg-black/40 border border-white/5 rounded-2xl">
                                            {[
                                                { id: 'lista', icon: FileSpreadsheet, label: 'Lista' },
                                                { id: 'graficos', icon: BarChart3, label: 'Gráficos' },
                                                { id: 'fechado', icon: LayoutList, label: 'Fechado' },
                                            ].map(mode => (
                                                <button
                                                    key={mode.id}
                                                    onClick={() => setPatViewMode(mode.id as ReportViewMode)}
                                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${patViewMode === mode.id ? 'bg-slate-800 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                                                >
                                                    <mode.icon className="w-4 h-4" />
                                                    {mode.label}
                                                </button>
                                            ))}
                                        </div>
                                        {!isReadOnly && (
                                            <label className="flex items-center gap-2 bg-linear-to-r from-cyan-500 to-blue-600 hover:opacity-90 text-white px-6 py-3 rounded-2xl cursor-pointer transition-all font-bold shadow-lg shadow-cyan-500/20">
                                                <Upload className="w-5 h-5" />
                                                Importar Saldo
                                                <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={handlePatrimonialRawFileUpload} />
                                            </label>
                                        )}
                                        <button onClick={() => handleExportPDF('Balanco_Patrimonial')} className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all text-white/40 hover:text-white" title="Exportar PDF">
                                            <Download className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

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
                                                        <div className="h-32 -mx-2">
                                                            <ResponsiveContainer width="100%" height="100%">
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
                                                        </div>
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
                            </div>
                        ) : dreSubTab === 'dfc' ? (
                            <ClientDfcSection
                                clientId={clientId || client?.id}
                                isAccountingView={isAccountingView}
                                selectedYear={selectedYear}
                                selectedMonthIndex={selectedMonthIndex}
                                months={months}
                                reportRef={reportRef}
                                onExport={() => handleExportPDF('DFC')}
                            />
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
                {activeTab === 'suporte' && isClientView && (
                    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-bold text-white tracking-tight">Meus Chamados</h3>
                                <p className="text-white/40 text-sm">Acompanhe seus tickets de suporte</p>
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
                                    <div key={ticket.id} className="bg-[#0d1829]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-6 hover:bg-white/5 transition-all">
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
                                                {new Date(ticket.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
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
