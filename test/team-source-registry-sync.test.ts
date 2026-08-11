import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { syncTeamSourceRegistry } from "../src/infrastructure/manual/team-source-registry-sync.js";

test("syncTeamSourceRegistry creates and preserves manual mappings from current fixtures snapshot", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "futestat-source-registry-"));
  await mkdir(path.join(repoRoot, "data", "fixtures"), { recursive: true });

  await writeFile(
    path.join(repoRoot, "data", "fixtures", "latest.json"),
    JSON.stringify(
      {
        source: "sofascore",
        status: "window",
        scrapedAtUtc: "2026-08-08T12:00:00Z",
        referenceDate: "2026-08-08",
        datesIncluded: ["2026-08-07", "2026-08-08", "2026-08-09"],
        fixtureCount: 1,
        visibleFixtureCount: 1,
        fixtures: [
          {
            source: "sofascore",
            sourceEventId: "1",
            matchDate: "2026-08-08",
            kickoffAtUtc: "2026-08-08T19:00:00Z",
            competitionId: "238",
            competitionName: "Liga Portugal Betclic",
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
            matchUrl: "https://example.com/match/1",
            firstSeenAtUtc: "2026-08-08T08:00:00Z",
            lastSeenAtUtc: "2026-08-08T12:00:00Z",
            lastChangedAtUtc: "2026-08-08T12:00:00Z",
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
    path.join(repoRoot, "data", "team-source-registry.json"),
    JSON.stringify(
      {
        generatedAtUtc: "2026-08-07T12:00:00Z",
        referenceDate: "2026-08-07",
        snapshotPath: "data/fixtures/latest.json",
        entries: [
          {
            sofascoreTeamId: "3006",
            teamName: "Benfica",
            countryName: "Portugal",
            competitionId: "238",
            competitionName: "Liga Portugal",
            activeInCurrentWindow: false,
            fixtureAppearancesInCurrentWindow: 0,
            firstSeenReferenceDate: "2026-08-07",
            lastSeenReferenceDate: "2026-08-07",
            sources: {
              fotmob: {
                status: "mapped",
                sourceTeamId: "8650",
                teamSlug: "benfica",
                competitionId: "238",
                competitionSlug: "liga-portugal",
                url: "https://www.fotmob.com/teams/8650/stats/benfica/teams",
                notes: null,
              },
              soccerRating: {
                status: "pending",
                sourceTeamId: null,
                teamSlug: "benfica-lisboa",
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

  const result = await syncTeamSourceRegistry(repoRoot, {});
  assert.equal(result.totalEntries, 2);
  assert.equal(result.activeEntries, 2);
  assert.equal(result.addedEntries, 1);
  assert.equal(result.retainedEntries, 1);

  const registry = JSON.parse(
    await readFile(path.join(repoRoot, "data", "team-source-registry.json"), "utf8"),
  );
  const benfica = registry.entries.find((entry: { sofascoreTeamId: string }) => entry.sofascoreTeamId === "3006");
  const sporting = registry.entries.find((entry: { sofascoreTeamId: string }) => entry.sofascoreTeamId === "9768");

  assert.equal(benfica.activeInCurrentWindow, true);
  assert.equal(benfica.fixtureAppearancesInCurrentWindow, 1);
  assert.equal(benfica.lastSeenReferenceDate, "2026-08-08");
  assert.equal(
    benfica.sources.fotmob.url,
    "https://www.fotmob.com/teams/8650/stats/benfica/teams",
  );
  assert.equal(sporting.sources.fotmob.status, "pending");
  assert.equal(sporting.sources.fotmob.competitionSlug, "liga-portugal-betclic");
  assert.equal(sporting.sources.soccerRating.countrySlug, "portugal");
  assert.equal(result.standingsSeededEntries, 0);
  assert.equal(result.fixtureLinkedSeedEntries, 0);
});

test("syncTeamSourceRegistry seeds teams from standings snapshots even without fixtures in the active window", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "futestat-source-registry-standings-"));
  await mkdir(path.join(repoRoot, "data", "fixtures", "standings"), { recursive: true });

  await writeFile(
    path.join(repoRoot, "data", "fixtures", "latest.json"),
    JSON.stringify(
      {
        source: "sofascore",
        status: "window",
        scrapedAtUtc: "2026-08-11T12:00:00Z",
        referenceDate: "2026-08-11",
        datesIncluded: ["2026-08-10", "2026-08-11", "2026-08-12"],
        fixtureCount: 0,
        visibleFixtureCount: 0,
        fixtures: [],
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
    path.join(repoRoot, "data", "fixtures", "standings", "18.json"),
    JSON.stringify(
      {
        source: "zerozero",
        competitionId: "18",
        competitionName: "Championship",
        countryName: "England",
        zerozeroUrl: "https://example.com/championship",
        mode: "single_table",
        status: "ready",
        scrapedAtUtc: "2026-08-11T11:00:00Z",
        editionId: "1",
        phaseId: "2",
        phaseName: "Championship",
        phaseNotes: [],
        ruleProfileId: null,
        tables: [
          {
            name: "Championship",
            type: "single_table",
            rows: [
              { position: 1, teamName: "Ipswich Town", teamUrl: null, points: 3, matches: 1, wins: 1, draws: 0, losses: 0, goalsFor: 2, goalsAgainst: 0, goalDifference: "+2" },
              { position: 2, teamName: "Leicester City", teamUrl: null, points: 3, matches: 1, wins: 1, draws: 0, losses: 0, goalsFor: 1, goalsAgainst: 0, goalDifference: "+1" },
            ],
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  const result = await syncTeamSourceRegistry(repoRoot, {});
  assert.equal(result.totalEntries, 2);
  assert.equal(result.activeEntries, 0);
  assert.equal(result.addedEntries, 2);
  assert.equal(result.retainedEntries, 0);
  assert.equal(result.standingsSeededEntries, 2);
  assert.equal(result.fixtureLinkedSeedEntries, 0);

  const registry = JSON.parse(
    await readFile(path.join(repoRoot, "data", "team-source-registry.json"), "utf8"),
  );

  const ipswich = registry.entries.find((entry: { teamName: string }) => entry.teamName === "Ipswich Town");
  assert.ok(ipswich);
  assert.equal(ipswich.sofascoreTeamId, "");
  assert.equal(ipswich.activeInCurrentWindow, false);
  assert.equal(ipswich.fixtureAppearancesInCurrentWindow, 0);
  assert.equal(ipswich.competitionId, "18");
  assert.equal(ipswich.sources.fotmob.competitionId, "18");
  assert.equal(ipswich.sources.fotmob.competitionSlug, "championship");
});

test("syncTeamSourceRegistry upgrades a standings-seeded team when the fixture snapshot later provides the sofascore id", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "futestat-source-registry-merge-"));
  await mkdir(path.join(repoRoot, "data", "fixtures"), { recursive: true });

  await writeFile(
    path.join(repoRoot, "data", "fixtures", "latest.json"),
    JSON.stringify(
      {
        source: "sofascore",
        status: "window",
        scrapedAtUtc: "2026-08-11T12:00:00Z",
        referenceDate: "2026-08-11",
        datesIncluded: ["2026-08-10", "2026-08-11", "2026-08-12"],
        fixtureCount: 1,
        visibleFixtureCount: 1,
        fixtures: [
          {
            source: "sofascore",
            sourceEventId: "15501",
            matchDate: "2026-08-11",
            kickoffAtUtc: "2026-08-11T20:00:00Z",
            competitionId: "155",
            competitionName: "Liga Profesional, Clausura",
            competitionLogoUrl: null,
            countryName: "Argentina",
            homeTeamId: "9001",
            homeTeamName: "Barracas Central",
            homeTeamLogoUrl: null,
            awayTeamId: "9002",
            awayTeamName: "Tigre",
            awayTeamLogoUrl: null,
            status: "upcoming",
            resultLabel: null,
            homeScore: null,
            awayScore: null,
            matchUrl: "https://example.com/match/15501",
            firstSeenAtUtc: "2026-08-11T10:00:00Z",
            lastSeenAtUtc: "2026-08-11T12:00:00Z",
            lastChangedAtUtc: "2026-08-11T12:00:00Z",
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
    path.join(repoRoot, "data", "team-source-registry.json"),
    JSON.stringify(
      {
        generatedAtUtc: "2026-08-10T12:00:00Z",
        referenceDate: "2026-08-10",
        snapshotPath: "data/fixtures/latest.json",
        entries: [
          {
            sofascoreTeamId: "",
            teamName: "Barracas",
            countryName: "Argentina",
            competitionId: "155",
            competitionName: "Liga Profesional",
            activeInCurrentWindow: false,
            fixtureAppearancesInCurrentWindow: 0,
            firstSeenReferenceDate: "2026-08-10",
            lastSeenReferenceDate: "2026-08-10",
            sources: {
              fotmob: {
                status: "pending",
                sourceTeamId: null,
                teamSlug: "barracas",
                competitionId: "155",
                competitionSlug: "liga-profesional",
                url: null,
                notes: null,
              },
              soccerRating: {
                status: "pending",
                sourceTeamId: null,
                teamSlug: "barracas",
                countrySlug: "argentina",
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

  const result = await syncTeamSourceRegistry(repoRoot, { seedFromStandings: false });
  assert.equal(result.totalEntries, 2);
  assert.equal(result.standingsSeededEntries, 0);
  assert.equal(result.fixtureLinkedSeedEntries, 1);

  const registry = JSON.parse(
    await readFile(path.join(repoRoot, "data", "team-source-registry.json"), "utf8"),
  );

  const barracas = registry.entries.find((entry: { sofascoreTeamId: string }) => entry.sofascoreTeamId === "9001");
  assert.ok(barracas);
  assert.equal(barracas.teamName, "Barracas Central");
  assert.equal(barracas.activeInCurrentWindow, true);
  assert.equal(
    registry.entries.filter((entry: { teamName: string }) => entry.teamName.includes("Barracas")).length,
    1,
  );
});
