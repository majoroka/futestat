import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTeamPageManifestEntry,
  deriveTeamPageHtmlPath,
  validateTeamPageCaptureOptions,
} from "../src/infrastructure/manual/team-page-capture.js";

const REPO_ROOT = "/Users/mariocabano/Documents/Futestat";

test("deriveTeamPageHtmlPath builds the FotMob raw path", () => {
  const filePath = deriveTeamPageHtmlPath(REPO_ROOT, {
    source: "fotmob",
    season: "2025-2026",
    competitionId: "238",
    competitionSlug: "liga-portugal",
    teamId: "9768",
    teamSlug: "sporting-cp",
    url: "https://www.fotmob.com/teams/9768/stats/sporting-cp/teams",
    force: false,
  });

  assert.equal(
    filePath,
    "/Users/mariocabano/Documents/Futestat/raw/team-pages/fotmob/2025-2026/238-liga-portugal/9768-sporting-cp.html",
  );
});

test("deriveTeamPageHtmlPath builds the Soccer-Rating raw path", () => {
  const filePath = deriveTeamPageHtmlPath(REPO_ROOT, {
    source: "soccer-rating",
    season: "2025-2026",
    countrySlug: "portugal",
    teamId: "1076",
    teamSlug: "benfica-lisboa",
    url: "https://www.soccer-rating.com/Benfica-Lisboa/1076/",
    force: false,
  });

  assert.equal(
    filePath,
    "/Users/mariocabano/Documents/Futestat/raw/team-pages/soccer-rating/2025-2026/portugal/1076-benfica-lisboa.html",
  );
});

test("validateTeamPageCaptureOptions requires FotMob competition metadata", () => {
  assert.throws(
    () =>
      validateTeamPageCaptureOptions({
        source: "fotmob",
        season: "2025-2026",
        teamId: "9768",
        teamSlug: "sporting-cp",
        url: "https://www.fotmob.com/teams/9768/stats/sporting-cp/teams",
        force: false,
      }),
    /competitionId is required/,
  );
});

test("validateTeamPageCaptureOptions requires Soccer-Rating country metadata", () => {
  assert.throws(
    () =>
      validateTeamPageCaptureOptions({
        source: "soccer-rating",
        season: "2025-2026",
        teamId: "1076",
        teamSlug: "benfica-lisboa",
        url: "https://www.soccer-rating.com/Benfica-Lisboa/1076/",
        force: false,
      }),
    /countrySlug/,
  );
});

test("buildTeamPageManifestEntry normalizes the relative manifest path", () => {
  const entry = buildTeamPageManifestEntry({
    repoRoot: REPO_ROOT,
    options: {
      source: "fotmob",
      season: "2025-2026",
      competitionId: "238",
      competitionSlug: "liga-portugal",
      teamId: "9768",
      teamSlug: "sporting-cp",
      url: "https://www.fotmob.com/teams/9768/stats/sporting-cp/teams",
      force: false,
    },
    htmlPath:
      "/Users/mariocabano/Documents/Futestat/raw/team-pages/fotmob/2025-2026/238-liga-portugal/9768-sporting-cp.html",
    finalUrl: "https://www.fotmob.com/pt-PT/teams/9768/stats/sporting-cp/teams",
    capturedAtUtc: "2026-07-31T18:00:00.000Z",
  });

  assert.deepEqual(entry, {
    source: "fotmob",
    season: "2025-2026",
    teamId: "9768",
    teamSlug: "sporting-cp",
    competitionId: "238",
    competitionSlug: "liga-portugal",
    countrySlug: null,
    url: "https://www.fotmob.com/pt-PT/teams/9768/stats/sporting-cp/teams",
    htmlPath: "raw/team-pages/fotmob/2025-2026/238-liga-portugal/9768-sporting-cp.html",
    capturedAtUtc: "2026-07-31T18:00:00.000Z",
  });
});
