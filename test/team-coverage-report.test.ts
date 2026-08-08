import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { generateTeamCoverageReport } from "../src/infrastructure/manual/team-coverage-report.js";

test("generateTeamCoverageReport summarizes current window team coverage by source", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "futestat-team-coverage-"));

  await mkdir(path.join(repoRoot, "data", "fixtures"), { recursive: true });
  await mkdir(path.join(repoRoot, "data", "team-stats", "fotmob"), { recursive: true });
  await mkdir(path.join(repoRoot, "data", "team-context", "soccer-rating"), { recursive: true });

  await writeFile(
    path.join(repoRoot, "data", "fixtures", "latest.json"),
    JSON.stringify(
      {
        source: "sofascore",
        status: "window",
        scrapedAtUtc: "2026-08-08T10:00:00Z",
        referenceDate: "2026-08-08",
        datesIncluded: ["2026-08-07", "2026-08-08", "2026-08-09"],
        fixtureCount: 2,
        visibleFixtureCount: 2,
        fixtures: [
          {
            source: "sofascore",
            sourceEventId: "1",
            matchDate: "2026-08-08",
            kickoffAtUtc: "2026-08-08T19:00:00Z",
            competitionId: "238",
            competitionName: "Liga Portugal",
            competitionLogoUrl: null,
            countryName: "Portugal",
            homeTeamId: "3006",
            homeTeamName: "Benfica",
            homeTeamLogoUrl: null,
            awayTeamId: "9768",
            awayTeamName: "Sporting CP",
            awayTeamLogoUrl: null,
            status: "upcoming",
            resultLabel: null,
            homeScore: null,
            awayScore: null,
            matchUrl: "https://example.com/1",
            firstSeenAtUtc: "2026-08-08T08:00:00Z",
            lastSeenAtUtc: "2026-08-08T10:00:00Z",
            lastChangedAtUtc: "2026-08-08T10:00:00Z",
          },
          {
            source: "sofascore",
            sourceEventId: "2",
            matchDate: "2026-08-09",
            kickoffAtUtc: "2026-08-09T16:00:00Z",
            competitionId: "239",
            competitionName: "Liga Portugal 2",
            competitionLogoUrl: null,
            countryName: "Portugal",
            homeTeamId: "5010",
            homeTeamName: "Feirense",
            homeTeamLogoUrl: null,
            awayTeamId: "5020",
            awayTeamName: "Alverca",
            awayTeamLogoUrl: null,
            status: "upcoming",
            resultLabel: null,
            homeScore: null,
            awayScore: null,
            matchUrl: "https://example.com/2",
            firstSeenAtUtc: "2026-08-08T08:00:00Z",
            lastSeenAtUtc: "2026-08-08T10:00:00Z",
            lastChangedAtUtc: "2026-08-08T10:00:00Z",
          },
        ],
        metadata: {
          browserTimezone: "UTC",
          scraperVersion: 2,
          pastDays: 1,
          futureDays: 1,
          excludedStatuses: ["live"],
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  await writeFile(
    path.join(repoRoot, "data", "team-stats", "fotmob", "index.json"),
    JSON.stringify(
      {
        generatedAtUtc: "2026-08-08T10:05:00Z",
        entries: [
          {
            season: "2026-2027",
            competitionId: "238",
            competitionSlug: "liga-portugal",
            sofascoreTeamId: "3006",
            teamId: "f-3006",
            teamSlug: "benfica",
            jsonPath: "data/team-stats/fotmob/2026-2027/238-liga-portugal/f-3006-benfica.json",
            sourceHtmlPath: "raw/team-pages/fotmob/2026-2027/238-liga-portugal/f-3006-benfica.html",
            parsedAtUtc: "2026-08-08T10:05:00Z",
            availabilityStatus: "partial",
          },
          {
            season: "2026-2027",
            competitionId: "239",
            competitionSlug: "liga-portugal-2",
            sofascoreTeamId: null,
            teamId: "f-5010",
            teamSlug: "feirense",
            jsonPath: "data/team-stats/fotmob/2026-2027/239-liga-portugal-2/f-5010-feirense.json",
            sourceHtmlPath: "raw/team-pages/fotmob/2026-2027/239-liga-portugal-2/f-5010-feirense.html",
            parsedAtUtc: "2026-08-08T10:05:00Z",
            availabilityStatus: "partial",
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  await writeFile(
    path.join(repoRoot, "data", "team-context", "soccer-rating", "index.json"),
    JSON.stringify(
      {
        generatedAtUtc: "2026-08-08T10:06:00Z",
        entries: [
          {
            season: "2026-2027",
            countrySlug: "portugal",
            sofascoreTeamId: "3006",
            teamId: "sr-1076",
            teamSlug: "benfica-lisboa",
            jsonPath: "data/team-context/soccer-rating/2026-2027/portugal/sr-1076-benfica-lisboa.json",
            sourceHtmlPath: "raw/team-pages/soccer-rating/2026-2027/portugal/sr-1076-benfica-lisboa.html",
            parsedAtUtc: "2026-08-08T10:06:00Z",
            availabilityStatus: "available",
          },
          {
            season: "2026-2027",
            countrySlug: "portugal",
            sofascoreTeamId: null,
            teamId: "sr-9768",
            teamSlug: "sporting-cp",
            jsonPath: "data/team-context/soccer-rating/2026-2027/portugal/sr-9768-sporting-cp.json",
            sourceHtmlPath: "raw/team-pages/soccer-rating/2026-2027/portugal/sr-9768-sporting-cp.html",
            parsedAtUtc: "2026-08-08T10:06:00Z",
            availabilityStatus: "available",
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  const result = await generateTeamCoverageReport(repoRoot, { write: true });

  assert.equal(result.report.summary.competitions, 2);
  assert.equal(result.report.summary.teams, 4);
  assert.equal(result.report.summary.teamsWithFotmob, 2);
  assert.equal(result.report.summary.teamsWithSoccerRating, 2);
  assert.equal(result.report.summary.teamsComplete, 1);
  assert.equal(result.report.summary.teamsMissingBoth, 1);

  const ligaPortugal = result.report.competitions.find(
    (competition) => competition.competitionId === "238",
  );
  assert.ok(ligaPortugal);

  const benfica = ligaPortugal?.teams.find((team) => team.teamName === "Benfica");
  const sporting = ligaPortugal?.teams.find((team) => team.teamName === "Sporting CP");
  assert.equal(benfica?.sources.fotmob.matchedBy, "sofascoreTeamId");
  assert.equal(benfica?.sources.soccerRating.matchedBy, "sofascoreTeamId");
  assert.equal(sporting?.sources.soccerRating.matchedBy, "teamSlug");
  assert.deepEqual(sporting?.recommendedNextSteps, ["capture_fotmob"]);

  const reportPath = path.join(repoRoot, "data", "team-coverage", "latest.json");
  const savedReport = JSON.parse(await readFile(reportPath, "utf8"));
  assert.equal(savedReport.summary.teams, 4);
});
