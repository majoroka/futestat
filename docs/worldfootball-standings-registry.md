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

## Estratégia por tipo

### 1. `direct`

Objetivo:
- extrair uma tabela principal única da época `2026/2027`

URL base preferida:
- `https://www.worldfootball.net/competition/<slug>/table/`

Fallback:
- `https://www.worldfootball.net/history/<slug>/`
- página de overview/schedule da mesma competição, quando a tabela não estiver ainda ligada diretamente

O que extrair:
- tabela principal da competição
- posição
- equipa
- jogos
- vitórias
- empates
- derrotas
- golos marcados/sofridos
- diferença
- pontos
- eventuais notas de qualificação/despromoção quando presentes

Regra de época:
- preferir sempre a página já resolvida para `2026/2027`
- se a página principal ainda não mostrar tabela mas o arquivo já listar a época, seguir o link dessa época

Resultado esperado:
- `standings.mode = single_table`
- `standings.status = ready`

### 2. `multi_phase`

Objetivo:
- extrair a fase regular e as fases derivadas relevantes

URL de entrada preferida:
- `https://www.worldfootball.net/history/<slug>/`

Motivo:
- o arquivo tende a expor melhor as subfases da época, por exemplo:
  - `Championship`
  - `Relegation`
  - `Europe`
  - `ECL Playoff`
  - `Playoff I`
  - `Playoff II`

Estratégia:
1. abrir o arquivo da competição
2. localizar todas as entradas da época `2026/2027`
3. agrupar:
   - fase regular
   - subfases competitivas
4. decidir qual a tabela principal para a UI
5. guardar as restantes em `groups[]` ou equivalente interno

Regras de leitura:
- a fase regular nunca deve ser perdida
- se existir grupo do campeão, ele deve ser elegível como tabela principal para jogos dessa fase
- se existir grupo de manutenção/despromoção, manter legenda e contexto separados
- se a prova tiver playoff europeu, guardar como tabela secundária

Resultado esperado:
- `standings.mode = regular_plus_playoffs`
- `standings.status = needs_phase_rules`

### 3. `delicate`

Objetivo:
- tratar competições onde a noção de “classificação” muda por fase

Competições esperadas:
- `UEFA Champions League`
- `UEFA Europa League`
- `UEFA Conference League`

URL de entrada preferida:
- `https://www.worldfootball.net/history/<slug>/`

URLs auxiliares possíveis:
- `https://www.worldfootball.net/competition/<slug>/table/`
- páginas específicas de qualificação, quando existirem como competição separada

Estratégia:
1. localizar a época `2026/2027`
2. distinguir:
   - qualification
   - league phase
   - knockout
3. só produzir tabela quando a fase realmente tiver standings
4. evitar fabricar tabela em rondas eliminatórias puras

Regras de decisão:
- `league phase` pode alimentar classificação
- `qualification` pode ficar fora da primeira iteração ou ser marcada como contexto apenas
- `knockout` não deve ser tratado como tabela clássica

Resultado esperado:
- `standings.mode = league_phase`
- `standings.status = needs_phase_rules` ou `unresolved`

## Estratégia de URL por grupo

### Grupo `direct`

Padrão:
- começar por `/competition/<slug>/table/`
- fallback para `/history/<slug>/`

### Grupo `multi_phase`

Padrão:
- começar por `/history/<slug>/`
- identificar entradas separadas da época
- abrir as subpáginas necessárias por fase

### Grupo `delicate`

Padrão:
- começar por `/history/<slug>/`
- distinguir league phase de qualification/knockout antes de qualquer parse final

## Estratégia de normalização

Independentemente da origem HTML:
- uma competição simples deve sair como uma tabela principal única
- uma competição com fases deve preservar múltiplas tabelas
- a UI não deve saber se a classificação veio de `Zerozero` ou `worldfootball.net`

Campos mínimos a normalizar:
- `competition.id`
- `competition.name`
- `competition.country`
- `season.label`
- `source.provider`
- `source.url`
- `availability.status`
- `tables[]`

Para cada tabela:
- `name`
- `type`
- `rows[]`

Para cada linha:
- `position`
- `teamName`
- `points`
- `matches`
- `wins`
- `draws`
- `losses`
- `goalsFor`
- `goalsAgainst`
- `goalDifference`

## Output final proposto

Princípio:
- o output final em `data/fixtures/standings/<competitionId>.json` deve continuar o mais próximo possível do contrato atual
- a UI não deve precisar de distinguir `Zerozero` de `worldfootball.net`
- a principal diferença será apenas `source.provider`

Campos de topo esperados:
- `source`
- `competitionId`
- `competitionName`
- `countryName`
- `worldfootballUrl`
- `mode`
- `status`
- `scrapedAtUtc`
- `editionId`
- `phaseId`
- `phaseName`
- `phaseNotes`
- `ruleProfileId`
- `tables`

Nota:
- quando a origem for `worldfootball.net`, `editionId` e `phaseId` podem ser `null`
- estes campos só devem ser preenchidos se o parser conseguir inferi-los com segurança

### Caso 1: `single_table`

Uso típico:
- ligas do grupo `direct`

```json
{
  "source": "worldfootball",
  "competitionId": "238",
  "competitionName": "Liga Portugal",
  "countryName": "Portugal",
  "worldfootballUrl": "https://www.worldfootball.net/competition/por-primeira-liga/table/",
  "mode": "single_table",
  "status": "ready",
  "scrapedAtUtc": "2026-08-17T12:00:00Z",
  "editionId": null,
  "phaseId": null,
  "phaseName": null,
  "phaseNotes": [],
  "ruleProfileId": "single-table-default",
  "tables": [
    {
      "name": "Table",
      "type": "total",
      "rows": [
        {
          "position": 1,
          "teamName": "Sporting CP",
          "teamUrl": null,
          "points": 6,
          "matches": 2,
          "wins": 2,
          "draws": 0,
          "losses": 0,
          "goalsFor": 5,
          "goalsAgainst": 1,
          "goalDifference": "+4"
        }
      ]
    }
  ]
}
```

### Caso 2: `regular_plus_playoffs`

Uso típico:
- ligas do grupo `multi_phase`

```json
{
  "source": "worldfootball",
  "competitionId": "38",
  "competitionName": "Pro League",
  "countryName": "Belgium",
  "worldfootballUrl": "https://www.worldfootball.net/history/bel-pro-league/",
  "mode": "regular_plus_playoffs",
  "status": "needs_phase_rules",
  "scrapedAtUtc": "2026-08-17T12:00:00Z",
  "editionId": null,
  "phaseId": null,
  "phaseName": "Championship",
  "phaseNotes": [
    "Arquivo da competição contém fase regular e subfases em páginas separadas."
  ],
  "ruleProfileId": "belgium-pro-league-playoffs",
  "tables": [
    {
      "name": "Regular Season",
      "type": "regular",
      "rows": []
    },
    {
      "name": "Championship",
      "type": "championship",
      "rows": []
    },
    {
      "name": "Relegation",
      "type": "relegation",
      "rows": []
    }
  ]
}
```

Regra:
- `tables[0]` não precisa de ser sempre a tabela mostrada por defeito na UI
- a escolha da tabela principal pode continuar a depender da fase do jogo e das `phase rules`

### Caso 3: `league_phase`

Uso típico:
- competições europeias do grupo `delicate`

```json
{
  "source": "worldfootball",
  "competitionId": "7",
  "competitionName": "UEFA Champions League",
  "countryName": "Europe",
  "worldfootballUrl": "https://www.worldfootball.net/history/champions-league/",
  "mode": "league_phase",
  "status": "needs_phase_rules",
  "scrapedAtUtc": "2026-08-17T12:00:00Z",
  "editionId": null,
  "phaseId": null,
  "phaseName": "League Phase",
  "phaseNotes": [
    "Qualification e knockout não devem ser tratados como tabela clássica."
  ],
  "ruleProfileId": "uefa-league-phase",
  "tables": [
    {
      "name": "League Phase",
      "type": "league_phase",
      "rows": []
    }
  ]
}
```

Regra:
- se a competição estiver apenas em `qualification` ou `knockout`, o parser pode optar por:
  - não gerar tabela
  - ou gerar snapshot com `status = needs_phase_rules` e `tables = []`

## Compatibilidade com o contrato atual

Compatibilidade desejada:
- manter `tables[]` e `rows[]` exatamente com a mesma semântica
- manter `mode`, `status`, `phaseName`, `phaseNotes` e `ruleProfileId`
- mudar apenas o provider e a URL de origem

Ponto técnico a rever quando houver código:
- o tipo atual em `src/domain/competition-standings.ts` fixa `source: "zerozero"`
- na implementação, isso deve passar a aceitar pelo menos:
  - `zerozero`
  - `worldfootball`

## Critério de fecho

- as 42 competições com estado explícito no registry
- todas as `direct` em `mapped + ready`
- todas as `multi_phase` com estratégia fechada de subfases
- europeias com estratégia explícita, mesmo que fiquem `conditional`
