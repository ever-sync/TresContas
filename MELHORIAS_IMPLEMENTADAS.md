# Melhorias Implementadas no TresContas SaaS

## Visão Geral

Este documento detalha todas as melhorias implementadas no projeto TresContas para torná-lo um SaaS de contabilidade robusto, com automação completa do Plano de Contas, Movimentações Mensais e Geração do DRE.

---

## 1. Backend - Persistência do DE-PARA

### 1.1 Alterações no Schema Prisma

#### Novo Modelo: `DREMapping`
```prisma
model DREMapping {
  id            String   @id @default(uuid())
  accounting_id String
  accounting    Accounting @relation(fields: [accounting_id], references: [id])
  client_id     String
  client        Client   @relation(fields: [client_id], references: [id], onDelete: Cascade)
  account_code  String   // Classificador da conta (ex: "03.1.01.01.0001")
  account_name  String   // Nome da conta
  category      String   // Categoria DE-PARA (ex: "Receita Bruta")
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  @@unique([client_id, account_code])
  @@index([accounting_id])
  @@index([client_id])
  @@index([category])
}
```

**Propósito:** Armazenar permanentemente o mapeamento entre contas do Plano de Contas e as 30 categorias de relatório (DE-PARA).

#### Campos Adicionados

**ChartOfAccounts:**
- `is_mapped` (Boolean): Indica se a conta foi mapeada no DE-PARA
- `updated_at` (DateTime): Rastreia atualizações

**MonthlyMovement:**
- `is_mapped` (Boolean): Indica se a movimentação foi mapeada no Plano de Contas
- Índice em `is_mapped` para buscas rápidas de contas não mapeadas

### 1.2 Novos Endpoints

#### GET `/api/clients/:clientId/dre-mappings`
Retorna todos os mapeamentos DE-PARA para um cliente.

**Response:**
```json
[
  {
    "id": "uuid",
    "account_code": "03.1.01.01.0001",
    "account_name": "RECEITA DE VENDAS",
    "category": "Receita Bruta",
    "created_at": "2025-02-19T...",
    "updated_at": "2025-02-19T..."
  }
]
```

#### POST `/api/clients/:clientId/dre-mappings`
Cria ou atualiza um mapeamento DE-PARA.

**Request Body:**
```json
{
  "account_code": "03.1.01.01.0001",
  "account_name": "RECEITA DE VENDAS",
  "category": "Receita Bruta"
}
```

#### DELETE `/api/clients/:clientId/dre-mappings/:account_code`
Remove um mapeamento DE-PARA.

#### GET `/api/clients/:clientId/unmapped-movements?year=2025&type=dre`
Retorna movimentações que não estão mapeadas no Plano de Contas.

**Response:**
```json
[
  {
    "id": "uuid",
    "code": "03.1.01.01.0001",
    "name": "RECEITA DE VENDAS",
    "category": null,
    "level": 15
  }
]
```

#### POST `/api/clients/:clientId/bulk-dre-mappings`
Importa múltiplos mapeamentos DE-PARA em uma única requisição.

**Request Body:**
```json
{
  "mappings": [
    {
      "account_code": "03.1.01.01.0001",
      "account_name": "RECEITA DE VENDAS",
      "category": "Receita Bruta"
    },
    ...
  ]
}
```

### 1.3 Validação de Categorias

O backend valida automaticamente se a categoria pertence às 30 categorias conhecidas:

```
Adiantamentos, Clientes, Contas A Pagar Cp, Custos Das Vendas, Deduções,
Despesas Administrativas, Despesas Antecipadas, Despesas Comerciais, 
Despesas Financeiras, Despesas Tributarias, Disponivel, 
Emprestimos E Financiamentos Cp, Estoques, Fornecedores, Imobilizado, 
Intangivel, Irpj E Csll, Obrigacoes Trabalhistas, Obrigacoes Tributarias,
Outras Contas A Pagar Lp, Outras Contas A Receber Lp, Outras Receitas, 
Parcelamentos Cp, Parcelamentos Lp, Processos Judiciais, Receita Bruta, 
Receitas Financeiras, Reserva De Lucros, Resultado Do Exercicio, 
Tributos A CompensarCP
```

---

## 2. Frontend - Importação Inteligente e Alertas

### 2.1 Novo Serviço: `dreMappingService`

**Localização:** `frontend/src/services/dreMappingService.ts`

**Métodos:**
- `getValidCategories()`: Retorna lista das 30 categorias válidas
- `getAll(clientId)`: Busca todos os mapeamentos
- `createOrUpdate(clientId, accountCode, accountName, category)`: Cria/atualiza mapeamento
- `delete(clientId, accountCode)`: Remove mapeamento
- `getUnmappedMovements(clientId, year, type)`: Busca contas não mapeadas
- `bulkImport(clientId, mappings)`: Importa múltiplos mapeamentos

### 2.2 Novo Componente: `UnmappedAccountsModal`

**Localização:** `frontend/src/components/UnmappedAccountsModal.tsx`

**Funcionalidades:**
- Exibe lista de contas não mapeadas após importação
- Permite selecionar categoria para cada conta
- Valida se todas as contas foram mapeadas antes de salvar
- Importa mapeamentos em lote via API
- Feedback visual com ícones de status

**Props:**
```typescript
interface UnmappedAccountsModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientId: string;
    year: number;
    type: 'dre' | 'patrimonial';
    onMappingComplete?: () => void;
}
```

### 2.3 Constantes de Categorias: `categoryConstants.ts`

**Localização:** `frontend/src/lib/categoryConstants.ts`

**Funcionalidades:**
- Array `VALID_CATEGORIES`: Lista das 30 categorias válidas
- Objeto `CATEGORY_ALIASES`: Mapeamento de aliases para categorias canônicas
- Função `normalizeCategory()`: Normaliza nomes de categorias
- Função `isValidCategory()`: Valida se categoria é válida
- Função `getCanonicalCategory()`: Retorna forma canônica da categoria

**Exemplo de Aliases:**
```typescript
'custos das vendas': 'Custos Das Vendas',
'custo de mercadoria vendida': 'Custos Das Vendas',
'cmv': 'Custos Das Vendas',
```

---

## 3. Fluxo de Importação Melhorado

### 3.1 Passo a Passo

1. **Usuário faz upload da planilha de movimentação**
   - Sistema lê o arquivo Excel/CSV
   - Extrai: CLASSIFICADOR (col 0), NOME (col 1), VALORES (cols 2-13), NÍVEL (col 15), DE-PARA (col 16)

2. **Sistema processa o arquivo**
   - Valida formato (12 valores mensais)
   - Marca contas como `is_mapped = true` se tiverem DE-PARA válido
   - Salva no banco de dados

3. **Sistema detecta contas não mapeadas**
   - Busca movimentações com `is_mapped = false`
   - Filtra apenas contas analíticas (nível 15)
   - Exibe modal com lista de contas para mapear

4. **Usuário mapeia contas**
   - Seleciona categoria para cada conta
   - Clica "Salvar Mapeamentos"
   - Sistema importa mapeamentos via `bulkCreateDREMappings`

5. **Sistema atualiza dados**
   - Salva mapeamentos em `DREMapping`
   - Atualiza `ChartOfAccounts` com `report_category`
   - Marca contas como `is_mapped = true`

6. **DRE é gerado automaticamente**
   - Frontend busca movimentações mapeadas
   - Agrupa por categoria (DE-PARA)
   - Calcula linhas do DRE

---

## 4. Integração no ClientDashboard

### 4.1 Importação de Movimentações

O fluxo de importação no `ClientDashboard.tsx` deve ser atualizado para:

```typescript
// Após importar movimentações com sucesso
const unmappedMovements = await dreMappingService.getUnmappedMovements(
    clientId,
    selectedYear,
    'dre'
);

if (unmappedMovements.length > 0) {
    setShowUnmappedModal(true);
}
```

### 4.2 Integração do Modal

```typescript
<UnmappedAccountsModal
    isOpen={showUnmappedModal}
    onClose={() => setShowUnmappedModal(false)}
    clientId={clientId}
    year={selectedYear}
    type="dre"
    onMappingComplete={() => {
        // Recarregar movimentações e DRE
        loadDreMovements();
    }}
/>
```

---

## 5. Cálculo Otimizado do DRE

### 5.1 Função `getSumByReportCategory`

A função existente no `ClientDashboard.tsx` já suporta:

1. **Busca por DE-PARA direto** (coluna `category` das movimentações)
2. **Fallback para Plano de Contas** (coluna `report_category`)
3. **Normalização com aliases** (via `CATEGORY_ALIASES`)

### 5.2 Melhorias Propostas

**Adicionar suporte a aliases:**

```typescript
const CATEGORY_ALIASES = {
    'deduções de vendas': ['deduções', 'deducoes', 'deduções de vendas'],
    'custos das vendas': ['custos das vendas', 'custos das vendas '],
    // ... mais aliases
};

const getSumByReportCategory = (categoryName: string, monthIdx: number, movementsData: MovementRow[]): number => {
    const normalize = (s: string) => s.trim().toLowerCase();
    const cat = normalize(categoryName);
    const aliases = CATEGORY_ALIASES[cat] ?? [cat];

    // Buscar por aliases
    const matched = movementsData.filter(m =>
        m.category && aliases.includes(normalize(m.category))
    );
    
    if (matched.length > 0) {
        const maxLevel = Math.max(...matched.map(m => m.level));
        return matched
            .filter(m => m.level === maxLevel)
            .reduce((sum, m) => sum + (m.values[monthIdx] || 0), 0);
    }

    return 0;
};
```

---

## 6. Estrutura de Arquivos Criados

```
backend/
├── src/
│   ├── controllers/
│   │   └── dreMapping.controller.ts (NOVO)
│   ├── routes/
│   │   └── dreMapping.routes.ts (NOVO)
│   └── index.ts (ATUALIZADO)
└── prisma/
    └── schema.prisma (ATUALIZADO)

frontend/
├── src/
│   ├── components/
│   │   └── UnmappedAccountsModal.tsx (NOVO)
│   ├── services/
│   │   └── dreMappingService.ts (NOVO)
│   └── lib/
│       └── categoryConstants.ts (NOVO)
```

---

## 7. Próximos Passos

1. **Executar migração Prisma:**
   ```bash
   cd backend
   npx prisma migrate dev --name add_dre_mapping
   ```

2. **Integrar modal no ClientDashboard.tsx:**
   - Importar `UnmappedAccountsModal`
   - Adicionar state para controlar visibilidade
   - Chamar após sucesso de importação

3. **Testar fluxo completo:**
   - Upload de planilha com contas não mapeadas
   - Mapeamento via modal
   - Verificação de DRE atualizado

4. **Melhorias futuras:**
   - Sugestão automática de categoria baseada em ML
   - Histórico de mapeamentos
   - Auditoria de alterações
   - Exportação de mapeamentos para reutilização

---

## 8. Validação das 30 Categorias

As 30 categorias foram identificadas na análise do arquivo `RelatórioGerencial12.2025.xlsx-COLARCOMPARATIVO-MOVIMENTO(2).csv`:

**Ativo Circulante (6):**
- Disponivel
- Clientes
- Estoques
- Adiantamentos
- Despesas Antecipadas
- Tributos A CompensarCP

**Ativo Não Circulante (3):**
- Imobilizado
- Intangivel
- Outras Contas A Receber Lp

**Passivo Circulante (8):**
- Fornecedores
- Contas A Pagar Cp
- Obrigacoes Trabalhistas
- Obrigacoes Tributarias
- Emprestimos E Financiamentos Cp
- Parcelamentos Cp

**Passivo Não Circulante (4):**
- Outras Contas A Pagar Lp
- Parcelamentos Lp
- Processos Judiciais

**Patrimônio Líquido (2):**
- Reserva De Lucros
- Resultado Do Exercicio

**DRE - Receitas (3):**
- Receita Bruta
- Outras Receitas
- Receitas Financeiras

**DRE - Deduções (1):**
- Deduções

**DRE - Custos (1):**
- Custos Das Vendas

**DRE - Despesas (5):**
- Despesas Administrativas
- Despesas Comerciais
- Despesas Tributarias
- Despesas Financeiras

**DRE - Impostos (1):**
- Irpj E Csll

**Total: 30 categorias**

---

## 9. Exemplo de Uso Completo

### Cenário: Importação de Movimentação com Contas Novas

1. **Usuário faz upload do arquivo `Planilhasemtítulo(1).xlsx`**
   - Arquivo contém 349 linhas com movimentações de 2025

2. **Sistema processa:**
   - Lê 30 categorias do DE-PARA (coluna 16)
   - Identifica 5 contas sem mapeamento (DE-PARA vazio ou #REF!)
   - Salva movimentações com `is_mapped = false` para essas 5 contas

3. **Sistema exibe modal:**
   - "Contas Não Mapeadas"
   - Lista as 5 contas: código, nome
   - Dropdown com 30 categorias válidas

4. **Usuário mapeia:**
   - Seleciona "Receita Bruta" para conta `03.1.01.01.0001`
   - Seleciona "Custos Das Vendas" para conta `04.1.01.01.0001`
   - ... (3 mais)

5. **Sistema salva:**
   - Cria 5 registros em `DREMapping`
   - Atualiza `ChartOfAccounts` com `report_category` e `is_mapped = true`
   - Marca `MonthlyMovement` como `is_mapped = true`

6. **DRE é atualizado:**
   - Função `calcDreForMonth` busca movimentações por categoria
   - Soma valores de janeiro (coluna 0) para "Receita Bruta"
   - Exibe resultado: R$ 1.065.468,84

---

## 10. Troubleshooting

### Problema: "Categoria inválida"
**Solução:** Verificar se a categoria está na lista de 30 válidas. Usar `normalizeCategory()` para converter aliases.

### Problema: "Contas não aparecem no DRE"
**Solução:** Verificar se `is_mapped = true` no banco de dados. Executar `getUnmappedMovements()` para diagnosticar.

### Problema: "Valores zerados no DRE"
**Solução:** Verificar se os valores foram importados corretamente (12 elementos no array `values`). Validar formato de números (separador decimal).

---

## Conclusão

Essas melhorias transformam o TresContas em um SaaS robusto e automatizado, onde:
- ✅ Usuários definem o Plano de Contas uma única vez
- ✅ Mapeamento DE-PARA é persistente e reutilizável
- ✅ Importação mensal é simples e intuitiva
- ✅ DRE é gerado automaticamente
- ✅ Alertas guiam o usuário para contas não mapeadas
- ✅ Sistema é escalável para múltiplos clientes e anos

