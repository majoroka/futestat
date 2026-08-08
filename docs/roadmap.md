# Roadmap

## Fase 1

Objetivo:
- janela deslizante `D-1 ... D+1`
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

## Fase 4

Objetivo:
- enriquecer o separador `Detalhes`

Itens:
- reintroduzir scraping por página individual apenas quando necessário
- estádio, localização, árbitro, ronda e contexto competitivo
- capacidade do estádio e TV em Portugal com nomes de canais quando disponíveis
- odds `1/X/2` no layout principal
- H2H e contexto recente das equipas

## Fase 5

Objetivo:
- estatísticas de equipa

Estado:
- Sprint 8 com match view derivada operacional

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

## Critérios de qualidade antes de avançar

- consistência do output durante vários dias
- contagem de fixtures plausível por data
- ausência de regressões óbvias ao mudar o DOM do site
- estabilidade da política `open / settling / frozen`
