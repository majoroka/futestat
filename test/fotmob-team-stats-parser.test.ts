import test from "node:test";
import assert from "node:assert/strict";

import { parseFotmobTeamStatsHtml } from "../src/infrastructure/fotmob/fotmob-team-stats-parser.js";

test("parseFotmobTeamStatsHtml extracts normalized metrics and archived availability", () => {
  const html = buildHtml({
    props: {
      url: "/pt-PT/teams/8650/stats/liverpool/teams",
      pageProps: {
        fallback: {
          "team-8650": {
            details: {
              id: 8650,
              name: "Liverpool",
              latestSeason: "2026/2027",
              primaryLeagueId: 17,
              primaryLeagueName: "Premier League",
              sportsTeamJSONLD: {
                logo: "https://images.fotmob.com/image_resources/logo/teamlogo/8650.png",
                location: {
                  address: {
                    addressCountry: "England",
                  },
                },
              },
            },
            overview: {
              season: "2025/2026",
              selectedSeason: "2025/2026",
            },
            stats: {
              tournamentId: "27110",
              tournamentSeasons: [
                {
                  season: "2025/2026",
                  leagueName: "Premier League",
                  tournamentId: "27110",
                  parentLeagueId: "17",
                },
              ],
            },
            statsMetrics: {
              teamRating: 7.4,
              goalsPerMatch: 1.9,
              goalsConcededPerMatch: 1.0,
              averagePossessionPct: "54%",
              cleanSheets: 12,
              xg: 1.6,
              xgDiff: 0.7,
              shotsOnTargetPerMatch: 5.2,
              bigChances: 43,
              bigChancesMissed: 18,
              accuratePassesPerMatch: 421,
              accurateLongBallsPerMatch: 28.1,
              accurateCrossesPerMatch: 6.1,
              penaltiesAwarded: 4,
              touchesInOppBoxPerMatch: 18.4,
              cornersPerMatch: 6.2,
              setPieceGoals: 4,
              xgConceded: 0.9,
              interceptionsPerMatch: 9.8,
              tacklesPerMatch: 14.1,
              clearancesPerMatch: 7.3,
              finalThirdRecoveriesPerMatch: 3.6,
              setPieceGoalsConceded: 2,
              penaltiesConceded: 3,
              savesPerMatch: 2.9,
              foulsPerMatch: 11.4,
              yellowCardsPerMatch: 2.1,
              redCardsPerMatch: 0.1,
            },
          },
        },
      },
    },
  });

  const result = parseFotmobTeamStatsHtml({
    html,
    inputPath:
      "/Users/mariocabano/Documents/Futestat/raw/team-pages/fotmob/2025-2026/17-premier-league/8650-liverpool.html",
    collectedAtUtc: "2026-07-31T12:00:00.000Z",
  });

  assert.equal(result.snapshot.team.id, "8650");
  assert.equal(result.snapshot.team.slug, "liverpool");
  assert.equal(result.snapshot.competition.id, "17");
  assert.equal(result.snapshot.competition.name, "Premier League");
  assert.equal(result.snapshot.season.label, "2025/2026");
  assert.equal(result.snapshot.season.isCurrent, false);
  assert.equal(result.snapshot.source.url, "https://www.fotmob.com/pt-PT/teams/8650/stats/liverpool/teams");
  assert.equal(result.snapshot.availability.status, "archived");
  assert.equal(result.snapshot.availability.coverage, "high");
  assert.equal(result.snapshot.attack.xg, 1.6);
  assert.equal(result.snapshot.defense.savesPerMatch, 2.9);
  assert.equal(result.snapshot.discipline.yellowCardsPerMatch, 2.1);
  assert.equal(result.metricsExtractedCount, 28);
});

test("parseFotmobTeamStatsHtml marks current empty season as not_started", () => {
  const html = buildHtml({
    props: {
      url: "/pt-PT/teams/9768/stats/sporting-cp/teams",
      pageProps: {
        fallback: {
          "team-9768": {
            details: {
              id: 9768,
              name: "Sporting CP",
              latestSeason: "2026/2027",
              primaryLeagueId: 238,
              primaryLeagueName: "Liga Portugal",
              sportsTeamJSONLD: {
                location: {
                  address: {
                    addressCountry: "Portugal",
                  },
                },
              },
            },
            overview: {
              season: "2026/2027",
              selectedSeason: "2026/2027",
            },
            stats: {
              tournamentId: "99999",
              tournamentSeasons: [
                {
                  season: "2026/2027",
                  leagueName: "Liga Portugal",
                  tournamentId: "99999",
                  parentLeagueId: "238",
                },
              ],
            },
          },
        },
      },
    },
  });

  const result = parseFotmobTeamStatsHtml({
    html,
    inputPath:
      "/Users/mariocabano/Documents/Futestat/raw/team-pages/fotmob/2026-2027/238-liga-portugal/9768-sporting-cp.html",
    collectedAtUtc: "2026-07-31T12:00:00.000Z",
  });

  assert.equal(result.snapshot.team.slug, "sporting-cp");
  assert.equal(result.snapshot.competition.id, "238");
  assert.equal(result.snapshot.availability.status, "not_started");
  assert.equal(result.snapshot.availability.notes, "Epoca atual ainda sem estatisticas agregadas disponiveis no HTML capturado.");
  assert.equal(result.metricsExtractedCount, 0);
});

function buildHtml(nextData: unknown): string {
  return `<!doctype html><html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
    nextData,
  )}</script></body></html>`;
}
