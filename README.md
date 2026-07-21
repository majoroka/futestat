# Futestat

1.º draft de um scraper de `fixtures` focado em jogos de futebol `upcoming` no Sofascore.

## Objetivo desta fase

Esta primeira iteração faz apenas:
- `fixtures` de futebol
- estado `upcoming`
- intervalo configurável de datas
- saída local em JSON

Ficam explicitamente fora desta fase:
- `live`
- `finished`
- estatísticas de equipa
- odds, eventos in-play, lineups ou detalhe de jogo

## Escolhas principais

- Stack: `Node 22 + TypeScript + Playwright`
- Fonte: página pública do Sofascore por data, via URL direta `https://www.sofascore.com/football/YYYY-MM-DD`
- Timezone do browser: `UTC`
- Persistência: ficheiros JSON versionados localmente

## Porque esta abordagem

O Sofascore expõe páginas por data e isso é mais robusto do que depender do seletor com setas ou de uma API interna sujeita a `403`. O draft atual usa browser automation apenas para renderizar a página, aplicar o filtro `Upcoming` e extrair os cartões principais de jogo.

## Estrutura

```text
src/
  application/
  config/
  domain/
  infrastructure/
  lib/
test/
docs/
```

## Instalação

```bash
npm install
npx playwright install chromium
```

## Execução

```bash
npm run scrape:fixtures
```

Com argumentos:

```bash
npm run scrape:fixtures -- --from=2026-07-21 --days-ahead=3 --include-today=true
```

## Variáveis de ambiente

Ver `/.env.example` no repositório.

As mais importantes:
- `FUTESTAT_FROM_DATE`
- `FUTESTAT_DAYS_AHEAD`
- `FUTESTAT_INCLUDE_TODAY`
- `FUTESTAT_OUTPUT_DIR`

## Output

O scraper grava:
- `data/fixtures/latest.json`
- `data/fixtures/runs/fixtures-<timestamp>.json`

Exemplo resumido:

```json
{
  "source": "sofascore",
  "status": "upcoming",
  "datesScraped": ["2026-07-21", "2026-07-22", "2026-07-23", "2026-07-24"],
  "fixtureCount": 42,
  "fixtures": [
    {
      "sourceEventId": "16350227",
      "kickoffAtUtc": "2026-07-21T17:00:00.000Z",
      "competitionName": "UEFA Champions League, Qualification",
      "countryName": "Europe",
      "homeTeamName": "Ararat-Armenia",
      "awayTeamName": "Shamrock Rovers",
      "matchUrl": "https://www.sofascore.com/football/match/fc-ararat-armenia-shamrock-rovers/CnbsEUec#id:16350227"
    }
  ]
}
```

## Qualidade e limites

O draft já incorpora algumas decisões de robustez:
- URL por data em vez de clicar no calendário
- deduplicação por `sourceEventId`
- normalização de kickoff para `UTC`
- filtragem de cartões reais de agenda (`event-hl-*`)
- exclusão de jogos live/finished pelo estado visual do cartão

Limites atuais:
- depende do DOM atual do Sofascore
- o filtro `Upcoming` continua a ser UI-driven
- não há retries avançados nem observabilidade externa
- ainda não há cobertura de regressão com HTML fixtures reais

## Documentação adicional

- [Arquitetura](./docs/architecture.md)
- [Roadmap](./docs/roadmap.md)

## Site estático e GitHub Pages

Este repositório inclui um site estático pequeno para publicar:
- snapshot atual de `upcoming fixtures`
- resumo do projeto
- documentação HTML derivada dos ficheiros em `docs/`

Build local do site:

```bash
npm run build:site
```

O output é gerado em `dist/`.

Para GitHub Pages, existe um workflow em `.github/workflows/deploy-pages.yml` que:
1. instala dependências
2. corre `npm run build:site`
3. publica o artefacto estático em Pages

Nota operacional:
- o site publica o snapshot presente em `data/fixtures/latest.json`
- para atualizar os fixtures visíveis no Pages, é preciso regenerar esse ficheiro e commitar a nova versão
