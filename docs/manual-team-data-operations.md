# Operacoes Manuais de Dados de Equipa

## Objetivo

Fixar a estrutura operacional minima para a futura camada manual de:
- `FotMob`
- `Soccer-Rating`

Este documento fecha as decisoes de:
- pastas
- convenções de nomes
- ordem de execucao
- comandos previstos

Estado atual:
- `autofill:team-source-registry` operacional
- `capture:team-pages-batch` operacional
- `capture:team-page` operacional
- `parse:fotmob-team-stats` operacional
- `parse:soccer-rating-team-context` operacional
- `parse:all-team-pages` operacional
- `validate:team-data` operacional
- `report:team-coverage` operacional
- `report:team-mapping` operacional
- `sync:team-source-registry` operacional
- `build:match-view` operacional

Os contratos finais de argumentos, manifestos e codigos de saida ficam definidos em:
- [Contratos de Execucao dos Scripts Manuais](./manual-team-data-script-contracts.md)

## Regra de separacao

Cada dominio continua isolado:
- `Sofascore` -> fixtures
- `Zerozero` -> classificacoes
- `FotMob` -> team stats
- `Soccer-Rating` -> team context

Antes de qualquer captura manual de equipa, a ordem recomendada passa a ser:
- `sync:team-source-registry`
- `report:team-mapping`

Nao misturar capturas nem outputs entre dominios.

## Estrutura canonica de pastas

### HTML bruto capturado manualmente

```text
raw/
  team-pages/
    fotmob/
      2026-2027/
        238-liga-portugal/
          9768-sporting-cp.html
    soccer-rating/
      2026-2027/
        portugal/
          1076-benfica-lisboa.html
```

### JSON normalizado

```text
data/
  team-stats/
    fotmob/
      2026-2027/
        238-liga-portugal/
          9768-sporting-cp.json
  team-context/
    soccer-rating/
      2026-2027/
        portugal/
          1076-benfica-lisboa.json
  match-view/
    2026-08-15/
      16350227.json
```

## Convencoes de nomes

### Epoca em filesystem

Usar sempre:
- `2026-2027`
- `2026-2027`

Nunca usar barras no nome da pasta.

### `season.label` dentro do JSON

Usar sempre:
- `2025/2026`
- `2026/2027`

### Ficheiro por equipa

Regra:
- `<teamId>-<teamSlug>.html`
- `<teamId>-<teamSlug>.json`

Exemplos:
- `9768-sporting-cp.html`
- `9768-sporting-cp.json`
- `1076-benfica-lisboa.html`
- `1076-benfica-lisboa.json`

### Pasta por competicao no `FotMob`

Regra:
- `<competitionId>-<competitionSlug>`

Exemplos:
- `238-liga-portugal`
- `17-premier-league`
- `7-uefa-champions-league`

### Pasta por pais no `Soccer-Rating`

Regra:
- `<countrySlug>`

Exemplos:
- `portugal`
- `england`
- `spain`

## Convencao de slugs

Todos os slugs devem ser:
- lowercase
- ASCII
- com `-`
- sem espacos
- sem caracteres especiais

Exemplos:
- `sporting-cp`
- `benfica-lisboa`
- `liga-portugal`

## IDs de referencia

### Equipa

Manter o ID nativo da fonte:
- `FotMob`: ID da equipa do FotMob
- `Soccer-Rating`: ID da equipa do Soccer-Rating

Nao assumir que os IDs sao partilhados entre fontes.

Quando existir mapeamento manual confiavel, guardar tambem:
- `sofascoreTeamId`

Uso:
- ligar o HTML/JSON manual a uma equipa concreta dos fixtures
- reduzir ambiguidades de slug e pequenas diferencas de nomenclatura

### Competicao

Para `FotMob`, usar:
- ID da competicao do ecossistema principal do projeto quando existir alinhamento funcional
- se nao existir, usar o identificador mais estavel disponivel no proprio contexto do projeto

### Match view

Usar:
- `sourceEventId` do `Sofascore`

Exemplo:
- `data/match-view/2026-08-15/16350227.json`

## Comandos manuais previstos

Estes comandos sao o contrato desejado para a futura implementacao.

### 1. Captura manual de pagina `FotMob`

```bash
npm run capture:team-page -- \
  --source=fotmob \
  --season=2026-2027 \
  --sofascore-team-id=3006 \
  --competition-id=238 \
  --competition-slug=liga-portugal \
  --team-id=9768 \
  --team-slug=sporting-cp \
  --url="https://www.fotmob.com/teams/9768/stats/sporting-cp/teams"
```

Saida esperada:

```text
raw/team-pages/fotmob/2026-2027/238-liga-portugal/9768-sporting-cp.html
```

### 2. Captura manual de pagina `Soccer-Rating`

```bash
npm run capture:team-page -- \
  --source=soccer-rating \
  --season=2026-2027 \
  --sofascore-team-id=3006 \
  --country-slug=portugal \
  --team-id=1076 \
  --team-slug=benfica-lisboa \
  --url="https://www.soccer-rating.com/Benfica-Lisboa/1076/"
```

Saida esperada:

```text
raw/team-pages/soccer-rating/2026-2027/portugal/1076-benfica-lisboa.html
```

### 3. Parse local de `FotMob`

```bash
npm run parse:fotmob-team-stats -- \
  --sofascore-team-id=3006 \
  --input="raw/team-pages/fotmob/2026-2027/238-liga-portugal/9768-sporting-cp.html"
```

Saida esperada:

```text
data/team-stats/fotmob/2026-2027/238-liga-portugal/9768-sporting-cp.json
```

### 4. Parse local de `Soccer-Rating`

```bash
npm run parse:soccer-rating-team-context -- \
  --sofascore-team-id=3006 \
  --input="raw/team-pages/soccer-rating/2026-2027/portugal/1076-benfica-lisboa.html"
```

Saida esperada:

```text
data/team-context/soccer-rating/2026-2027/portugal/1076-benfica-lisboa.json
```

### 5. Composicao opcional da vista final do jogo

```bash
npm run build:match-view -- \
  --fixture-id=16350227 \
  --match-date=2026-08-15
```

Saida esperada:

```text
data/match-view/2026-08-15/16350227.json
```

### 6. Relatorio de cobertura das equipas da janela atual

```bash
npm run report:team-coverage
```

Saida esperada:
```text
data/team-coverage/latest.json
```

### 7. Relatorio de mapeamento das equipas

```bash
npm run report:team-mapping
```

Saida esperada:
```text
data/team-mapping/latest.json
```

```text
data/team-coverage/latest.json
```

Este comando:
- lê `data/fixtures/latest.json`
- cruza as equipas da janela atual com os índices `FotMob` e `Soccer-Rating`
- mostra que equipas já têm dados manuais e quais ainda precisam de captura por fonte

### 7. Sincronizacao do registo canonico de equipas/fontes

```bash
npm run sync:team-source-registry
```

Saida esperada:

```text
data/team-source-registry.json
```

Este comando:
- lê `data/fixtures/latest.json`
- gera ou atualiza um registo único por equipa do `Sofascore`
- preserva mapeamentos manuais já preenchidos para `FotMob` e `Soccer-Rating`
- acrescenta equipas novas da janela atual com estado `pending`

### 8. Autofill conservador do registo de equipas/fontes

```bash
npm run autofill:team-source-registry
```

Exemplos:

```bash
npm run autofill:team-source-registry -- --source=fotmob --limit=25
npm run autofill:team-source-registry -- --team-id=3006 --dry-run=true
```

Este comando:
- lê `data/team-source-registry.json`
- tenta mapear equipas pendentes por pesquisa remota no `FotMob` e no `Soccer-Rating`
- grava apenas mapeamentos com confiança suficiente
- mantém pendentes os casos ambíguos para revisão manual posterior

Notas operacionais:
- continua a ser um script manual
- usa atrasos entre pedidos para reduzir risco de bloqueio
- se um domínio devolver `403`, a execução falha logo para evitar insistência

### 9. Captura em lote a partir do registo canónico

```bash
npm run capture:team-pages-batch -- --season=2026-2027
```

Exemplos:

```bash
npm run capture:team-pages-batch -- --season=2026-2027 --source=fotmob --only-active=true
npm run capture:team-pages-batch -- --season=2026-2027 --source=soccer-rating --limit=20 --dry-run=true
```

Este comando:
- lê `data/team-source-registry.json`
- seleciona apenas equipas mapeadas nas fontes pedidas
- faz captura sequencial com atraso configurável
- escreve HTML bruto e atualiza `raw/team-pages/manifest.json`

## Ordem manual recomendada

### Fluxo normal

1. `npm run refresh:fixtures-local`
2. o refresh recompõe tambem as `match_view` da janela atual antes de publicar para `fixtures-data`
3. atualizar classificacoes, quando aplicavel
4. capturar paginas `FotMob`
5. capturar paginas `Soccer-Rating`
6. correr `sync:team-source-registry`
7. correr `autofill:team-source-registry`
8. correr `capture:team-pages-batch`
9. correr `parse:all-team-pages`
10. correr `build:match-view` ou `build:match-views-window` quando houver novo HTML/manual data relevante
11. validar localmente
12. fazer deploy quando necessario

## Regras de atualizacao

### `FotMob`

Frequencia esperada:
- semanal

### `Soccer-Rating`

Frequencia esperada:
- semanal
- ou antes de jogos relevantes, se quiseres atualizar prediction/odds/lineup

### `match_view`

Frequencia esperada:
- recomposta automaticamente no `refresh:fixtures-local` para a janela publica
- adicionalmente sob demanda para jogos especificos ou depois de atualizar dados manuais

## Politica de reprocessamento

Reprocessar apenas quando:
- o HTML mudou
- a epoca mudou
- o parser mudou
- a interface passou a usar novos campos

Evitar:
- refazer parse de todo o arquivo sem necessidade

## Ficheiros de indice

Atuais:

```text
data/team-stats/fotmob/index.json
data/team-context/soccer-rating/index.json
data/match-view/index.json
```

Uso:
- listar equipas disponiveis
- listar epocas disponiveis
- saber ultima recolha
- listar match views geradas

## Conclusao

O contrato operacional do fluxo manual fica assim fechado:
- `raw/team-pages/...` para HTML bruto
- `data/team-stats/...` para `FotMob`
- `data/team-context/...` para `Soccer-Rating`
- `data/match-view/...` para composicao derivada

Proximo passo natural:
- ligar `match_view` ao frontend publico
