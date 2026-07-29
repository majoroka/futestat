import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_ALLOWED_COMPETITIONS,
  buildAllowedCompetitionIdSet,
  filterFixturesByCompetition,
} from "../src/config/competition-whitelist.js";

test("buildAllowedCompetitionIdSet returns the curated defaults when env is absent", () => {
  const ids = buildAllowedCompetitionIdSet();

  assert.equal(ids.size, DEFAULT_ALLOWED_COMPETITIONS.length);
  assert.equal(ids.has("7"), true);
  assert.equal(ids.has("679"), true);
  assert.equal(ids.has("17015"), true);
  assert.equal(ids.has("238"), true);
  assert.equal(ids.has("325"), true);
  assert.equal(ids.has("203"), true);
});

test("buildAllowedCompetitionIdSet parses an explicit env override", () => {
  const ids = buildAllowedCompetitionIdSet("17, 238,325");

  assert.deepEqual([...ids], ["17", "238", "325"]);
});

test("filterFixturesByCompetition keeps only allowed competition identities", () => {
  const fixtures = [
    {
      sourceEventId: "1",
      competitionId: "17",
      competitionName: "Premier League",
      countryName: "England",
    },
    {
      sourceEventId: "2",
      competitionId: "215",
      competitionName: "Superettan",
      countryName: "Sweden",
    },
    { sourceEventId: "3", competitionId: "9999", competitionName: "Outra", countryName: "Outro" },
    { sourceEventId: "4", competitionId: null, competitionName: null, countryName: null },
    {
      sourceEventId: "5",
      competitionId: "325",
      competitionName: "Brasileirão Betano",
      countryName: "Brazil",
    },
  ];

  assert.deepEqual(filterFixturesByCompetition(fixtures, new Set(["17", "215", "325"])), [
    {
      sourceEventId: "1",
      competitionId: "17",
      competitionName: "Premier League",
      countryName: "England",
    },
    {
      sourceEventId: "5",
      competitionId: "325",
      competitionName: "Brasileirão Betano",
      countryName: "Brazil",
    },
  ]);
});
