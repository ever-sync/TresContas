# Manual DFC

## Objetivo

Este manual explica como a DFC funciona hoje dentro da plataforma TresContas.

Aqui, "DFC" significa uma demonstracao gerencial de fluxo de caixa por cliente, calculada a partir de:

- um plano de contas compartilhado por escritorio
- os movimentos DRE do cliente
- os movimentos patrimoniais do cliente
- a configuracao DFC daquele cliente

Importante:

- o plano de contas e unico por escritorio/accounting
- a configuracao da DFC e por cliente
- os movimentos continuam sendo por cliente

## Onde a DFC fica

Na tela do cliente:

- Aba `DRE`
- Subaba `DFC`

Para a equipe contabil, a DFC tem 2 modos:

- `Visualizacao`
- `Configuracao`

Para o cliente no portal:

- somente leitura

## Como a DFC e alimentada

A DFC depende de 4 blocos de dados.

### 1. Plano de contas compartilhado

O plano de contas e importado uma vez e vale para todos os clientes do mesmo escritorio.

Cada conta pode ter:

- `code`
- `reduced_code`
- `name`
- `type`
- `level`
- `report_type`
- `report_category`

O sistema usa esse plano para:

- identificar contas-titulo elegiveis na configuracao DFC
- enriquecer `reduced_code` na importacao dos movimentos
- reaproveitar `report_category` no DRE quando necessario

### 2. Movimentos DRE do cliente

Os movimentos DRE sao importados por cliente e por ano.

Eles alimentam as linhas da DFC cuja origem e `dre`, por exemplo:

- Resultado Liquido do Exercicio
- Depreciacao e Amortizacao
- Resultado da Venda de Ativo Imobilizado
- Recebimentos por Vendas de Ativo Inv./Imob./Intang.

### 3. Movimentos patrimoniais do cliente

Os movimentos patrimoniais sao importados por cliente e por ano, em formato bruto por conta.

Eles alimentam as linhas da DFC cuja origem e:

- `asset`
- `liability`
- `equity`
- `cash`

### 4. Configuracao DFC do cliente

Cada cliente tem sua propria parametrizacao DFC.

Essa configuracao diz:

- qual linha DFC usa qual conta-titulo
- qual multiplicador aplicar
- se deve incluir as filhas analiticas da conta

## O que e conta-titulo no sistema

A DFC so permite mapear contas-titulo elegiveis.

Hoje o sistema considera uma conta como titulo quando pelo menos uma destas regras e atendida:

- `type = T`
- `type = S`
- `type = TOTAL`
- o tipo contem `SINT`
- o tipo contem `TIT`
- `is_analytic = false`
- a conta possui contas descendentes pelo codigo

Exemplo:

- `01.01` pode ser aceita como titulo se existir `01.01.01`, `01.01.02` etc.

## Fluxo operacional recomendado

### Passo 1. Importar o plano de contas

Importe o plano de contas do escritorio na tela do cliente.

Mesmo entrando por um cliente, o plano salvo passa a ser compartilhado para todos os clientes do mesmo escritorio.

Se o plano foi importado antes da regra nova de conta-titulo, reimporte o arquivo uma vez.

### Passo 2. Importar o DRE do cliente

Importe o balancete DRE do cliente para o ano desejado.

### Passo 3. Importar o patrimonial do cliente

Importe o patrimonial bruto do cliente para o ano desejado.

Para a DFC fechar corretamente, tambem e necessario ter o patrimonial de dezembro do ano anterior.

Exemplo:

- para calcular 2026, a base de abertura vem de dezembro/2025

### Passo 4. Abrir a aba DFC em modo Configuracao

Na DFC do cliente, alterne para `Configuracao`.

Ali voce vera as linhas configuraveis agrupadas por secao.

### Passo 5. Adicionar contas nas linhas

Clique em `Adicionar conta` na linha desejada e escolha uma conta-titulo elegivel.

Para cada mapeamento voce pode definir:

- `Conta-titulo`
- `Multiplicador`
- `Incluir filhas`

### Passo 6. Salvar a configuracao

Ao salvar:

- a configuracao antiga do cliente e substituida
- os novos mapeamentos passam a valer para o relatorio

### Passo 7. Conferir em Visualizacao

Depois de salvar, volte para `Visualizacao` e confira:

- valores por mes
- alertas
- status `Parcial`, se existir

## Como o calculo funciona

## Base anual

A DFC trabalha por ano e calcula 12 colunas, de janeiro a dezembro.

## Regra de acumulacao patrimonial

Para linhas patrimoniais, a base e:

- saldo do mes corrente
- menos saldo de dezembro do ano anterior

Ou seja, nao usa o mes anterior como base.

## Regra de sinal

### Ativo

Para linhas de ativo:

- aumento de saldo gera efeito negativo na DFC
- reducao de saldo gera efeito positivo

### Passivo e patrimonio liquido

Para linhas de passivo e PL:

- aumento de saldo gera efeito positivo na DFC
- reducao de saldo gera efeito negativo

### Linhas DRE

Linhas com origem `dre` usam:

- soma dos movimentos da conta mapeada
- mais as filhas, se `incluir filhas = true`
- multiplicador da linha

## Estrutura da DFC

### Resultado contabil

Linhas configuraveis:

- Resultado Liquido do Exercicio
- Depreciacao e Amortizacao
- Resultado da Venda de Ativo Imobilizado
- Resultado da Equivalencia Patrimonial
- Recebimentos de Lucros e Dividendos de Subsidiarias

Linha derivada:

- `Lucro Ajustado`

Formula:

`Lucro Ajustado = soma das 5 linhas acima`

### Variacao ativo

Linhas configuraveis internas:

- Contas a Receber
- Adiantamentos
- Impostos a Compensar
- Estoques
- Despesas Antecipadas
- Outras Contas a Receber

Linha visivel derivada:

- `Variacao Ativo`

Formula:

`Variacao Ativo = soma das linhas de ativo`

Observacao:

- as sublinhas nao aparecem na tabela final
- elas alimentam a linha consolidada

### Variacao passivo

Linhas configuraveis internas:

- Fornecedores
- Obrigacoes Trabalhistas
- Obrigacoes Tributarias
- Outras Obrigacoes
- Parcelamentos

Linha visivel derivada:

- `Variacao Passivo`

Formula:

`Variacao Passivo = soma das linhas de passivo`

### Resultado operacional

Linha derivada:

- `Resultado Operacional`

Formula:

`Resultado Operacional = Lucro Ajustado + Variacao Ativo + Variacao Passivo`

### Investimentos

Linhas configuraveis:

- Recebimentos por Vendas de Ativo Inv./Imob./Intang.
- Compras de Imobilizado
- Aquisicoes em Investimentos
- Baixa de Ativo Imobilizado

Linha derivada:

- `Resultado de Investimento`

Formula:

`Resultado de Investimento = soma das linhas de investimento`

### Financiamentos

Linhas configuraveis:

- Integralizacao ou Aumento de Capital Social
- Pagamento de Lucros e Dividendos
- Variacao em Emprestimos/Financiamentos
- Dividendos Provisionados a Pagar
- Variacao Emprestimos Pessoas Ligadas PJ/PF

Linha derivada:

- `Resultado Financeiro`

Formula:

`Resultado Financeiro = soma das linhas de financiamento`

### Base de caixa

Linha configuravel interna:

- `Disponibilidades Base`

Essa linha nao aparece no relatorio final, mas e obrigatoria para:

- saldo inicial disponivel
- saldo final disponivel
- conciliacao

### Geracao de caixa

Linhas derivadas:

- Saldo Inicial Disponivel
- Saldo Final Disponivel
- Resultado Geracao de Caixa

Formulas:

- `Saldo Inicial Disponivel = saldo de dezembro do ano anterior das contas mapeadas em Disponibilidades Base`
- `Saldo Final Disponivel = saldo do mes atual dessas mesmas contas`
- `Resultado Geracao de Caixa = Resultado Operacional + Resultado de Investimento + Resultado Financeiro`

## O que significa "Incluir filhas"

Quando `Incluir filhas` esta ligado:

- a DFC soma a conta escolhida
- e tambem soma todas as contas abaixo dela na hierarquia do codigo

Exemplo:

Se a conta configurada for `01.01` e existirem:

- `01.01.01`
- `01.01.02`
- `01.01.03`

o sistema usa as contas filhas no calculo.

## O que significa "Multiplicador"

O multiplicador altera o sinal ou o peso da linha.

Exemplos:

- `1` mantem o valor
- `-1` inverte o sinal

Isso e usado principalmente em linhas como:

- Resultado da Venda de Ativo Imobilizado
- Compras de Imobilizado
- Pagamento de Lucros e Dividendos

## Alertas e warnings da DFC

A DFC pode gerar os seguintes avisos.

### `missing_configuration`

Significa:

- nenhuma linha foi configurada para o cliente

### `missing_prior_year_base`

Significa:

- nao existe patrimonial bruto de dezembro do ano anterior

Efeito:

- a DFC fica `Parcial`
- varias linhas patrimoniais ficam sem base confiavel

### `missing_cash_mapping`

Significa:

- a linha `Disponibilidades Base` nao foi configurada

Efeito:

- nao e possivel calcular saldo inicial/final disponivel corretamente
- a conciliacao nao fecha

### `reconciliation_mismatch`

Significa:

- a geracao de caixa calculada nao bateu com
- `Saldo Final Disponivel - Saldo Inicial Disponivel`

O sistema usa tolerancia de `0,01`.

## Quando a DFC fica "Parcial"

A DFC e marcada como `Parcial` quando:

- falta base patrimonial do ano anterior
- falta configuracao essencial
- alguma linha retorna `null`

## Regras importantes de uso

### 1. O plano e compartilhado por escritorio

Se voce alterar o plano de contas:

- todos os clientes do mesmo escritorio passam a enxergar o mesmo plano

### 2. A configuracao DFC e por cliente

Mesmo com plano compartilhado:

- cada cliente pode ter mapeamentos DFC diferentes

### 3. O patrimonial precisa estar bruto por conta

Nao use patrimonial agregado por secao para a DFC.

A DFC precisa do patrimonial por conta para:

- localizar contas-filhas
- calcular variacao por codigo
- fazer conciliacao de disponibilidades

### 4. Dezembro do ano anterior e obrigatorio para fechamento correto

Sem essa base:

- a DFC ainda pode aparecer
- mas sera parcial

## Problemas comuns

### Problema: "Nenhuma conta-titulo elegivel para esta linha"

Causas provaveis:

- o plano de contas nao foi importado
- o plano foi importado com tipos errados
- as contas nao foram reconhecidas como titulo

Como resolver:

1. reimporte o plano de contas
2. confirme se existem contas pai no codigo
3. confirme se as contas sinteticas estao como `T`, `S`, `TOTAL`, `Sintetica` ou equivalente

### Problema: "Missing cash mapping"

Causa:

- a linha `Disponibilidades Base` ainda nao foi configurada

Como resolver:

1. abra a DFC em `Configuracao`
2. localize a secao `Base de Caixa`
3. configure a linha `Disponibilidades Base`
4. salve

### Problema: DFC parcial

Causa mais comum:

- falta o patrimonial de dezembro do ano anterior

Como resolver:

1. importe o patrimonial do ano atual
2. importe tambem dezembro do ano anterior
3. recalcule a DFC

### Problema: a conciliacao nao fecha

Verifique:

- se `Disponibilidades Base` esta correta
- se as contas de caixa/banco mapeadas sao as contas certas
- se o patrimonial do ano anterior foi importado
- se alguma linha patrimonial foi mapeada com conta errada ou multiplicador invertido

## Visao tecnica resumida

### Backend

Principais pontos:

- configuracao: `GET /api/clients/:clientId/dfc-config`
- salvar configuracao: `PUT /api/clients/:clientId/dfc-config`
- relatorio staff: `GET /api/clients/:clientId/dfc?year=YYYY`
- relatorio portal: `GET /api/client-portal/dfc?year=YYYY`

### Frontend

Na interface, a DFC:

- carrega relatorio
- mostra warnings
- permite configurar contas por linha
- salva a configuracao do cliente
- atualiza a visualizacao apos salvar

## Checklist de implantacao por cliente

Antes de considerar a DFC pronta para um cliente, confira:

- plano de contas compartilhado importado
- DRE do ano importado
- patrimonial do ano importado
- dezembro do ano anterior importado
- linhas principais configuradas
- `Disponibilidades Base` configurada
- conciliacao sem divergencia relevante

## Resumo final

A DFC atual funciona assim:

- o escritorio possui um plano de contas compartilhado
- cada cliente possui seus movimentos e sua configuracao DFC
- a equipe contabil parametriza as linhas por contas-titulo
- o sistema calcula automaticamente os valores e resultados derivados
- o cliente enxerga somente a visualizacao final

Se quiser, o proximo passo pode ser transformar este manual em:

- manual para usuario final
- manual tecnico para o time
- PDF padronizado com logo da TresContas
