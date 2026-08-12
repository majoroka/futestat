import test from "node:test";
import assert from "node:assert/strict";

import {
  listPrimaryCompetitionStandingsSources,
  resolveCompetitionStandingsSourceForFixture,
} from "../src/application/competition-standings-source-resolver.js";

test("listPrimaryCompetitionStandingsSources returns one canonical source per competition", () => {
  const sources = listPrimaryCompetitionStandingsSources();

  assert.equal(sources.length, 42);
  assert.equal(new Set(sources.map((source) => source.competitionId)).size, 42);
});

test("resolveCompetitionStandingsSourceForFixture keeps qualification variants for active fixtures", () => {
  const source = resolveCompetitionStandingsSourceForFixture({
    competitionId: "7",
    competitionName: "UEFA Champions League, Qualification",
    countryName: "Europe",
  });

  assert.equal(source?.competitionId, "7");
  assert.equal(source?.zerozeroUrl, "https://www.zerozero.pt/competicao/liga-dos-campeoes-qualificacao-");
});

test("resolveCompetitionStandingsSourceForFixture resolves canonical primary leagues from the registry", () => {
  const source = resolveCompetitionStandingsSourceForFixture({
    competitionId: "38",
    competitionName: "Pro League",
    countryName: "Belgium",
  });

  assert.equal(source?.competitionId, "38");
  assert.equal(source?.zerozeroUrl, "https://www.zerozero.pt/competicao/liga-belga");
});
