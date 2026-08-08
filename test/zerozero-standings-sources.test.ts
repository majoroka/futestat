import test from "node:test";
import assert from "node:assert/strict";

import {
  findCompetitionStandingsSource,
} from "../src/config/competition-standings-sources.js";

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

test("findCompetitionStandingsSource exposes competition-specific phase rule profiles", () => {
  const belgiumSource = findCompetitionStandingsSource({
    competitionId: "40",
    competitionName: "Pro League",
    countryName: "Belgium",
  });
  const scotlandSource = findCompetitionStandingsSource({
    competitionId: "36",
    competitionName: "Premiership",
    countryName: "Scotland",
  });
  const argentinaSource = findCompetitionStandingsSource({
    competitionId: "155",
    competitionName: "Liga Profesional, Apertura",
    countryName: "Argentina",
  });

  assert.ok(belgiumSource?.phaseRules?.some((rule) => rule.ruleProfileId === "europe-round"));
  assert.ok(scotlandSource?.phaseRules?.some((rule) => rule.ruleProfileId === "championship-round"));
  assert.ok(argentinaSource?.phaseRules?.some((rule) => rule.ruleProfileId === "arg-group-stage"));
});

test("findCompetitionStandingsSource resolves Portugal lower divisions", () => {
  const secondTierSource = findCompetitionStandingsSource({
    competitionId: "239",
    competitionName: "Liga Portugal 2",
    countryName: "Portugal",
  });
  const leagueThreeSource = findCompetitionStandingsSource({
    competitionId: "17101",
    competitionName: "Liga 3",
    countryName: "Portugal",
  });

  assert.equal(
    secondTierSource?.zerozeroUrl,
    "https://www.zerozero.pt/competicao/segunda-liga-portuguesa",
  );
  assert.equal(leagueThreeSource?.zerozeroUrl, "https://www.zerozero.pt/competicao/liga-3");
  assert.ok(leagueThreeSource?.phaseRules?.some((rule) => rule.ruleProfileId === "group-stage"));
});
