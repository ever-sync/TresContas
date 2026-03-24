/**
 * Canonical DE-PARA categories for the app.
 * Canonical values are ASCII-normalized to match backend validation.
 */

export const VALID_CATEGORIES = [
    'Adiantamentos',
    'Clientes',
    'Contas A Pagar Cp',
    'Custos Das Vendas',
    'Deducoes',
    'Depreciacao E Amortizacao',
    'Despesas Administrativas',
    'Despesas Antecipadas',
    'Despesas Comerciais',
    'Despesas Financeiras',
    'Despesas Tributarias',
    'Disponivel',
    'Emprestimos E Financiamentos Cp',
    'Estoques',
    'Fornecedores',
    'Imobilizado',
    'Intangivel',
    'Irpj E Csll',
    'Obrigacoes Trabalhistas',
    'Obrigacoes Tributarias',
    'Outras Contas A Pagar Lp',
    'Outras Contas A Receber Lp',
    'Outras Despesas',
    'Outras Receitas',
    'Parcelamentos Cp',
    'Parcelamentos Lp',
    'Processos Judiciais',
    'Receita Bruta',
    'Receitas Financeiras',
    'Reserva De Lucros',
    'Resultado Do Exercicio',
    'Tributos A CompensarCP',
];

export const CATEGORY_DISPLAY_LABELS: Record<string, string> = {
    Deducoes: 'Deduções',
    'Depreciacao E Amortizacao': 'Depreciação e Amortização',
    'Contas A Pagar Cp': 'Contas a Pagar CP',
    'Despesas Tributarias': 'Despesas Tributárias',
    Intangivel: 'Intangível',
    'Irpj E Csll': 'IRPJ e CSLL',
    Disponivel: 'Disponível',
    'Obrigacoes Trabalhistas': 'Obrigações Trabalhistas',
    'Obrigacoes Tributarias': 'Obrigações Tributárias',
    'Emprestimos E Financiamentos Cp': 'Empréstimos e Financiamentos CP',
    'Emprestimos E Financiamentos Lp': 'Empréstimos e Financiamentos LP',
    'Parcelamentos Cp': 'Parcelamentos CP',
    'Parcelamentos Lp': 'Parcelamentos LP',
    'Tributos A CompensarCP': 'Tributos a Compensar CP',
};

/**
 * Remove diacritics and normalize whitespace.
 */
export const removeDiacritics = (text: string): string => {
    if (!text) return '';

    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
};

/**
 * Aliases for canonical categories.
 * Keys must be lower-case and without diacritics.
 */
export const CATEGORY_ALIASES: Record<string, string> = {
    // Revenue
    'receita bruta': 'Receita Bruta',
    'receitas bruta': 'Receita Bruta',
    'receita de vendas': 'Receita Bruta',
    'receitas de vendas': 'Receita Bruta',

    // Deducoes
    deducoes: 'Deducoes',
    deducao: 'Deducoes',
    'deducoes de vendas': 'Deducoes',
    'deducao de vendas': 'Deducoes',
    devolucoes: 'Deducoes',
    devolucao: 'Deducoes',

    // Costs
    'custos das vendas': 'Custos Das Vendas',
    'custos da vendas': 'Custos Das Vendas',
    'custo das vendas': 'Custos Das Vendas',
    'custo da vendas': 'Custos Das Vendas',
    'custo de mercadoria vendida': 'Custos Das Vendas',
    cmv: 'Custos Das Vendas',

    // Administrative expenses
    'despesas administrativas': 'Despesas Administrativas',
    'despesa administrativa': 'Despesas Administrativas',
    'despesas admin': 'Despesas Administrativas',

    // Commercial expenses
    'despesas comerciais': 'Despesas Comerciais',
    'despesa comercial': 'Despesas Comerciais',
    'despesas de vendas': 'Despesas Comerciais',

    // Financial expenses
    'despesas financeiras': 'Despesas Financeiras',
    'despesa financeira': 'Despesas Financeiras',
    juros: 'Despesas Financeiras',

    // Financial revenue
    'receitas financeiras': 'Receitas Financeiras',
    'receita financeira': 'Receitas Financeiras',
    rendimentos: 'Receitas Financeiras',

    // Tax expenses
    'despesas tributarias': 'Despesas Tributarias',
    'despesa tributaria': 'Despesas Tributarias',

    // Other expenses
    'outras despesas': 'Outras Despesas',
    'outra despesa': 'Outras Despesas',
    'despesas diversas': 'Outras Despesas',
    'despesa diversa': 'Outras Despesas',

    // IRPJ and CSLL
    'irpj e csll': 'Irpj E Csll',
    'imposto de renda': 'Irpj E Csll',
    'contribuicao social': 'Irpj E Csll',

    // Available
    disponivel: 'Disponivel',
    disponibilidades: 'Disponivel',
    caixa: 'Disponivel',
    bancos: 'Disponivel',

    // Clients
    clientes: 'Clientes',
    'contas a receber': 'Clientes',
    'duplicatas a receber': 'Clientes',

    // Inventory
    estoques: 'Estoques',
    estoque: 'Estoques',
    mercadorias: 'Estoques',

    // Suppliers
    fornecedores: 'Fornecedores',
    'contas a pagar': 'Fornecedores',

    // Fixed assets
    imobilizado: 'Imobilizado',
    'ativo imobilizado': 'Imobilizado',
    'bens e direitos': 'Imobilizado',

    // Intangibles
    intangivel: 'Intangivel',

    // Other revenue
    'outras receitas': 'Outras Receitas',
    'outra receita': 'Outras Receitas',

    // Advances
    adiantamentos: 'Adiantamentos',
    adiantamento: 'Adiantamentos',

    // Prepaid expenses
    'despesas antecipadas': 'Despesas Antecipadas',
    'despesa antecipada': 'Despesas Antecipadas',

    // Short-term payables
    'contas a pagar cp': 'Contas A Pagar Cp',
    'contas a pagar curto prazo': 'Contas A Pagar Cp',

    // Short-term loans
    'emprestimos e financiamentos cp': 'Emprestimos E Financiamentos Cp',
    'emprestimo e financiamento cp': 'Emprestimos E Financiamentos Cp',
    'emprestimos cp': 'Emprestimos E Financiamentos Cp',

    // Installments
    'parcelamentos cp': 'Parcelamentos Cp',
    'parcelamento cp': 'Parcelamentos Cp',

    // Labor liabilities
    'obrigacoes trabalhistas': 'Obrigacoes Trabalhistas',
    'salarios a pagar': 'Obrigacoes Trabalhistas',
    'encargos trabalhistas': 'Obrigacoes Trabalhistas',

    // Tax liabilities
    'obrigacoes tributarias': 'Obrigacoes Tributarias',
    'impostos a pagar': 'Obrigacoes Tributarias',

    // Taxes recoverable
    'tributos a compensarcp': 'Tributos A CompensarCP',
    'tributos a compensar cp': 'Tributos A CompensarCP',

    // Long-term payables
    'outras contas a pagar lp': 'Outras Contas A Pagar Lp',
    'outras contas a pagar longo prazo': 'Outras Contas A Pagar Lp',

    // Long-term receivables
    'outras contas a receber lp': 'Outras Contas A Receber Lp',
    'outras contas a receber longo prazo': 'Outras Contas A Receber Lp',

    // Long-term installments
    'parcelamentos lp': 'Parcelamentos Lp',
    'parcelamento lp': 'Parcelamentos Lp',

    // Legal processes
    'processos judiciais': 'Processos Judiciais',
    'processo judicial': 'Processos Judiciais',
    contingencias: 'Processos Judiciais',

    // Equity
    'reserva de lucros': 'Reserva De Lucros',
    reservas: 'Reserva De Lucros',
    'resultado do exercicio': 'Resultado Do Exercicio',
    'lucro do exercicio': 'Resultado Do Exercicio',

    // Depreciation and amortization
    'depreciacao e amortizacao': 'Depreciacao E Amortizacao',
    depreciacoes: 'Depreciacao E Amortizacao',
    amortizacoes: 'Depreciacao E Amortizacao',
    depreciacao: 'Depreciacao E Amortizacao',
    amortizacao: 'Depreciacao E Amortizacao',
};

export const normalizeCategory = (categoryName: string): string | null => {
    if (!categoryName) return null;

    const withoutDiacritics = removeDiacritics(categoryName);

    if (CATEGORY_ALIASES[withoutDiacritics]) {
        return CATEGORY_ALIASES[withoutDiacritics];
    }

    const originalLower = categoryName.trim().toLowerCase();
    if (CATEGORY_ALIASES[originalLower]) {
        return CATEGORY_ALIASES[originalLower];
    }

    return null;
};

export const isValidCategory = (categoryName: string): boolean => {
    const canonical = normalizeCategory(categoryName) || categoryName;
    return VALID_CATEGORIES.includes(canonical);
};

export const getCanonicalCategory = (categoryName: string): string => {
    const normalized = normalizeCategory(categoryName);
    return normalized || categoryName;
};

export const getCategoryDisplayLabel = (categoryName: string): string => {
    const canonical = normalizeCategory(categoryName) || categoryName;
    return CATEGORY_DISPLAY_LABELS[canonical] || canonical;
};

export const debugNormalization = (categoryName: string) => ({
    original: categoryName,
    withoutDiacritics: removeDiacritics(categoryName),
    normalized: normalizeCategory(categoryName),
    isValid: isValidCategory(normalizeCategory(categoryName) || categoryName),
});
