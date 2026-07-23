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
- detalhe adicional para um subconjunto conservador de jogos `upcoming`

Ficam explicitamente fora desta fase:
- UI de `live`
- lineups completas e eventos in-play
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
- `FUTESTAT_MAX_ATTEMPTS_PER_DATE`
- `FUTESTAT_RETRY_DELAY_MS`
- `FUTESTAT_CAPTURE_FAILURE_ARTIFACTS`
- `FUTESTAT_STRUCTURED_LOGS`
- `FUTESTAT_MATCH_DETAILS_ENABLED`
- `FUTESTAT_MATCH_DETAILS_MAX_FIXTURES`
- `FUTESTAT_MATCH_DETAILS_MAX_AGE_HOURS`
- `FUTESTAT_MATCH_DETAILS_DELAY_MS`

## Output local

O scraper grava:
- `data/fixtures/latest.json`
- `data/fixtures/details/<sourceEventId>.json`
- `data/fixtures/runs/fixtures-window-<timestamp>.json`
- `data/fixtures/runs/fixtures-metrics-<timestamp>.json`
- `data/fixtures/days/YYYY-MM-DD.json`
- `data/fixtures/diagnostics/<run>/<date>/attempt-<n>.{html,png}` quando houver falhas bloqueantes

Nota importante:
- estes ficheiros existem localmente para testes e builds locais
- no branch `main`, `data/fixtures/` passa a ficar ignorado para evitar conflitos com a automação
- a store canónica persistente publicada passa a viver no ramo dedicado `fixtures-data`

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

### Detalhe por jogo `upcoming`

Os detalhes enriquecidos ficam em ficheiros separados:
- `data/fixtures/details/<sourceEventId>.json`

Nesta fase, o detalhe adicional inclui:
- estádio
- localização
- árbitro
- competição e ronda
- contexto de `two legs`
- jogos anteriores e seguintes das equipas
- histórico `H2H`
- odds `1/X/2` recolhidas para uso posterior na coluna esquerda

Política operacional desta camada:
- apenas jogos `upcoming`
- prioridade a todos os jogos `upcoming` do dia de referência
- depois, subconjunto adicional por proximidade temporal até ao limite configurado
- cache persistente por `sourceEventId`
- refresh por idade máxima e/ou alteração do fixture
- falha num detalhe individual não invalida a run principal de fixtures

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
- a observabilidade fica local e orientada a ficheiros, não a serviço externo
- a cobertura com HTML real existe apenas para um conjunto inicial de snapshots guardados

## Documentação adicional

- [Arquitetura](./docs/architecture.md)
- [Roadmap](./docs/roadmap.md)

## Site estático e GitHub Pages

Este repositório inclui um site estático pequeno para publicar:
- resultados passados e jogos futuros dentro da janela atual
- resumo do projeto
- documentação HTML derivada dos ficheiros em `docs/`

## Operação recomendada

O Sofascore está a bloquear os runners do GitHub Actions com `403 Forbidden`, por isso o scraping não deve correr no GitHub.

Modelo operacional adotado:
- `main` para código, UI e documentação
- `fixtures-data` para a store canónica de fixtures
- scraping e publish feitos localmente
- GitHub Pages construído a partir de `fixtures-data`

Fluxo local recomendado:

```bash
npm run refresh:fixtures-local
```

Este comando:
1. corre `npm run scrape:fixtures`
2. atualiza também o detalhe adicional de jogos `upcoming` dentro do mesmo fluxo local
3. publica a store local para o ramo `fixtures-data`

Se preferires separar os passos:

```bash
npm run scrape:fixtures
npm run publish:fixtures-data
```

Nota técnica:
- `data/fixtures/` fica ignorado no `main`
- o ramo `fixtures-data` recebe apenas dados gerados
- o deploy do Pages lê sempre o snapshot mais recente desse ramo
- se o scrape local falhar e devolver zero fixtures em todas as datas, a run falha e não publica um snapshot vazio
- cada data pode ser reintentada várias vezes antes de falhar a run inteira
- em caso de bloqueio, a run grava logs estruturados e artefactos opcionais de diagnóstico
- o refresh de detalhe adicional é conservador e não falha a run principal se um jogo individual der erro

Build local do site:

```bash
npm run build:site
```

O output é gerado em `dist/`.

Para GitHub Pages, existe um workflow em `.github/workflows/deploy-pages.yml` que:
1. lê o snapshot mais recente a partir de `fixtures-data`
2. corre `npm run build:site`
3. publica o artefacto estático em Pages
4. corre por `push` ao `main`, manualmente, e de hora a hora

## Regra operacional no GitHub Desktop

No `main` deves tratar como versionáveis apenas:
- código
- UI
- documentação

Os ficheiros gerados em `data/fixtures/` deixam de entrar no fluxo normal de commit do `main`.

Isto evita o problema anterior:
- refresh local a mexer nos mesmos JSON
- scraping remoto bloqueado por `403` no GitHub Actions
- conflitos recorrentes em `pull`

Nota operacional:
- o site publica o snapshot presente em `data/fixtures/latest.json`
- para atualizar os fixtures visíveis no Pages, é preciso regenerar esse ficheiro e commitar a nova versão
