/**
 * Constantes de categorias DE-PARA para o SaaS de Contabilidade
 * Baseado na análise das 30 categorias identificadas no Plano de Contas
 */

export const VALID_CATEGORIES = [
    'Adiantamentos',
    'Clientes',
    'Contas A Pagar Cp',
    'Custos Das Vendas',
    'Deduções',
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

/**
 * Mapeamento de aliases para categorias canônicas
 * Ajuda a normalizar variações de nomes de categorias
 */
export const CATEGORY_ALIASES: Record<string, string> = {
    // Receitas
    'receita bruta': 'Receita Bruta',
    'receitas bruta': 'Receita Bruta',
    'receita de vendas': 'Receita Bruta',
    'receitas de vendas': 'Receita Bruta',

    // Deduções
    'deduções': 'Deduções',
    'deducoes': 'Deduções',
    'deduções de vendas': 'Deduções',
    'deducoes de vendas': 'Deduções',
    'devoluções': 'Deduções',
    'devoluçoes': 'Deduções',

    // Custos
    'custos das vendas': 'Custos Das Vendas',
    'custos da vendas': 'Custos Das Vendas',
    'custo das vendas': 'Custos Das Vendas',
    'custo da vendas': 'Custos Das Vendas',
    'custo de mercadoria vendida': 'Custos Das Vendas',
    'cmv': 'Custos Das Vendas',

    // Despesas Administrativas
    'despesas administrativas': 'Despesas Administrativas',
    'despesa administrativa': 'Despesas Administrativas',
    'despesas admin': 'Despesas Administrativas',

    // Despesas Comerciais
    'despesas comerciais': 'Despesas Comerciais',
    'despesa comercial': 'Despesas Comerciais',
    'despesas de vendas': 'Despesas Comerciais',

    // Despesas Financeiras
    'despesas financeiras': 'Despesas Financeiras',
    'despesa financeira': 'Despesas Financeiras',
    'juros': 'Despesas Financeiras',

    // Receitas Financeiras
    'receitas financeiras': 'Receitas Financeiras',
    'receita financeira': 'Receitas Financeiras',
    'rendimentos': 'Receitas Financeiras',

    // Despesas Tributárias
    'despesas tributarias': 'Despesas Tributarias',
    'despesas tributárias': 'Despesas Tributarias',
    'despesa tributaria': 'Despesas Tributarias',
    'despesa tributária': 'Despesas Tributarias',

    // IRPJ e CSLL
    'irpj e csll': 'Irpj E Csll',
    'irpj e csll ': 'Irpj E Csll',
    'imposto de renda': 'Irpj E Csll',
    'contribuição social': 'Irpj E Csll',

    // Disponível
    'disponivel': 'Disponivel',
    'disponibilidades': 'Disponivel',
    'caixa': 'Disponivel',
    'bancos': 'Disponivel',

    // Clientes
    'clientes': 'Clientes',
    'contas a receber': 'Clientes',
    'duplicatas a receber': 'Clientes',

    // Estoques
    'estoques': 'Estoques',
    'estoque': 'Estoques',
    'mercadorias': 'Estoques',

    // Fornecedores
    'fornecedores': 'Fornecedores',
    'contas a pagar': 'Fornecedores',

    // Imobilizado
    'imobilizado': 'Imobilizado',
    'ativo imobilizado': 'Imobilizado',
    'bens e direitos': 'Imobilizado',

    // Intangível
    'intangivel': 'Intangivel',
    'intangível': 'Intangivel',

    // Outras Receitas
    'outras receitas': 'Outras Receitas',
    'outra receita': 'Outras Receitas',

    // Adiantamentos
    'adiantamentos': 'Adiantamentos',
    'adiantamento': 'Adiantamentos',

    // Despesas Antecipadas
    'despesas antecipadas': 'Despesas Antecipadas',
    'despesa antecipada': 'Despesas Antecipadas',

    // Contas a Pagar CP
    'contas a pagar cp': 'Contas A Pagar Cp',
    'contas a pagar curto prazo': 'Contas A Pagar Cp',

    // Empréstimos e Financiamentos CP
    'emprestimos e financiamentos cp': 'Emprestimos E Financiamentos Cp',
    'empréstimos e financiamentos cp': 'Emprestimos E Financiamentos Cp',
    'emprestimos cp': 'Emprestimos E Financiamentos Cp',

    // Parcelamentos CP
    'parcelamentos cp': 'Parcelamentos Cp',
    'parcelamento cp': 'Parcelamentos Cp',

    // Obrigações Trabalhistas
    'obrigacoes trabalhistas': 'Obrigacoes Trabalhistas',
    'obrigações trabalhistas': 'Obrigacoes Trabalhistas',
    'salários a pagar': 'Obrigacoes Trabalhistas',
    'encargos trabalhistas': 'Obrigacoes Trabalhistas',

    // Obrigações Tributárias
    'obrigacoes tributarias': 'Obrigacoes Tributarias',
    'obrigações tributárias': 'Obrigacoes Tributarias',
    'impostos a pagar': 'Obrigacoes Tributarias',

    // Tributos a Compensar CP
    'tributos a compensarcp': 'Tributos A CompensarCP',
    'tributos a compensar cp': 'Tributos A CompensarCP',

    // Outras Contas a Pagar LP
    'outras contas a pagar lp': 'Outras Contas A Pagar Lp',
    'outras contas a pagar longo prazo': 'Outras Contas A Pagar Lp',

    // Outras Contas a Receber LP
    'outras contas a receber lp': 'Outras Contas A Receber Lp',
    'outras contas a receber longo prazo': 'Outras Contas A Receber Lp',

    // Parcelamentos LP
    'parcelamentos lp': 'Parcelamentos Lp',
    'parcelamento lp': 'Parcelamentos Lp',

    // Processos Judiciais
    'processos judiciais': 'Processos Judiciais',
    'processo judicial': 'Processos Judiciais',
    'contingências': 'Processos Judiciais',

    // Reserva de Lucros
    'reserva de lucros': 'Reserva De Lucros',
    'reservas': 'Reserva De Lucros',

    // Resultado do Exercício
    'resultado do exercicio': 'Resultado Do Exercicio',
    'resultado do exercício': 'Resultado Do Exercicio',
    'lucro do exercício': 'Resultado Do Exercicio',
};

/**
 * Normaliza um nome de categoria para a forma canônica
 */
export const normalizeCategory = (categoryName: string): string | null => {
    const normalized = categoryName.trim().toLowerCase();
    return CATEGORY_ALIASES[normalized] || null;
};

/**
 * Verifica se uma categoria é válida
 */
export const isValidCategory = (categoryName: string): boolean => {
    return VALID_CATEGORIES.includes(categoryName);
};

/**
 * Retorna a categoria canônica ou a original se não encontrar alias
 */
export const getCanonicalCategory = (categoryName: string): string => {
    const normalized = normalizeCategory(categoryName);
    return normalized || categoryName;
};
