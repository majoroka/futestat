import { readFile } from "node:fs/promises";
import path from "node:path";

import type { TeamPageCaptureSource } from "../../domain/team-page-capture.js";
import type { TeamSourceRegistry, TeamSourceRegistryEntry } from "../../domain/team-source-registry.js";
import type { TeamPageCaptureOptions, TeamPageCaptureResult } from "./team-page-capture.js";
import { captureTeamPage } from "./team-page-capture.js";

export interface BatchCaptureTeamPagesOptions {
  registryPath?: string;
  source?: "all" | TeamPageCaptureSource;
  season: string;
  onlyActive?: boolean;
  onlyMapped?: boolean;
  teamId?: string;
  competitionId?: string;
  limit?: number;
  delayMs?: number;
  force?: boolean;
  dryRun?: boolean;
}

export interface BatchCapturePlanItem {
  source: TeamPageCaptureSource;
  sofascoreTeamId: string;
  teamName: string;
  competitionId: string | null;
  competitionName: string | null;
  countryName: string | null;
  captureOptions: TeamPageCaptureOptions;
}

export interface BatchCaptureSummary {
  registryPath: string;
  season: string;
  selectedEntries: number;
  plannedCaptures: number;
  captured: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  sourceSummary: Record<TeamPageCaptureSource, { planned: number; captured: number; skipped: number; failed: number }>;
  results: Array<
    | { status: "captured"; item: BatchCapturePlanItem; result: TeamPageCaptureResult }
    | { status: "skipped"; item: BatchCapturePlanItem; reason: string }
    | { status: "failed"; item: BatchCapturePlanItem; error: string }
  >;
}

export async function captureTeamPagesBatch(
  repoRoot: string,
  options: BatchCaptureTeamPagesOptions,
): Promise<BatchCaptureSummary> {
  validateBatchCaptureOptions(options);

  const registryPath = path.resolve(
    repoRoot,
    options.registryPath ?? path.join("data", "team-source-registry.json"),
  );
  const registry = await readRegistry(registryPath);
  const plan = buildBatchCapturePlan(registry, options);
  const dryRun = options.dryRun ?? false;
  const delayMs = Math.max(0, options.delayMs ?? 1_200);

  const summary: BatchCaptureSummary = {
    registryPath,
    season: options.season,
    selectedEntries: selectEntries(registry.entries, options).length,
    plannedCaptures: plan.length,
    captured: 0,
    skipped: 0,
    failed: 0,
    dryRun,
    sourceSummary: {
      fotmob: { planned: 0, captured: 0, skipped: 0, failed: 0 },
      "soccer-rating": { planned: 0, captured: 0, skipped: 0, failed: 0 },
    },
    results: [],
  };

  for (const item of plan) {
    summary.sourceSummary[item.source].planned += 1;
  }

  let lastCaptureAtMs = 0;

  for (const item of plan) {
    if (dryRun) {
      summary.skipped += 1;
      summary.sourceSummary[item.source].skipped += 1;
      summary.results.push({
        status: "skipped",
        item,
        reason: "dry-run",
      });
      continue;
    }

    const waitMs = delayMs - (Date.now() - lastCaptureAtMs);
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    try {
      const result = await captureTeamPage(repoRoot, item.captureOptions);
      lastCaptureAtMs = Date.now();
      summary.captured += 1;
      summary.sourceSummary[item.source].captured += 1;
      summary.results.push({
        status: "captured",
        item,
        result,
      });
    } catch (error) {
      lastCaptureAtMs = Date.now();
      summary.failed += 1;
      summary.sourceSummary[item.source].failed += 1;
      summary.results.push({
        status: "failed",
        item,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return summary;
}

export function buildBatchCapturePlan(
  registry: TeamSourceRegistry,
  options: BatchCaptureTeamPagesOptions,
): BatchCapturePlanItem[] {
  const selectedEntries = selectEntries(registry.entries, options);
  const source = options.source ?? "all";
  const onlyMapped = options.onlyMapped ?? true;
  const force = options.force ?? false;
  const items: BatchCapturePlanItem[] = [];

  for (const entry of selectedEntries) {
    if (source === "all" || source === "fotmob") {
      const fotmob = entry.sources.fotmob;
      if (
        (!onlyMapped || fotmob.status === "mapped") &&
        fotmob.sourceTeamId &&
        fotmob.teamSlug &&
        fotmob.url &&
        fotmob.competitionId &&
        fotmob.competitionSlug
      ) {
        items.push({
          source: "fotmob",
          sofascoreTeamId: entry.sofascoreTeamId,
          teamName: entry.teamName,
          competitionId: entry.competitionId,
          competitionName: entry.competitionName,
          countryName: entry.countryName,
          captureOptions: {
            source: "fotmob",
            season: options.season,
            sofascoreTeamId: entry.sofascoreTeamId,
            teamId: fotmob.sourceTeamId,
            teamSlug: fotmob.teamSlug,
            url: fotmob.url,
            competitionId: fotmob.competitionId,
            competitionSlug: fotmob.competitionSlug,
            force,
            note: `batch-capture:${entry.teamName}`,
          },
        });
      }
    }

    if (source === "all" || source === "soccer-rating") {
      const soccerRating = entry.sources.soccerRating;
      if (
        (!onlyMapped || soccerRating.status === "mapped") &&
        soccerRating.sourceTeamId &&
        soccerRating.teamSlug &&
        soccerRating.url &&
        soccerRating.countrySlug
      ) {
        items.push({
          source: "soccer-rating",
          sofascoreTeamId: entry.sofascoreTeamId,
          teamName: entry.teamName,
          competitionId: entry.competitionId,
          competitionName: entry.competitionName,
          countryName: entry.countryName,
          captureOptions: {
            source: "soccer-rating",
            season: options.season,
            sofascoreTeamId: entry.sofascoreTeamId,
            teamId: soccerRating.sourceTeamId,
            teamSlug: soccerRating.teamSlug,
            url: soccerRating.url,
            countrySlug: soccerRating.countrySlug,
            force,
            note: `batch-capture:${entry.teamName}`,
          },
        });
      }
    }
  }

  return items.slice(0, options.limit && options.limit > 0 ? options.limit : items.length);
}

function selectEntries(
  entries: TeamSourceRegistryEntry[],
  options: BatchCaptureTeamPagesOptions,
): TeamSourceRegistryEntry[] {
  return entries.filter((entry) => {
    if (options.onlyActive && !entry.activeInCurrentWindow) {
      return false;
    }
    if (options.teamId && entry.sofascoreTeamId !== options.teamId) {
      return false;
    }
    if (options.competitionId && entry.competitionId !== options.competitionId) {
      return false;
    }
    return true;
  });
}

function validateBatchCaptureOptions(options: BatchCaptureTeamPagesOptions): void {
  if (!/^\d{4}-\d{4}$/.test(options.season)) {
    throw new Error(`Invalid season "${options.season}". Expected YYYY-YYYY.`);
  }

  if (options.source && options.source !== "all" && options.source !== "fotmob" && options.source !== "soccer-rating") {
    throw new Error(`Invalid source "${String(options.source)}". Expected all, fotmob or soccer-rating.`);
  }
}

async function readRegistry(registryPath: string): Promise<TeamSourceRegistry> {
  const raw = await readFile(registryPath, "utf8");
  return JSON.parse(raw) as TeamSourceRegistry;
}
