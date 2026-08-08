import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import type { TeamPageCaptureManifest, TeamPageCaptureSource } from "../../domain/team-page-capture.js";
import { parseFotmobTeamStatsHtml } from "../fotmob/fotmob-team-stats-parser.js";
import { parseSoccerRatingTeamContextHtml } from "../soccer-rating/soccer-rating-team-context-parser.js";
import { JsonTeamContextStore } from "../storage/json-team-context-store.js";
import { JsonTeamStatsStore } from "../storage/json-team-stats-store.js";

export interface ParseAllTeamPagesOptions {
  source?: TeamPageCaptureSource | "all";
  season?: string;
  force: boolean;
}

export interface ParseAllTeamPagesSummary {
  manifestPath: string;
  attempted: number;
  parsed: number;
  failed: number;
  skipped: number;
  parsedBySource: Record<TeamPageCaptureSource, number>;
  failedEntries: Array<{
    source: TeamPageCaptureSource;
    htmlPath: string;
    message: string;
  }>;
}

export async function parseAllCapturedTeamPages(
  repoRoot: string,
  options: ParseAllTeamPagesOptions,
): Promise<ParseAllTeamPagesSummary> {
  const manifestPath = path.join(repoRoot, "raw", "team-pages", "manifest.json");
  const manifest = await readCaptureManifest(manifestPath);
  const filteredEntries = manifest.entries.filter((entry) => {
    if (options.source && options.source !== "all" && entry.source !== options.source) {
      return false;
    }

    if (options.season && entry.season !== options.season) {
      return false;
    }

    return true;
  });

  const teamStatsStore = new JsonTeamStatsStore(repoRoot);
  const teamContextStore = new JsonTeamContextStore(repoRoot);
  const summary: ParseAllTeamPagesSummary = {
    manifestPath,
    attempted: filteredEntries.length,
    parsed: 0,
    failed: 0,
    skipped: 0,
    parsedBySource: {
      fotmob: 0,
      "soccer-rating": 0,
    },
    failedEntries: [],
  };

  for (const entry of filteredEntries) {
    const htmlPath = path.resolve(repoRoot, entry.htmlPath);

    try {
      const [html, htmlStats] = await Promise.all([readFile(htmlPath, "utf8"), stat(htmlPath)]);

      if (entry.source === "fotmob") {
        const result = parseFotmobTeamStatsHtml({
          html,
          inputPath: htmlPath,
          collectedAtUtc: htmlStats.mtime.toISOString(),
          season: entry.season,
          competitionId: entry.competitionId ?? undefined,
          competitionSlug: entry.competitionSlug ?? undefined,
          teamId: entry.teamId,
          teamSlug: entry.teamSlug,
        });

        const outputPath = teamStatsStore.deriveOutputPath(htmlPath);
        await teamStatsStore.writeSnapshot({
          snapshot: result.snapshot,
          outputPath,
          sourceHtmlPath: htmlPath,
          seasonFs: result.seasonFs,
          competitionId: result.competitionId,
          competitionSlug: result.competitionSlug,
          sofascoreTeamId: entry.sofascoreTeamId ?? null,
          teamId: result.teamId,
          teamSlug: result.teamSlug,
          parsedAtUtc: new Date().toISOString(),
          force: options.force,
        });
      } else {
        const result = parseSoccerRatingTeamContextHtml({
          html,
          inputPath: htmlPath,
          collectedAtUtc: htmlStats.mtime.toISOString(),
          season: entry.season,
          countrySlug: entry.countrySlug ?? undefined,
          teamId: entry.teamId,
          teamSlug: entry.teamSlug,
        });

        const outputPath = teamContextStore.deriveOutputPath(htmlPath);
        await teamContextStore.writeSnapshot({
          snapshot: result.snapshot,
          outputPath,
          sourceHtmlPath: htmlPath,
          seasonFs: result.seasonFs,
          countrySlug: result.countrySlug,
          sofascoreTeamId: entry.sofascoreTeamId ?? null,
          teamId: result.teamId,
          teamSlug: result.teamSlug,
          parsedAtUtc: new Date().toISOString(),
          force: options.force,
        });
      }

      summary.parsed += 1;
      summary.parsedBySource[entry.source] += 1;
    } catch (error) {
      summary.failed += 1;
      summary.failedEntries.push({
        source: entry.source,
        htmlPath: entry.htmlPath,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return summary;
}

async function readCaptureManifest(manifestPath: string): Promise<TeamPageCaptureManifest> {
  try {
    const raw = await readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw) as TeamPageCaptureManifest;
    return {
      generatedAtUtc: parsed.generatedAtUtc,
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    };
  } catch {
    return {
      generatedAtUtc: new Date(0).toISOString(),
      entries: [],
    };
  }
}
