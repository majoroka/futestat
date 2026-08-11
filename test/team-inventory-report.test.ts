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
          createRegistryEntry("7", "Central Córdoba"),
          createRegistryEntry("2", "Barracas Central"),
          createRegistryEntry("3", "Defensa y Justicia"),
          createRegistryEntry("4", "Deportivo Riestra"),
          createRegistryEntry("5", "Estudiantes Río Cuarto"),
          createRegistryEntry("6", "Independiente Rivadavia"),
          createRegistryEntry("8", "Talleres"),
          createRegistryEntry("9", "Unión de Santa Fe"),
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
              createStandingRow(7, "Central Córdoba S.Estero"),
              createStandingRow(2, "Barracas"),
              createStandingRow(3, "Def y Justicia"),
              createStandingRow(4, "Dep. Riestra"),
              createStandingRow(5, "Estudiantes R.C."),
              createStandingRow(6, "Ind. Rivadavia"),
              createStandingRow(8, "Talleres"),
              createStandingRow(9, "Unión"),
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
  assert.equal(ligaProfesional.teamCount, 9);
  assert.equal(ligaProfesional.matchedRegistryTeams, 9);

  assertTeamMatch(ligaProfesional.teams, "Argentinos Jrs.", "Argentinos Juniors", "heuristic_name");
  assertTeamMatch(ligaProfesional.teams, "Central Córdoba S.Estero", "Central Córdoba", "heuristic_name");
  assertTeamMatch(ligaProfesional.teams, "Barracas", "Barracas Central", "heuristic_name");
  assertTeamMatch(ligaProfesional.teams, "Def y Justicia", "Defensa y Justicia", "heuristic_name");
  assertTeamMatch(ligaProfesional.teams, "Dep. Riestra", "Deportivo Riestra", "heuristic_name");
  assertTeamMatch(ligaProfesional.teams, "Estudiantes R.C.", "Estudiantes Río Cuarto", "heuristic_name");
  assertTeamMatch(ligaProfesional.teams, "Ind. Rivadavia", "Independiente Rivadavia", "heuristic_name");
  assertTeamMatch(ligaProfesional.teams, "Talleres", "Talleres", "normalized_name");
  assertTeamMatch(ligaProfesional.teams, "Unión", "Unión de Santa Fe", "heuristic_name");
});

test("generateTeamInventoryReport matches common Brasileirao naming variants", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "futestat-team-inventory-brazil-"));
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
          createBrazilRegistryEntry("1967", "Athletico"),
          createBrazilRegistryEntry("1977", "Atlético-MG"),
          createBrazilRegistryEntry("1999", "RB Bragantino"),
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  await writeFile(
    path.join(repoRoot, "data", "fixtures", "standings", "325.json"),
    JSON.stringify(
      {
        source: "zerozero",
        competitionId: "325",
        competitionName: "Brasileirao Serie A",
        countryName: "Brazil",
        zerozeroUrl: "https://example.com/325",
        mode: "single_table",
        status: "ready",
        scrapedAtUtc: "2026-08-10T09:00:00Z",
        editionId: "1",
        phaseId: "2",
        phaseName: "Serie A",
        phaseNotes: [],
        ruleProfileId: null,
        tables: [
          {
            name: "Serie A",
            type: "single_table",
            rows: [
              createStandingRow(1, "Athletico Paranaense"),
              createStandingRow(2, "Atlético Mineiro"),
              createStandingRow(3, "Red Bull Bragantino"),
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
  const brasileirao = result.report.competitions.find((competition) => competition.competitionId === "325");
  assert.ok(brasileirao);
  assert.equal(brasileirao.teamCount, 3);
  assert.equal(brasileirao.matchedRegistryTeams, 3);

  assertTeamMatch(brasileirao.teams, "Athletico Paranaense", "Athletico", "heuristic_name");
  assertTeamMatch(brasileirao.teams, "Atlético Mineiro", "Atlético-MG", "heuristic_name");
  assertTeamMatch(brasileirao.teams, "Red Bull Bragantino", "RB Bragantino", "heuristic_name");
});

test("generateTeamInventoryReport matches naming variants from Bulgaria, Croatia and Norway", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "futestat-team-inventory-europe-"));
  await mkdir(path.join(repoRoot, "data", "fixtures", "standings"), { recursive: true });
  await mkdir(path.join(repoRoot, "data"), { recursive: true });

  await writeFile(
    path.join(repoRoot, "data", "team-source-registry.json"),
    JSON.stringify(
      {
        generatedAtUtc: "2026-08-11T10:00:00Z",
        referenceDate: "2026-08-11",
        snapshotPath: "data/fixtures/latest.json",
        entries: [
          createEuropeanRegistryEntry("274971", "Arda", "247", "Parva Liga", "Bulgaria"),
          createEuropeanRegistryEntry("25529", "Istra", "170", "HNL", "Croatia"),
          createEuropeanRegistryEntry("35226", "Rudeš", "170", "HNL", "Croatia"),
          createEuropeanRegistryEntry("656", "Bodø/Glimt", "20", "Eliteserien", "Norway"),
          createEuropeanRegistryEntry("1159", "Brann", "20", "Eliteserien", "Norway"),
          createEuropeanRegistryEntry("786", "KFUM Oslo", "20", "Eliteserien", "Norway"),
          createEuropeanRegistryEntry("664", "Lillestrøm", "20", "Eliteserien", "Norway"),
          createEuropeanRegistryEntry("660", "Tromsø", "20", "Eliteserien", "Norway"),
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  await writeFile(
    path.join(repoRoot, "data", "fixtures", "standings", "247.json"),
    JSON.stringify(
      {
        source: "zerozero",
        competitionId: "247",
        competitionName: "Parva Liga",
        countryName: "Bulgaria",
        zerozeroUrl: "https://example.com/247",
        mode: "single_table",
        status: "ready",
        scrapedAtUtc: "2026-08-11T09:00:00Z",
        editionId: "1",
        phaseId: "2",
        phaseName: "Parva Liga",
        phaseNotes: [],
        ruleProfileId: null,
        tables: [
          {
            name: "Parva Liga",
            type: "single_table",
            rows: [createStandingRow(1, "Arda Kardzhali")],
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  await writeFile(
    path.join(repoRoot, "data", "fixtures", "standings", "170.json"),
    JSON.stringify(
      {
        source: "zerozero",
        competitionId: "170",
        competitionName: "HNL",
        countryName: "Croatia",
        zerozeroUrl: "https://example.com/170",
        mode: "single_table",
        status: "ready",
        scrapedAtUtc: "2026-08-11T09:00:00Z",
        editionId: "1",
        phaseId: "2",
        phaseName: "HNL",
        phaseNotes: [],
        ruleProfileId: null,
        tables: [
          {
            name: "HNL",
            type: "single_table",
            rows: [
              createStandingRow(1, "NK Istra 1961"),
              createStandingRow(2, "NK Rudes"),
            ],
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  await writeFile(
    path.join(repoRoot, "data", "fixtures", "standings", "20.json"),
    JSON.stringify(
      {
        source: "zerozero",
        competitionId: "20",
        competitionName: "Eliteserien",
        countryName: "Norway",
        zerozeroUrl: "https://example.com/20",
        mode: "single_table",
        status: "ready",
        scrapedAtUtc: "2026-08-11T09:00:00Z",
        editionId: "1",
        phaseId: "2",
        phaseName: "Eliteserien",
        phaseNotes: [],
        ruleProfileId: null,
        tables: [
          {
            name: "Eliteserien",
            type: "single_table",
            rows: [
              createStandingRow(1, "Bodo/Glimt"),
              createStandingRow(2, "Brann"),
              createStandingRow(3, "KFUM Fotball"),
              createStandingRow(4, "Lillestrom"),
              createStandingRow(5, "Tromso"),
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
  const bulgaria = result.report.competitions.find((competition) => competition.competitionId === "247");
  const croatia = result.report.competitions.find((competition) => competition.competitionId === "170");
  const norway = result.report.competitions.find((competition) => competition.competitionId === "20");

  assert.ok(bulgaria);
  assert.ok(croatia);
  assert.ok(norway);
  assert.equal(bulgaria.matchedRegistryTeams, 1);
  assert.equal(croatia.matchedRegistryTeams, 2);
  assert.equal(norway.matchedRegistryTeams, 5);

  assertTeamMatch(bulgaria.teams, "Arda Kardzhali", "Arda", "heuristic_name");
  assertTeamMatch(croatia.teams, "NK Istra 1961", "Istra", "heuristic_name");
  assertTeamMatch(croatia.teams, "NK Rudes", "Rudeš", "heuristic_name");
  assertTeamMatch(norway.teams, "Bodo/Glimt", "Bodø/Glimt", "normalized_name");
  assertTeamMatch(norway.teams, "Brann", "Brann", "normalized_name");
  assertTeamMatch(norway.teams, "KFUM Fotball", "KFUM Oslo", "heuristic_name");
  assertTeamMatch(norway.teams, "Lillestrom", "Lillestrøm", "normalized_name");
  assertTeamMatch(norway.teams, "Tromso", "Tromsø", "normalized_name");
});

test("generateTeamInventoryReport matches naming variants from Portugal and Romania", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "futestat-team-inventory-pt-ro-"));
  await mkdir(path.join(repoRoot, "data", "fixtures", "standings"), { recursive: true });
  await mkdir(path.join(repoRoot, "data"), { recursive: true });

  await writeFile(
    path.join(repoRoot, "data", "team-source-registry.json"),
    JSON.stringify(
      {
        generatedAtUtc: "2026-08-11T10:00:00Z",
        referenceDate: "2026-08-11",
        snapshotPath: "data/fixtures/latest.json",
        entries: [
          createEuropeanRegistryEntry("3035", "Estrela Amadora", "238", "Liga Portugal", "Portugal"),
          createEuropeanRegistryEntry("483088", "AVS", "239", "Liga Portugal 2", "Portugal"),
          createEuropeanRegistryEntry("148278", "Corvinul", "152", "SuperLiga", "Romania"),
          createEuropeanRegistryEntry("283972", "Csíkszereda", "152", "SuperLiga", "Romania"),
          createEuropeanRegistryEntry("3294", "Farul Constanța", "152", "SuperLiga", "Romania"),
          createEuropeanRegistryEntry("7734", "U. Cluj", "152", "SuperLiga", "Romania"),
          createEuropeanRegistryEntry("116223", "U. Craiova", "152", "SuperLiga", "Romania"),
          createEuropeanRegistryEntry("204657", "UTA", "152", "SuperLiga", "Romania"),
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
        scrapedAtUtc: "2026-08-11T09:00:00Z",
        editionId: "1",
        phaseId: "2",
        phaseName: "Liga Portugal",
        phaseNotes: [],
        ruleProfileId: null,
        tables: [
          {
            name: "Liga Portugal",
            type: "single_table",
            rows: [createStandingRow(1, "Est. Amadora")],
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  await writeFile(
    path.join(repoRoot, "data", "fixtures", "standings", "239.json"),
    JSON.stringify(
      {
        source: "zerozero",
        competitionId: "239",
        competitionName: "Liga Portugal 2",
        countryName: "Portugal",
        zerozeroUrl: "https://example.com/239",
        mode: "single_table",
        status: "ready",
        scrapedAtUtc: "2026-08-11T09:00:00Z",
        editionId: "1",
        phaseId: "2",
        phaseName: "Liga Portugal 2",
        phaseNotes: [],
        ruleProfileId: null,
        tables: [
          {
            name: "Liga Portugal 2",
            type: "single_table",
            rows: [createStandingRow(1, "AFS")],
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  await writeFile(
    path.join(repoRoot, "data", "fixtures", "standings", "152.json"),
    JSON.stringify(
      {
        source: "zerozero",
        competitionId: "152",
        competitionName: "SuperLiga",
        countryName: "Romania",
        zerozeroUrl: "https://example.com/152",
        mode: "single_table",
        status: "ready",
        scrapedAtUtc: "2026-08-11T09:00:00Z",
        editionId: "1",
        phaseId: "2",
        phaseName: "SuperLiga",
        phaseNotes: [],
        ruleProfileId: null,
        tables: [
          {
            name: "SuperLiga",
            type: "single_table",
            rows: [
              createStandingRow(1, "Corvinul Hunedoara"),
              createStandingRow(2, "Csikszereda M. Ciuc"),
              createStandingRow(3, "Farul"),
              createStandingRow(4, "Universitatea Cluj"),
              createStandingRow(5, "Universitatea Craiova"),
              createStandingRow(6, "UTA Arad"),
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
  const ligaPortugal = result.report.competitions.find((competition) => competition.competitionId === "238");
  const ligaPortugal2 = result.report.competitions.find((competition) => competition.competitionId === "239");
  const romania = result.report.competitions.find((competition) => competition.competitionId === "152");

  assert.ok(ligaPortugal);
  assert.ok(ligaPortugal2);
  assert.ok(romania);
  assert.equal(ligaPortugal.matchedRegistryTeams, 1);
  assert.equal(ligaPortugal2.matchedRegistryTeams, 1);
  assert.equal(romania.matchedRegistryTeams, 6);

  assertTeamMatch(ligaPortugal.teams, "Est. Amadora", "Estrela Amadora", "heuristic_name");
  assertTeamMatch(ligaPortugal2.teams, "AFS", "AVS", "heuristic_name");
  assertTeamMatch(romania.teams, "Corvinul Hunedoara", "Corvinul", "heuristic_name");
  assertTeamMatch(romania.teams, "Csikszereda M. Ciuc", "Csíkszereda", "heuristic_name");
  assertTeamMatch(romania.teams, "Farul", "Farul Constanța", "heuristic_name");
  assertTeamMatch(romania.teams, "Universitatea Cluj", "U. Cluj", "heuristic_name");
  assertTeamMatch(romania.teams, "Universitatea Craiova", "U. Craiova", "heuristic_name");
  assertTeamMatch(romania.teams, "UTA Arad", "UTA", "heuristic_name");
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

function createBrazilRegistryEntry(sofascoreTeamId: string, teamName: string) {
  return {
    sofascoreTeamId,
    teamName,
    countryName: "Brazil",
    competitionId: "325",
    competitionName: "Brasileirao Serie A",
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

function createEuropeanRegistryEntry(
  sofascoreTeamId: string,
  teamName: string,
  competitionId: string,
  competitionName: string,
  countryName: string,
) {
  return {
    sofascoreTeamId,
    teamName,
    countryName,
    competitionId,
    competitionName,
    activeInCurrentWindow: true,
    fixtureAppearancesInCurrentWindow: 1,
    firstSeenReferenceDate: "2026-08-08",
    lastSeenReferenceDate: "2026-08-11",
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
  matchMethod: string,
) {
  const team = teams.find((entry) => entry.inventoryTeamName === inventoryTeamName);
  assert.ok(team);
  assert.equal(team.matchedRegistry, true);
  assert.equal(team.matchMethod, matchMethod);
  assert.equal(team.registryTeamName, registryTeamName);
}
