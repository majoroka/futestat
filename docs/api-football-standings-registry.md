# API-FOOTBALL Standings Registry

## Objetivo

Definir a camada lógica que liga cada `sofascoreCompetitionId` da whitelist a uma competição da `API-FOOTBALL`, apenas para classificações da época `2026/2027`.

Este ficheiro não substitui:
- `data/competition-source-registry.json`

Este ficheiro complementa:
- a camada atual de mapeamento de competições
- o pipeline de classificações
- a decisão de provider por competição

## Ficheiro proposto

- `data/competition-api-football-registry.json`

## Regras base

- a chave canónica continua a ser `sofascoreCompetitionId`
- a época operacional é sempre `season = 2026`
- a app nunca consulta a `API-FOOTBALL` diretamente
- o backend/script consulta a API, normaliza e grava JSON local
- a UI continua a ler `data/fixtures/standings/<competitionId>.json`

## Estrutura de topo

```json
{
  "generatedAtUtc": "2026-08-17T12:00:00Z",
  "season": 2026,
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
  "apiFootball": {
    "status": "mapped",
    "sourceCompetitionId": "94",
    "competitionName": "Primeira Liga",
    "countryName": "Portugal",
    "type": "League",
    "season": 2026,
    "current": true,
    "coverage": {
      "standings": true
    },
    "url": null,
    "notes": null
  },
  "standings": {
    "enabled": true,
    "provider": "api-football",
    "mode": "single_table",
    "status": "ready"
  }
}
```

Nota:
- os exemplos deste documento mostram a forma final esperada do ficheiro
- `sourceCompetitionId` da `API-FOOTBALL` só deve ser gravado depois de validado com a tua chave e com `GET /leagues?season=2026`
- até essa validação, os exemplos devem ser lidos como estruturais, não como mapeamento fechado

## Campos

Campos canónicos:
- `sofascoreCompetitionId`
- `competitionName`
- `countryName`
- `competitionAliases`
- `countryAliases`

Bloco `apiFootball`:
- `status`
- `sourceCompetitionId`
- `competitionName`
- `countryName`
- `type`
- `season`
- `current`
- `coverage.standings`
- `url`
- `notes`

Bloco `standings`:
- `enabled`
- `provider`
- `mode`
- `status`

## Estados de `apiFootball.status`

- `mapped`
  - competição identificada com segurança e pronta para consumo técnico
- `pending`
  - mapeamento ainda não fechado
- `unsupported`
  - competição conhecida, mas sem `coverage.standings` útil
- `conditional`
  - competição com suporte parcial ou estrutura especial
- `not_applicable`
  - competição fora do âmbito da API nesta fase

## Estados de `standings.status`

- `ready`
  - snapshot já pode alimentar a UI
- `needs_phase_rules`
  - a API devolve dados, mas a leitura por fase/grupo ainda precisa de regra local
- `coverage_off`
  - a competição existe, mas `coverage.standings=false`
- `not_started`
  - época `2026` ainda sem classificação útil
- `unresolved`
  - mapeamento ou resposta ainda por validar

## Modos esperados

- `single_table`
- `regular_plus_playoffs`
- `league_phase`

## Fluxo operacional previsto

1. `GET /leagues?season=2026`
2. resolver a competição da whitelist para `apiFootballLeagueId`
3. validar `coverage.standings`
4. se `true`, chamar `/standings?league=<id>&season=2026`
5. normalizar para o formato interno já usado pela UI
6. guardar em `data/fixtures/standings/<sofascoreCompetitionId>.json`

## Critério de fecho

- todas as 42 competições com estado explícito
- todas as `single_table` em `mapped + ready`
- competições com fases especiais marcadas como `needs_phase_rules` ou `conditional`
- UI sem dependência da origem externa da classificação
