# Roadmap

## Fase 1

Objetivo:
- janela operacional `D`
- store canónica por dia
- filtro por ligas suportadas
- snapshot público sem `live`
- site estático com resultados passados e jogos futuros

Estado:
- base operacional estabilizada

Entregáveis atuais:
- CLI funcional
- scraping por data via Playwright
- reconciliação por `sourceEventId`
- days store em `data/fixtures/days/`
- snapshot público em `data/fixtures/latest.json`
- separação entre `main` e ramo dedicado `fixtures-data`
- publish local da store para `fixtures-data`

## Fase 2

Objetivo:
- endurecer robustez operacional

Estado:
- fechada na base atual de operação manual

Itens:
- testes com HTML real
- logs estruturados
- screenshots opcionais por falha
- retries por data
- métricas básicas de scraping

Entregáveis já introduzidos:
- retries por data com limite configurável
- logs estruturados da run e por tentativa
- screenshots/HTML opcionais quando a página falha por bloqueio
- ficheiro de métricas por run em `data/fixtures/runs/`
- suplemento por páginas de competição para recuperar ligas ausentes na página global

Pendências residuais:
- enriquecer classificação de falhas raras além de `403`
- métricas históricas comparáveis entre runs

## Fase 3

Objetivo:
- melhorar a camada pública dos fixtures

Estado:
- em curso

Entregáveis já introduzidos:
- painel direito com detalhe base do jogo
- separadores `Detalhes` e `Classificação`
- carregamento sob demanda da classificação por competição
- classificação desacoplada do Sofascore e servida a partir do Zerozero
- consumo opcional de `match_view.json` no painel público quando a vista derivada existe
- refinamento visual do separador `Detalhes` com cartões de contexto e painéis comparativos por equipa
- odds `1/X/2` na coluna esquerda quando a `match_view` existe
- tratamento visual de `postponed` e `cancelled` nos cards de fixtures
- refresh local com recomposição em lote de `match_view` e publicação conjunta no ramo `fixtures-data`
- fallback visual mais limpo quando ainda não existe `match_view` e renderização condicional dos campos reais no separador `Detalhes`
- contexto competitivo no separador `Detalhes` com H2H curto, eliminatória e momento recente das equipas
- separador `Classificação` com mais colunas, destaque forte das equipas do jogo, zonas coloridas e legenda de contexto quando existe regra local
- regras de zonas/classificação extraídas para configuração dedicada, preparadas para crescer por competição sem mexer no renderer
- snapshot de classificações enriquecida com `phaseName`, `phaseNotes` e `ruleProfileId` a partir das regras do `Zerozero`
- zonas e legendas da classificação agora conscientes da fase (`ruleProfileId`), incluindo ajustes específicos para UEFA fase-liga e grupos da Argentina
- regras por competição refinadas para ligas com splits e playoffs, com distinção visual entre fase regular, grupo do campeão, grupo europeu e manutenção quando aplicável
- classificação com UX melhorada para múltiplas tabelas, destacando automaticamente a tabela do jogo e recolhendo as restantes num bloco secundário
- separador `Detalhes` com melhor hierarquia visual, leitura rápida no topo e painéis-resumo por equipa reaproveitados na vista pública
- separador `Estatísticas` aberto na UI pública com comparação casa/fora a partir dos dados já existentes no `match_view`
- separador `Plantel` aberto na UI pública com elencos por equipa a partir do bloco `squad` já presente na `match_view`
- separador `Histórico` aberto na UI pública com jogos recentes por equipa a partir do bloco `history` já presente na `match_view`
- shell visual transversal dos separadores reforçado, com introduções consistentes, estados vazios reutilizáveis e navegação mais robusta em mobile
- separador `Detalhes` consolidado com menos redundância entre highlights e cartões, e melhor separação entre contexto competitivo, cobertura e estado operacional
- cartões internos do `Detalhes` e painéis de equipa afinados com hierarquia tipográfica mais clara e densidade visual mais controlada
- separadores `Estatísticas`, `Plantel` e `Histórico` alinhados visualmente com cabeçalhos, listas e leitura mobile mais consistentes
- estados de loading, indisponibilidade e links externos unificados no painel direito, com micro-UX mais consistente entre separadores
- separador `Classificação` refinado com meta em chips, legenda/notas tituladas e acordeão de tabelas secundárias mais claro
- revisão transversal de consistência dos subtítulos e headings internos do painel, aproximando todos os separadores da mesma linguagem visual

Pendências desta fase:
- seletor UX dedicado para `passado / hoje / futuro`
- ordenação e filtros de estado
- afinação visual dos novos blocos do painel
- consolidar o conteúdo final do separador `Detalhes` após a fase atual
- planear a migração da camada de classificações de `Zerozero` para `worldfootball.net`, preservando o output JSON atual para a UI

## Fase 4

Objetivo:
- enriquecer o separador `Detalhes`

Itens:
- reintroduzir scraping por página individual apenas quando necessário
- estádio, localização, árbitro, ronda e contexto competitivo
- capacidade do estádio e TV em Portugal com nomes de canais quando disponíveis
- odds `1/X/2` no layout principal
- H2H e contexto recente das equipas

## Fase 4A

Objetivo:
- reorientar as classificações para `worldfootball.net` na época `2026/2027`

Princípios:
- usar `worldfootball.net` como fonte principal das classificações
- manter `Sofascore` como chave canónica de competição via `sofascoreCompetitionId`
- consumir apenas a época `2026/2027`
- guardar snapshots locais por competição e servir sempre a UI a partir de JSON local
- evitar chamadas diretas da app/browser a serviços externos

Entregáveis previstos:
- `competition-worldfootball-registry.json` como registo dedicado da camada de classificações
- mapeamento `sofascoreCompetitionId -> worldfootball slug`
- classificação por estado `direct`, `multi_phase` e `delicate`
- refresh manual de classificações via `worldfootball.net`
- persistência em `data/fixtures/standings/<competitionId>.json`
- adaptação do pipeline de standings para aceitar `provider=worldfootball`
- política de estados `mapped`, `pending`, `unsupported`, `conditional`
- política de estados finais `ready`, `needs_phase_rules`, `not_started`, `unresolved`

Checklist operacional:
- resolver as 42 competições da whitelist para `slug`
- classificar cada competição em `direct`, `multi_phase` ou `delicate`
- construir URLs base de `table`, `archive` ou fase auxiliar por competição
- fazer fetch do HTML relevante da época `2026/2027`
- extrair a tabela principal ou as subfases necessárias
- normalizar a resposta para o formato interno já usado pela UI
- preservar `groups[]` quando houver múltiplas tabelas
- guardar logs de refresh por competição, sem bloquear o resto da run
- manter o renderer da UI desacoplado da fonte externa

Prioridade 1:
- fechar primeiro todas as competições com `single_table` e comportamento `direct`
- objetivo: `mapped + ready`
- competições alvo:
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

Prioridade 2:
- tratar competições com `regular_plus_playoffs` e comportamento `multi_phase`
- objetivo: `mapped + needs_phase_rules`
- competições alvo:
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

Prioridade 3:
- avaliar e integrar competições europeias
- objetivo: `mapped + needs_phase_rules`
- competições alvo:
- `Europe | UEFA Champions League`
- `Europe | UEFA Europa League`
- `Europe | UEFA Conference League`

Riscos conhecidos:
- algumas ligas expõem subfases em URLs ou blocos separados
- algumas provas podem devolver grupos/fases sem equivalência direta com a UI atual
- ligas europeias e qualificações podem exigir parser específico por fase
- o HTML pode mudar e exigir ajustes localizados de parser

Critério de fecho desta subfase:
- todas as 42 competições com estado explícito no registry
- todas as competições `direct` consumidas por `worldfootball.net`
- UI a ler o mesmo JSON final sem saber se a origem foi `Zerozero` ou `worldfootball.net`
- `Zerozero` mantido apenas como fallback temporário onde `worldfootball.net` não entregar a classificação necessária

## Fase 5

Objetivo:
- fechar a base de equipas antes de escalar estatísticas

Estado:
- em reorientação arquitetural

### Fase 5A

Objetivo:
- inventário canónico de equipas por competição
- mapeamento estável entre `Sofascore`, `FotMob` e `Soccer-Rating`

Entregáveis desta subfase:
- `competition-source-registry.json` como registo mestre das competições e IDs cruzados entre plataformas
- `team-source-registry.json` como registo mestre
- relatório `team-inventory` por competição a partir da whitelist e das standings locais
- relatório `team-mapping` por competição
- workflow documental claro para revisão manual dos casos pendentes
- definição formal de `complete`, `partial` e `missing`

Pendências desta subfase:
- garantir cobertura por competição para além da janela atual de fixtures
- introduzir semeadura do inventário com classificações e páginas de competição
- reduzir aliases ambíguos antes de ampliar capturas
- depois de fechar toda a whitelist em `FotMob` e `Soccer-Rating`, avaliar uma camada explícita de mapeamento `Zerozero` por equipa, separada do mapeamento por competição já usado nas classificações

### Ligas alvo para fecho do mapeamento

Regra operacional:
- tratar uma competição de cada vez até ficar `completa`
- só depois avançar para a seguinte
- sempre que houver variantes de nome no registo, normalizar depois da competição ficar fechada

#### Fechadas

- `Argentina | Liga Profesional`
- `Brasil | Brasileirão Betano`
- `Bulgária | Parva Liga`
- `Croácia | HNL`
- `Áustria | Bundesliga`
- `Alemanha | Bundesliga`
- `Bélgica | Pro League`
- `Dinamarca | Superliga`
- `Alemanha | 2. Bundesliga`
- `Inglaterra | Premier League`
- `Inglaterra | Championship`
- `Noruega | Eliteserien`
- `Países Baixos | Eerste Divisie`
- `Portugal | Liga Portugal`
- `Portugal | Liga Portugal 2`
- `Portugal | Liga Portugal Betclic`
- `Portugal | Liga 3, Group A`
- `Portugal | Liga 3, Group B`
- `Roménia | SuperLiga`
- `Rússia | Premier League`
- `Eslováquia | Niké Liga`
- `Eslovénia | PrvaLiga`
- `Espanha | LaLiga 2`
- `Suíça | Super League`
- `Ucrânia | Premier League`

#### Em curso

- `Chéquia | Chance Liga`

#### Por semear ou mapear

- `Europa | UEFA Champions League`
- `Europa | UEFA Europa League`
- `Europa | UEFA Conference League`
- `Finlândia | Veikkausliiga`
- `França | Ligue 1`
- `França | Ligue 2`
- `Grécia | Super League`
- `Hungria | NB I`
- `Israel | Premier League`
- `Itália | Serie A`
- `Itália | Serie B`
- `Países Baixos | Eredivisie`
- `Polónia | Ekstraklasa`
- `Escócia | Premiership`
- `Sérvia | SuperLiga`
- `Espanha | LaLiga`
- `Suécia | Allsvenskan`
- `Turquia | Super Lig`

#### Notas de limpeza futura

- consolidar `Liga Profesional` e fases sazonais/segmentos (`Apertura`, `Clausura`) sem perder contexto competitivo

### Fase 5B

Objetivo:
- estatísticas de equipa em cima do mapeamento estável

Itens:
- modelação baseada em `2025/2026` para cobrir o caso completo
- suporte explícito a `2026/2027` parcial ou ainda não iniciada
- pipeline manual offline separado por fonte
- estrutura final de pastas e comandos manuais fixada antes da implementação
- contratos de execucao e manifestos definidos antes dos scripts
- `FotMob` para estatística agregada
- `Soccer-Rating` para contexto de equipa
- extração estruturada por secção
- tratamento de campos opcionais e estados de disponibilidade

Entregáveis já introduzidos:
- comando manual `capture:team-page`
- comando manual `parse:fotmob-team-stats`
- comando manual `parse:soccer-rating-team-context`
- comando agregador `parse:all-team-pages`
- comando agregador `validate:team-data`
- comando derivado `build:match-view`
- manifesto `raw/team-pages/manifest.json`
- normalização de `team_stats_season.json` a partir de HTML bruto local
- normalização de `team_context.json` a partir de HTML bruto local
- manifesto `data/team-stats/fotmob/index.json`
- manifesto `data/team-context/soccer-rating/index.json`
- manifesto `data/match-view/index.json`
- validação mínima cruzada entre manifestos, HTML bruto e JSON normalizados
- deteção inicial de estados `not_started`, `partial`, `available`, `unavailable` e `archived`
- composição derivada `match_view.json` a partir de fixture, detalhe, classificação e dados manuais de equipa
- ligação opcional por `sofascoreTeamId` nos dados manuais para resolver equipas no `match_view` com menos dependência de slugs aproximados
- relatório `team-coverage` para medir a cobertura real das equipas do snapshot por fonte manual
- registo `team-source-registry.json` para preservar o mapeamento canónico das equipas entre `Sofascore`, `FotMob` e `Soccer-Rating`
- autofill conservador desse registo por pesquisa remota, mantendo revisão manual apenas para casos ambíguos
- captura manual em lote de HTML por fonte a partir do registo canónico, para escalar a recolha sem captura equipa a equipa
- relatório `team-mapping` para acompanhar o fecho do mapeamento antes de crescer a camada estatística

Decisão atual:
- não avançar primeiro pelo enriquecimento visual ou estatístico
- priorizar o fecho do mapeamento das equipas
- só depois consolidar a camada pública de estatísticas

## Critérios de qualidade antes de avançar

- consistência do output durante vários dias
- contagem de fixtures plausível por data
- ausência de regressões óbvias ao mudar o DOM do site
- estabilidade da política `open / settling / frozen`
