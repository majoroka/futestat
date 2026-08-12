import test from "node:test";
import assert from "node:assert/strict";

import { STANDINGS_ZONE_PRESETS, getStandingsZonePreset } from "../site/standings-zone-presets.js";
import { DEFAULT_ALLOWED_COMPETITIONS } from "../src/config/competition-whitelist.js";

test("getStandingsZonePreset returns league-phase zones for UEFA competitions", () => {
  const zones = getStandingsZonePreset("7", "league-phase");

  assert.deepEqual(zones, [
    { from: 1, to: 8, tone: "ucl", label: "Oitavos de final" },
    { from: 9, to: 24, tone: "playoff", label: "Play-off de apuramento" },
  ]);
});

test("getStandingsZonePreset suppresses misleading default zones for Argentina group stage", () => {
  const zones = getStandingsZonePreset("155", "arg-group-stage");

  assert.deepEqual(zones, [
    { from: 1, to: 8, tone: "playoff", label: "Apuramento para a fase a eliminar" },
  ]);
});

test("getStandingsZonePreset uses softer split labels during regular season", () => {
  const zones = getStandingsZonePreset("39", "regular-season-before-split");

  assert.deepEqual(zones, [
    { from: 1, to: 6, tone: "playoff", label: "Zona de apuramento para o play-off campeão" },
    { from: 7, to: 12, tone: "relegation", label: "Zona de manutenção" },
  ]);
});

test("getStandingsZonePreset falls back to competition defaults when no phase profile exists", () => {
  const zones = getStandingsZonePreset("39", null);

  assert.deepEqual(zones, [
    { from: 1, to: 6, tone: "championship", label: "Play-off Campeão" },
    { from: 7, to: 12, tone: "relegation", label: "Play-off Despromoção" },
  ]);
});

test("standings zone presets only use canonical whitelist competition ids", () => {
  const allowedIds = new Set(DEFAULT_ALLOWED_COMPETITIONS.map((competition) => competition.competitionId));
  const presetIds = Object.keys(STANDINGS_ZONE_PRESETS);

  assert.deepEqual(
    presetIds.filter((competitionId) => !allowedIds.has(competitionId)),
    [],
  );
});

test("getStandingsZonePreset exposes canonical presets for Belgium and Finland", () => {
  const belgiumZones = getStandingsZonePreset("38", "regular-season-before-split");
  const finlandZones = getStandingsZonePreset("41", "regular-season-before-split");

  assert.deepEqual(belgiumZones, [
    { from: 1, to: 6, tone: "playoff", label: "Zona de apuramento para o play-off campeão" },
    { from: 7, to: 12, tone: "uel", label: "Zona intermédia de apuramento" },
    { from: 13, to: 16, tone: "relegation", label: "Zona de risco para manutenção" },
  ]);

  assert.deepEqual(finlandZones, [
    { from: 1, to: 6, tone: "playoff", label: "Zona de apuramento para o grupo do campeão" },
    { from: 7, to: 12, tone: "relegation", label: "Zona de manutenção" },
  ]);
});
