# Parametrizacao dos Demonstrativos no TresContas

Este documento explica como funciona a parametrizacao de DRE, Patrimonial e DFC no TresContas.

## Resumo geral

Os tres demonstrativos seguem a mesma ideia base:

1. A contabilidade escolhe uma conta titulo do plano de contas.
2. Essa conta recebe uma categoria, grupo ou linha de demonstrativo.
3. O sistema grava esse DE-PARA.
4. O frontend usa esse mapeamento para montar os relatórios.

O que muda entre eles e o tipo de relatorio e a forma como o dado e consumido:

- DRE: soma categorias de resultado.
- Patrimonial: agrupa saldo por blocos de balanco.
- DFC: transforma contas titulo em linhas do fluxo de caixa indireto.

## Modelos de configuracao

O app trabalha com dois contextos:

### 1. Parametrizacao global da contabilidade

Vale para toda a carteira da contabilidade.

E usada para:

- padronizar DRE
- padronizar Patrimonial
- padronizar DFC

### 2. Parametrizacao por cliente

Vale so para um cliente.

E usada quando a contabilidade precisa ajustar a leitura de um cliente especifico.

## Tela de entrada

A tela principal de parametrizacao e a componente:

- `frontend/src/components/AccountingParametrizacaoPanel.tsx`

Ela mostra tres entradas:

- DRE
- Patrimonial
- DFC

Na pratica, essa tela usa uma base de referencia de cliente para copiar a configuracao inicial.

### Base de referencia

O sistema procura um cliente de referencia:

1. primeiro cliente cujo nome contenha `coca cola`
2. se nao achar, usa o primeiro cliente da carteira

Essa base e usada para:

- carregar uma estrutura inicial
- importar configuracoes ja prontas
- facilitar a parametrizacao global

## Como o sistema grava os mapeamentos

### DRE e Patrimonial

Usam a tabela `DREMapping`.

Campos principais:

- `account_code`
- `account_name`
- `category`
- `client_id`
- `accounting_id`

Quando a configuracao e global:

- `client_id = null`

Quando a configuracao e por cliente:

- `client_id = <id do cliente>`

Depois de salvar, o backend sincroniza:

- `ChartOfAccounts.report_category`
- `ChartOfAccounts.is_mapped`
- `MonthlyMovement.category`
- `MonthlyMovement.is_mapped`

### DFC

Usa a tabela `DFCLineMapping`.

Campos principais:

- `line_key`
- `chart_account_id`
- `account_code_snapshot`
- `reduced_code_snapshot`
- `source_type`
- `multiplier`
- `include_children`
- `client_id`
- `accounting_id`

O DFC trabalha com linhas, nao com categorias soltas.

## DRE

### Onde a parametrizacao fica

Arquivos principais:

- `frontend/src/components/ClientDreConfigPanel.tsx`
- `backend/src/controllers/dreMapping.controller.ts`
- `backend/src/routes/dreMapping.routes.ts`

### O que pode ser parametrizado

O DRE trabalha com estas familias:

- Receitas
- Deducoes
- Custos
- Despesas
- Outros

Categorias mais usadas:

- Receita Bruta
- Deducoes de Vendas
- Custos das Vendas
- Custos dos Servicos
- Despesas Administrativas
- Despesas Comerciais
- Despesas Tributarias
- Despesas Financeiras
- Outras Despesas
- Outras Receitas
- Depreciacao e Amortizacao
- Resultado Participacoes Societarias
- IRPJ e CSLL
- Receitas Financeiras

### Como o DRE e configurado

O painel DRE permite:

1. abrir a parametrizacao global
2. abrir a parametrizacao por cliente
3. importar a base de um cliente de referencia
4. adicionar ou remover mapeamentos
5. salvar tudo de uma vez

### Validacao das categorias

O backend valida se a categoria existe dentro da lista permitida.

Se a categoria nao for aceita:

- o save falha
- o frontend mostra erro

### Precedencia de leitura

Quando o sistema precisa descobrir a categoria de uma conta:

1. usa o mapeamento DRE salvo
2. usa a categoria vinda do arquivo
3. usa `report_category` da conta
4. usa inferencia por codigo, se necessario

### O que o save faz

Quando salva o DRE global:

1. remove os mapeamentos antigos do grupo
2. insere os novos mapeamentos
3. atualiza as contas do plano
4. atualiza as movimentacoes importadas

### Endpoints principais

- `GET /api/accounting/dre-mappings`
- `PUT /api/accounting/dre-mappings`
- `GET /api/clients/:clientId/dre-mappings`
- `POST /api/clients/:clientId/dre-mappings`
- `DELETE /api/clients/:clientId/dre-mappings/:account_code`
- `POST /api/clients/:clientId/bulk-dre-mappings`

### Regra pratica

O DRE e um DE-PARA de resultado.

Ele diz:

- esta conta vira receita
- esta conta vira custo
- esta conta vira despesa
- esta conta vira imposto

E depois o dashboard soma tudo em linhas do demonstrativo.

## Patrimonial

### Onde a parametrizacao fica

Arquivos principais:

- `frontend/src/components/ClientPatConfigPanel.tsx`
- `backend/src/controllers/dreMapping.controller.ts`
- `backend/src/routes/dreMapping.routes.ts`

### O que pode ser parametrizado

O patrimonial trabalha com grupos do balanco:

- Ativo Circulante
- Ativo Nao Circulante
- Passivo Circulante
- Passivo Nao Circulante
- Patrimonio Liquido

### Categorias patrimoniais

Exemplos:

- Disponivel
- Clientes
- Adiantamentos
- Estoques
- Tributos A Compensar CP
- Outras Contas A Receber
- Despesas Antecipadas
- Contas A Receber LP
- Processos Judiciais
- Partes Relacionadas A Receber
- Investimentos
- Imobilizado
- Intangivel
- Fornecedores
- Emprestimos E Financiamentos CP
- Obrigacoes Trabalhistas
- Obrigacoes Tributarias
- Contas A Pagar CP
- Parcelamentos CP
- Emprestimos E Financiamentos LP
- Conta Corrente Dos Socios
- Impostos Diferidos
- Capital Social
- Reserva De Lucros
- Resultado Do Exercicio

### Como o patrimonial e configurado

O painel patrimonial permite:

1. importar a base de um cliente de referencia
2. adicionar contas manualmente
3. auto-classificar contas pelo codigo
4. remover mapeamentos
5. salvar a parametrizacao

### Auto-classificacao por codigo

O sistema tenta inferir a categoria olhando o prefixo da conta:

```text
01.1.xx -> Ativo Circulante
01.2.xx -> Ativo Nao Circulante
02.1.xx -> Passivo Circulante
02.2.xx -> Passivo Nao Circulante
02.3.xx -> Passivo Nao Circulante
02.4.xx -> Patrimonio Liquido
```

Depois disso, ele tenta sugerir a categoria mais adequada:

- Disponivel
- Clientes
- Estoques
- Fornecedores
- Capital Social
- etc.

### Como o save funciona

Quando salva o patrimonial global:

1. o backend valida a categoria permitida
2. apaga os mapeamentos antigos daquele grupo
3. grava os novos mapeamentos
4. sincroniza `report_category` e `MonthlyMovement.category`

### Importancia da base de referencia

O patrimonial usa a base de referencia para:

- puxar um mapa pronto
- acelerar a configuracao
- manter padrao entre clientes

### Regra pratica

O patrimonial nao cria resultado.

Ele diz:

- onde esta o ativo
- onde esta o passivo
- onde esta o patrimonio liquido
- qual saldo pertence a cada grupo

## DFC

### Onde a parametrizacao fica

Arquivos principais:

- `frontend/src/components/ClientDfcSection.tsx`
- `frontend/src/components/AccountingParametrizacaoPanel.tsx`
- `backend/src/services/dfc.service.ts`
- `backend/src/services/dfcCatalog.ts`
- `backend/src/controllers/dfc.controller.ts`

### O que pode ser parametrizado

O DFC nao mapeia categorias soltas.

Ele mapeia linhas do fluxo de caixa:

- Resultado Liquido do Exercicio
- Depreciacao e Amortizacao
- Resultado da Venda de Ativo Imobilizado
- Resultado da Equivalencia Patrimonial
- Recebimentos de Lucros e Dividendos de Subsidiarias
- Contas a Receber
- Adiantamentos
- Impostos a Compensar
- Estoques
- Despesas Antecipadas
- Outras Contas a Receber
- Fornecedores
- Obrigacoes Trabalhistas
- Obrigacoes Tributarias
- Outras Obrigacoes
- Parcelamentos
- Recebimentos por Vendas de Ativo
- Compras de Imobilizado
- Aquisicoes em Investimentos
- Baixa de Ativo Imobilizado
- Integralizacao ou Aumento de Capital Social
- Pagamento de Lucros e Dividendos
- Variacao em Emprestimos/Financiamentos
- Dividendos Provisionados a Pagar
- Variacao Emprestimos Pessoas Ligadas
- Disponibilidades Base

### Como o DFC e configurado

O painel do DFC permite:

1. escolher a linha
2. escolher a conta titulo
3. definir multiplicador
4. decidir se inclui filhas analiticas
5. salvar a configuracao

### Tipos de conta aceitos

O DFC classifica contas por tipo de origem:

- `dre`
- `asset`
- `liability`
- `equity`
- `cash`

Cada linha so aceita o tipo de conta que faz sentido para ela.

### Como o save funciona

Quando salva:

1. o backend valida se a conta e compativel com a linha
2. evita duplicidade de conta na mesma linha
3. grava snapshot do codigo da conta
4. salva o multiplicador
5. salva se inclui filhas

### Ordem de leitura da configuracao

Quando o DFC e carregado, o sistema tenta:

1. configuracao global da contabilidade
2. configuracao do cliente
3. configuracao de um cliente de referencia

### Importancia da base patrimonial anterior

O DFC precisa da base patrimonial de dezembro do ano anterior para calcular variacoes.

Se nao existir, o relatorio fica parcial.

### Como o DFC calcula as linhas

O backend calcula:

- lucro ajustado
- variacao ativo
- variacao passivo
- resultado operacional
- resultado de investimento
- resultado financeiro
- saldo inicial disponivel
- saldo final disponivel
- resultado geracao de caixa

### Reconciliacao

O sistema verifica se:

```text
saldo final - saldo inicial = resultado da geracao de caixa
```

Se nao bater:

- o relatorio recebe aviso
- o mes fica marcado com inconsistencias

### Regra pratica

O DFC e uma composicao tecnica:

- usa DRE como ponto de partida
- usa patrimonial como base de variacao
- usa disponibilidades para fechar o caixa

## Quem consome a parametrizacao

### DRE

Consumido por:

- dashboard financeiro
- graficos de margem e resultado
- tabela de DRE

### Patrimonial

Consumido por:

- balanco patrimonial
- liquidez
- rentabilidade
- atividade
- prazos

### DFC

Consumido por:

- relatorio do fluxo de caixa
- exportacao em PDF
- reconciliacao mensal

## Fluxo de trabalho recomendado

Se voce for parametrizar do zero, a ordem certa e:

1. montar o plano de contas
2. parametrizar DRE
3. parametrizar Patrimonial
4. parametrizar DFC
5. importar os balancetes
6. conferir os avisos
7. validar os relatórios

## Onde mexer no codigo

### DRE

- `frontend/src/components/ClientDreConfigPanel.tsx`
- `backend/src/controllers/dreMapping.controller.ts`
- `backend/src/routes/dreMapping.routes.ts`
- `frontend/src/pages/ClientDashboard.tsx`

### Patrimonial

- `frontend/src/components/ClientPatConfigPanel.tsx`
- `backend/src/controllers/dreMapping.controller.ts`
- `backend/src/routes/dreMapping.routes.ts`
- `frontend/src/pages/ClientDashboard.tsx`

### DFC

- `frontend/src/components/ClientDfcSection.tsx`
- `backend/src/services/dfc.service.ts`
- `backend/src/services/dfcCatalog.ts`
- `backend/src/controllers/dfc.controller.ts`

## Resumo final

Parametrizacao no TresContas e o processo de dizer ao sistema:

- qual conta vira qual categoria no DRE
- qual conta pertence a qual grupo no Patrimonial
- qual conta alimenta cada linha do DFC

Depois disso, o sistema usa essa base para calcular os demonstrativos automaticamente.
