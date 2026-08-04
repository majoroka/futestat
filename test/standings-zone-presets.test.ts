import test from "node:test";
import assert from "node:assert/strict";

import { getStandingsZonePreset } from "../site/standings-zone-presets.js";

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
