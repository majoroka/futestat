import assert from "node:assert/strict";
import test from "node:test";

import {
  chooseBestFotmobCandidate,
  chooseBestSoccerRatingCandidate,
  extractFotmobCandidates,
  extractSoccerRatingCandidates,
} from "../src/infrastructure/manual/team-source-registry-autofill.js";
import type { TeamSourceRegistryEntry } from "../src/domain/team-source-registry.js";

test("extractFotmobCandidates collects unique teams from teamSuggest and matchSuggest", () => {
  const candidates = extractFotmobCandidates({
    teamSuggest: [
      {
        text: "Benfica",
        options: [
          {
            text: "Benfica|9772",
            payload: {
              id: "9772",
              leagueName: "Liga Portugal",
            },
          },
        ],
      },
    ],
    matchSuggest: [
      {
        options: [
          {
            payload: {
              homeTeamId: "9772",
              awayTeamId: "1786",
              homeName: "Benfica",
              awayName: "Academico Viseu",
              leagueName: "Liga Portugal",
            },
          },
        ],
      },
    ],
  });

  assert.equal(candidates.length, 2);
  assert.equal(candidates[0]?.sourceTeamId, "9772");
  assert.equal(candidates[0]?.url, "https://www.fotmob.com/teams/9772/stats/benfica/teams");
});

test("chooseBestFotmobCandidate prefers first team over B team", () => {
  const entry = createEntry({
    sofascoreTeamId: "3006",
    teamName: "Benfica",
    countryName: "Portugal",
    competitionName: "Liga Portugal",
  });
  const candidates = extractFotmobCandidates({
    teamSuggest: [
      {
        text: "Benfica",
        options: [
          {
            text: "Benfica|9772",
            payload: {
              id: "9772",
              leagueName: "Liga Portugal",
            },
          },
          {
            text: "Benfica B|338302",
            payload: {
              id: "338302",
              leagueName: "Liga Portugal 2",
            },
          },
        ],
      },
    ],
  });

  const best = chooseBestFotmobCandidate(entry, candidates);
  assert.ok(best);
  assert.equal(best.candidate.sourceTeamId, "9772");
});

test("extractSoccerRatingCandidates reads slug, id, label and country code", () => {
  const html = `
    <table>
      <tr>
        <td><a href="/Benfica-Lisboa/1076/">Benfica Lisboa</a></td>
        <td><img src="./flags/PT.gif" width="28" height="19"></td>
        <td>2347.12</td>
      </tr>
      <tr>
        <td><a href="/Benfica-Lisboa-II/8038/">Benfica Lisboa II</a></td>
        <td><img src="./flags/PT.gif" width="28" height="19"></td>
        <td>1795.70</td>
      </tr>
    </table>
  `;

  const candidates = extractSoccerRatingCandidates(html);
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0]?.sourceTeamId, "1076");
  assert.equal(candidates[0]?.countryCode, "PT");
  assert.equal(candidates[0]?.url, "https://www.soccer-rating.com/Benfica-Lisboa/1076/");
});

test("chooseBestSoccerRatingCandidate resolves Sporting CP to Sporting Lisboa", () => {
  const entry = createEntry({
    sofascoreTeamId: "9768",
    teamName: "Sporting CP",
    countryName: "Portugal",
    competitionName: "Liga Portugal",
  });
  const html = `
    <table>
      <tr>
        <td><a href="/Sporting-Lisboa/1085/">Sporting Lisboa</a></td>
        <td><img src="./flags/PT.gif" width="28" height="19"></td>
        <td>2300.00</td>
      </tr>
      <tr>
        <td><a href="/Sporting-Braga/1083/">Sporting Braga</a></td>
        <td><img src="./flags/PT.gif" width="28" height="19"></td>
        <td>2200.00</td>
      </tr>
    </table>
  `;

  const best = chooseBestSoccerRatingCandidate(entry, extractSoccerRatingCandidates(html));
  assert.ok(best);
  assert.equal(best.candidate.sourceTeamId, "1085");
});

function createEntry(
  overrides: Partial<
    Pick<TeamSourceRegistryEntry, "sofascoreTeamId" | "teamName" | "countryName" | "competitionName">
  >,
): TeamSourceRegistryEntry {
  return {
    sofascoreTeamId: overrides.sofascoreTeamId ?? "1",
    teamName: overrides.teamName ?? "Benfica",
    countryName: overrides.countryName ?? "Portugal",
    competitionId: "238",
    competitionName: overrides.competitionName ?? "Liga Portugal",
    activeInCurrentWindow: true,
    fixtureAppearancesInCurrentWindow: 1,
    firstSeenReferenceDate: "2026-08-08",
    lastSeenReferenceDate: "2026-08-08",
    sources: {
      fotmob: {
        status: "pending",
        sourceTeamId: null,
        teamSlug: null,
        competitionId: "238",
        competitionSlug: "liga-portugal",
        url: null,
        notes: null,
      },
      soccerRating: {
        status: "pending",
        sourceTeamId: null,
        teamSlug: null,
        countrySlug: "portugal",
        url: null,
        notes: null,
      },
    },
  };
}
