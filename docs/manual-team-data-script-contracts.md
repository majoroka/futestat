# Contratos de Execucao dos Scripts Manuais

## Objetivo

Definir o contrato funcional dos futuros scripts da camada manual de:
- captura de paginas
- parse local
- composicao opcional do `match_view`

Este documento fixa:
- nomes finais dos comandos
- argumentos
- outputs
- manifestos auxiliares
- codigos de saida esperados

Nao implementa ainda os scripts.

## Principio

Os scripts devem ser:
- locais
- idempotentes sempre que possivel
- orientados a ficheiros
- desacoplados do pipeline principal

## Scripts previstos

### 1. `capture:team-page`

Uso:
- guardar HTML bruto de uma pagina de `FotMob` ou `Soccer-Rating`

Forma de chamada:

```bash
npm run capture:team-page -- [args]
```

Argumentos obrigatorios:
- `--source=fotmob|soccer-rating`
- `--season=YYYY-YYYY`
- `--team-id=<id>`
- `--team-slug=<slug>`
- `--url=<url>`

Argumentos condicionais:
- `--competition-id=<id>` obrigatório para `fotmob`
- `--competition-slug=<slug>` obrigatório para `fotmob`
- `--country-slug=<slug>` obrigatório para `soccer-rating`

Argumentos opcionais:
- `--force=true|false`
- `--note=<texto>`

Saida principal:
- ficheiro `.html` em `raw/team-pages/...`

Saida secundaria:
- entrada em manifesto de capturas

Comportamento esperado:
- se o ficheiro ja existir e `--force=false`, o script pode recusar sobrescrever
- se `--force=true`, o ficheiro pode ser substituido

### 2. `parse:fotmob-team-stats`

Uso:
- converter HTML bruto do `FotMob` em `team_stats_season.json`

Forma de chamada:

```bash
npm run parse:fotmob-team-stats -- [args]
```

Argumentos obrigatorios:
- `--input=<path-html>`

Argumentos opcionais:
- `--output=<path-json>`
- `--season=YYYY-YYYY`
- `--competition-id=<id>`
- `--competition-slug=<slug>`
- `--team-id=<id>`
- `--team-slug=<slug>`
- `--force=true|false`

Saida principal:
- ficheiro JSON em `data/team-stats/fotmob/...`

Saida secundaria:
- entrada em manifesto de stats

Comportamento esperado:
- se `--output` nao vier, o script deriva o caminho a partir do `input`
- o parser deve escrever sempre JSON valido, mesmo que o estado seja `partial` ou `unavailable`

### 3. `parse:soccer-rating-team-context`

Uso:
- converter HTML bruto do `Soccer-Rating` em `team_context.json`

Forma de chamada:

```bash
npm run parse:soccer-rating-team-context -- [args]
```

Argumentos obrigatorios:
- `--input=<path-html>`

Argumentos opcionais:
- `--output=<path-json>`
- `--season=YYYY-YYYY`
- `--country-slug=<slug>`
- `--team-id=<id>`
- `--team-slug=<slug>`
- `--force=true|false`

Saida principal:
- ficheiro JSON em `data/team-context/soccer-rating/...`

Saida secundaria:
- entrada em manifesto de contextos

### 4. `build:match-view`

Uso:
- compor um `match_view.json` a partir de:
  - fixture `Sofascore`
  - classificacao `Zerozero`
  - team stats `FotMob`
  - team context `Soccer-Rating`

Forma de chamada:

```bash
npm run build:match-view -- [args]
```

Argumentos obrigatorios:
- `--fixture-id=<sourceEventId>`
- `--match-date=YYYY-MM-DD`

Argumentos opcionais:
- `--output=<path-json>`
- `--force=true|false`

Saida principal:
- ficheiro JSON em `data/match-view/<date>/<fixtureId>.json`

## Scripts agregadores opcionais

### `parse:all-team-pages`

Objetivo:
- correr em lote os parsers locais sobre um conjunto de HTMLs ja guardados

Uso recomendado:
- semanal

### `validate:team-data`

Objetivo:
- validar schema minimo
- confirmar presenca de campos obrigatorios
- confirmar coerencia de pastas e nomes

Uso recomendado:
- antes de build/deploy

## Manifestos auxiliares

Os scripts devem atualizar manifestos simples em JSON.

### 1. Manifesto de capturas

Caminho:

```text
raw/team-pages/manifest.json
```

Estrutura:

```json
{
  "generatedAtUtc": "2026-07-31T12:00:00Z",
  "entries": [
    {
      "source": "fotmob",
      "season": "2025-2026",
      "teamId": "9768",
      "teamSlug": "sporting-cp",
      "competitionId": "238",
      "competitionSlug": "liga-portugal",
      "countrySlug": null,
      "url": "https://www.fotmob.com/teams/9768/stats/sporting-cp/teams",
      "htmlPath": "raw/team-pages/fotmob/2025-2026/238-liga-portugal/9768-sporting-cp.html",
      "capturedAtUtc": "2026-07-31T12:00:00Z"
    }
  ]
}
```

### 2. Manifesto de team stats

Caminho:

```text
data/team-stats/fotmob/index.json
```

Estrutura:

```json
{
  "generatedAtUtc": "2026-07-31T12:10:00Z",
  "entries": [
    {
      "season": "2025-2026",
      "competitionId": "238",
      "competitionSlug": "liga-portugal",
      "teamId": "9768",
      "teamSlug": "sporting-cp",
      "jsonPath": "data/team-stats/fotmob/2025-2026/238-liga-portugal/9768-sporting-cp.json",
      "sourceHtmlPath": "raw/team-pages/fotmob/2025-2026/238-liga-portugal/9768-sporting-cp.html",
      "parsedAtUtc": "2026-07-31T12:10:00Z",
      "availabilityStatus": "archived"
    }
  ]
}
```

### 3. Manifesto de team context

Caminho:

```text
data/team-context/soccer-rating/index.json
```

Estrutura:

```json
{
  "generatedAtUtc": "2026-07-31T12:15:00Z",
  "entries": [
    {
      "season": "2025-2026",
      "countrySlug": "portugal",
      "teamId": "1076",
      "teamSlug": "benfica-lisboa",
      "jsonPath": "data/team-context/soccer-rating/2025-2026/portugal/1076-benfica-lisboa.json",
      "sourceHtmlPath": "raw/team-pages/soccer-rating/2025-2026/portugal/1076-benfica-lisboa.html",
      "parsedAtUtc": "2026-07-31T12:15:00Z",
      "availabilityStatus": "archived"
    }
  ]
}
```

### 4. Manifesto de match views

Caminho:

```text
data/match-view/index.json
```

Estrutura:

```json
{
  "generatedAtUtc": "2026-07-31T12:20:00Z",
  "entries": [
    {
      "fixtureId": "16350227",
      "matchDate": "2026-08-15",
      "jsonPath": "data/match-view/2026-08-15/16350227.json",
      "builtAtUtc": "2026-07-31T12:20:00Z"
    }
  ]
}
```

## Codigos de saida esperados

### `0`

Sucesso.

### `1`

Erro funcional:
- HTML invalido
- dados minimos nao encontrados
- ficheiro de input em falta
- fixture inexistente

### `2`

Erro de contrato:
- argumentos obrigatorios em falta
- combinacao invalida de flags
- `source` nao suportado

## Regras minimas de validacao

### Para `capture:team-page`

Validar:
- URL presente
- `source` suportado
- pasta de output derivada corretamente

### Para `parse:fotmob-team-stats`

Validar:
- `team.id`
- `team.name`
- `season.id`
- `source.provider = "fotmob"`
- `availability.status`

### Para `parse:soccer-rating-team-context`

Validar:
- `team.id`
- `team.name`
- `season.id`
- `source.provider = "soccer-rating"`
- `availability.status`

### Para `build:match-view`

Validar:
- fixture encontrado
- equipa da casa resolvida
- equipa de fora resolvida
- output final em JSON valido

## Regras de fallback

### Se faltar `FotMob`

O `match_view` continua valido:
- `statistics` pode ficar vazio ou a `null`

### Se faltar `Soccer-Rating`

O `match_view` continua valido:
- `overview`, `squad` e `history` podem ficar vazios

### Se faltar `Zerozero`

O `match_view` continua valido:
- `standings.available = false`

## Ordem de implementacao recomendada

1. `parse:fotmob-team-stats`
2. `parse:soccer-rating-team-context`
3. `build:match-view`
4. `capture:team-page`
5. `validate:team-data`

Motivo:
- o parsing local e a composicao trazem mais valor imediato
- a captura pode continuar manual numa primeira versao

## Conclusao

Com este contrato, o Sprint seguinte pode focar-se em implementacao real sem reabrir discussoes de:
- nomes
- flags
- caminhos
- manifestos
