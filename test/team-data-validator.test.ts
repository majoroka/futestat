import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { validateTeamDataArtifacts } from "../src/infrastructure/manual/team-data-validator.js";

test("validateTeamDataArtifacts reports missing source html and invalid provider mismatches", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "futestat-validate-"));
  const statsDir = path.join(repoRoot, "data", "team-stats", "fotmob");
  const contextDir = path.join(repoRoot, "data", "team-context", "soccer-rating");
  const rawDir = path.join(repoRoot, "raw", "team-pages");

  await mkdir(statsDir, { recursive: true });
  await mkdir(contextDir, { recursive: true });
  await mkdir(rawDir, { recursive: true });

  await writeFile(
    path.join(rawDir, "manifest.json"),
    JSON.stringify({ generatedAtUtc: "2026-08-01T10:00:00Z", entries: [] }, null, 2),
    "utf8",
  );

  await writeFile(
    path.join(statsDir, "index.json"),
    JSON.stringify(
      {
        generatedAtUtc: "2026-08-01T10:00:00Z",
        entries: [
          {
            season: "2025-2026",
            competitionId: "17",
            competitionSlug: "premier-league",
            teamId: "8650",
            teamSlug: "liverpool",
            jsonPath: "data/team-stats/fotmob/2025-2026/17-premier-league/8650-liverpool.json",
            sourceHtmlPath: "raw/team-pages/fotmob/2025-2026/17-premier-league/8650-liverpool.html",
            parsedAtUtc: "2026-08-01T10:10:00Z",
            availabilityStatus: "archived",
          },
        ],
      },
      null,
      2,
    ),
    "utf8",
  );

  await mkdir(path.join(statsDir, "2025-2026", "17-premier-league"), { recursive: true });
  await writeFile(
    path.join(statsDir, "2025-2026", "17-premier-league", "8650-liverpool.json"),
    JSON.stringify(
      {
        team: { id: "8650", name: "Liverpool", slug: "liverpool", country: "England", logoUrl: null },
        competition: { id: "17", name: "Premier League" },
        season: { id: "2025/2026", label: "2025/2026", isCurrent: false },
        source: { provider: "wrong", url: "https://example.com", collectedAtUtc: "2026-08-01T10:00:00Z" },
        availability: { status: "archived", coverage: "high", notes: null },
        overview: {},
        attack: {},
        defense: {},
        discipline: {},
      },
      null,
      2,
    ),
    "utf8",
  );

  const summary = await validateTeamDataArtifacts(repoRoot);
  const issueCodes = summary.issues.map((issue) => issue.code);

  assert.ok(issueCodes.includes("team_stats_source_html_missing"));
  assert.ok(issueCodes.includes("team_stats_provider_invalid"));
});
