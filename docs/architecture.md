# Arquitetura

## Visão geral

O projeto está dividido em cinco fluxos independentes:

1. `fixtures`
2. `classificações`
3. `mapeamento de competições`
4. `mapeamento de equipas`
5. `dados manuais de equipa`

O objetivo desta separação é simples:
- manter o scraping crítico dos fixtures leve e previsível
- evitar acoplamento entre fontes com políticas diferentes
- permitir evolução do site sem scraping live no clique do utilizador

## Fluxos

### 1. Fixtures

Fonte:
- `Sofascore`

Responsabilidade:
- janela pública `D`
- jogos `upcoming`
- resultados `finished`
- metadados base do jogo

Output principal:
- `data/fixtures/latest.json`
- `data/fixtures/days/*.json`

### 2. Classificações

Fonte:
- `Zerozero`

Responsabilidade:
- classificação por competição
- fases, grupos, splits e legendas

Output principal:
- `data/fixtures/standings/<competitionId>.json`

### 3. Mapeamento de competições

Fontes lógicas:
- `Sofascore` como origem canónica das competições no projeto
- `Zerozero` como fonte de classificação e URL operacional
- `FotMob` e `Soccer-Rating` como registo de IDs por competição

Responsabilidade:
- manter o inventário canónico de ligas e competições suportadas
- ligar cada `sofascoreCompetitionId` aos IDs corretos nas fontes secundárias
- consolidar aliases e variantes por fase sem misturar IDs entre plataformas

Output principal:
- `data/competition-source-registry.json`

### 4. Mapeamento de equipas

Fontes lógicas:
- `Sofascore` como origem canónica da equipa no projeto
- `FotMob` como destino para estatística agregada
- `Soccer-Rating` como destino para contexto de equipa

Responsabilidade:
- manter o inventário canónico de equipas
- ligar cada `sofascoreTeamId` aos IDs/slugs corretos nas fontes secundárias
- expor gaps de cobertura antes de qualquer scraping estatístico

Output principal:
- `data/team-source-registry.json`
- `data/team-mapping/latest.json`

### 5. Dados manuais de equipa

Fontes:
- `FotMob`
- `Soccer-Rating`

Responsabilidade:
- capturar HTML manualmente ou em lote controlado
- parse local para JSON normalizado
- alimentar a UI pública através de ficheiros já persistidos

Outputs principais:
- `data/team-stats/fotmob/...`
- `data/team-context/soccer-rating/...`
- `data/match-view/<date>/<fixtureId>.json`

## Ordem correta de evolução

O fluxo correto não é:
- fixtures -> scraping estatístico direto

O fluxo correto é:
- fixtures -> inventário de equipas -> mapeamento -> captura manual -> parse local -> composição opcional

Isto evita dois problemas:
- scraping de equipas sem identidade estável
- JSONs de estatística associados à equipa errada

## Source of truth

### Equipas

O identificador canónico do projeto é:
- `sofascoreTeamId`

O registo mestre é:
- `data/team-source-registry.json`

### Competições

A whitelist curada em código continua a definir:
- que ligas entram nos fixtures
- que ligas justificam cobertura de classificação
- que universo de equipas interessa mapear

O registo mestre complementar é:
- `data/competition-source-registry.json`

## Limitações atuais

O registo de equipas atual nasce do snapshot público de fixtures.  
Isto significa:
- cobre bem as equipas já vistas na janela operacional
- pode ainda não conter a totalidade de uma competição se essa equipa ainda não apareceu na janela

Próximo endurecimento esperado:
- semear ou validar o inventário de equipas também com classificações e páginas de competição, não apenas com fixtures visíveis

## Regra operacional

Enquanto o mapeamento não estiver estável:
- não promover scraping estatístico como fluxo “fechado”
- não confiar em `match_view` como fonte principal da verdade

Primeiro fecha-se:
- inventário
- aliases
- IDs
- slugs

Só depois se escala:
- captura
- parse
- publicação estatística
