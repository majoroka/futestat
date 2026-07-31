import path from "node:path";

import type {
  TeamPageCaptureManifestEntry,
  TeamPageCaptureSource,
} from "../../domain/team-page-capture.js";

export interface TeamPageCaptureOptions {
  source: TeamPageCaptureSource;
  season: string;
  teamId: string;
  teamSlug: string;
  url: string;
  competitionId?: string;
  competitionSlug?: string;
  countrySlug?: string;
  force: boolean;
  note?: string;
}

export function validateTeamPageCaptureOptions(options: TeamPageCaptureOptions): void {
  if (!/^\d{4}-\d{4}$/.test(options.season)) {
    throw new Error(`Invalid season "${options.season}". Expected YYYY-YYYY.`);
  }

  if (!options.teamId.trim()) {
    throw new Error("teamId is required.");
  }

  if (!isSafeSlug(options.teamSlug)) {
    throw new Error(
      `Invalid teamSlug "${options.teamSlug}". Expected lowercase ASCII with hyphens.`,
    );
  }

  try {
    const url = new URL(options.url);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error();
    }
  } catch {
    throw new Error(`Invalid url "${options.url}".`);
  }

  if (options.source === "fotmob") {
    if (!options.competitionId?.trim()) {
      throw new Error('competitionId is required when source="fotmob".');
    }

    if (!options.competitionSlug || !isSafeSlug(options.competitionSlug)) {
      throw new Error(
        `Invalid competitionSlug "${options.competitionSlug ?? ""}" for source="fotmob".`,
      );
    }
  }

  if (options.source === "soccer-rating") {
    if (!options.countrySlug || !isSafeSlug(options.countrySlug)) {
      throw new Error(
        `Invalid countrySlug "${options.countrySlug ?? ""}" for source="soccer-rating".`,
      );
    }
  }
}

export function deriveTeamPageHtmlPath(repoRoot: string, options: TeamPageCaptureOptions): string {
  const baseDir = path.join(repoRoot, "raw", "team-pages", options.source, options.season);
  const fileName = `${options.teamId}-${options.teamSlug}.html`;

  if (options.source === "fotmob") {
    return path.join(
      baseDir,
      `${options.competitionId}-${options.competitionSlug}`,
      fileName,
    );
  }

  return path.join(baseDir, String(options.countrySlug), fileName);
}

export function buildTeamPageManifestEntry(params: {
  repoRoot: string;
  options: TeamPageCaptureOptions;
  htmlPath: string;
  finalUrl?: string;
  capturedAtUtc: string;
}): TeamPageCaptureManifestEntry {
  const { repoRoot, options, htmlPath, capturedAtUtc } = params;

  return {
    source: options.source,
    season: options.season,
    teamId: options.teamId,
    teamSlug: options.teamSlug,
    competitionId: options.source === "fotmob" ? String(options.competitionId) : null,
    competitionSlug: options.source === "fotmob" ? String(options.competitionSlug) : null,
    countrySlug: options.source === "soccer-rating" ? String(options.countrySlug) : null,
    url: params.finalUrl ?? options.url,
    htmlPath: toProjectRelativePath(repoRoot, htmlPath),
    capturedAtUtc,
  };
}

function toProjectRelativePath(repoRoot: string, filePath: string): string {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}

function isSafeSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
