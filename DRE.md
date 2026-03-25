# DRE no TresContas

Este documento descreve somente o DRE: de onde os dados vem, como as linhas sao montadas e quais calculos sao feitos.

## Visao geral

O DRE nao e calculado direto do banco em SQL. O fluxo real e:

1. O arquivo do balancete / movimentacao e importado.
2. O backend grava as movimentacoes mensais em `MonthlyMovement`.
3. Cada linha recebe uma categoria pelo DE-PARA do plano de contas ou pelo CSV importado.
4. O frontend soma as movimentacoes por categoria.
5. O dashboard aplica os calculos finais do DRE.

Na pratica, o DRE depende de:

- `MonthlyMovement.values` com 12 meses
- `MonthlyMovement.category`
- `ChartOfAccounts.report_category`
- mapeamentos DRE globais e por cliente

## Como as categorias entram no sistema

Na importacao, a categoria de cada linha e resolvida nesta ordem:

1. Mapeamento DRE configurado para o codigo da conta
2. Categoria vinda do CSV
3. `report_category` da conta no plano de contas
4. Inferencia por prefixo do codigo da conta, quando o import e DRE

Se o arquivo vier com categoria vazia, o sistema tenta inferir pelo codigo da conta.

Para import DRE, o backend tambem pode converter valores acumulados em valores mensais:

```text
valor_mensal = valor_atual - valor_mes_anterior
```

Quando o import nao e acumulado, os valores entram como estao no arquivo.

## Como o frontend soma as linhas do DRE

No dashboard principal, a soma por categoria segue esta logica:

1. Procura contas configuradas para a categoria
2. Se achar, usa as linhas exatas da configuracao
3. Se nao, tenta descendentes da configuracao
4. Se nao, tenta `movement.category`
5. Se nao, tenta `report_category` do plano de contas

A soma sempre considera apenas as movimentacoes finais de folha, para evitar dupla contagem de contas pai e filho.

## Formula principal do DRE

O calculo principal esta no dashboard e normaliza os sinais com `abs()`:

```text
pos(categoria) = abs(soma_da_categoria)
neg(categoria) = -abs(soma_da_categoria)
```

Isso e feito porque o CSV pode trazer sinais inconsistentes entre categorias.

### Linha a linha

```text
Receita Bruta
recBruta = pos("Receita Bruta")

Deducoes de Vendas
deducoes = neg("Deducoes de Vendas")

Receita Liquida
recLiquida = recBruta + deducoes

Custos das Vendas
custos = neg("Custos das Vendas")

Custos dos Servicos
custosServicos = neg("Custos Dos Servicos")

Lucro Bruto / Lucro Operacional
lucroBruto = recLiquida + custos + custosServicos

Despesas Administrativas
despAdm = neg("Despesas Administrativas")

Despesas Comerciais
despCom = neg("Despesas Comerciais")

Despesas Tributarias
despTrib = neg("Despesas Tributarias")

Resultado de Participacoes Societarias
partSocietarias = pos("Resultado Participacoes Societarias")

Outras Receitas
outrasReceitas = pos("Outras Receitas")

Receitas Financeiras
recFin = pos("Receitas Financeiras")

Despesas Financeiras
despFin = neg("Despesas Financeiras")

LAIR
lair = lucroBruto + despAdm + despCom + despTrib + partSocietarias + outrasReceitas + recFin + despFin

IRPJ e CSLL
irpjCsll = neg("IRPJ e CSLL")

Lucro / Prejuizo Liquido
lucroLiq = lair + irpjCsll

Depreciacao e Amortizacao
depreciacao = neg("Depreciacao e Amortizacao")

Resultado Financeiro
resultFin = recFin + despFin

EBITDA
ebtida = lair + abs(depreciacao) + resultFin
```

## O que cada linha representa na tela

O DRE exibido no dashboard usa estas linhas:

| Linha | Formula |
|---|---|
| Receita Bruta | `recBruta` |
| Deducoes | `deducoes` |
| Receita Liquida | `recLiquida` |
| Custos das Vendas | `custos` |
| Custos dos Servicos | `custosServicos` |
| Lucro Operacional | `lucroBruto` |
| Despesas Administrativas | `despAdm` |
| Despesas Comerciais | `despCom` |
| Despesas Tributarias | `despTrib` |
| Resultado Participacoes Societarias | `partSocietarias` |
| Outras Receitas | `outrasReceitas` |
| Receitas Financeiras | `recFin` |
| Despesas Financeiras | `despFin` |
| LAIR | `lair` |
| IRPJ e CSLL | `irpjCsll` |
| Lucro / Prejuizo Liquido | `lucroLiq` |
| Depreciacao e Amortizacao | `depreciacao` |
| Resultado Financeiro | `resultFin` |
| EBITDA | `ebtida` |

## Indicadores derivados

O dashboard tambem deriva alguns indicadores a partir do DRE:

```text
Custos + Despesas = custos + despAdm + despCom + despTrib + despFin

Margem Bruta = lucroBruto / recLiquida * 100

Margem Liquida = lucroLiq / recBruta * 100

Margem EBITDA = ebtida / recLiquida * 100
```

Quando o denominador e zero, o valor exibido vira zero.

## Cartoes de resumo

Na area superior do dashboard, os cards usam estes valores:

- Receita Bruta = `recBruta`
- Custos + Despesas = `custos + despAdm + despCom + despTrib + despFin`
- Resultado Liquido = `lucroLiq`
- IRPJ / CSLL = `irpjCsll`

## Grafico e distribuicao

O grafico de distribuicao usa os seguintes agregados:

```text
Custo de Venda = abs(custos)
Impostos = abs(deducoes + irpjCsll)
Despesas = abs(despAdm + despCom + despTrib + despFin)
Lucro = max(lucroLiq, 0)
```

Esse grafico nao mostra sinais contabeis puros; ele mostra valores para leitura visual.

## Dashboard mensal

O DRE mensal e recalculado para os 12 meses:

```text
mes 1 -> janeiro
mes 2 -> fevereiro
...
mes 12 -> dezembro
```

Cada mes gera uma estrutura com todas as linhas acima e tambem alimenta:

- linha de margem bruta
- linha de margem liquida
- linha de margem EBITDA
- barras de comparacao mensal

## Implementacao auxiliar / legada

Existe tambem uma calculadora auxiliar em `frontend/src/services/dreCalculationService.ts`.

Ela calcula o DRE com uma logica mais simples e respeita os sinais originais das contas:

```text
recLiquida = recBruta - deducoes
lucroBruto = recLiquida - custos
lair = lucroBruto - despAdm - despCom - despTrib - despOutras + outrasReceitas + recFin - despFin
lucroLiq = lair - irpjCsll
ebtida = lair + depreciacao
```

Essa versao e usada por componentes auxiliares, como a tabela otimizada e alertas de contas sem mapa.

Importante:

- a calculadora principal do dashboard normaliza sinais com `abs()`
- a calculadora auxiliar usa os sinais reais do movimento
- as duas devem ser tratadas com cuidado, porque podem gerar resultados diferentes se o import vier com sinais inconsistentes

## Regras importantes

- O DRE depende do mapeamento do plano de contas.
- Se a categoria estiver errada, a linha sai errada.
- Se o arquivo vier acumulado, o backend converte para delta mensal antes de gravar.
- Se a categoria vier vazia, o sistema tenta inferir pelo codigo da conta.
- O dashboard principal sempre tenta evitar dupla contagem de contas pai e filho.

## Resumo curto

O DRE do TresContas e:

1. importado como movimentacao mensal
2. classificado por categoria
3. somado por linha do demonstrativo
4. convertido em margens, EBITDA e cards derivados

Se voce quiser alterar o DRE, os pontos certos sao:

- `backend/src/controllers/movement.controller.ts`
- `backend/src/controllers/dreMapping.controller.ts`
- `frontend/src/pages/ClientDashboard.tsx`
- `frontend/src/services/dreCalculationService.ts`
