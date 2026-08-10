import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { generateTeamInventoryReport } from "../src/infrastructure/manual/team-inventory-report.js";

test("generateTeamInventoryReport lists whitelist competitions and seeds teams from standings", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "futestat-team-inventory-"));
  await mkdir(path.join(repoRoot, "data", "fixtures", "standings"), { recursive: true });
  await mkdir(path.join(repoRoot, "data"), { recursive: true });

  await writeFile(
    path.join(repoRoot, "data", "team-source-registry.json"),
    JSON.stringify(
      {
        generatedAtUtc: "2026-08-10T10:00:00Z",
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
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  await writeFile(
    path.join(repoRoot, "data", "fixtures", "standings", "238.json"),
    JSON.stringify(
      {
        source: "zerozero",
        competitionId: "238",
        competitionName: "Liga Portugal",
        countryName: "Portugal",
        zerozeroUrl: "https://example.com/238",
        mode: "single_table",
        status: "ready",
        scrapedAtUtc: "2026-08-10T09:00:00Z",
        editionId: "1",
        phaseId: "2",
        phaseName: "Campeonato",
        phaseNotes: [],
        ruleProfileId: null,
        tables: [
          {
            name: "Campeonato",
            type: "single_table",
            rows: [
              {
                position: 1,
                teamName: "Benfica",
                teamUrl: null,
                points: 3,
                matches: 1,
                wins: 1,
                draws: 0,
                losses: 0,
                goalsFor: 2,
                goalsAgainst: 0,
                goalDifference: "+2",
              },
              {
                position: 2,
                teamName: "Sporting",
                teamUrl: null,
                points: 3,
                matches: 1,
                wins: 1,
                draws: 0,
                losses: 0,
                goalsFor: 1,
                goalsAgainst: 0,
                goalDifference: "+1",
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  const result = await generateTeamInventoryReport(repoRoot, { write: true });
  assert.equal(result.report.summary.competitions, 36);
  assert.equal(result.report.summary.competitionsWithStandings, 1);
  assert.equal(result.report.summary.competitionsWithoutStandings, 35);
  assert.equal(result.report.summary.teams, 2);
  assert.equal(result.report.summary.matchedRegistryTeams, 1);
  assert.equal(result.report.summary.missingRegistryTeams, 1);

  const ligaPortugal = result.report.competitions.find((competition) => competition.competitionId === "238");
  assert.ok(ligaPortugal);
  assert.equal(ligaPortugal.hasStandingsSnapshot, true);
  assert.equal(ligaPortugal.teamCount, 2);

  const benfica = ligaPortugal.teams.find((team) => team.inventoryTeamName === "Benfica");
  const sporting = ligaPortugal.teams.find((team) => team.inventoryTeamName === "Sporting");
  assert.ok(benfica);
  assert.ok(sporting);
  assert.equal(benfica.matchedRegistry, true);
  assert.equal(benfica.sofascoreTeamId, "3006");
  assert.equal(sporting.matchedRegistry, false);

  const premierLeague = result.report.competitions.find((competition) => competition.competitionId === "17");
  assert.ok(premierLeague);
  assert.equal(premierLeague.hasStandingsSnapshot, false);
  assert.equal(premierLeague.teamCount, 0);

  const reportPath = path.join(repoRoot, "data", "team-inventory", "latest.json");
  const savedReport = JSON.parse(await readFile(reportPath, "utf8"));
  assert.equal(savedReport.summary.teams, 2);
});
