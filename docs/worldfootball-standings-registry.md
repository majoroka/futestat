# Worldfootball Standings Registry

## Objetivo

Definir a camada lógica que liga cada `sofascoreCompetitionId` da whitelist à competição equivalente em `worldfootball.net`, apenas para classificações da época `2026/2027`.

Este ficheiro não substitui:
- `data/competition-source-registry.json`

Este ficheiro complementa:
- a camada atual de mapeamento de competições
- o pipeline de classificações
- a decisão de provider por competição

## Ficheiro proposto

- `data/competition-worldfootball-registry.json`

## Regras base

- a chave canónica continua a ser `sofascoreCompetitionId`
- a época operacional continua centrada em `2026/2027`
- a app nunca consulta `worldfootball.net` diretamente
- o backend/script consulta HTML, normaliza e grava JSON local
- a UI continua a ler `data/fixtures/standings/<competitionId>.json`

## Estrutura de topo

```json
{
  "generatedAtUtc": "2026-08-17T12:00:00Z",
  "seasonLabel": "2026/2027",
  "entryCount": 42,
  "entries": []
}
```

## Estrutura por entrada

```json
{
  "sofascoreCompetitionId": "238",
  "competitionName": "Liga Portugal",
  "countryName": "Portugal",
  "competitionAliases": [],
  "countryAliases": [],
  "worldfootball": {
    "status": "mapped",
    "slug": "por-primeira-liga",
    "competitionName": "Primeira Liga",
    "countryName": "Portugal",
    "pathMode": "direct",
    "seasonLabel": "2026/2027",
    "tableUrl": "https://www.worldfootball.net/competition/por-primeira-liga/table/",
    "archiveUrl": "https://www.worldfootball.net/history/por-primeira-liga/",
    "notes": null
  },
  "standings": {
    "enabled": true,
    "provider": "worldfootball",
    "mode": "single_table",
    "status": "ready"
  }
}
```

## Campos

Campos canónicos:
- `sofascoreCompetitionId`
- `competitionName`
- `countryName`
- `competitionAliases`
- `countryAliases`

Bloco `worldfootball`:
- `status`
- `slug`
- `competitionName`
- `countryName`
- `pathMode`
- `seasonLabel`
- `tableUrl`
- `archiveUrl`
- `notes`

Bloco `standings`:
- `enabled`
- `provider`
- `mode`
- `status`

## Estados de `worldfootball.status`

- `mapped`
  - slug fechado e caminho de leitura definido
- `pending`
  - slug ou comportamento ainda por validar
- `unsupported`
  - sem tabela útil para o caso de uso
- `conditional`
  - exige páginas auxiliares, fases separadas ou fallback

## Estados de `standings.status`

- `ready`
  - tabela principal pronta para alimentar a UI
- `needs_phase_rules`
  - a competição existe, mas tem fases/grupos/splits a tratar
- `not_started`
  - época presente sem classificação útil ainda publicada
- `unresolved`
  - mapeamento ou estratégia de parse ainda não fechados

## Modos de caminho (`pathMode`)

- `direct`
  - uma página principal de tabela resolve o caso base
- `multi_phase`
  - a competição tem subfases ou tabelas separadas
- `delicate`
  - a competição exige parser específico ou decisão adicional por época/fase

## Agrupamento lógico atual da whitelist

### `direct`

- `England | Premier League`
- `England | Championship`
- `Spain | LaLiga`
- `Spain | LaLiga 2`
- `Italy | Serie A`
- `Italy | Serie B`
- `Germany | Bundesliga`
- `Germany | 2. Bundesliga`
- `France | Ligue 1`
- `France | Ligue 2`
- `Portugal | Liga Portugal`
- `Portugal | Liga Portugal 2`
- `Netherlands | Eredivisie`
- `Netherlands | Eerste Divisie`
- `Turkey | Super Lig`
- `Norway | Eliteserien`
- `Sweden | Allsvenskan`
- `Poland | Ekstraklasa`
- `Hungary | NB I`
- `Croatia | HNL`
- `Slovenia | PrvaLiga`
- `Ukraine | Premier League`
- `Russia | Premier League`
- `Brazil | Brasileirao Serie A`

### `multi_phase`

- `Portugal | Liga 3`
- `Belgium | Pro League`
- `Scotland | Premiership`
- `Austria | Bundesliga`
- `Switzerland | Super League`
- `Denmark | Superliga`
- `Finland | Veikkausliiga`
- `Czech Republic | Chance Liga`
- `Romania | SuperLiga`
- `Serbia | SuperLiga`
- `Slovakia | Niké Liga`
- `Bulgaria | Parva Liga`
- `Greece | Super League`
- `Israel | Premier League`
- `Argentina | Liga Profesional`

### `delicate`

- `Europe | UEFA Champions League`
- `Europe | UEFA Europa League`
- `Europe | UEFA Conference League`

## Fluxo operacional previsto

1. resolver `sofascoreCompetitionId -> slug`
2. construir a URL de tabela base ou arquivo
3. classificar a competição em `direct`, `multi_phase` ou `delicate`
4. fazer fetch do HTML relevante
5. extrair a(s) tabela(s) da época `2026/2027`
6. normalizar para o formato interno já usado pela UI
7. guardar em `data/fixtures/standings/<sofascoreCompetitionId>.json`

## Critério de fecho

- as 42 competições com estado explícito no registry
- todas as `direct` em `mapped + ready`
- todas as `multi_phase` com estratégia fechada de subfases
- europeias com estratégia explícita, mesmo que fiquem `conditional`
