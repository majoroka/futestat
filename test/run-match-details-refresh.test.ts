import test from "node:test";
import assert from "node:assert/strict";

import { __testables } from "../src/application/run-match-details-refresh.js";
import type { MatchFixture } from "../src/domain/fixture.js";

function buildFixture(overrides: Partial<MatchFixture>): MatchFixture {
  return {
    source: "sofascore",
    sourceEventId: "1",
    matchDate: "2026-08-15",
    kickoffAtUtc: "2026-08-15T18:00:00.000Z",
    competitionId: "238",
    competitionName: "Liga Portugal",
    competitionLogoUrl: null,
    countryName: "Portugal",
    homeTeamId: "3006",
    homeTeamName: "Benfica",
    homeTeamLogoUrl: null,
    awayTeamId: "9768",
    awayTeamName: "Sporting",
    awayTeamLogoUrl: null,
    status: "upcoming",
    resultLabel: null,
    homeScore: null,
    awayScore: null,
    matchUrl: "https://example.com/match/1",
    firstSeenAtUtc: "2026-08-15T10:00:00.000Z",
    lastSeenAtUtc: "2026-08-15T10:00:00.000Z",
    lastChangedAtUtc: "2026-08-15T10:00:00.000Z",
    ...overrides,
  };
}

test("match details refresh accepts upcoming fixtures", () => {
  assert.equal(
    __testables.isEligibleForMatchDetails(
      "2026-08-15",
      buildFixture({ status: "upcoming" }),
    ),
    true,
  );
});

test("match details refresh accepts finished fixtures on reference day", () => {
  assert.equal(
    __testables.isEligibleForMatchDetails(
      "2026-08-15",
      buildFixture({ status: "finished", homeScore: 1, awayScore: 0, resultLabel: "FT" }),
    ),
    true,
  );
});

test("match details refresh rejects finished fixtures outside reference day", () => {
  assert.equal(
    __testables.isEligibleForMatchDetails(
      "2026-08-15",
      buildFixture({
        matchDate: "2026-08-14",
        status: "finished",
        homeScore: 1,
        awayScore: 0,
        resultLabel: "FT",
      }),
    ),
    false,
  );
});

test("match details refresh rejects postponed fixtures", () => {
  assert.equal(
    __testables.isEligibleForMatchDetails(
      "2026-08-15",
      buildFixture({ status: "postponed" }),
    ),
    false,
  );
});
