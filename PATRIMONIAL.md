# Patrimonial no TresContas

Este documento descreve somente o patrimonial: quais grupos existem, como as contas sao classificadas, como os totais sao montados e quais indicadores o app calcula.

## Visao geral

O patrimonial no TresContas e a leitura do balanco/balancete por grupos de conta. O fluxo real e:

1. O arquivo patrimonial e importado.
2. O backend grava as linhas em `MonthlyMovement` com `type = patrimonial`.
3. Cada linha recebe uma categoria patrimonial pelo DE-PARA do plano de contas ou pelo proprio arquivo.
4. O frontend agrupa as linhas por secao patrimonial.
5. O dashboard monta os demonstrativos, totais e indicadores financeiros.

Na pratica, o patrimonial depende de:

- `MonthlyMovement.values` com 12 meses
- `MonthlyMovement.category`
- `ChartOfAccounts.report_category`
- mapeamentos patrimoniais globais ou por cliente

## Estrutura patrimonial exibida no app

O app trabalha com 4 blocos principais e seus totais:

1. Ativo Circulante
2. Ativo Nao Circulante
3. Passivo Circulante
4. Passivo Nao Circulante
5. Patrimonio Liquido

Os totais exibidos sao:

- Total do Ativo
- Total do Passivo

### Itens demonstrativos por grupo

#### Ativo Circulante

- Disponivel
- Clientes
- Adiantamentos
- Estoques
- Tributos A Compensar CP
- Outras Contas A Receber
- Despesas Antecipadas

#### Ativo Nao Circulante

- Contas A Receber LP
- Processos Judiciais
- Partes Relacionadas A Receber
- Outras Contas A Receber LP
- Tributos A Recuperar LP
- Investimentos
- Imobilizado
- Intangivel

#### Passivo Circulante

- Fornecedores
- Emprestimos E Financiamentos CP
- Obrigacoes Trabalhistas
- Obrigacoes Tributarias
- Contas A Pagar CP
- Parcelamentos CP
- Processos A Pagar CP

#### Passivo Nao Circulante

- Emprestimos E Financiamentos LP
- Conta Corrente Dos Socios
- Emprestimos Partes Relacionadas
- Parcelamentos LP
- Processos A Pagar LP
- Impostos Diferidos
- Outras Contas A Pagar LP
- Receita De Exercicio Futuro LP
- Provisao Para Contingencias

#### Patrimonio Liquido

- Capital Social
- Reserva De Capital
- Reserva De Lucros
- Resultado Do Exercicio
- Distribuicao De Lucros

## Como as contas sao classificadas

O patrimonial tem duas camadas de classificacao:

### 1. Classificacao por categoria

Uma linha pode ser ligada a uma categoria patrimonial por:

1. Mapeamento manual no painel de configuracao
2. Categoria vinda do CSV
3. `report_category` da conta no plano de contas
4. Auto-classificacao por prefixo do codigo

### 2. Classificacao por secao

Quando o app precisa agrupar o demonstrativo, ele usa o prefixo do codigo da conta:

```text
01.1 -> Ativo Circulante
01.2 -> Ativo Nao Circulante
02.1 -> Passivo Circulante
02.2 -> Passivo Nao Circulante
02.3 -> Passivo Nao Circulante
02.4 -> Patrimonio Liquido
```

## Como o backend importa o patrimonial

Na importacao patrimonial, o backend:

- valida se cada linha tem codigo, nome e 12 valores
- grava a lista em `MonthlyMovement`
- nao converte valores acumulados em delta mensal
- mantem os valores como vierem do arquivo, porque patrimonial geralmente representa saldo/posicao

Importante:

- a conversao de acumulado para mensal existe apenas no DRE
- patrimonial e tratado como leitura patrimonial mensal, nao como resultado acumulado

Se o arquivo for comparativo e trouxer patrimonial junto com DRE, o frontend pode separar:

- contas com codigo `01` ou `02` vao para patrimonial
- contas com codigo `03` ou `04` vao para DRE

## Como o frontend soma o patrimonial

O patrimonial usa duas logicas de soma:

### Soma por categoria

Para descobrir o valor de uma categoria especifica, o app:

1. Normaliza o texto da categoria
2. Procura contas cujo `report_category` bate com a categoria
3. Procura movimentacoes com `movement.category` igual
4. Se nao achar, procura pelo nome da linha

### Soma por grupo

Para descobrir o valor de uma secao grande, o app:

1. Agrupa pelas linhas cujo codigo cai no prefixo da secao
2. Remove contas pai para evitar dupla contagem
3. Se nao houver codigo numerico, usa `movement.level === 2` e a categoria textual

### Regra de nao duplicar linhas

Quando existem contas numericas, o app considera apenas as linhas folha:

- se uma conta tem filhas, ela nao entra duas vezes na soma
- o filtro de folha evita somar pai + filho ao mesmo tempo

## Formula dos grupos

O patrimonial nao tem formula de resultado como o DRE. Ele monta totais de estrutura.

```text
Ativo Circulante = soma das contas do grupo ATIVO CIRCULANTE
Ativo Nao Circulante = soma das contas do grupo ATIVO NAO CIRCULANTE

Total do Ativo = Ativo Circulante + Ativo Nao Circulante

Passivo Circulante = soma das contas do grupo PASSIVO CIRCULANTE
Passivo Nao Circulante = soma das contas do grupo PASSIVO NAO CIRCULANTE
Patrimonio Liquido = soma das contas do grupo PATRIMONIO LIQUIDO

Total do Passivo = Passivo Circulante + Passivo Nao Circulante + Patrimonio Liquido
```

O app mostra os grupos, mas nao corrige automaticamente eventuais diferencas entre ativo e passivo. Se o balanco estiver desalinhado, isso aparece na leitura.

## Indicadores patrimoniais calculados

No painel patrimonial, o app calcula estes indicadores para o mes selecionado:

```text
Liquidez Corrente = Ativo Circulante / Passivo Circulante

Liquidez Imediata = Disponivel / Passivo Circulante

Liquidez Seca = (Ativo Circulante - Estoques) / Passivo Circulante

Liquidez Geral = (Ativo Circulante + Ativo Nao Circulante) / (Passivo Circulante + Passivo Nao Circulante)

Participacao de Terceiros = (Passivo Circulante + Passivo Nao Circulante) / Total do Ativo

ROE = Lucro Liquido / Patrimonio Liquido

ROA = Lucro Liquido / Total do Ativo

Margem Liquida = Lucro Liquido / Receita Bruta

Giro do Ativo = Receita Liquida / Total do Ativo

ROIC = LAIR / Total do Ativo

Rotacao de Estoques = abs(Custos) / Estoques

Prazo Medio de Estoque = 360 / Rotacao de Estoques

PMC = Clientes / abs(Receita Liquida) * 360

PMP = Fornecedores / abs(Custos) * 360

Ciclo Financeiro = PMC - PMP
```

Se o denominador for zero, o app zera o indicador.

Observacao:

- `Lucro Liquido`, `Receita Bruta`, `Receita Liquida`, `Custos`, `LAIR` e `EBITDA` sao buscados do DRE do mesmo mes.
- Ou seja: o patrimonial usa o DRE como apoio para os indicadores de rentabilidade e prazo.

## Como o painel patrimonial e configurado

O painel patrimonial fica na parametrizacao da contabilidade e segue a mesma base de referencia do plano de contas.

O fluxo de configuracao e:

1. Abrir a parametrizacao patrimonial
2. Escolher uma conta patrimonial
3. Associar a conta a uma categoria do grupo correto
4. Salvar a configuracao

O painel permite:

- importar a base de um cliente de referencia
- auto-classificar contas por prefixo
- editar o DE-PARA manualmente
- salvar no escopo da contabilidade ou no escopo do cliente, dependendo da tela

### Auto-classificacao por prefixo

O app tenta classificar automaticamente contas novas usando o codigo:

```text
01.1.01 -> Disponivel
01.1.02 -> Clientes
01.1.03 -> Adiantamentos
01.1.04 -> Estoques
01.1.05 -> Tributos A Compensar CP
01.1.06 -> Outras Contas A Receber
01.1.07 -> Despesas Antecipadas

01.2.01 -> Contas A Receber LP
01.2.02 -> Processos Judiciais
01.2.03 -> Partes Relacionadas A Receber
01.2.04 -> Outras Contas A Receber LP
01.2.05 -> Tributos A Recuperar LP
01.2.06 -> Investimentos
01.2.07 -> Imobilizado
01.2.08 -> Intangivel

02.1.01 -> Fornecedores
02.1.02 -> Emprestimos E Financiamentos CP
02.1.03 -> Obrigacoes Trabalhistas
02.1.04 -> Obrigacoes Tributarias
02.1.05 -> Contas A Pagar CP
02.1.06 -> Parcelamentos CP
02.1.07 -> Processos A Pagar CP

02.2.01 -> Emprestimos E Financiamentos LP
02.2.02 -> Conta Corrente Dos Socios
02.2.03 -> Emprestimos Partes Relacionadas
02.2.04 -> Parcelamentos LP
02.2.05 -> Processos A Pagar LP
02.2.06 -> Impostos Diferidos
02.2.07 -> Outras Contas A Pagar LP
02.2.08 / 02.3.01 -> Receita De Exercicio Futuro LP
02.2.09 / 02.3.02 -> Provisao Para Contingencias

02.4.01 -> Capital Social
02.4.02 -> Reserva De Capital
02.4.03 -> Reserva De Lucros
02.4.04 -> Resultado Do Exercicio
02.4.05 -> Distribuicao De Lucros
```

## Cartoes e graficos do patrimonial

Na tela patrimonial, o app monta:

- cards do grupo selecionado
- tabela/lista com os valores mensais
- graficos por grupo
- indicadores de liquidez, rentabilidade e atividade

Os valores mais importantes exibidos sao:

- Ativo Circulante
- Ativo Nao Circulante
- Total do Ativo
- Passivo Circulante
- Passivo Nao Circulante
- Patrimonio Liquido
- Total do Passivo

## Resumo curto

O patrimonial do TresContas funciona assim:

1. importa o balancete patrimonial
2. classifica as contas por grupo e subgrupo
3. soma os valores mensais por secao
4. monta o balanco com totais
5. calcula liquidez, rentabilidade e prazos

Se voce quiser alterar o patrimonial, os pontos principais sao:

- `backend/src/controllers/movement.controller.ts`
- `backend/src/controllers/dreMapping.controller.ts`
- `frontend/src/pages/ClientDashboard.tsx`
- `frontend/src/components/ClientPatConfigPanel.tsx`
- `frontend/src/components/client-dashboard/constants.ts`
