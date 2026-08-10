import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { generateTeamMappingReport } from "../src/infrastructure/manual/team-mapping-report.js";

test("generateTeamMappingReport summarizes mapping progress by competition", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "futestat-team-mapping-"));
  await mkdir(path.join(repoRoot, "data"), { recursive: true });

  await writeFile(
    path.join(repoRoot, "data", "team-source-registry.json"),
    JSON.stringify(
      {
        generatedAtUtc: "2026-08-10T09:00:00Z",
        referenceDate: "2026-08-10",
        snapshotPath: "data/fixtures/latest.json",
        entries: [
          {
            sofascoreTeamId: "3006",
            teamName: "Benfica",
            countryName: "Portugal",
            competitionId: "238",
            competitionName: "Liga Portugal",
            activeInCurrentWindow: true,
            fixtureAppearancesInCurrentWindow: 1,
            firstSeenReferenceDate: "2026-08-08",
            lastSeenReferenceDate: "2026-08-10",
            sources: {
              fotmob: {
                status: "mapped",
                sourceTeamId: "9772",
                teamSlug: "benfica",
                competitionId: "238",
                competitionSlug: "liga-portugal-betclic",
                url: "https://www.fotmob.com/teams/9772/stats/benfica/teams",
                notes: null,
              },
              soccerRating: {
                status: "mapped",
                sourceTeamId: "1076",
                teamSlug: "benfica-lisboa",
                countrySlug: "portugal",
                url: "https://www.soccer-rating.com/Benfica-Lisboa/1076/",
                notes: null,
              },
            },
          },
          {
            sofascoreTeamId: "9768",
            teamName: "Sporting CP",
            countryName: "Portugal",
            competitionId: "238",
            competitionName: "Liga Portugal",
            activeInCurrentWindow: true,
            fixtureAppearancesInCurrentWindow: 1,
            firstSeenReferenceDate: "2026-08-08",
            lastSeenReferenceDate: "2026-08-10",
            sources: {
              fotmob: {
                status: "mapped",
                sourceTeamId: "9768",
                teamSlug: "sporting-cp",
                competitionId: "238",
                competitionSlug: "liga-portugal-betclic",
                url: "https://www.fotmob.com/teams/9768/stats/sporting-cp/teams",
                notes: null,
              },
              soccerRating: {
                status: "pending",
                sourceTeamId: null,
                teamSlug: "sporting-lisboa",
                countrySlug: "portugal",
                url: null,
                notes: "match inconclusivo",
              },
            },
          },
          {
            sofascoreTeamId: "5020",
            teamName: "Alverca",
            countryName: "Portugal",
            competitionId: "239",
            competitionName: "Liga Portugal 2",
            activeInCurrentWindow: false,
            fixtureAppearancesInCurrentWindow: 0,
            firstSeenReferenceDate: "2026-08-08",
            lastSeenReferenceDate: "2026-08-09",
            sources: {
              fotmob: {
                status: "pending",
                sourceTeamId: null,
                teamSlug: "alverca",
                competitionId: "239",
                competitionSlug: "liga-portugal-2",
                url: null,
                notes: null,
              },
              soccerRating: {
                status: "pending",
                sourceTeamId: null,
                teamSlug: "fc-alverca",
                countrySlug: "portugal",
                url: null,
                notes: null,
              },
            },
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  const result = await generateTeamMappingReport(repoRoot, { write: true });
  assert.equal(result.report.summary.competitions, 36);
  assert.equal(result.report.summary.whitelistCompetitions, 36);
  assert.equal(result.report.summary.competitionsWithRegistryEntries, 2);
  assert.equal(result.report.summary.competitionsWithoutRegistryEntries, 34);
  assert.equal(result.report.summary.teams, 3);
  assert.equal(result.report.summary.activeTeams, 2);
  assert.equal(result.report.summary.complete, 1);
  assert.equal(result.report.summary.partial, 1);
  assert.equal(result.report.summary.missing, 1);

  const ligaPortugal = result.report.competitions.find((competition) => competition.competitionId === "238");
  assert.ok(ligaPortugal);
  assert.equal(ligaPortugal.seededFromWhitelist, true);
  assert.equal(ligaPortugal.hasRegistryEntries, true);
  assert.equal(ligaPortugal.teamCount, 2);
  assert.equal(ligaPortugal.coverage.complete, 1);
  assert.equal(ligaPortugal.coverage.partial, 1);

  const sporting = ligaPortugal.teams.find((team) => team.teamName === "Sporting CP");
  assert.ok(sporting);
  assert.equal(sporting.mappingState, "partial");
  assert.deepEqual(sporting.recommendedNextSteps, ["map_soccer_rating"]);

  const premierLeague = result.report.competitions.find((competition) => competition.competitionId === "17");
  assert.ok(premierLeague);
  assert.equal(premierLeague.hasRegistryEntries, false);
  assert.equal(premierLeague.teamCount, 0);

  const reportPath = path.join(repoRoot, "data", "team-mapping", "latest.json");
  const savedReport = JSON.parse(await readFile(reportPath, "utf8"));
  assert.equal(savedReport.summary.teams, 3);
  assert.equal(savedReport.summary.competitionsWithoutRegistryEntries, 34);
});
