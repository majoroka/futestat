# Modelo de Dados de Equipa

## Objetivo

Definir o modelo de dados para enriquecer a interface pública do jogo com:
- visão geral das equipas
- estatísticas agregadas
- plantel
- histórico recente
- classificação

Este modelo é desenhado com base na época **2025/2026** como referência estrutural, porque em **31 de julho de 2026** a época **2026/2027** ainda não começou na maior parte das ligas e muitos campos surgem vazios ou indisponíveis.

Regra principal:
- usar `2025/2026` para desenhar o schema
- usar `2026/2027` para validar estados `partial` ou `not_started`

## Fontes e responsabilidades

### `Sofascore`

Responsabilidade:
- fixtures
- metadados do jogo
- equipas
- competição
- hora/data

Não deve ser usado, nesta fase, para:
- estatística de equipa
- classificação

### `Zerozero`

Responsabilidade:
- classificação por competição

### `FotMob`

Responsabilidade:
- estatística agregada de equipa por competição/época

### `Soccer-Rating`

Responsabilidade:
- rating global da equipa
- rankings nacional/europeu
- forma recente
- prediction/tip
- odds de mercado
- injuries e suspensions
- expected lineup
- plantel
- histórico recente

## Princípio de desenho

Não usar um único ficheiro bruto por fonte.

Usar quatro níveis:
1. `team_stats_season.json`
2. `team_context.json`
3. `competition_standings.json`
4. `match_view.json`

Os três primeiros são ficheiros de dados de origem normalizada.  
O quarto é um ficheiro derivado para consumo direto da interface.

## Estados de disponibilidade

Todos os ficheiros devem incluir:

```json
{
  "availability": {
    "status": "not_started",
    "coverage": "partial",
    "notes": "Epoca ainda sem estatisticas agregadas suficientes."
  }
}
```

Estados permitidos:
- `not_started`
- `partial`
- `available`
- `unavailable`
- `archived`

Significado:
- `not_started`: época ainda sem dados suficientes
- `partial`: há dados, mas incompletos
- `available`: dados normais e utilizáveis
- `unavailable`: a fonte não deu qualquer informação útil
- `archived`: época anterior fechada e estável

## 1. `team_stats_season.json`

Uso na interface:
- cabeçalho do jogo
- aba `ESTATÍSTICAS`

Fonte principal:
- `FotMob`

Granularidade:
- um ficheiro por `equipa + competição + época`

Estrutura:

```json
{
  "team": {
    "id": "8650",
    "name": "Liverpool",
    "slug": "liverpool",
    "country": "England",
    "logoUrl": null
  },
  "competition": {
    "id": "premier-league",
    "name": "Premier League"
  },
  "season": {
    "id": "2026/2027",
    "label": "2026/2027",
    "isCurrent": true
  },
  "source": {
    "provider": "fotmob",
    "url": "https://www.fotmob.com/pt-PT/teams/8650/stats/liverpool/teams",
    "collectedAtUtc": "2026-07-31T10:00:00Z"
  },
  "availability": {
    "status": "partial",
    "coverage": "medium",
    "notes": null
  },
  "overview": {
    "teamRating": null,
    "goalsPerMatch": null,
    "goalsConcededPerMatch": null,
    "averagePossessionPct": null,
    "cleanSheets": null,
    "attendanceAverage": null
  },
  "attack": {
    "xg": null,
    "xgDiff": null,
    "shotsOnTargetPerMatch": null,
    "bigChances": null,
    "bigChancesMissed": null,
    "accuratePassesPerMatch": null,
    "accurateLongBallsPerMatch": null,
    "accurateCrossesPerMatch": null,
    "penaltiesAwarded": null,
    "touchesInOppBoxPerMatch": null,
    "cornersPerMatch": null,
    "setPieceGoals": null
  },
  "defense": {
    "xgConceded": null,
    "interceptionsPerMatch": null,
    "tacklesPerMatch": null,
    "clearancesPerMatch": null,
    "finalThirdRecoveriesPerMatch": null,
    "setPieceGoalsConceded": null,
    "penaltiesConceded": null,
    "savesPerMatch": null
  },
  "discipline": {
    "foulsPerMatch": null,
    "yellowCardsPerMatch": null,
    "redCardsPerMatch": null
  }
}
```

### Campos obrigatórios

- `team.id`
- `team.name`
- `competition.id`
- `competition.name`
- `season.id`
- `season.label`
- `source.provider`
- `source.url`
- `source.collectedAtUtc`
- `availability.status`

### Campos opcionais ou anuláveis

- todas as métricas numéricas
- `logoUrl`
- `availability.notes`

## 2. `team_context.json`

Uso na interface:
- cabeçalho do jogo
- aba `VISÃO GERAL`
- aba `PLANTEL`
- aba `HISTÓRICO`

Fonte principal:
- `Soccer-Rating`

Granularidade:
- um ficheiro por `equipa + época`

Estrutura:

```json
{
  "team": {
    "id": "1076",
    "name": "Benfica Lisboa",
    "slug": "benfica-lisboa",
    "country": "Portugal",
    "logoUrl": null
  },
  "season": {
    "id": "2026/2027",
    "label": "2026/2027",
    "isCurrent": true
  },
  "source": {
    "provider": "soccer-rating",
    "url": "https://www.soccer-rating.com/Benfica-Lisboa/1076/",
    "collectedAtUtc": "2026-07-31T10:00:00Z"
  },
  "availability": {
    "status": "partial",
    "coverage": "medium",
    "notes": null
  },
  "ratings": {
    "overall": 7.8,
    "home": 8.0,
    "away": 7.4
  },
  "rankings": {
    "national": 3,
    "europe": 24
  },
  "form": {
    "last3": ["W", "D", "W"]
  },
  "prediction": {
    "tip": "home_win",
    "tipLabel": "Vitoria da equipa da casa",
    "confidencePct": 75,
    "strengthComparison": "significantly_superior"
  },
  "oddsMarket": {
    "opening1X2": {
      "home": 1.8,
      "draw": 3.5,
      "away": 4.2
    },
    "fair1X2": {
      "home": 1.75,
      "draw": 3.6,
      "away": 4.5
    },
    "movementSummary": "home_odds_down"
  },
  "squadHealth": {
    "injuries": [],
    "suspensions": []
  },
  "expectedLineup": {
    "formation": "4-3-3",
    "averageRating": 7.5,
    "players": []
  },
  "squad": [],
  "recentMatches": [],
  "similarTeams": []
}
```

### Estruturas internas

`squadHealth.injuries[]` e `squadHealth.suspensions[]`

```json
{
  "player": "Joao Silva",
  "status": "injury",
  "description": null
}
```

`expectedLineup.players[]` e `squad[]`

```json
{
  "name": "Rui Silva",
  "position": "GK",
  "age": 29,
  "apps": 24,
  "goals": 0,
  "rating": 7.8
}
```

`recentMatches[]`

```json
{
  "date": "2026-07-12",
  "homeTeam": "FC Exemplo",
  "awayTeam": "Adv A",
  "result": "2-1",
  "odds1X2": {
    "home": 1.9,
    "draw": 3.3,
    "away": 4.1
  },
  "homeRating": 7.4,
  "awayRating": 6.8
}
```

## 3. `competition_standings.json`

Uso na interface:
- aba `CLASSIFICAÇÃO`

Fonte principal:
- `Zerozero`

Granularidade:
- um ficheiro por `competição + época`

Estrutura:

```json
{
  "competition": {
    "id": "238",
    "name": "Liga Portugal",
    "country": "Portugal"
  },
  "season": {
    "id": "2026/2027",
    "label": "2026/2027",
    "isCurrent": true
  },
  "source": {
    "provider": "zerozero",
    "url": "https://www.zerozero.pt/...",
    "collectedAtUtc": "2026-07-31T10:00:00Z"
  },
  "availability": {
    "status": "not_started",
    "coverage": "empty",
    "notes": null
  },
  "tables": [
    {
      "name": "Classificacao",
      "type": "total",
      "rows": []
    }
  ]
}
```

`tables[].rows[]`

```json
{
  "position": 1,
  "teamName": "FC Porto",
  "points": 45,
  "matches": 18,
  "wins": 14,
  "draws": 3,
  "losses": 1,
  "goalsFor": 38,
  "goalsAgainst": 12,
  "goalDifference": "+26"
}
```

## 4. `match_view.json`

Uso na interface:
- ficheiro derivado para consumo direto do painel do jogo

Fonte:
- composição interna de `Sofascore + FotMob + Soccer-Rating + Zerozero`

Estrutura:

```json
{
  "match": {
    "id": "fixture-123",
    "competition": {
      "id": "238",
      "name": "Liga Portugal",
      "country": "Portugal",
      "logoUrl": null
    },
    "season": {
      "id": "2026/2027",
      "label": "2026/2027"
    },
    "kickoffAtUtc": "2026-08-15T18:45:00Z"
  },
  "homeTeam": {
    "identity": {
      "id": "1076",
      "name": "Benfica Lisboa",
      "logoUrl": null
    },
    "headerStats": {
      "overallRating": 7.8,
      "nationalRank": 3,
      "europeRank": 24,
      "formLast3": ["W", "D", "W"],
      "xgFor": 1.6,
      "xgAgainst": 0.9,
      "averagePossessionPct": 54,
      "cleanSheets": 12
    },
    "overview": {},
    "statistics": {},
    "squad": [],
    "history": []
  },
  "awayTeam": {
    "identity": {
      "id": "9999",
      "name": "Equipa B",
      "logoUrl": null
    },
    "headerStats": {
      "overallRating": null,
      "nationalRank": null,
      "europeRank": null,
      "formLast3": [],
      "xgFor": null,
      "xgAgainst": null,
      "averagePossessionPct": null,
      "cleanSheets": null
    },
    "overview": {},
    "statistics": {},
    "squad": [],
    "history": []
  },
  "standings": {
    "available": false,
    "tableName": null,
    "rows": []
  }
}
```

## Mapeamento para a interface

### Cabeçalho do jogo

Campos:
- `match.competition.*`
- `match.kickoffAtUtc`
- `homeTeam.identity.*`
- `awayTeam.identity.*`
- `homeTeam.headerStats.*`
- `awayTeam.headerStats.*`

### Aba `VISÃO GERAL`

Campos:
- `homeTeam.overview`
- `awayTeam.overview`

Origem recomendada:
- `Soccer-Rating`
- com complemento mínimo de `FotMob` no bloco de performance base

### Aba `ESTATÍSTICAS`

Campos:
- `homeTeam.statistics`
- `awayTeam.statistics`

Origem recomendada:
- `FotMob`

### Aba `PLANTEL`

Campos:
- `homeTeam.squad`
- `awayTeam.squad`

Origem recomendada:
- `Soccer-Rating`

### Aba `HISTÓRICO`

Campos:
- `homeTeam.history`
- `awayTeam.history`

Origem recomendada:
- `Soccer-Rating`

### Aba `CLASSIFICAÇÃO`

Campos:
- `standings.*`

Origem recomendada:
- `Zerozero`

## Regras de nulidade

Princípio:
- o campo existe no schema mesmo quando a época atual ainda não disponibiliza o valor
- o valor deve ser `null` ou lista vazia
- a razão funcional vem em `availability.status`

Exemplos:
- época ainda não começou: `availability.status = "not_started"`
- fonte sem bloco nessa página: `availability.status = "unavailable"`
- fonte com parte dos dados: `availability.status = "partial"`

## Conclusão

Este modelo deve ser considerado a base estável para a fase de estatística de equipa.

Próximo passo natural:
- implementar pipelines manuais separados para captura e parse de `FotMob` e `Soccer-Rating`
- manter `Sofascore` e `Zerozero` totalmente independentes desses fluxos
