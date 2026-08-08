import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { parseAllCapturedTeamPages } from "../src/infrastructure/manual/team-pages-batch-parser.js";

test("parseAllCapturedTeamPages processes both sources from capture manifest", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "futestat-batch-"));
  const manifestPath = path.join(repoRoot, "raw", "team-pages", "manifest.json");
  const fotmobHtmlPath = path.join(
    repoRoot,
    "raw",
    "team-pages",
    "fotmob",
    "2025-2026",
    "17-premier-league",
    "8650-liverpool.html",
  );
  const soccerHtmlPath = path.join(
    repoRoot,
    "raw",
    "team-pages",
    "soccer-rating",
    "2025-2026",
    "portugal",
    "1076-benfica-lisboa.html",
  );

  await mkdir(path.dirname(fotmobHtmlPath), { recursive: true });
  await mkdir(path.dirname(soccerHtmlPath), { recursive: true });
  await writeFile(fotmobHtmlPath, buildFotmobHtml(), "utf8");
  await writeFile(soccerHtmlPath, buildSoccerRatingHtml(), "utf8");
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        generatedAtUtc: "2026-08-01T10:00:00.000Z",
        entries: [
          {
            source: "fotmob",
            season: "2025-2026",
            sofascoreTeamId: "8650",
            teamId: "8650",
            teamSlug: "liverpool",
            competitionId: "17",
            competitionSlug: "premier-league",
            countrySlug: null,
            url: "https://www.fotmob.com/teams/8650/stats/liverpool/teams",
            htmlPath: "raw/team-pages/fotmob/2025-2026/17-premier-league/8650-liverpool.html",
            capturedAtUtc: "2026-08-01T10:00:00.000Z",
          },
          {
            source: "soccer-rating",
            season: "2025-2026",
            sofascoreTeamId: "3006",
            teamId: "1076",
            teamSlug: "benfica-lisboa",
            competitionId: null,
            competitionSlug: null,
            countrySlug: "portugal",
            url: "https://www.soccer-rating.com/Benfica-Lisboa/1076/",
            htmlPath: "raw/team-pages/soccer-rating/2025-2026/portugal/1076-benfica-lisboa.html",
            capturedAtUtc: "2026-08-01T10:05:00.000Z",
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  const summary = await parseAllCapturedTeamPages(repoRoot, {
    source: "all",
    force: true,
  });

  assert.equal(summary.attempted, 2);
  assert.equal(summary.parsed, 2);
  assert.equal(summary.failed, 0);
  assert.equal(summary.parsedBySource.fotmob, 1);
  assert.equal(summary.parsedBySource["soccer-rating"], 1);

  const statsJson = JSON.parse(
    await readFile(
      path.join(
        repoRoot,
        "data",
        "team-stats",
        "fotmob",
        "2025-2026",
        "17-premier-league",
        "8650-liverpool.json",
      ),
      "utf8",
    ),
  );
  const contextJson = JSON.parse(
    await readFile(
      path.join(
        repoRoot,
        "data",
        "team-context",
        "soccer-rating",
        "2025-2026",
        "portugal",
        "1076-benfica-lisboa.json",
      ),
      "utf8",
    ),
  );

  assert.equal(statsJson.team.id, "8650");
  assert.equal(contextJson.team.id, "1076");

  const statsIndex = JSON.parse(
    await readFile(path.join(repoRoot, "data", "team-stats", "fotmob", "index.json"), "utf8"),
  );
  const contextIndex = JSON.parse(
    await readFile(
      path.join(repoRoot, "data", "team-context", "soccer-rating", "index.json"),
      "utf8",
    ),
  );

  assert.equal(statsIndex.entries[0].sofascoreTeamId, "8650");
  assert.equal(contextIndex.entries[0].sofascoreTeamId, "3006");
});

function buildFotmobHtml(): string {
  return `<!doctype html><html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
    {
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
                  location: { address: { addressCountry: "England" } },
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
              },
            },
          },
        },
      },
    },
  )}</script></body></html>`;
}

function buildSoccerRatingHtml(): string {
  return `
    <html><head><title>Benfica Lisboa: Prediction (1x2), Betting Advice & FAIR ODDS</title></head><body>
      <table><tr><th><font><b>Benfica Lisboa</b></font></th></tr></table>
      <table><tr><td>Country:</td><td><a class="highlight">Portugal</a></td></tr><tr><td>Rating Total:</td><td>2332.70</td><td></td><td>Rating Home:</td><td>2333.45</td><td></td><td>Rating Away:</td><td>2331.96</td></tr></table>
      <table><tr><td colspan>Benfica Lisboa is ranked #1 in Portugal and #21 in Europe.</td></tr></table>
      <table><tr><th><font><b>Benfica Lisboa Prediction &amp; Betting Advice</b></font></th></tr><tr><td><font><table><tr><td>Form Last 3 Games</td><td>6 P., 9:3 (WLW)</td></tr></table><table><tr><td>Opening Odds:</td><td>1.09</td><td></td><td>10.50</td><td>26.00</td></tr><tr><td>Fair Odds:</td><td>1.18</td><td></td><td>9.68</td><td>19.36</td></tr></table>Bet on (X2) Academico Viseu (Stake 3/10)</font></td></tr></table>
      <table style="display:block" id="inj1"><tr><td><i>None</i></td></tr></table>
      <table style="display:block" id="line1"><tr><td>#1</td><td><div class="nomobil"> Anatoliy Trubin (GK)</div></td><td> 0/0</td><td class="cr1">68</td></tr></table>
      <table style="display:block" id="squad1"><tr><td><i><div class="nomobil"> Anatoliy Trubin (24)</div></i></td><td> 0/0</td><td class="cr1">68</td></tr></table>
    </body></html>
  `;
}
