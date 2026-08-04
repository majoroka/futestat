import test from "node:test";
import assert from "node:assert/strict";

import { buildStandingsTableLayout } from "../site/standings-table-groups.js";

test("buildStandingsTableLayout highlights the shared table for both teams", () => {
  const layout = buildStandingsTableLayout(
    [
      {
        name: "Grupo A",
        type: "league_phase",
        rows: [
          { teamName: "Benfica" },
          { teamName: "Sporting CP" },
        ],
      },
      {
        name: "Grupo B",
        type: "league_phase",
        rows: [{ teamName: "Braga" }],
      },
    ],
    {
      homeTeamName: "Benfica",
      awayTeamName: "Sporting CP",
    },
  );

  assert.equal(layout.summary, "As duas equipas pertencem à mesma tabela nesta fase.");
  assert.equal(layout.primaryTables.length, 1);
  assert.equal(layout.primaryTables[0]?.badge, "Tabela do jogo");
  assert.equal(layout.primaryTables[0]?.name, "Grupo A");
  assert.equal(layout.secondaryTables.length, 1);
});

test("buildStandingsTableLayout separates home and away tables when teams are split", () => {
  const layout = buildStandingsTableLayout(
    [
      {
        name: "Grupo A",
        type: "league_phase",
        rows: [{ teamName: "Benfica" }],
      },
      {
        name: "Grupo B",
        type: "league_phase",
        rows: [{ teamName: "Sporting CP" }],
      },
      {
        name: "Grupo C",
        type: "league_phase",
        rows: [{ teamName: "Braga" }],
      },
    ],
    {
      homeTeamName: "Benfica",
      awayTeamName: "Sporting CP",
    },
  );

  assert.equal(layout.summary, "As equipas aparecem em grupos ou tabelas diferentes nesta fase.");
  assert.deepEqual(
    layout.primaryTables.map((table) => [table.badge, table.name]),
    [
      ["Grupo da equipa da casa", "Grupo A"],
      ["Grupo da equipa visitante", "Grupo B"],
    ],
  );
  assert.equal(layout.secondaryTables.length, 1);
  assert.equal(layout.secondaryTables[0]?.name, "Grupo C");
});

test("buildStandingsTableLayout falls back cleanly when no team is found", () => {
  const layout = buildStandingsTableLayout(
    [
      {
        name: "Grupo A",
        type: "league_phase",
        rows: [{ teamName: "Braga" }],
      },
      {
        name: "Grupo B",
        type: "league_phase",
        rows: [{ teamName: "Porto" }],
      },
    ],
    {
      homeTeamName: "Benfica",
      awayTeamName: "Sporting CP",
    },
  );

  assert.equal(
    layout.summary,
    "Existem várias tabelas nesta fase e não foi possível identificar automaticamente a mais relevante para este jogo.",
  );
  assert.equal(layout.primaryTables.length, 1);
  assert.equal(layout.primaryTables[0]?.badge, "Tabela principal da fase");
  assert.equal(layout.secondaryTables.length, 1);
});
