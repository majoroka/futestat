# Futestat

Pipeline local híbrida para `fixtures` de futebol no Sofascore e classificações no Zerozero, com janela deslizante `D-1 ... D+1`, store canónica por dia e snapshot público para o site estático.

## Objetivo desta fase

Esta iteração faz:
- jogos passados de ontem
- jogos de hoje
- jogos futuros de amanhã
- filtro por whitelist de ligas suportadas
- resultados finais para jogos terminados
- exclusão de `live` do snapshot público
- classificações por competição a partir do Zerozero
- saída local em JSON
- painel direito com separadores `Detalhes` e `Classificação`

Ficam explicitamente fora desta fase:
- UI de `live`
- detalhe enriquecido completo por jogo
- lineups completas e eventos in-play
- estatísticas de equipa

Nota de roadmap:
- a camada de estatísticas de equipa continua separada do pipeline principal
- antes de a escalar, o projeto passa por uma fase explícita de inventário e mapeamento de equipas

## Escolhas principais

- Stack: `Node 22 + TypeScript + Playwright`
- Fonte de fixtures: página pública do Sofascore por data, com suplemento por página de competição whitelistada
- Fonte de classificações: páginas públicas de competição do Zerozero
- Timezone do browser de scraping: `UTC`
- Data de referência operacional: `Europe/Lisbon`
- Persistência: store canónica em ficheiros JSON por dia

## Porque esta abordagem

O Sofascore expõe páginas por data, mas algumas ligas ficam escondidas por virtualização ou acordeões fechados. O scraper atual usa a página da data como base e, quando a data de referência é o dia operacional atual, suplementa a janela com páginas de competição whitelistadas para recuperar jogos em falta. Os cartões são classificados em:
- `upcoming`
- `finished`
- `postponed`
- `cancelled`
- `live`

O estado `live` é guardado na store canónica, mas é excluído do snapshot público desta fase.

As classificações deixam de depender do Sofascore. Sempre que a janela pública contém uma competição suportada, o pipeline tenta refrescar a classificação dessa competição a partir do Zerozero e publica-a em ficheiro separado para consumo do site.

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

Documentação principal:
- [Roadmap](./docs/roadmap.md)
- [Arquitetura](./docs/architecture.md)
- [Fluxo Manual de Dados de Equipa](./docs/manual-team-data-pipeline.md)
- [Mapeamento de Equipas](./docs/team-mapping.md)

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
npm run scrape:fixtures -- --reference-date=2026-07-24 --past-days=1 --future-days=1
```

## Variáveis de ambiente

Ver `/.env.example` no repositório.

As mais importantes:
- `FUTESTAT_REFERENCE_DATE`
- `FUTESTAT_PAST_DAYS`
- `FUTESTAT_FUTURE_DAYS`
- `FUTESTAT_ALLOWED_COMPETITION_IDS`
- `FUTESTAT_OUTPUT_DIR`
- `FUTESTAT_MAX_ATTEMPTS_PER_DATE`
- `FUTESTAT_RETRY_DELAY_MS`
- `FUTESTAT_CAPTURE_FAILURE_ARTIFACTS`
- `FUTESTAT_STRUCTURED_LOGS`
- `FUTESTAT_COMPETITION_STANDINGS_ENABLED`
- `FUTESTAT_COMPETITION_STANDINGS_MAX_AGE_HOURS`
- `FUTESTAT_COMPETITION_STANDINGS_OUTPUT_DIR`

Notas:
- `FUTESTAT_MATCH_DETAILS_ENABLED` existe, mas fica desligada por omissão nesta fase
- o fluxo principal usa agora classificações por competição em `data/fixtures/standings/`

## Fluxo manual de equipa

Antes de capturar ou parsear dados de equipa, o passo recomendado passa a ser:
- sincronizar o registo canónico de equipas
- medir cobertura e gaps de mapeamento

Comandos de base:
- `npm run sync:team-source-registry`
- `npm run report:team-mapping`

Os dados de equipa continuam separados do pipeline principal.

Comandos já operacionais:
- `npm run capture:team-page`
- `npm run parse:fotmob-team-stats`
- `npm run parse:soccer-rating-team-context`
- `npm run parse:all-team-pages`
- `npm run validate:team-data`
- `npm run build:match-view -- --fixture-id=<id> --match-date=YYYY-MM-DD`

O `build:match-view` compõe um JSON derivado em `data/match-view/<date>/<fixtureId>.json` a partir de:
- fixture do `Sofascore`
- detalhe persistido do jogo, quando existir
- classificação do `Zerozero`
- estatística agregada do `FotMob`
- contexto de equipa do `Soccer-Rating`

No site estático:
- o painel direito tenta carregar `./match-view/<data>/<fixtureId>.json`
- se o ficheiro existir, usa-o para enriquecer `Detalhes` e `Classificação`
- se não existir, mantém fallback para fixture base e classificação por competição

Regra operacional nova:
- o `match_view` continua útil para UI e testes
- mas a prioridade da fase atual deixa de ser enriquecer `match_view`
- a prioridade passa a ser fechar o inventário e o mapeamento de equipas

## Output local

O scraper grava:
- `data/fixtures/latest.json`
- `data/fixtures/standings/<competitionId>.json`
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
- todos os `finished`, `postponed`, `cancelled` e `upcoming` dentro da whitelist de ligas
- exclusão de `live`

As classificações são publicadas em paralelo, por competição:
- `data/fixtures/standings/<competitionId>.json`

### Filtro de ligas

Por omissão, o projeto publica apenas uma whitelist curada de ligas, identificadas por `uniqueTournament.id` do Sofascore.

Nesta fase inclui:
- `7` UEFA Champions League
- `679` UEFA Europa League
- `17015` UEFA Conference League
- `17` Premier League
- `8` LaLiga
- `23` Serie A
- `35` Bundesliga
- `34` Ligue 1
- `238` Liga Portugal
- `239` Liga Portugal 2
- `17101` Liga 3
- `37` Eredivisie
- `40` Pro League
- `36` Premiership
- `52` Super Lig
- `45` Bundesliga Austria
- `215` Super League Switzerland
- `39` Superliga Denmark
- `20` Eliteserien
- `43` Allsvenskan
- `67` Veikkausliiga
- `47` Ekstraklasa
- `49` Chance Liga
- `152` SuperLiga Romania
- `53` NB I
- `170` HNL
- `210` SuperLiga Serbia
- `211` Nike Liga
- `212` PrvaLiga
- `247` Parva Liga
- `185` Super League Greece
- `218` Premier League Ukraine
- `203` Premier League Russia
- `59` Premier League Israel
- `325` Brasileirao Serie A
- `155` Liga Profesional

Se for necessário alterar sem mexer em código, podes definir:

```bash
FUTESTAT_ALLOWED_COMPETITION_IDS=17,8,23,35
```

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

### Classificações por competição

As classificações ficam em ficheiros separados:
- `data/fixtures/standings/<competitionId>.json`

Nesta fase:
- os fixtures continuam a ser recolhidos no Sofascore
- as classificações são recolhidas apenas no Zerozero
- o site carrega a classificação sob demanda quando o utilizador abre o separador `Classificação`
- se não existir ficheiro para a competição, o painel mostra estado indisponível sem falhar a página

Política operacional desta camada:
- apenas competições presentes na janela pública atual
- cache persistente por `competitionId`
- refresh por idade máxima configurável
- falha numa classificação individual não invalida a run principal de fixtures

### Separador `Detalhes`

O separador `Detalhes` fica propositadamente reduzido nesta fase.

Objetivo atual:
- preservar a estrutura UI do painel direito
- adiar o enriquecimento por página individual para uma fase posterior
- evitar aumentar o risco de bloqueio no Sofascore enquanto a camada de classificações estabiliza

## Regras operacionais

- janela padrão: `D-1 ... D+1`
- `hoje` e datas futuras: `open`
- `ontem`: `settling`
- `D-2` e anteriores: `frozen`

O merge é sempre feito por `sourceEventId`. Um jogo conhecido não é removido só porque deixou de aparecer como `upcoming` numa run tardia do mesmo dia.

## Qualidade e limites

O draft já incorpora algumas decisões de robustez:
- URL por data em vez de clicar no calendário
- suplemento por competição whitelistada para contornar ligas escondidas na página global
- store canónica por dia em vez de substituir o snapshot inteiro
- reconciliação por `sourceEventId`
- normalização de kickoff para `UTC` quando a hora está disponível
- extração de `teamId` a partir dos `img` dos cartões para construir URLs estáveis de logótipo
- exclusão de `live` do snapshot público
- desacoplamento entre fixtures e classificações para reduzir dependência de uma única fonte

Limites atuais:
- depende do DOM atual do Sofascore
- alguns jogos passados podem não expor a hora de kickoff na página da data, pelo que `kickoffAtUtc` pode ficar `null`
- a observabilidade fica local e orientada a ficheiros, não a serviço externo
- a cobertura com HTML real existe apenas para um conjunto inicial de snapshots guardados

## Documentação adicional

- [Arquitetura](./docs/architecture.md)
- [Roadmap](./docs/roadmap.md)
- [Modelo de Dados de Equipa](./docs/team-data-model.md)
- [Fluxo Manual de Dados de Equipa](./docs/manual-team-data-pipeline.md)
- [Mapeamento Campo -> Interface](./docs/ui-field-mapping.md)
- [Operações Manuais de Dados de Equipa](./docs/manual-team-data-operations.md)
- [Contratos de Execução dos Scripts Manuais](./docs/manual-team-data-script-contracts.md)

## Site estático e GitHub Pages

Este repositório inclui um site estático pequeno para publicar:
- resultados de ontem, jogos de hoje e jogos de amanhã
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
2. recompõe automaticamente as `match_view` para os jogos da janela atual
3. inclui também as classificações suportadas a partir do Zerozero dentro do mesmo fluxo local
4. publica a store pública local para o ramo `fixtures-data`

Se preferires separar os passos:

```bash
npm run scrape:fixtures
npm run build:match-views-window
npm run publish:fixtures-data
```

Primeiro comando manual já operacional para estatísticas de equipa:

```bash
npm run capture:team-page -- --source=fotmob --season=2025-2026 --sofascore-team-id=3006 --competition-id=238 --competition-slug=liga-portugal --team-id=9768 --team-slug=sporting-cp --url=https://www.fotmob.com/teams/9768/stats/sporting-cp/teams
npm run parse:fotmob-team-stats -- --input=raw/team-pages/fotmob/2025-2026/238-liga-portugal/9768-sporting-cp.html
```

Estes comandos:
- guardam HTML bruto local em `raw/team-pages/...`
- lêem HTML bruto já guardado localmente
- normaliza `team_stats_season.json` em `data/team-stats/fotmob/...`
- atualizam os índices `raw/team-pages/manifest.json` e `data/team-stats/fotmob/index.json`
- quando `--sofascore-team-id` é fornecido, deixam também uma ligação canónica para casar a equipa no `match_view` sem depender apenas do slug

O segundo parser manual já operacional é:

```bash
npm run parse:soccer-rating-team-context -- --input=raw/team-pages/soccer-rating/2025-2026/portugal/1076-benfica-lisboa.html
```

Este comando:
- normaliza `team_context.json` em `data/team-context/soccer-rating/...`
- atualiza o índice `data/team-context/soccer-rating/index.json`

Comandos agregadores já operacionais:

```bash
npm run parse:all-team-pages
npm run validate:team-data
npm run report:team-coverage
npm run sync:team-source-registry
```

Estes comandos:
- processam em lote as capturas registadas em `raw/team-pages/manifest.json`
- reconstroem os JSON normalizados das duas fontes
- validam manifestos, paths e campos mínimos antes de build/deploy
- medem a cobertura das equipas presentes no snapshot atual e mostram o que ainda falta captar por fonte
- sincronizam um registo canónico de equipas/fontes em `data/team-source-registry.json`, preservando mapeamentos manuais já preenchidos

Nota técnica:
- `data/fixtures/` fica ignorado no `main`
- o ramo `fixtures-data` recebe apenas dados gerados
- o deploy do Pages lê sempre o snapshot mais recente desse ramo
- se o scrape local falhar e devolver zero fixtures em todas as datas, a run falha e não publica um snapshot vazio
- cada data pode ser reintentada várias vezes antes de falhar a run inteira
- em caso de bloqueio, a run grava logs estruturados e artefactos opcionais de diagnóstico
- o refresh das classificações é conservador e não falha a run principal se uma competição individual der erro

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
