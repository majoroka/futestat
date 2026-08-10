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

test("generateTeamInventoryReport matches common abbreviated team names inside the same competition", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "futestat-team-inventory-abbrev-"));
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
          createRegistryEntry("1", "Argentinos Juniors"),
          createRegistryEntry("2", "Barracas Central"),
          createRegistryEntry("3", "Defensa y Justicia"),
          createRegistryEntry("4", "Deportivo Riestra"),
          createRegistryEntry("5", "Estudiantes Río Cuarto"),
          createRegistryEntry("6", "Independiente Rivadavia"),
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  await writeFile(
    path.join(repoRoot, "data", "fixtures", "standings", "155.json"),
    JSON.stringify(
      {
        source: "zerozero",
        competitionId: "155",
        competitionName: "Liga Profesional",
        countryName: "Argentina",
        zerozeroUrl: "https://example.com/155",
        mode: "single_table",
        status: "ready",
        scrapedAtUtc: "2026-08-10T09:00:00Z",
        editionId: "1",
        phaseId: "2",
        phaseName: "Clausura",
        phaseNotes: [],
        ruleProfileId: null,
        tables: [
          {
            name: "Clausura",
            type: "single_table",
            rows: [
              createStandingRow(1, "Argentinos Jrs."),
              createStandingRow(2, "Barracas"),
              createStandingRow(3, "Def y Justicia"),
              createStandingRow(4, "Dep. Riestra"),
              createStandingRow(5, "Estudiantes R.C."),
              createStandingRow(6, "Ind. Rivadavia"),
            ],
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  const result = await generateTeamInventoryReport(repoRoot, { write: false });
  const ligaProfesional = result.report.competitions.find((competition) => competition.competitionId === "155");
  assert.ok(ligaProfesional);
  assert.equal(ligaProfesional.teamCount, 6);
  assert.equal(ligaProfesional.matchedRegistryTeams, 6);

  assertTeamMatch(ligaProfesional.teams, "Argentinos Jrs.", "Argentinos Juniors");
  assertTeamMatch(ligaProfesional.teams, "Barracas", "Barracas Central");
  assertTeamMatch(ligaProfesional.teams, "Def y Justicia", "Defensa y Justicia");
  assertTeamMatch(ligaProfesional.teams, "Dep. Riestra", "Deportivo Riestra");
  assertTeamMatch(ligaProfesional.teams, "Estudiantes R.C.", "Estudiantes Río Cuarto");
  assertTeamMatch(ligaProfesional.teams, "Ind. Rivadavia", "Independiente Rivadavia");
});

function createRegistryEntry(sofascoreTeamId: string, teamName: string) {
  return {
    sofascoreTeamId,
    teamName,
    countryName: "Argentina",
    competitionId: "155",
    competitionName: "Liga Profesional",
    activeInCurrentWindow: true,
    fixtureAppearancesInCurrentWindow: 1,
    firstSeenReferenceDate: "2026-08-08",
    lastSeenReferenceDate: "2026-08-10",
    sources: {
      fotmob: {
        status: "pending",
        sourceTeamId: null,
        teamSlug: null,
        competitionId: null,
        competitionSlug: null,
        url: null,
        notes: null,
      },
      soccerRating: {
        status: "pending",
        sourceTeamId: null,
        teamSlug: null,
        countrySlug: null,
        url: null,
        notes: null,
      },
    },
  };
}

function createStandingRow(position: number, teamName: string) {
  return {
    position,
    teamName,
    teamUrl: null,
    points: 0,
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: "0",
  };
}

function assertTeamMatch(
  teams: Array<{
    inventoryTeamName: string;
    matchedRegistry: boolean;
    matchMethod: string | null;
    registryTeamName: string | null;
  }>,
  inventoryTeamName: string,
  registryTeamName: string,
) {
  const team = teams.find((entry) => entry.inventoryTeamName === inventoryTeamName);
  assert.ok(team);
  assert.equal(team.matchedRegistry, true);
  assert.equal(team.matchMethod, "heuristic_name");
  assert.equal(team.registryTeamName, registryTeamName);
}
