# Validacao DFC Gerencial

## Objetivo deste documento

Este material foi preparado para validar com o cliente como a DFC gerencial mensal sera apurada dentro do sistema.

O objetivo aqui e validar:

- a logica de calculo
- a estrutura das linhas
- a forma de apresentacao gerencial

Nao e um manual tecnico do sistema.

## Proposta de funcionamento da DFC

A DFC sera apresentada como uma demonstracao gerencial mensal, calculada de forma automatica com base no:

- DRE do cliente
- balanco patrimonial do cliente
- plano de contas parametrizado

A proposta e que a DFC seja fechada por regra e formula, sem campos abertos para digitacao manual de valores.

## Regra principal de calculo

A DFC mensal sera calculada de forma acumulada dentro do ano.

Exemplo:

- fevereiro considera a variacao acumulada de janeiro a fevereiro
- marco considera a variacao acumulada de janeiro a marco
- abril considera a variacao acumulada de janeiro a abril

## Saldo inicial da DFC

O saldo inicial usado como base nao sera o saldo do mes anterior.

A base da DFC sera:

- o saldo de dezembro do ano anterior

Esse saldo sera o ponto de partida fixo para toda a DFC do ano.

Exemplo:

- para a DFC de 2026, a base inicial sera dezembro de 2025

Se essa base nao existir no sistema, a DFC podera ser exibida como parcial, com aviso de que falta a base anterior.

## Estrutura gerencial proposta

Na visao final do cliente, a DFC sera mostrada em formato gerencial, com as principais linhas abaixo.

### Resultado contabil

- Resultado Liquido do Exercicio
- Depreciacao e Amortizacao
- Resultado da Venda de Ativo Imobilizado
- Resultado da Equivalencia Patrimonial
- Recebimentos de Lucros e Dividendos de Subsidiarias
- Lucro Ajustado

### Fluxos operacionais

- Variacao Ativo
- Variacao Passivo
- Resultado Operacional

### Fluxos de investimento

- Recebimentos por Vendas de Ativo Inv./Imob./Intang.
- Compras de Imobilizado
- Aquisicoes em Investimentos
- Baixa de Ativo Imobilizado
- Resultado de Investimento

### Fluxos de financiamento

- Integralizacao ou Aumento de Capital Social
- Pagamento de Lucros e Dividendos
- Variacao em Emprestimos/Financiamentos
- Dividendos Provisionados a Pagar
- Variacao Emprestimos Pessoas Ligadas PJ/PF
- Resultado Financeiro

### Geracao de caixa

- Saldo Inicial Disponivel
- Saldo Final Disponivel
- Resultado Geracao de Caixa

## Consolidacao de ativo e passivo

Conforme alinhado, a visao gerencial final devera manter a consolidacao em:

- `Variacao Ativo`
- `Variacao Passivo`

Ou seja, as subcontas que alimentam essas variacoes podem ser parametrizadas internamente, mas no relatorio final a proposta e apresentar essas variacoes fechadas em duas linhas consolidadas.

As linhas internas consideradas para essa consolidacao sao:

### Variacao Ativo

- Contas a Receber
- Adiantamentos
- Impostos a Compensar
- Estoques
- Despesas Antecipadas
- Outras Contas a Receber

### Variacao Passivo

- Fornecedores
- Obrigacoes Trabalhistas
- Obrigacoes Tributarias
- Outras Obrigacoes
- Parcelamentos

## Regras de sinal

Para manter a logica gerencial da DFC:

### Contas de ativo

- aumento no saldo: efeito negativo na DFC
- reducao no saldo: efeito positivo na DFC

### Contas de passivo e patrimonio liquido

- aumento no saldo: efeito positivo na DFC
- reducao no saldo: efeito negativo na DFC

## Base de disponibilidades

Para calcular:

- saldo inicial disponivel
- saldo final disponivel
- conciliacao da geracao de caixa

sera necessario definir quais contas representam as disponibilidades da empresa.

Essas contas serao usadas como base de caixa da DFC.

## Conciliacao da DFC

O sistema fara a conciliacao automatica entre:

- Resultado Geracao de Caixa

e

- Saldo Final Disponivel menos Saldo Inicial Disponivel

Se houver divergencia, o sistema exibira um aviso para revisao.

## Forma de parametrizacao

A estrutura sera parametrizada por contas-titulo do plano de contas.

Isso significa que:

- a configuracao sera feita nas contas principais
- o sistema podera considerar automaticamente as contas filhas relacionadas

Esse modelo foi definido para reduzir manutencao e evitar retrabalho quando novas contas analiticas forem criadas.

## O que nao esta previsto nesta etapa

Nesta etapa, a proposta nao considera:

- campos livres para digitacao manual de valores na DFC mensal
- ajustes manuais para "forcar fechamento"
- uma peca contabil oficial no formato legal

O foco aqui e uma DFC gerencial automatizada.

## Pontos para validacao do cliente

Solicitamos validar principalmente os itens abaixo:

1. A DFC mensal deve ser acumulada, usando como base fixa dezembro do ano anterior?
2. A estrutura gerencial final pode manter `Variacao Ativo` e `Variacao Passivo` consolidadas em duas linhas?
3. As linhas de financiamento estao corretas para a leitura gerencial esperada?
4. A linha `Lucro Ajustado` esta coerente com a forma como a empresa analisa a operacao?
5. A visao final deve permanecer sem campos abertos para digitacao manual?
6. A linha de disponibilidades esta coerente para fechamento de saldo inicial e final de caixa?

## Resumo para aprovacao

Em resumo, a proposta e:

- DFC gerencial mensal
- calculo acumulado dentro do ano
- base fixa em dezembro do ano anterior
- fechamento por formula
- ativo e passivo consolidados em duas linhas gerenciais
- parametrizacao por contas-titulo
- conciliacao automatica da geracao de caixa

## Sugestao de mensagem para envio

Segue uma sugestao de texto para encaminhar ao cliente:

`Segue a proposta de funcionamento da DFC gerencial no sistema para sua validacao. O objetivo e confirmar a regra de calculo, o saldo inicial, a estrutura das linhas e a consolidacao de ativo e passivo antes da parametrizacao definitiva.`
