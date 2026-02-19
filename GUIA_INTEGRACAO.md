# Guia de Integração das Melhorias - TresContas SaaS

Este documento fornece instruções passo a passo para integrar todas as melhorias implementadas no projeto TresContas.

---

## 📋 Índice

1. [Preparação do Ambiente](#preparação-do-ambiente)
2. [Backend - Migrações e Endpoints](#backend---migrações-e-endpoints)
3. [Frontend - Integração de Componentes](#frontend---integração-de-componentes)
4. [Fluxo de Importação Completo](#fluxo-de-importação-completo)
5. [Testes e Validação](#testes-e-validação)
6. [Troubleshooting](#troubleshooting)

---

## Preparação do Ambiente

### 1.1 Instalar Dependências

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 1.2 Configurar Variáveis de Ambiente

**Backend (.env):**
```
DATABASE_URL="postgresql://user:password@localhost:5432/trescontas"
JWT_SECRET="seu-secret-jwt-aqui"
PORT=3001
```

**Frontend (.env.local):**
```
VITE_API_URL=http://localhost:3001/api
```

---

## Backend - Migrações e Endpoints

### 2.1 Executar Migração Prisma

```bash
cd backend

# Criar migração
npx prisma migrate dev --name add_dre_mapping

# Ou, se já tiver os arquivos:
npx prisma migrate deploy
```

**Alterações no banco de dados:**
- ✅ Novo modelo `DREMapping`
- ✅ Novos campos em `ChartOfAccounts`: `is_mapped`, `updated_at`
- ✅ Novos campos em `MonthlyMovement`: `is_mapped`
- ✅ Novos índices para performance

### 2.2 Verificar Rotas Registradas

Abra `backend/src/index.ts` e confirme que a linha abaixo está presente:

```typescript
app.use('/api/clients', dreMappingRoutes);
```

### 2.3 Testar Endpoints

```bash
# Iniciar servidor backend
npm run dev

# Em outro terminal, testar endpoint
curl http://localhost:3001/api/clients/{clientId}/dre-mappings \
  -H "Authorization: Bearer {token}"
```

**Endpoints disponíveis:**
- `GET /api/clients/:clientId/dre-mappings` - Listar mapeamentos
- `POST /api/clients/:clientId/dre-mappings` - Criar/atualizar mapeamento
- `DELETE /api/clients/:clientId/dre-mappings/:account_code` - Deletar mapeamento
- `GET /api/clients/:clientId/unmapped-movements?year=2025&type=dre` - Contas não mapeadas
- `POST /api/clients/:clientId/bulk-dre-mappings` - Importar múltiplos mapeamentos

---

## Frontend - Integração de Componentes

### 3.1 Importar Novos Componentes no ClientDashboard

Adicione os imports no topo do arquivo `frontend/src/pages/ClientDashboard.tsx`:

```typescript
import { UnmappedAccountsModal } from '../components/UnmappedAccountsModal';
import { UnmappedAccountsAlert } from '../components/UnmappedAccountsAlert';
import { OptimizedDRETable } from '../components/OptimizedDRETable';
import { QuickAccountRegistrationModal } from '../components/QuickAccountRegistrationModal';
import { dreMappingService } from '../services/dreMappingService';
import { DRECalculationService } from '../services/dreCalculationService';
```

### 3.2 Adicionar Estados para Controlar Modais

Dentro do componente `ClientDashboard`, adicione:

```typescript
// Estados para modais
const [showUnmappedModal, setShowUnmappedModal] = useState(false);
const [showQuickRegisterModal, setShowQuickRegisterModal] = useState(false);
const [suggestedAccountCode, setSuggestedAccountCode] = useState('');
const [suggestedAccountName, setSuggestedAccountName] = useState('');
```

### 3.3 Integrar Modal de Contas Não Mapeadas

Após a importação bem-sucedida de movimentações, adicione:

```typescript
// Dentro de createMovementUploadHandler
const handleDreFileUpload = createMovementUploadHandler('dre', setDreMovements);

// Após sucesso de importação:
const checkUnmappedAccounts = async () => {
    try {
        const unmapped = await dreMappingService.getUnmappedMovements(
            clientId,
            selectedYear,
            'dre'
        );
        if (unmapped.length > 0) {
            setShowUnmappedModal(true);
        }
    } catch (error) {
        console.error('Erro ao verificar contas não mapeadas:', error);
    }
};
```

### 3.4 Adicionar Componentes ao JSX

No retorno JSX do componente, adicione:

```typescript
{/* Modal de Contas Não Mapeadas */}
<UnmappedAccountsModal
    isOpen={showUnmappedModal}
    onClose={() => setShowUnmappedModal(false)}
    clientId={clientId}
    year={selectedYear}
    type="dre"
    onMappingComplete={() => {
        // Recarregar movimentações
        loadDreMovements();
        setShowUnmappedModal(false);
    }}
/>

{/* Modal de Registro Rápido de Conta */}
<QuickAccountRegistrationModal
    isOpen={showQuickRegisterModal}
    onClose={() => setShowQuickRegisterModal(false)}
    clientId={clientId}
    suggestedCode={suggestedAccountCode}
    suggestedName={suggestedAccountName}
    onAccountCreated={() => {
        // Recarregar dados
        loadDreMovements();
        setShowQuickRegisterModal(false);
    }}
/>

{/* Alerta de Contas Não Mapeadas (no topo do dashboard) */}
{dreMovements.length > 0 && (
    <UnmappedAccountsAlert
        movements={dreMovements}
        onMapClick={() => setShowUnmappedModal(true)}
    />
)}

{/* Tabela DRE Otimizada (substituir tabela existente) */}
{dreSubTab === 'dre' && dreViewMode === 'lista' && (
    <OptimizedDRETable
        movements={dreMovements}
        selectedMonthIndex={selectedMonthIndex}
        months={months}
        isReadOnly={isReadOnly}
        comments={dreComments}
        onCommentChange={(itemId, comment) =>
            setDreComments(prev => ({ ...prev, [itemId]: comment }))
        }
    />
)}
```

### 3.5 Atualizar Função de Cálculo do DRE

Substitua a função `calcDreForMonth` existente por:

```typescript
const calcDreForMonth = (monthIdx: number) => {
    return DRECalculationService.calculateDREForMonth(monthIdx, dreMovements);
};
```

---

## Fluxo de Importação Completo

### 4.1 Sequência de Eventos

```
1. Usuário clica "Importar Balancete"
   ↓
2. Seleciona arquivo Excel/CSV
   ↓
3. Sistema lê arquivo e valida formato
   ↓
4. Sistema salva movimentações no banco
   ↓
5. Sistema busca contas não mapeadas
   ↓
6. Se houver contas não mapeadas:
   → Exibe modal UnmappedAccountsModal
   → Usuário seleciona categorias
   → Sistema salva mapeamentos via API
   ↓
7. DRE é recalculado automaticamente
   ↓
8. Dashboard é atualizado com novos dados
```

### 4.2 Tratamento de Erros

```typescript
try {
    // Importar movimentações
    await movementService.importMovements(clientId, file, year, 'dre');
    
    // Verificar contas não mapeadas
    const unmapped = await dreMappingService.getUnmappedMovements(
        clientId,
        year,
        'dre'
    );
    
    if (unmapped.length > 0) {
        toast.warning(`${unmapped.length} conta(s) não mapeada(s). Por favor, mapeie-as.`);
        setShowUnmappedModal(true);
    } else {
        toast.success('Importação concluída com sucesso!');
    }
} catch (error) {
    toast.error('Erro ao importar movimentações');
    console.error(error);
}
```

---

## Testes e Validação

### 5.1 Teste de Importação Básica

1. **Upload de arquivo com todas as contas mapeadas**
   - Resultado esperado: DRE é gerado sem alertas
   - Verificar: Valores aparecem corretamente na tabela

2. **Upload de arquivo com contas não mapeadas**
   - Resultado esperado: Modal exibe contas não mapeadas
   - Verificar: Usuário consegue selecionar categorias

3. **Mapeamento de contas**
   - Resultado esperado: Mapeamentos são salvos no banco
   - Verificar: Próximo upload não exibe as mesmas contas

### 5.2 Teste de Cálculos

```typescript
// Teste unitário para DRECalculationService
import { DRECalculationService } from '../services/dreCalculationService';

describe('DRECalculationService', () => {
    it('deve calcular DRE corretamente', () => {
        const movements = [
            {
                code: '03.1.01.01.0001',
                name: 'RECEITA DE VENDAS',
                level: 15,
                category: 'Receita Bruta',
                values: [1000, 2000, 3000, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            },
        ];

        const dre = DRECalculationService.calculateDREForMonth(0, movements);
        expect(dre.recBruta).toBe(1000);
    });
});
```

### 5.3 Teste de Normalização de Categorias

```typescript
import { normalizeCategory, getCanonicalCategory } from '../lib/categoryConstants';

describe('categoryConstants', () => {
    it('deve normalizar variações de categorias', () => {
        expect(normalizeCategory('custos das vendas')).toBe('custos das vendas');
        expect(normalizeCategory('CUSTOS DAS VENDAS')).toBe('custos das vendas');
        expect(normalizeCategory('custo de mercadoria vendida')).toBe('custos das vendas');
    });

    it('deve retornar categoria canônica', () => {
        expect(getCanonicalCategory('CMV')).toBe('Custos Das Vendas');
    });
});
```

### 5.4 Teste de API

```bash
# Teste de criação de mapeamento
curl -X POST http://localhost:3001/api/clients/{clientId}/dre-mappings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "account_code": "03.1.01.01.0001",
    "account_name": "RECEITA DE VENDAS",
    "category": "Receita Bruta"
  }'

# Teste de busca de contas não mapeadas
curl http://localhost:3001/api/clients/{clientId}/unmapped-movements?year=2025&type=dre \
  -H "Authorization: Bearer {token}"
```

---

## Troubleshooting

### Problema: "Erro de autenticação ao acessar endpoints"

**Solução:**
1. Verificar se o token JWT está sendo enviado no header `Authorization`
2. Verificar se o `JWT_SECRET` está correto no `.env`
3. Verificar se o middleware de autenticação está registrado

```typescript
// backend/src/index.ts
app.use(authMiddleware); // Adicionar antes das rotas
```

### Problema: "Categorias não são reconhecidas"

**Solução:**
1. Verificar se a categoria está na lista de 30 válidas
2. Usar `normalizeCategory()` para converter aliases
3. Verificar se há espaços extras no nome da categoria

```typescript
const normalized = normalizeCategory('custos das vendas '); // Remove espaços
```

### Problema: "DRE mostra valores zerados"

**Solução:**
1. Verificar se as movimentações foram importadas (checar banco de dados)
2. Verificar se `is_mapped = true` nas movimentações
3. Verificar se o mês selecionado tem dados (array `values` não vazio)

```typescript
// Verificar dados no console
console.log('Movimentações:', dreMovements);
console.log('DRE calculado:', DRECalculationService.calculateDREForMonth(0, dreMovements));
```

### Problema: "Modal de contas não mapeadas não aparece"

**Solução:**
1. Verificar se `showUnmappedModal` está sendo setado para `true`
2. Verificar se o componente está renderizado no JSX
3. Verificar console para erros de API

```typescript
// Debug
console.log('showUnmappedModal:', showUnmappedModal);
console.log('Contas não mapeadas:', unmappedAccounts);
```

### Problema: "Erro ao salvar mapeamentos em lote"

**Solução:**
1. Verificar se todas as contas têm categoria válida
2. Verificar se o payload está no formato correto
3. Verificar limite de requisição (máximo 100 contas por requisição)

```typescript
// Formato correto
{
  "mappings": [
    {
      "account_code": "03.1.01.01.0001",
      "account_name": "RECEITA DE VENDAS",
      "category": "Receita Bruta"
    }
  ]
}
```

---

## Checklist de Integração

- [ ] Migração Prisma executada com sucesso
- [ ] Rotas de DRE Mapping registradas no backend
- [ ] Serviço `dreMappingService` criado no frontend
- [ ] Componente `UnmappedAccountsModal` importado
- [ ] Componente `UnmappedAccountsAlert` importado
- [ ] Componente `OptimizedDRETable` importado
- [ ] Componente `QuickAccountRegistrationModal` importado
- [ ] Serviço `DRECalculationService` importado
- [ ] Estados para modais adicionados
- [ ] Função `calcDreForMonth` atualizada
- [ ] Componentes renderizados no JSX
- [ ] Testes de importação executados
- [ ] Testes de cálculo executados
- [ ] Testes de API executados
- [ ] Aplicação em produção testada

---

## Próximas Melhorias Sugeridas

1. **Sugestão Automática de Categoria**
   - Usar ML para sugerir categoria baseada no nome da conta
   - Exemplo: "RECEITA DE VENDAS" → "Receita Bruta"

2. **Histórico de Mapeamentos**
   - Rastrear alterações de mapeamentos
   - Permitir reversão de alterações

3. **Auditoria**
   - Log de quem mapeou qual conta
   - Timestamps de alterações

4. **Exportação de Mapeamentos**
   - Permitir exportar mapeamentos em CSV
   - Permitir importar mapeamentos de outro cliente

5. **Validação em Tempo Real**
   - Validar mapeamentos enquanto usuário digita
   - Sugerir categorias similares

---

## Suporte

Para dúvidas ou problemas, consulte:
- `MELHORIAS_IMPLEMENTADAS.md` - Documentação técnica completa
- `backend/src/controllers/dreMapping.controller.ts` - Implementação do backend
- `frontend/src/services/dreMappingService.ts` - Implementação do frontend

