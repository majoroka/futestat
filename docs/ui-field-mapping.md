# Mapeamento Campo -> Interface

## Objetivo

Fixar a correspondencia entre os ficheiros de dados normalizados e a interface publica do jogo.

Este documento serve para evitar ambiguidade antes de implementar:
- parsers offline
- composicao do `match_view`
- renderizacao final do painel direito

## Fontes envolvidas

- `Sofascore`: fixture e metadados do jogo
- `FotMob`: estatistica agregada de equipa
- `Soccer-Rating`: contexto de equipa
- `Zerozero`: classificacao

## Regra geral

O frontend do jogo deve preferir ler um ficheiro derivado:
- `match_view.json`

Mas esse ficheiro deve ser montado a partir de:
- `team_stats_season.json`
- `team_context.json`
- `competition_standings.json`
- fixture do `Sofascore`

## Cabecalho do jogo

### Bloco: Liga / Competicao / Pais

Campos:
- `match.competition.logoUrl`
- `match.competition.name`
- `match.competition.country`

Origem:
- fixture do `Sofascore`

Fallback:
- `null` em `logoUrl`
- string simples se faltar pais ou nome

### Bloco: Data e Hora

Campos:
- `match.kickoffAtUtc`

Origem:
- fixture do `Sofascore`

Transformacao:
- formatar para `Europe/Lisbon`

### Bloco: Equipas

Campos:
- `homeTeam.identity.logoUrl`
- `homeTeam.identity.name`
- `awayTeam.identity.name`
- `awayTeam.identity.logoUrl`

Origem:
- fixture do `Sofascore`
- contexto da equipa pode enriquecer `logoUrl` se necessario

### Bloco: Visao Geral das Equipas

#### Rating Geral

Campos:
- `homeTeam.headerStats.overallRating`
- `awayTeam.headerStats.overallRating`

Origem:
- `team_context.ratings.overall`

#### Ranking Nacional / Europeu

Campos:
- `homeTeam.headerStats.nationalRank`
- `homeTeam.headerStats.europeRank`
- `awayTeam.headerStats.nationalRank`
- `awayTeam.headerStats.europeRank`

Origem:
- `team_context.rankings.*`

#### Forma (ultimos 3 jogos)

Campos:
- `homeTeam.headerStats.formLast3`
- `awayTeam.headerStats.formLast3`

Origem:
- `team_context.form.last3`

#### Performance Base

Campos:
- `homeTeam.headerStats.xgFor`
- `homeTeam.headerStats.xgAgainst`
- `homeTeam.headerStats.averagePossessionPct`
- `homeTeam.headerStats.cleanSheets`
- equivalentes `awayTeam.*`

Origem:
- `team_stats_season.attack.xg`
- `team_stats_season.defense.xgConceded`
- `team_stats_season.overview.averagePossessionPct`
- `team_stats_season.overview.cleanSheets`

## Aba `VISAO GERAL`

### Prognostico / Betting Tip

Campos:
- `homeTeam.overview.prediction.tip`
- `homeTeam.overview.prediction.tipLabel`
- `homeTeam.overview.prediction.confidencePct`

Origem:
- `team_context.prediction`

Nota:
- este bloco e centrado no jogo, por isso no `match_view` pode viver fora da equipa se fizer mais sentido

### Comparacao de Forca

Campos:
- `homeTeam.overview.prediction.strengthComparison`

Origem:
- `team_context.prediction.strengthComparison`

### Saude do Plantel

Campos:
- `homeTeam.overview.squadHealth.injuries`
- `homeTeam.overview.squadHealth.suspensions`
- equivalentes `awayTeam.*`

Origem:
- `team_context.squadHealth`

### Expected Lineup

Campos:
- `homeTeam.overview.expectedLineup.formation`
- `homeTeam.overview.expectedLineup.averageRating`
- `homeTeam.overview.expectedLineup.players`
- equivalentes `awayTeam.*`

Origem:
- `team_context.expectedLineup`

### Mercado de Odds

Campos:
- `homeTeam.overview.oddsMarket.opening1X2`
- `homeTeam.overview.oddsMarket.fair1X2`
- `homeTeam.overview.oddsMarket.movementSummary`

Origem:
- `team_context.oddsMarket`

## Aba `ESTATISTICAS`

### Bloco `Metrica Global`

Campos:
- `statistics.overview.goalsPerMatch`
- `statistics.overview.goalsConcededPerMatch`
- `statistics.overview.averagePossessionPct`
- `statistics.overview.attendanceAverage`

Origem:
- `team_stats_season.overview.*`

### Bloco `Ataque`

Campos:
- `statistics.attack.xg`
- `statistics.attack.shotsOnTargetPerMatch`
- `statistics.attack.accuratePassesPerMatch`
- `statistics.attack.accurateCrossesPerMatch`
- `statistics.attack.touchesInOppBoxPerMatch`
- `statistics.attack.setPieceGoals`

Origem:
- `team_stats_season.attack.*`

### Bloco `Defesa`

Campos:
- `statistics.defense.xgConceded`
- `statistics.defense.interceptionsPerMatch`
- `statistics.defense.tacklesPerMatch`
- `statistics.defense.clearancesPerMatch`
- `statistics.defense.finalThirdRecoveriesPerMatch`
- `statistics.defense.savesPerMatch`

Origem:
- `team_stats_season.defense.*`

### Bloco `Disciplina`

Campos:
- `statistics.discipline.foulsPerMatch`
- `statistics.discipline.yellowCardsPerMatch`
- `statistics.discipline.redCardsPerMatch`
- `statistics.discipline.penaltiesConceded`

Origem:
- `team_stats_season.discipline.*`
- `team_stats_season.defense.penaltiesConceded`

## Aba `PLANTEL`

Campos:
- `squad[]`

Por linha:
- `name`
- `position`
- `age`
- `apps`
- `goals`
- `rating`

Origem:
- `team_context.squad`

## Aba `HISTORICO`

Campos:
- `history.recentMatches[]`

Por linha:
- `date`
- `homeTeam`
- `awayTeam`
- `result`
- `odds1X2.home`
- `odds1X2.draw`
- `odds1X2.away`
- `homeRating`
- `awayRating`

Origem:
- `team_context.recentMatches`

## Aba `CLASSIFICACAO`

Campos:
- `standings.available`
- `standings.phaseName`
- `standings.phaseNotes[]`
- `standings.ruleProfileId`
- `standings.tableName`
- `standings.rows[]`

Por linha:
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

Origem:
- `competition_standings.tables[].rows[]`

## Prioridade de fontes

### Prioridade primaria

1. `Sofascore` para jogo e equipas
2. `FotMob` para estatistica agregada
3. `Soccer-Rating` para contexto
4. `Zerozero` para classificacao

### Fallback funcional

Se faltar uma fonte:
- manter a aba
- mostrar estado vazio controlado
- nao quebrar o `match_view`

## Campos que podem vir a `null`

Campos com probabilidade alta de nulidade na epoca `2026/2027`:
- quase todas as metricas `FotMob`
- rankings europeus/nacionais de `Soccer-Rating`
- prediction e odds em jogos ainda distantes
- expected lineup
- classificacao antes do inicio da competicao

Regra:
- manter o campo no schema
- explicar a indisponibilidade com `availability.status`
