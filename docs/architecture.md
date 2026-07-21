# Arquitetura

## Resumo

O sistema foi desenhado para uma primeira fase pequena e auditável:
- um comando CLI
- uma fonte única
- um domínio simples
- persistência local

## Camadas

### `domain`

Define o contrato dos dados que interessam ao produto nesta fase:
- `UpcomingFixture`
- `FixtureSnapshot`

### `application`

Coordena o fluxo:
1. calcular datas
2. executar scraping
3. persistir output

### `infrastructure/sofascore`

Contém a integração específica com o Sofascore:
- construção da URL por data
- automação Playwright
- extração dos cartões principais de fixtures

### `infrastructure/storage`

Persistência local em JSON:
- `latest.json`
- histórico por run

### `config` e `lib`

Contêm parsing de configuração, datas e CLI.

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

## 3. Browser em `UTC`

Motivo:
- elimina ambiguidade na hora dos jogos
- reduz problemas de DST/localização
- simplifica persistência e integrações futuras

## 4. Persistência append-only por run

Motivo:
- auditoria simples
- comparação de runs
- debugging mais fácil

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

### Mitigações previstas

- usar URL por data
- filtrar cartões `event-hl-*`
- validar estado `upcoming` no próprio cartão
- deduplicar por `eventId`
- preparar testes com snapshots HTML no próximo ciclo

## Evolução natural

Quando a fase 1 estabilizar, o próximo passo técnico natural é:
1. extrair HTML fixtures reais para testes de regressão
2. adicionar retries, screenshots e logs estruturados
3. suportar `finished`
4. suportar detalhe por fixture
