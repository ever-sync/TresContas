export const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const;

export const PAT_STRUCTURE = [
    {
        id: 'ativo_circ',
        groupLabel: 'ATIVO CIRCULANTE',
        displayLabel: 'Ativo Circulante',
        type: 'section' as const,
        children: ['Disponível', 'Clientes', 'Adiantamentos', 'Estoques', 'Tributos A CompensarCP', 'Outras Contas a Receber', 'Despesas Antecipadas'],
    },
    {
        id: 'ativo_nao',
        groupLabel: 'ATIVO NÃO CIRCULANTE',
        displayLabel: 'Ativo Não Circulante',
        type: 'section' as const,
        children: ['Contas A Receber Lp', 'Processos Judiciais', 'Partes Relacionadas A Receber', 'Outras Contas A Receber Lp', 'Tributos a RecuperarLP', 'Investimentos', 'Imobilizado', 'Intangível'],
    },
    {
        id: 'total_ativo',
        groupLabel: '',
        displayLabel: 'TOTAL DO ATIVO',
        type: 'total' as const,
        children: [] as string[],
    },
    {
        id: 'pass_circ',
        groupLabel: 'PASSIVO CIRCULANTE',
        displayLabel: 'Passivo Circulante',
        type: 'section' as const,
        children: ['Fornecedores', 'Emprestimos E Financiamentos Cp', 'Obrigacoes Trabalhistas', 'Obrigacoes Tributarias', 'Contas A Pagar Cp', 'Parcelamentos Cp', 'Processos A Pagar Cp'],
    },
    {
        id: 'pass_nao',
        groupLabel: 'PASSIVO NÃO CIRCULANTE',
        displayLabel: 'Passivo Não Circulante',
        type: 'section' as const,
        children: ['Emprestimos E Financiamentos Lp', 'Conta Corrente Dos Socios', 'Emprestimos Partes Relacionadas', 'Parcelamentos Lp', 'Processos A Pagar Lp', 'Impostos Diferidos', 'Outras Contas A Pagar Lp', 'Receita de Exercicio Futuro Lp', 'Provisao Para Contingencias'],
    },
    {
        id: 'pat_liq',
        groupLabel: 'PATRIMÔNIO LÍQUIDO',
        displayLabel: 'Patrimônio Líquido',
        type: 'section' as const,
        children: ['Capital Social', 'Reserva De Capital', 'Reserva De Lucros', 'Resultado Do Exercicio', 'Distribuicao De Lucros'],
    },
    {
        id: 'total_passivo',
        groupLabel: '',
        displayLabel: 'TOTAL DO PASSIVO',
        type: 'total' as const,
        children: [] as string[],
    },
] as const;

export type DreMonthData = {
    recBruta: number;
    deducoes: number;
    recLiquida: number;
    custos: number;
    custosServicos: number;
    lucroBruto: number;
    despAdm: number;
    despCom: number;
    despTrib: number;
    partSocietarias: number;
    outrasReceitas: number;
    recFin: number;
    despFin: number;
    lair: number;
    irpjCsll: number;
    lucroLiq: number;
    depreciacao: number;
    resultFin: number;
    ebtida: number;
};

export type DreLineKey = keyof DreMonthData;

export type DreLineDef = {
    id: string;
    name: string;
    key: DreLineKey;
    type: 'main' | 'negative' | 'positive' | 'highlight' | 'sub';
    category: string;
};

export const DRE_LINE_DEFS: DreLineDef[] = [
    { id: 'rec_bruta', name: 'Receita Bruta', key: 'recBruta', type: 'main', category: 'Receita Bruta' },
    { id: 'deducoes', name: 'Deduções', key: 'deducoes', type: 'negative', category: 'Deduções de Vendas' },
    { id: 'rec_liquida', name: 'RECEITA LIQUIDA', key: 'recLiquida', type: 'main', category: '' },
    { id: 'custos', name: 'Custos Das Vendas', key: 'custos', type: 'negative', category: 'Custos das Vendas' },
    { id: 'custos_serv', name: 'Custos Dos Serviços', key: 'custosServicos', type: 'negative', category: 'Custos Dos Serviços' },
    { id: 'lucro_bruto', name: 'LUCRO OPERACIONAL', key: 'lucroBruto', type: 'main', category: '' },
    { id: 'desp_adm', name: 'Despesas Administrativas', key: 'despAdm', type: 'negative', category: 'Despesas Administrativas' },
    { id: 'desp_com', name: 'Despesas Comerciais', key: 'despCom', type: 'negative', category: 'Despesas Comerciais' },
    { id: 'desp_trib', name: 'Despesas Tributarias', key: 'despTrib', type: 'negative', category: 'Despesas Tributárias' },
    { id: 'part_soc', name: 'Resultado Participações Societárias', key: 'partSocietarias', type: 'positive', category: 'Resultado Participações Societárias' },
    { id: 'outras_receitas', name: 'Outras Receitas', key: 'outrasReceitas', type: 'positive', category: 'Outras Receitas' },
    { id: 'rec_fin', name: 'Receitas Financeiras', key: 'recFin', type: 'positive', category: 'Receitas Financeiras' },
    { id: 'desp_fin', name: 'Despesas Financeiras', key: 'despFin', type: 'negative', category: 'Despesas Financeiras' },
    { id: 'lair', name: 'LUCRO ANTES DO IRPJ E CSLL', key: 'lair', type: 'main', category: '' },
    { id: 'irpj_csll', name: 'Irpj E Csll', key: 'irpjCsll', type: 'negative', category: 'IRPJ e CSLL' },
    { id: 'lucro_liq', name: 'LUCRO/PREJUÍZO LIQUIDO', key: 'lucroLiq', type: 'highlight', category: '' },
    { id: 'ebtida_lair', name: 'LUCRO ANTES DO IRPJ E CSLL', key: 'lair', type: 'sub', category: '' },
    { id: 'ebtida_dep', name: '(+) Depreciação', key: 'depreciacao', type: 'sub', category: 'Depreciação e Amortização' },
    { id: 'ebtida_fin', name: '(+) Resultado Financeiro', key: 'resultFin', type: 'sub', category: '' },
    { id: 'ebtida', name: 'RESULTADO EBTIDA', key: 'ebtida', type: 'highlight', category: '' },
];
