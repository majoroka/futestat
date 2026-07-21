import test from "node:test";
import assert from "node:assert/strict";

import {
  absoluteMatchUrl,
  buildSofascoreDateUrl,
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
