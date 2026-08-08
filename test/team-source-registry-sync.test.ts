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
});
