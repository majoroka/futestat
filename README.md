# Futestat

Scraper local de `fixtures` de futebol no Sofascore com janela deslizante `D-7 ... D+7`, store canónica por dia e snapshot público para o site estático.

## Objetivo desta fase

Esta iteração faz:
- jogos passados dos últimos `7` dias
- jogos de hoje
- jogos futuros dos próximos `7` dias
- resultados finais para jogos terminados
- exclusão de `live` do snapshot público
- saída local em JSON

Ficam explicitamente fora desta fase:
- UI de `live`
- detalhe aprofundado de jogo
- odds, lineups e eventos in-play
- estatísticas de equipa

## Escolhas principais

- Stack: `Node 22 + TypeScript + Playwright`
- Fonte: página pública do Sofascore por data, via URL direta `https://www.sofascore.com/football/YYYY-MM-DD`
- Timezone do browser de scraping: `UTC`
- Data de referência operacional: `Europe/Lisbon`
- Persistência: store canónica em ficheiros JSON por dia

## Porque esta abordagem

O Sofascore expõe páginas por data e isso é mais robusto do que depender do seletor com setas ou de uma API interna sujeita a `403`. O scraper atual renderiza a página da data e extrai os cartões principais dos jogos, classificando-os em:
- `upcoming`
- `finished`
- `postponed`
- `cancelled`
- `live`

O estado `live` é guardado na store canónica, mas é excluído do snapshot público desta fase.

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
site/
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
npm run scrape:fixtures -- --reference-date=2026-07-21 --past-days=7 --future-days=7
```

## Variáveis de ambiente

Ver `/.env.example` no repositório.

As mais importantes:
- `FUTESTAT_REFERENCE_DATE`
- `FUTESTAT_PAST_DAYS`
- `FUTESTAT_FUTURE_DAYS`
- `FUTESTAT_OUTPUT_DIR`

## Output

O scraper grava:
- `data/fixtures/latest.json`
- `data/fixtures/runs/fixtures-window-<timestamp>.json`
- `data/fixtures/days/YYYY-MM-DD.json`

Nota importante:
- `data/fixtures/days/*.json` faz parte da store canónica e deve ficar versionado no repositório
- se esses ficheiros não existirem no GitHub, o workflow agendado começa sem histórico reconciliado e pode publicar um `latest.json` vazio quando uma run não conseguir extrair cartões

### Store canónica por dia

Cada dia mantém:
- `collectionState`: `open`, `settling` ou `frozen`
- timestamps de primeira e última recolha
- lista de fixtures reconciliados por `sourceEventId`

### Snapshot público

`data/fixtures/latest.json` é derivado da store canónica e contém:
- a janela de datas incluídas
- todos os `finished`, `postponed`, `cancelled` e `upcoming`
- exclusão de `live`

Exemplo resumido:

```json
{
  "source": "sofascore",
  "status": "window",
  "referenceDate": "2026-07-21",
  "datesIncluded": [
    "2026-07-14",
    "2026-07-15",
    "2026-07-16"
  ],
  "fixtureCount": 531,
  "visibleFixtureCount": 528,
  "fixtures": [
    {
      "sourceEventId": "16350227",
      "matchDate": "2026-07-21",
      "kickoffAtUtc": "2026-07-21T16:00:00.000Z",
      "competitionName": "UEFA Champions League, Qualification",
      "countryName": "Europe",
      "homeTeamId": "262229",
      "homeTeamName": "Ararat-Armenia",
      "homeTeamLogoUrl": "https://img.sofascore.com/api/v1/team/262229/image/small",
      "awayTeamId": "5226",
      "awayTeamName": "Shamrock Rovers",
      "awayTeamLogoUrl": "https://img.sofascore.com/api/v1/team/5226/image/small",
      "status": "finished",
      "resultLabel": "FT",
      "homeScore": 2,
      "awayScore": 0
    }
  ]
}
```

## Regras operacionais

- janela padrão: `D-7 ... D+7`
- `hoje` e datas futuras: `open`
- `ontem`: `settling`
- `D-2` e anteriores: `frozen`

O merge é sempre feito por `sourceEventId`. Um jogo conhecido não é removido só porque deixou de aparecer como `upcoming` numa run tardia do mesmo dia.

## Qualidade e limites

O draft já incorpora algumas decisões de robustez:
- URL por data em vez de clicar no calendário
- store canónica por dia em vez de substituir o snapshot inteiro
- reconciliação por `sourceEventId`
- normalização de kickoff para `UTC` quando a hora está disponível
- extração de `teamId` a partir dos `img` dos cartões para construir URLs estáveis de logótipo
- exclusão de `live` do snapshot público

Limites atuais:
- depende do DOM atual do Sofascore
- alguns jogos passados podem não expor a hora de kickoff na página da data, pelo que `kickoffAtUtc` pode ficar `null`
- não há retries avançados nem observabilidade externa
- ainda não há cobertura de regressão com HTML fixtures reais

## Documentação adicional

- [Arquitetura](./docs/architecture.md)
- [Roadmap](./docs/roadmap.md)

## Site estático e GitHub Pages

Este repositório inclui um site estático pequeno para publicar:
- resultados passados e jogos futuros dentro da janela atual
- resumo do projeto
- documentação HTML derivada dos ficheiros em `docs/`

## Automatização

Existe agora um workflow agendado em `.github/workflows/refresh-fixtures.yml` que:
1. instala dependências
2. instala o Chromium do Playwright
3. corre `npm run scrape:fixtures`
4. reconstrói o site com `npm run build:site`
5. faz commit de `data/fixtures` apenas se houver alterações
6. publica o Pages no mesmo workflow

Cadência configurada:
- `03:17`
- `09:17`
- `13:17`
- `17:17`
- `21:17`

Todas as horas acima são em `Europe/Lisbon`.

Motivo da cadência:
- evita o topo da hora, onde o GitHub Actions pode sofrer mais atrasos
- permite apanhar resultados finais ao longo do dia sem suportar `live`
- mantém o dia atual e o dia anterior suficientemente frescos para esta fase

Nota técnica:
- o deploy do Pages é feito no mesmo workflow agendado
- isto evita depender de um `push` feito pelo `GITHUB_TOKEN`, porque esse tipo de push não dispara workflows adicionais normais no GitHub Actions

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
