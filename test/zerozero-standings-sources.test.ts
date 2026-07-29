import test from "node:test";
import assert from "node:assert/strict";

import { findCompetitionStandingsSource } from "../src/config/competition-standings-sources.js";

test("findCompetitionStandingsSource matches qualification aliases for UEFA competitions", () => {
  const source = findCompetitionStandingsSource({
    competitionId: "7",
    competitionName: "UEFA Champions League, Qualification",
    countryName: "Europe",
  });

  assert.equal(source?.competitionId, "7");
  assert.equal(source?.zerozeroUrl, "https://www.zerozero.pt/competicao/liga-dos-campeoes-qualificacao-");
});

test("findCompetitionStandingsSource matches sponsored and seasonal aliases", () => {
  const brazilSource = findCompetitionStandingsSource({
    competitionId: "325",
    competitionName: "Brasileirão Betano",
    countryName: "Brazil",
  });
  const argentinaSource = findCompetitionStandingsSource({
    competitionId: "155",
    competitionName: "Liga Profesional, Clausura",
    countryName: "Argentina",
  });

  assert.equal(brazilSource?.competitionId, "325");
  assert.equal(argentinaSource?.competitionId, "155");
});
