# DFC no TresContas

Este documento descreve somente o DFC: como o relatorio e montado, quais linhas existem, como as contas sao parametrizadas e como o calculo fecha mes a mes.

## Visao geral

O DFC no TresContas usa o metodo indireto. O fluxo real e:

1. O usuario importa o balancete mensal.
2. O backend grava o balancete em `MonthlyMovement` com `type = patrimonial`.
3. A contabilidade configura quais contas titulo alimentam cada linha do DFC.
4. O backend calcula os saldos, variacoes e resultados derivados.
5. O frontend exibe o relatorio, os avisos e a reconciliacao.

Na pratica, o DFC depende de:

- movimentacoes DRE do ano atual
- movimentacoes patrimoniais do ano atual
- base patrimonial de dezembro do ano anterior
- contas titulo parametrizadas na contabilidade
- balancete mensal importado e salvo no sistema

## Metodo indireto

O DFC nao e um relatorio isolado. Ele cruza:

- resultado contabil
- variacao de ativo
- variacao de passivo
- movimentos de investimento
- movimentos de financiamento
- saldo de caixa disponivel

O objetivo e responder:

```text
Saldo inicial disponivel
+ Resultado operacional
+ Resultado de investimento
+ Resultado financeiro
= Resultado da geracao de caixa
= Saldo final disponivel
```

## Estrutura do relatorio

O relatorio final esta organizado nestes blocos:

1. Resultado Contabil
2. Fluxos de Caixa Originarios de Atividades Operacionais
3. Fluxos de Caixa Originarios de Atividades de Investimentos
4. Fluxos de Caixa Originarios de Atividades de Financiamentos
5. Resultado da Geracao de Caixa

### Linhas exibidas no relatorio

#### Resultado Contabil

- Resultado Liquido do Exercicio
- Depreciacao e Amortizacao
- Resultado da Venda de Ativo Imobilizado
- Resultado da Equivalencia Patrimonial
- Recebimentos de Lucros e Dividendos de Subsidiarias
- Lucro Ajustado

#### Operacional

- Variacao Ativo
- Variacao Passivo
- Resultado Operacional

#### Investimentos

- Recebimentos por Vendas de Ativo Inv./Imob./Intang.
- Compras de Imobilizado
- Aquisicoes em Investimentos
- Baixa de Ativo Imobilizado
- Resultado de Investimento

#### Financiamentos

- Integralizacao ou Aumento de Capital Social
- Pagamento de Lucros e Dividendos
- Variacao em Emprestimos/Financiamentos
- Dividendos Provisionados a Pagar
- Variacao Emprestimos Pessoas Ligadas PJ/PF
- Resultado Financeiro

#### Base e fechamento de caixa

- Disponibilidades Base
- Saldo Inicial Disponivel
- Saldo Final Disponivel
- Resultado Geracao de Caixa

## Como as linhas sao configuradas

O DFC tem linhas configuraveis e linhas derivadas.

### Linhas configuraveis

Sao as linhas que recebem uma ou mais contas titulo:

- Resultado Liquido do Exercicio
- Depreciacao e Amortizacao
- Resultado da Venda de Ativo Imobilizado
- Resultado da Equivalencia Patrimonial
- Recebimentos de Lucros e Dividendos de Subsidiarias
- Contas do bloco operacional
- Contas do bloco de investimentos
- Contas do bloco de financiamentos
- Disponibilidades Base

### Linhas derivadas

Sao calculadas a partir das anteriores:

- Lucro Ajustado
- Variacao Ativo
- Variacao Passivo
- Resultado Operacional
- Resultado de Investimento
- Resultado Financeiro
- Saldo Inicial Disponivel
- Saldo Final Disponivel
- Resultado Geracao de Caixa

## Tipos de conta usados no DFC

O catalogo do DFC trabalha com estes tipos de origem:

- `dre`
- `asset`
- `liability`
- `equity`
- `cash`

### Regras de compatibilidade

- `dre` aceita contas do resultado
- `asset` aceita contas de ativo
- `liability` aceita contas de passivo
- `equity` aceita contas de patrimonio liquido
- `cash` usa a base de disponibilidades

## Como a configuracao funciona

A configuracao do DFC pode ser salva em dois niveis:

1. Escopo da contabilidade
2. Escopo do cliente

### Escopo da contabilidade

Quando a configuracao e salva na contabilidade:

- ela vale para todos os clientes
- fica disponivel como padrao da base
- pode ser reaproveitada na importacao de outros clientes

### Escopo do cliente

Quando a configuracao e salva no cliente:

- ela vale so para aquele cliente
- sobrescreve a leitura padrao daquele contexto

### Fallback de configuracao

Quando o sistema busca a configuracao efetiva, ele tenta nesta ordem:

1. configuracao global da contabilidade
2. configuracao do cliente atual, se existir
3. configuracao de cliente de referencia

No codigo atual, a referencia padrao e o primeiro cliente encontrado na contabilidade, com preferencia para um nome que contenha "coca cola".

## Como o backend calcula o DFC

O backend monta o relatorio em tres etapas:

### 1. Carrega os dados

O backend busca:

- movimentacoes DRE do ano corrente
- movimentacoes patrimoniais do ano corrente
- movimentacoes patrimoniais de dezembro do ano anterior
- configuracoes DFC salvas

### 2. Calcula cada linha configuravel

#### Linhas DRE

Para uma linha do tipo `dre`, o valor mensal e:

```text
valor_da_linha = soma_das_movimentacoes_iguais_ao_snapshot_da_conta * multiplicador
```

O sistema soma somente as linhas folha ligadas ao codigo da conta configurada.

#### Linhas patrimoniais

Para uma linha do tipo patrimonial/ativo/passivo/patrimonio, o sistema calcula a variacao entre:

```text
saldo_fechamento_do_mes_atual - saldo_abertura_de_dezembro_do_ano_anterior
```

Depois aplica o sinal conforme o tipo da conta:

- ativo e caixa: sinal invertido para representar consumo/saída
- passivo e patrimonio: sinal mantido

Formula simplificada:

```text
delta = saldo_atual - saldo_anterior

se sourceType = asset ou cash:
    valor = -delta * multiplicador
senao:
    valor = delta * multiplicador
```

### 3. Calcula as linhas derivadas

#### Lucro Ajustado

```text
Lucro Ajustado =
    Resultado Liquido do Exercicio
  + Depreciacao e Amortizacao
  + Resultado da Venda de Ativo Imobilizado
  + Resultado da Equivalencia Patrimonial
  + Recebimentos de Lucros e Dividendos de Subsidiarias
```

#### Variacao Ativo

```text
Variacao Ativo =
    Contas a Receber
  + Adiantamentos
  + Impostos a Compensar
  + Estoques
  + Despesas Antecipadas
  + Outras Contas a Receber
```

#### Variacao Passivo

```text
Variacao Passivo =
    Fornecedores
  + Obrigacoes Trabalhistas
  + Obrigacoes Tributarias
  + Outras Obrigacoes
  + Parcelamentos
```

#### Resultado Operacional

```text
Resultado Operacional = Lucro Ajustado + Variacao Ativo + Variacao Passivo
```

#### Resultado de Investimento

```text
Resultado de Investimento =
    Recebimentos por Vendas de Ativo Inv./Imob./Intang.
  + Compras de Imobilizado
  + Aquisicoes em Investimentos
  + Baixa de Ativo Imobilizado
```

#### Resultado Financeiro

```text
Resultado Financeiro =
    Integralizacao ou Aumento de Capital Social
  + Pagamento de Lucros e Dividendos
  + Variacao em Emprestimos/Financiamentos
  + Dividendos Provisionados a Pagar
  + Variacao Emprestimos Pessoas Ligadas PJ/PF
```

#### Saldo Inicial e Final Disponivel

```text
Saldo Inicial Disponivel = saldo de dezembro do ano anterior
Saldo Final Disponivel = saldo atual do mes
```

Esses valores so existem se a linha `Disponibilidades Base` estiver parametrizada.

#### Resultado Geracao de Caixa

```text
Resultado Geracao de Caixa =
    Resultado Operacional
  + Resultado de Investimento
  + Resultado Financeiro
```

## Reconciliacao do DFC

Depois de calcular o fluxo, o backend valida o fechamento do caixa:

```text
resultado_esperado = saldo_final_disponivel - saldo_inicial_disponivel
```

Se o valor esperado for diferente do `Resultado Geracao de Caixa`, o sistema cria um aviso de reconciliacao.

### Avisos possiveis

- configuracao inexistente
- base patrimonial do ano anterior ausente
- disponibilidade base nao parametrizada
- reconciliacao nao fechou em um ou mais meses

Quando a base do ano anterior nao existe, o DFC e marcado como parcial.

## Como o frontend mostra o DFC

O frontend tem dois modos:

1. Visualizacao
2. Configuracao

### Visualizacao

Mostra:

- tabela do DFC
- linhas de resultado e derivadas
- avisos de parcialidade e reconciliacao
- exportacao em PDF

### Configuracao

Permite:

- escolher as contas titulo de cada linha
- definir multiplicador
- marcar se deve incluir as filhas analiticas
- salvar a configuracao global ou do cliente

## Como o balancete entra no processo

O balancete mensal e enviado pelo painel do DFC.

Regras do upload:

- o arquivo pode ser `.csv`, `.xlsx` ou `.xls`
- o usuario precisa informar mes e ano
- o documento e salvo com `document_type = dfc_balancete`
- o upload serve como base mensal para consulta e rastreio

Na visao de contabilidade, o balancete aparece como historico de arquivos enviados.

## Regras importantes

- O DFC nao usa conversao de acumulado para mensal como o DRE.
- O DFC depende da base patrimonial do ano anterior para calcular variacoes.
- O DFC usa multipliers para ajustar o sinal de cada linha.
- O DFC so fecha corretamente se a configuracao de disponibilidades base estiver completa.
- As linhas derivadas nao sao parametrizadas manualmente.

## Resumo curto

O DFC do TresContas funciona assim:

1. importa o balancete
2. usa o DRE e o patrimonial como base
3. calcula lucro ajustado, variacoes, investimentos e financiamentos
4. fecha o fluxo com saldo inicial, saldo final e geracao de caixa
5. avisa quando a reconciliacao nao bate

Se voce quiser alterar o DFC, os pontos principais sao:

- `backend/src/services/dfcCatalog.ts`
- `backend/src/services/dfc.service.ts`
- `backend/src/controllers/dfc.controller.ts`
- `frontend/src/components/ClientDfcSection.tsx`
- `frontend/src/components/AccountingParametrizacaoPanel.tsx`
- `frontend/src/pages/ClientDashboard.tsx`
