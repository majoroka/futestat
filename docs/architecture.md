# Arquitetura

## Resumo

O sistema evoluiu de um scraper simples de `upcoming` para uma pipeline pequena, mas já com dois níveis de persistência:
- store canónica por dia
- snapshot público derivado para o site

## Camadas

### `domain`

Define o contrato dos dados:
- `MatchFixture`
- `FixtureDay`
- `PublicFixtureSnapshot`
- estados de fixture e de coleção por dia

### `application`

Coordena o fluxo:
1. calcular a janela `D-7 ... D+7`
2. executar scraping por data
3. reconciliar com a store canónica
4. derivar o snapshot público

### `infrastructure/sofascore`

Contém a integração específica com o Sofascore:
- construção da URL por data
- automação Playwright
- parsing dos cartões principais de jogos
- derivação de `teamId` e URL de logótipo a partir das imagens
- classificação de estado: `upcoming`, `finished`, `postponed`, `cancelled`, `live`

### `infrastructure/storage`

Persistência local em JSON:
- `data/fixtures/days/YYYY-MM-DD.json`
- `data/fixtures/latest.json`
- `data/fixtures/runs/fixtures-window-<timestamp>.json`

### `config` e `lib`

Contêm:
- parsing de CLI
- resolução da data de referência em `Europe/Lisbon`
- construção da janela deslizante
- utilitários de datas

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

### Mitigações já aplicadas

- usar URL por data
- filtrar cartões `event-hl-*`
- reconciliar por `sourceEventId`
- separar store canónica de snapshot público
- excluir `live` do produto nesta fase

## Evolução natural

Os próximos passos técnicos mais naturais são:
1. testes com snapshots HTML reais
2. retries e observabilidade estruturada
3. classificação mais rica de estados raros
4. detalhe por fixture
