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

Pendências desta fase:
- seletor UX dedicado para `passado / hoje / futuro`
- ordenação e filtros de estado
- tratamento visual de `postponed` e `cancelled`
- odds `1/X/2` na coluna esquerda
- afinação visual dos novos blocos do painel
- decidir o conteúdo final do separador `Detalhes`

## Fase 4

Objetivo:
- enriquecer o separador `Detalhes`

Itens:
- reintroduzir scraping por página individual apenas quando necessário
- estádio, localização, árbitro, ronda e contexto competitivo
- odds `1/X/2` no layout principal
- H2H e contexto recente das equipas

## Fase 5

Objetivo:
- estatísticas de equipa

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

## Critérios de qualidade antes de avançar

- consistência do output durante vários dias
- contagem de fixtures plausível por data
- ausência de regressões óbvias ao mudar o DOM do site
- estabilidade da política `open / settling / frozen`
