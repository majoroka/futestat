# Mapeamento de Equipas

## Objetivo

Antes de evoluir a camada de estatísticas, o projeto precisa de uma base canónica de equipas.

Essa base responde a duas perguntas:
- que equipas fazem parte do universo publicado pelo projeto
- como cada equipa é resolvida em `FotMob` e `Soccer-Rating`

## Fonte canónica

O projeto usa:
- `sofascoreTeamId`

como chave principal da equipa.

O ficheiro mestre é:
- `data/team-source-registry.json`

## Estado pretendido por equipa

Cada equipa deve poder ficar num destes estados lógicos:
- `complete`: mapeada em `FotMob` e `Soccer-Rating`
- `partial`: mapeada apenas numa das fontes
- `missing`: sem mapeamento útil

## Fluxo recomendado

1. atualizar fixtures
2. sincronizar o registo de equipas
3. gerar relatório de mapeamento
4. preencher manualmente os casos pendentes
5. só depois capturar e parsear HTML de equipa

## Comandos úteis

### Atualizar o registo mestre

```bash
npm run sync:team-source-registry
```

### Gerar relatório de mapeamento

```bash
npm run report:team-mapping
```

Output esperado:
- `data/team-mapping/latest.json`

## O que olhar no relatório

Por competição:
- `teamCount`
- `activeTeams`
- `coverage.complete`
- `coverage.partial`
- `coverage.missing`

Por equipa:
- estado do `FotMob`
- estado do `Soccer-Rating`
- `firstSeenReferenceDate`
- `lastSeenReferenceDate`
- `recommendedNextSteps`

## Limitação atual

O registo ainda depende fortemente das equipas que já apareceram nos fixtures publicados.

Isso significa:
- bom ponto de partida
- mas não é ainda garantia de cobertura total de cada liga logo no primeiro dia

## Próximo endurecimento lógico

Quando esta fase avançar, o ideal é completar o universo de equipas por:
- classificação da competição
- página da competição
- histórico acumulado do registo atual

## Regra prática

Não começar por estatísticas.

A ordem robusta é:
- primeiro equipas
- depois mapeamento
- depois fontes
- depois estatísticas
