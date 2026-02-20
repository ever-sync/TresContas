/**
 * Constantes de categorias DE-PARA para o SaaS de Contabilidade
 * Baseado na análise das 30 categorias identificadas no Plano de Contas
 * Com suporte robusto a encoding incorreto e diacríticos
 */

export const VALID_CATEGORIES = [
    'Adiantamentos',
    'Clientes',
    'Contas A Pagar Cp',
    'Custos Das Vendas',
    'Deduções',
    'Depreciação e Amortização',
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

/**
 * Remove diacríticos e normaliza encoding de caracteres especiais
 * Converte "DeduÃ§Ãµes" para "deducoes"
 * Converte "Deduções" para "deducoes"
 */
export const removeDiacritics = (text: string): string => {
    if (!text) return '';
    
    // Normalizar para NFD (decomposição) e remover diacríticos
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos
        .toLowerCase()
        .trim();
};

/**
 * Mapeamento de aliases para categorias canônicas
 * Ajuda a normalizar variações de nomes de categorias
 * Todas as chaves devem estar em minúsculas e sem diacríticos
 */
export const CATEGORY_ALIASES: Record<string, string> = {
    // Receitas
    'receita bruta': 'Receita Bruta',
    'receitas bruta': 'Receita Bruta',
    'receita de vendas': 'Receita Bruta',
    'receitas de vendas': 'Receita Bruta',

    // Deduções (com suporte a encoding incorreto e diacríticos)
    'deducoes': 'Deduções',
    'deducao': 'Deduções',
    'deducoes de vendas': 'Deduções',
    'deducao de vendas': 'Deduções',
    'devolucoes': 'Deduções',
    'devolucao': 'Deduções',
    'devoluçoes': 'Deduções',
    'devolução': 'Deduções',

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
    'despesa tributaria': 'Despesas Tributarias',

    // Outras Despesas
    'outras despesas': 'Outras Despesas',
    'outra despesa': 'Outras Despesas',
    'despesas diversas': 'Outras Despesas',
    'despesa diversa': 'Outras Despesas',

    // IRPJ e CSLL
    'irpj e csll': 'Irpj E Csll',
    'imposto de renda': 'Irpj E Csll',
    'contribuicao social': 'Irpj E Csll',

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
    'emprestimo e financiamento cp': 'Emprestimos E Financiamentos Cp',
    'emprestimos cp': 'Emprestimos E Financiamentos Cp',

    // Parcelamentos CP
    'parcelamentos cp': 'Parcelamentos Cp',
    'parcelamento cp': 'Parcelamentos Cp',

    // Obrigações Trabalhistas
    'obrigacoes trabalhistas': 'Obrigacoes Trabalhistas',
    'salarios a pagar': 'Obrigacoes Trabalhistas',
    'encargos trabalhistas': 'Obrigacoes Trabalhistas',

    // Obrigações Tributárias
    'obrigacoes tributarias': 'Obrigacoes Tributarias',
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
    'contingencias': 'Processos Judiciais',

    // Reserva de Lucros
    'reserva de lucros': 'Reserva De Lucros',
    'reservas': 'Reserva De Lucros',

    // Resultado do Exercício
    'resultado do exercicio': 'Resultado Do Exercicio',
    'lucro do exercicio': 'Resultado Do Exercicio',

    // Depreciação e Amortização
    'depreciacao e amortizacao': 'Depreciação e Amortização',
    'depreciacoes': 'Depreciação e Amortização',
    'amortizacoes': 'Depreciação e Amortização',
    'depreciacao': 'Depreciação e Amortização',
    'amortizacao': 'Depreciação e Amortização',
};

/**
 * Normaliza um nome de categoria para a forma canônica
 * Suporta encoding incorreto e diacríticos
 * Exemplo: "DeduÃ§Ãµes" → "Deduções"
 */
export const normalizeCategory = (categoryName: string): string | null => {
    if (!categoryName) return null;
    
    // Primeiro, tentar normalizar com diacríticos removidos
    const withoutDiacritics = removeDiacritics(categoryName);
    
    // Buscar no mapeamento de aliases
    if (CATEGORY_ALIASES[withoutDiacritics]) {
        return CATEGORY_ALIASES[withoutDiacritics];
    }
    
    // Tentar com a versão original (em caso de encoding UTF-8 correto)
    const originalLower = categoryName.trim().toLowerCase();
    if (CATEGORY_ALIASES[originalLower]) {
        return CATEGORY_ALIASES[originalLower];
    }
    
    // Se não encontrou, retornar null
    return null;
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

/**
 * Função de debug para testar normalização
 * Retorna informações sobre como uma string foi normalizada
 */
export const debugNormalization = (categoryName: string) => {
    return {
        original: categoryName,
        withoutDiacritics: removeDiacritics(categoryName),
        normalized: normalizeCategory(categoryName),
        isValid: isValidCategory(normalizeCategory(categoryName) || categoryName),
    };
};
