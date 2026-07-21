# Roadmap

## Fase 1

Objetivo:
- scraper de `upcoming fixtures`
- 1 fonte
- output JSON
- execução manual ou agendada

Estado:
- em progresso

Entregáveis:
- CLI funcional
- documentação inicial
- persistência local

## Fase 2

Objetivo:
- endurecer robustez operacional

Itens:
- testes com HTML real
- logs estruturados
- screenshots opcionais por falha
- retries por data
- métricas básicas de scraping

## Fase 3

Objetivo:
- suportar `finished fixtures`

Itens:
- navegação por datas passadas
- parsing de score final
- estado do jogo
- regras anti-duplicação entre runs

## Fase 4

Objetivo:
- enriquecer fixtures

Itens:
- país e competição mais normalizados
- IDs de equipa quando possível
- detalhe de fixture por página individual

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
