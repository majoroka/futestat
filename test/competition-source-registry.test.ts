import test from "node:test";
import assert from "node:assert/strict";

import {
  findCompetitionSourceRegistryEntry,
  getCompetitionSourceRegistry,
  getCompetitionSourceRegistryEntryById,
} from "../src/config/competition-source-registry.js";

test("competition source registry exposes the full curated competition universe", () => {
  const registry = getCompetitionSourceRegistry();

  assert.equal(registry.entryCount, 42);
  assert.equal(registry.entries.length, 42);
});

test("competition source registry resolves seasonal and sponsored aliases", () => {
  const argentina = findCompetitionSourceRegistryEntry({
    competitionId: "155",
    competitionName: "Liga Profesional, Clausura",
    countryName: "Argentina",
  });
  const brazil = findCompetitionSourceRegistryEntry({
    competitionId: "325",
    competitionName: "Brasileirão Betano",
    countryName: "Brazil",
  });

  assert.equal(argentina?.sofascoreCompetitionId, "155");
  assert.equal(brazil?.sofascoreCompetitionId, "325");
});

test("competition source registry preserves canonical source ids by competition", () => {
  const benficaCompetition = getCompetitionSourceRegistryEntryById("238");

  assert.ok(benficaCompetition);
  assert.equal(benficaCompetition?.sources.zerozero.sourceCompetitionId, "3");
  assert.equal(benficaCompetition?.sources.fotmob.sourceCompetitionId, "61");
  assert.equal(benficaCompetition?.sources.soccerRating.sourceCompetitionId, "PT1");
});
