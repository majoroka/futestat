# Fluxo Manual de Dados de Equipa

## Objetivo

Definir um fluxo manual e robusto para estatísticas e contexto de equipa, sem depender de scraping automático online agressivo.

Este fluxo é separado do pipeline existente de:
- `Sofascore` para fixtures
- `Zerozero` para classificações

E passa agora a assumir explicitamente um pré-requisito:
- mapeamento canónico das equipas antes da captura estatística

## Princípio operacional

Para reduzir risco de bloqueio e de `403`, o fluxo de estatísticas de equipa deve ser separado em camadas:

1. inventário e mapeamento de equipas
2. captura manual do HTML
3. parse local para JSON
4. composição opcional para `match_view`

Ou seja:
- o projeto fecha primeiro `sofascoreTeamId -> fonte secundária`
- o browser humano recolhe a página
- os scripts locais transformam o HTML já guardado em disco
- a UI nunca depende da página remota em tempo real

## Fontes abrangidas

### `FotMob`

Uso:
- estatística agregada por equipa/competição/época

### `Soccer-Rating`

Uso:
- rating global
- rankings
- forma
- tip/prediction
- odds
- injuries
- expected lineup
- plantel
- histórico recente

## Porque não misturar no fluxo principal

Motivos:
- políticas mais restritivas de scraping
- risco acrescido de `403`
- dados menos críticos do que fixtures
- maior probabilidade de falhas parciais por época e por liga

Separação recomendada:
- `fixtures`: fluxo principal já ativo
- `classificações`: fluxo próprio
- `estatísticas de equipa`: fluxo manual offline

## Estrutura recomendada de pastas

Este documento descreve o fluxo.  
As convencoes finais de pastas, ficheiros e comandos ficam definidas em:
- [Operacoes Manuais de Dados de Equipa](./manual-team-data-operations.md)

### Capturas brutas

```text
raw/
  team-pages/
    fotmob/
      2025-2026/
        238-liga-portugal/
          9768-sporting-cp.html
    soccer-rating/
      2025-2026/
        portugal/
          1076-benfica-lisboa.html
```

### Dados normalizados

```text
data/
  team-stats/
    fotmob/
      2025-2026/
        238-liga-portugal/
          9768-sporting-cp.json
  team-context/
    soccer-rating/
      2025-2026/
        portugal/
          1076-benfica-lisboa.json
```

### Ficheiros derivados opcionais

```text
data/
  match-view/
    2026-08-15/
      fixture-123.json
```

## Scripts recomendados

O fluxo pode ser dividido em 2 ou 3 scripts.  
A recomendação é usar 3.

### Script A: `capture-team-pages-manual`

Responsabilidade:
- guardar HTML bruto das páginas abertas manualmente pelo utilizador

Entradas:
- URL
- época
- nome/slug da equipa
- origem (`fotmob` ou `soccer-rating`)

Saída:
- ficheiro `.html` em `raw/...`

Nota:
- este passo pode ser semi-manual
- o objetivo é reduzir ao mínimo o número de pedidos automáticos ao site

### Script B: `parse-fotmob-team-stats-local`

Responsabilidade:
- ler HTML do `FotMob` já guardado
- gerar `team_stats_season.json`

Entradas:
- ficheiro HTML em `raw/fotmob/...`

Saída:
- ficheiro JSON em `data/team-stats/fotmob/...`

### Script C: `parse-soccer-rating-team-context-local`

Responsabilidade:
- ler HTML do `Soccer-Rating` já guardado
- gerar `team_context.json`

Entradas:
- ficheiro HTML em `raw/soccer-rating/...`

Saída:
- ficheiro JSON em `data/team-context/soccer-rating/...`

### Script D opcional: `build-match-view-local`

Responsabilidade:
- combinar:
  - fixture do `Sofascore`
  - classificação do `Zerozero`
  - stats do `FotMob`
  - context do `Soccer-Rating`
- gerar um JSON pronto para a interface

Este script é útil, mas não é obrigatório na primeira fase.

## Ordem de execução recomendada

### Situação normal

1. atualizar fixtures via `Sofascore`
2. atualizar classificações via `Zerozero`
3. sincronizar o registo de equipas
4. rever o relatório de mapeamento
5. capturar manualmente HTML necessário de `FotMob` e `Soccer-Rating`
6. correr parse local dessas capturas
7. opcionalmente gerar `match_view`
8. validar no site local

## Política por época

### Para modelação

Usar:
- `2025/2026`

Motivo:
- a época está completa
- expõe o conjunto mais rico de campos
- permite desenhar o schema completo

### Para operação corrente

Usar:
- `2026/2027`

Motivo:
- é a época atual
- mas deve aceitar estados `not_started` e `partial`

## Regras anti-bloqueio

### Regras práticas

- não correr em GitHub Actions
- não fazer scraping contínuo
- usar cache sempre
- guardar HTML antes de parsear
- não reprocessar páginas sem necessidade
- um domínio por fluxo

### Regra de robustez

Se a captura falhar:
- não se perde o parser
- não se perde a UI
- não se perde o resto do pipeline

Se o parser falhar:
- o HTML bruto continua disponível para debugging

## Critérios de sucesso

O fluxo deve garantir:
- independência do pipeline de fixtures
- independência do pipeline de classificações
- repetibilidade do parse local
- inspeção manual fácil
- tolerância a temporadas incompletas

## Conclusão

Este fluxo manual offline é a abordagem recomendada para a fase de estatística de equipa, porque:
- minimiza o risco de `403`
- reduz acoplamento entre fontes
- permite evoluir a UI sem depender de scraping live
- cria uma base limpa para futura automação parcial, se a fonte se revelar estável
