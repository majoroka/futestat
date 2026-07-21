import test from "node:test";
import assert from "node:assert/strict";

import {
  absoluteMatchUrl,
  buildTeamLogoUrl,
  buildSofascoreDateUrl,
  parseTeamIdFromImageUrl,
} from "../src/infrastructure/sofascore/sofascore-helpers.js";

test("buildSofascoreDateUrl creates direct dated page URLs", () => {
  assert.equal(
    buildSofascoreDateUrl("https://www.sofascore.com", "2026-07-21"),
    "https://www.sofascore.com/football/2026-07-21",
  );
});

test("absoluteMatchUrl resolves relative match URLs", () => {
  assert.equal(
    absoluteMatchUrl(
      "https://www.sofascore.com",
      "/football/match/fc-ararat-armenia-shamrock-rovers/CnbsEUec#id:16350227",
    ),
    "https://www.sofascore.com/football/match/fc-ararat-armenia-shamrock-rovers/CnbsEUec#id:16350227",
  );
});

test("parseTeamIdFromImageUrl extracts the team id from sofascore crest URLs", () => {
  assert.equal(
    parseTeamIdFromImageUrl("https://img.sofascore.com/api/v1/team/3006/image/small"),
    "3006",
  );
  assert.equal(
    parseTeamIdFromImageUrl("https://img.sofascore.com/api/v1/team/3006/image"),
    "3006",
  );
  assert.equal(parseTeamIdFromImageUrl("https://example.com/logo.png"), null);
});

test("buildTeamLogoUrl creates stable crest URLs from team ids", () => {
  assert.equal(
    buildTeamLogoUrl("3006"),
    "https://img.sofascore.com/api/v1/team/3006/image/small",
  );
  assert.equal(
    buildTeamLogoUrl("3006", "default"),
    "https://img.sofascore.com/api/v1/team/3006/image",
  );
});
