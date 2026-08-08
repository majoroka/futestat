import assert from "node:assert/strict";
import test from "node:test";

import { buildBatchCapturePlan } from "../src/infrastructure/manual/team-pages-batch-capture.js";
import type { TeamSourceRegistry } from "../src/domain/team-source-registry.js";

test("buildBatchCapturePlan creates mapped captures for both sources", () => {
  const registry = createRegistry({
    entries: [
      createEntry({
        sofascoreTeamId: "3006",
        teamName: "Benfica",
        countryName: "Portugal",
        competitionId: "238",
        competitionName: "Liga Portugal",
        activeInCurrentWindow: true,
        sources: {
          fotmob: {
            status: "mapped",
            sourceTeamId: "9772",
            teamSlug: "benfica",
            competitionId: "238",
            competitionSlug: "liga-portugal",
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
      }),
    ],
  });

  const plan = buildBatchCapturePlan(registry, {
    source: "all",
    season: "2026-2027",
    onlyMapped: true,
    onlyActive: false,
    force: false,
  });

  assert.equal(plan.length, 2);
  assert.equal(plan[0]?.captureOptions.season, "2026-2027");
  assert.equal(plan[0]?.captureOptions.sofascoreTeamId, "3006");
  assert.equal(plan[1]?.captureOptions.countrySlug, "portugal");
});

test("buildBatchCapturePlan filters only active and only mapped entries", () => {
  const registry = createRegistry({
    entries: [
      createEntry({
        sofascoreTeamId: "3006",
        teamName: "Benfica",
        activeInCurrentWindow: true,
      }),
      createEntry({
        sofascoreTeamId: "9768",
        teamName: "Sporting CP",
        activeInCurrentWindow: false,
      }),
      createEntry({
        sofascoreTeamId: "1074320",
        teamName: "Estrela Amadora",
        activeInCurrentWindow: true,
        sources: {
          fotmob: {
            status: "pending",
            sourceTeamId: null,
            teamSlug: "estrela-amadora",
            competitionId: "238",
            competitionSlug: "liga-portugal",
            url: null,
            notes: null,
          },
          soccerRating: {
            status: "mapped",
            sourceTeamId: "1080",
            teamSlug: "cf-estrela",
            countrySlug: "portugal",
            url: "https://www.soccer-rating.com/CF-Estrela/1080/",
            notes: null,
          },
        },
      }),
    ],
  });

  const plan = buildBatchCapturePlan(registry, {
    source: "all",
    season: "2026-2027",
    onlyMapped: true,
    onlyActive: true,
    force: false,
  });

  assert.equal(plan.length, 3);
  assert.deepEqual(
    plan.map((item) => [item.sofascoreTeamId, item.source]),
    [
      ["3006", "fotmob"],
      ["3006", "soccer-rating"],
      ["1074320", "soccer-rating"],
    ],
  );
});

function createRegistry(overrides: Partial<TeamSourceRegistry>): TeamSourceRegistry {
  return {
    generatedAtUtc: "2026-08-08T12:00:00.000Z",
    referenceDate: "2026-08-08",
    snapshotPath: "data/fixtures/latest.json",
    entries: overrides.entries ?? [],
  };
}

function createEntry(overrides: {
  sofascoreTeamId: string;
  teamName: string;
  countryName?: string;
  competitionId?: string;
  competitionName?: string;
  activeInCurrentWindow: boolean;
  sources?: {
    fotmob?: {
      status: "pending" | "mapped" | "not_applicable";
      sourceTeamId: string | null;
      teamSlug: string | null;
      competitionId: string | null;
      competitionSlug: string | null;
      url: string | null;
      notes: string | null;
    };
    soccerRating?: {
      status: "pending" | "mapped" | "not_applicable";
      sourceTeamId: string | null;
      teamSlug: string | null;
      countrySlug: string | null;
      url: string | null;
      notes: string | null;
    };
  };
}) {
  return {
    sofascoreTeamId: overrides.sofascoreTeamId,
    teamName: overrides.teamName,
    countryName: overrides.countryName ?? "Portugal",
    competitionId: overrides.competitionId ?? "238",
    competitionName: overrides.competitionName ?? "Liga Portugal",
    activeInCurrentWindow: overrides.activeInCurrentWindow,
    fixtureAppearancesInCurrentWindow: 1,
    firstSeenReferenceDate: "2026-08-08",
    lastSeenReferenceDate: "2026-08-08",
    sources: {
      fotmob: overrides.sources?.fotmob ?? {
        status: "mapped",
        sourceTeamId: "9772",
        teamSlug: "benfica",
        competitionId: "238",
        competitionSlug: "liga-portugal",
        url: "https://www.fotmob.com/teams/9772/stats/benfica/teams",
        notes: null,
      },
      soccerRating: overrides.sources?.soccerRating ?? {
        status: "mapped",
        sourceTeamId: "1076",
        teamSlug: "benfica-lisboa",
        countrySlug: "portugal",
        url: "https://www.soccer-rating.com/Benfica-Lisboa/1076/",
        notes: null,
      },
    },
  };
}
