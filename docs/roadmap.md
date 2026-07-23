# Roadmap

## Fase 1

Objetivo:
- janela deslizante `D-7 ... D+7`
- store canónica por dia
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
- em progresso

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

Em falta nesta fase:
- testes com HTML real do Sofascore
- enriquecer classificação de falhas raras além de `403`
- métricas históricas comparáveis entre runs

## Fase 3

Objetivo:
- melhorar a camada pública dos fixtures

Itens:
- seletor UX dedicado para `passado / hoje / futuro`
- ordenação e filtros de estado
- tratamento visual de `postponed` e `cancelled`
- detalhe de fixture na coluna direita

## Fase 4

Objetivo:
- enriquecer fixtures

Itens:
- país e competição mais normalizados
- heurísticas para recuperar kickoff em dias passados quando a página da data não o mostra
- enriquecimento a partir da página individual do jogo

## Fase 5

Objetivo:
- estatísticas de equipa

Itens:
- seleção de torneio/época
- extração estruturada por secção
- tratamento de campos opcionais

## Critérios de qualidade antes de avançar

- consistência do output durante vários dias
- contagem de fixtures plausível por data
- ausência de regressões óbvias ao mudar o DOM do site
- estabilidade da política `open / settling / frozen`
