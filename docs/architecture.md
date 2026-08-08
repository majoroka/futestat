# Arquitetura

## Resumo

O sistema evoluiu de um scraper simples de `upcoming` para uma pipeline pequena, mas já com dois níveis de persistência:
- store canónica por dia
- snapshot público derivado para o site
- classificações por competição em ficheiros próprios
- métricas operacionais por run

Para a futura camada de estatísticas de equipa, a arquitetura prevista é deliberadamente separada:
- `FotMob` e `Soccer-Rating` fora do pipeline principal
- captura manual de HTML
- parse local para JSON
- relatório de cobertura por equipa a partir do snapshot atual
- registo canónico de equipas/fontes mantido a partir do snapshot atual
- composição opcional de um `match_view` derivado

Na operação em GitHub, a persistência fica também separada por ramo:
- `main` para código, UI e documentação
- `fixtures-data` para a store canónica gerada automaticamente

O scraping, porém, deixa de correr no GitHub Actions:
- o Sofascore devolve `403 Forbidden` aos runners do GitHub
- a recolha fiável passa a ser local
- o GitHub fica apenas com a função de publicar o snapshot já recolhido

## Camadas

### `domain`

Define o contrato dos dados:
- `MatchFixture`
- `FixtureDay`
- `PublicFixtureSnapshot`
- estados de fixture e de coleção por dia

### `application`

Coordena o fluxo:
1. calcular a janela `D-1 ... D+1`
2. executar scraping por data
3. filtrar fixtures pela whitelist de `competitionId`
4. reconciliar com a store canónica
5. derivar o snapshot público
6. refrescar classificações das competições presentes na janela pública
7. gravar métricas da run
8. manter a porta aberta para detalhe por jogo, hoje desligado por omissão

### `infrastructure/sofascore`

Contém a integração específica com o Sofascore:
- construção da URL por data
- construção da URL estável por competição a partir do `competitionId`
- automação Playwright
- parsing dos cartões principais de jogos
- derivação de `teamId` e URL de logótipo a partir das imagens
- classificação de estado: `upcoming`, `finished`, `postponed`, `cancelled`, `live`
- retries por data
- deteção explícita de páginas bloqueadas por `403`
- captura opcional de `html/png` para diagnóstico
- suplemento da janela atual por páginas de competição para contornar DOM incompleto, acordeões e virtualização

### `infrastructure/zerozero`

Contém a integração específica com o Zerozero:
- pedido HTTP simples a páginas públicas de competição
- parsing das tabelas `zz-datatable`
- extração de `editionId` e `phaseId`
- normalização de linhas de classificação
- persistência por `competitionId`

### `infrastructure/storage`

Persistência local em JSON:
- `data/fixtures/days/YYYY-MM-DD.json`
- `data/fixtures/latest.json`
- `data/fixtures/standings/<competitionId>.json`
- `data/fixtures/runs/fixtures-window-<timestamp>.json`
- `data/fixtures/runs/fixtures-metrics-<timestamp>.json`
- `data/fixtures/diagnostics/<run>/<date>/attempt-<n>.{html,png}`
- `data/team-coverage/latest.json`
- `data/team-source-registry.json`

Persistência remota automatizada:
- ramo `fixtures-data`
- mesmo esquema `data/fixtures/...`
- publish local para esse ramo via script dedicado

### `config` e `lib`

Contêm:
- parsing de CLI
- resolução da data de referência em `Europe/Lisbon`
- construção da janela deslizante
- whitelist curada de competições suportadas
- utilitários de datas
- logging estruturado da execução

## Decisões técnicas

## 1. Browser scraping em vez de API interna

Motivo:
- a API interna do Sofascore não deve ser assumida como estável
- endpoints diretos podem devolver `403`
- a página por data é um alvo mais previsível

## 2. URL por data em vez de navegação por setas

Motivo:
- menos fragilidade de UI
- menos dependência de animações/estado
- mais fácil de testar e repetir

Padrão usado:
- `https://www.sofascore.com/football/YYYY-MM-DD`

## 2b. Suplemento por competição quando a data de referência é hoje

Motivo:
- algumas ligas não aparecem na página global por data
- certas secções ficam em acordeão fechado
- a virtualização do DOM pode ocultar jogos mais abaixo

Padrão aplicado:
- a página global continua a ser a base
- para a janela operacional atual, o scraper visita também as páginas das ligas whitelistadas
- os fixtures suplementares são agrupados por dia e fundidos por `sourceEventId`

## 3. Browser em `UTC`, referência operacional em `Europe/Lisbon`

Motivo:
- `UTC` simplifica a normalização dos kickoffs quando a hora está visível
- `Europe/Lisbon` define corretamente o “hoje” operacional para o produto

## 4. Store canónica por dia

Motivo:
- evita que jogos do dia desapareçam ao longo do dia quando deixam de estar `upcoming`
- permite reconciliar resultados finais sem substituir a lista inteira
- facilita o `freeze` de datas passadas

## 5. Snapshot público derivado

Motivo:
- a UI não precisa de conhecer a política de reconciliação
- `live` pode ficar fora do produto sem se perder da store canónica
- o GitHub Pages consome um único ficheiro estável

## 6. Separação entre código e dados gerados

Motivo:
- evita conflitos no `main` quando o utilizador faz refresh local e o GitHub Actions faz refresh remoto
- reduz ruído no GitHub Desktop
- mantém o histórico de código limpo de commits automáticos de dados

Padrão aplicado:
- `main` ignora `data/fixtures/`
- o publish local escreve a store canónica em `fixtures-data`
- o workflow de Pages lê o snapshot publicado nesse ramo

## 7. Robustez local antes de automação externa

Motivo:
- o scraping remoto no GitHub Actions deixou de ser fiável por bloqueio `403`
- a execução local é atualmente o ambiente mais estável
- a observabilidade precisava de existir mesmo sem serviço externo

Padrão aplicado:
- retries configuráveis por data
- logs estruturados em `stderr`
- métricas persistidas por run
- artefactos opcionais de falha para inspeção manual

## 8. Separação de responsabilidades entre fontes

Motivo:
- o Sofascore é a melhor fonte atual para agenda e resultados
- o Zerozero é uma fonte mais simples para classificações públicas
- separar responsabilidades reduz impacto quando uma das fontes falha

Padrão aplicado:
- Sofascore apenas para fixtures
- Zerozero apenas para classificações
- ficheiros de classificação persistidos por `competitionId`
- refresh de classificação só para competições presentes na janela pública
- falha numa classificação individual é registada, mas não interrompe a run principal

## 9. Estatísticas de equipa como pipeline offline

Motivo:
- `FotMob` e `Soccer-Rating` acrescentam valor, mas não devem comprometer o pipeline principal
- a recolha manual reduz risco de `403`
- o parse local em HTML guardado permite debugging e repetibilidade

Padrão previsto:
- captura manual da página no browser
- persistência do HTML bruto em disco
- parser local por fonte
- relatório local de cobertura por equipa, cruzando snapshot público com índices manuais
- registo local de mapeamento entre `Sofascore` e fontes manuais, preservado entre janelas
- JSON normalizado por equipa/época
- composição opcional de um `match_view` para a interface

## Política de estados

### Estado do dia

- `open`: hoje e futuro
- `settling`: ontem
- `frozen`: `D-2` e anteriores

### Estado do fixture

- `upcoming`
- `finished`
- `live`
- `postponed`
- `cancelled`
- `unknown`

Nesta fase:
- `live` é guardado na store canónica
- `live` é excluído do snapshot público

## Estratégia de merge

Chave primária:
- `sourceEventId`

Regras principais:
- nunca substituir a lista inteira de um dia por uma única run
- preservar fixtures antigos que não apareçam numa run posterior
- promover `upcoming -> live -> finished`
- manter estados terminais contra regressões pontuais do DOM
- preservar `kickoffAtUtc` conhecido quando a página passada já não o mostra

## Segurança e design

### Princípios já aplicados

- sem credenciais por defeito
- sem scraping autenticado
- sem execução arbitrária remota
- output limitado ao filesystem local
- dependência mínima de terceiros
- dados públicos apenas

### Riscos conhecidos

- mudança de DOM/classe CSS no Sofascore
- banners de consentimento com variações regionais
- widgets editoriais misturados com agenda
- rate limits ou anti-bot no futuro
- páginas passadas sem hora visível de kickoff
- variações de markup entre competições no Zerozero

### Mitigações já aplicadas

- usar URL por data
- filtrar cartões `event-hl-*`
- reconciliar por `sourceEventId`
- separar store canónica de snapshot público
- excluir `live` do produto nesta fase
- abortar a run quando todas as datas devolvem zero fixtures
- reintentar datas bloqueadas antes de declarar falha
- gravar artefactos locais quando o Sofascore devolve página bloqueada
- tratar classificações como camada secundária e opcional

## Evolução natural

Os próximos passos técnicos mais naturais são:
1. testes com snapshots HTML reais
2. retries e observabilidade estruturada
3. classificação mais rica de estados raros
4. enriquecimento do separador `Detalhes`
