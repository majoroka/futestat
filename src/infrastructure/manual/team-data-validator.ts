import { access, readFile } from "node:fs/promises";
import path from "node:path";

import type { TeamContextIndex, TeamContextSnapshot } from "../../domain/team-context.js";
import type { TeamPageCaptureManifest } from "../../domain/team-page-capture.js";
import type { TeamStatsIndex, TeamStatsSeasonSnapshot } from "../../domain/team-stats.js";

export interface TeamDataValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  path: string | null;
}

export interface TeamDataValidationSummary {
  checkedAtUtc: string;
  captures: {
    manifestPath: string;
    entries: number;
  };
  teamStats: {
    indexPath: string;
    entries: number;
  };
  teamContext: {
    indexPath: string;
    entries: number;
  };
  issues: TeamDataValidationIssue[];
}

export async function validateTeamDataArtifacts(
  repoRoot: string,
): Promise<TeamDataValidationSummary> {
  const captureManifestPath = path.join(repoRoot, "raw", "team-pages", "manifest.json");
  const teamStatsIndexPath = path.join(repoRoot, "data", "team-stats", "fotmob", "index.json");
  const teamContextIndexPath = path.join(
    repoRoot,
    "data",
    "team-context",
    "soccer-rating",
    "index.json",
  );

  const issues: TeamDataValidationIssue[] = [];
  const captures = await readJsonOrNull<TeamPageCaptureManifest>(captureManifestPath);
  const teamStatsIndex = await readJsonOrNull<TeamStatsIndex>(teamStatsIndexPath);
  const teamContextIndex = await readJsonOrNull<TeamContextIndex>(teamContextIndexPath);

  if (!captures) {
    issues.push(warning("capture_manifest_missing", "Capture manifest is missing.", captureManifestPath));
  }

  if (!teamStatsIndex) {
    issues.push(warning("team_stats_index_missing", "Team stats index is missing.", teamStatsIndexPath));
  }

  if (!teamContextIndex) {
    issues.push(
      warning("team_context_index_missing", "Team context index is missing.", teamContextIndexPath),
    );
  }

  const captureEntries = captures?.entries ?? [];
  const teamStatsEntries = teamStatsIndex?.entries ?? [];
  const teamContextEntries = teamContextIndex?.entries ?? [];
  const captureHtmlPaths = new Set<string>();

  for (const entry of captureEntries) {
    if (!entry.source || !entry.season || !entry.teamId || !entry.teamSlug || !entry.url || !entry.htmlPath) {
      issues.push(error("capture_entry_invalid", "Capture entry is missing required fields.", entry.htmlPath ?? null));
      continue;
    }

    captureHtmlPaths.add(normalizePath(entry.htmlPath));

    if (!(await fileExists(path.resolve(repoRoot, entry.htmlPath)))) {
      issues.push(error("capture_html_missing", "Captured HTML file is missing.", entry.htmlPath));
    }
  }

  for (const entry of teamStatsEntries) {
    const absoluteJsonPath = path.resolve(repoRoot, entry.jsonPath);
    const absoluteHtmlPath = path.resolve(repoRoot, entry.sourceHtmlPath);

    if (!(await fileExists(absoluteJsonPath))) {
      issues.push(error("team_stats_json_missing", "Team stats JSON file is missing.", entry.jsonPath));
      continue;
    }

    if (!(await fileExists(absoluteHtmlPath))) {
      issues.push(error("team_stats_source_html_missing", "Team stats source HTML file is missing.", entry.sourceHtmlPath));
    }

    if (!captureHtmlPaths.has(normalizePath(entry.sourceHtmlPath))) {
      issues.push(
        warning(
          "team_stats_source_not_in_manifest",
          "Team stats source HTML is not present in capture manifest.",
          entry.sourceHtmlPath,
        ),
      );
    }

    const snapshot = await readJsonOrNull<TeamStatsSeasonSnapshot>(absoluteJsonPath);
    if (!snapshot) {
      issues.push(error("team_stats_json_invalid", "Team stats JSON is invalid.", entry.jsonPath));
      continue;
    }

    validateTeamStatsSnapshot(entry, snapshot, issues);
  }

  for (const entry of teamContextEntries) {
    const absoluteJsonPath = path.resolve(repoRoot, entry.jsonPath);
    const absoluteHtmlPath = path.resolve(repoRoot, entry.sourceHtmlPath);

    if (!(await fileExists(absoluteJsonPath))) {
      issues.push(error("team_context_json_missing", "Team context JSON file is missing.", entry.jsonPath));
      continue;
    }

    if (!(await fileExists(absoluteHtmlPath))) {
      issues.push(
        error("team_context_source_html_missing", "Team context source HTML file is missing.", entry.sourceHtmlPath),
      );
    }

    if (!captureHtmlPaths.has(normalizePath(entry.sourceHtmlPath))) {
      issues.push(
        warning(
          "team_context_source_not_in_manifest",
          "Team context source HTML is not present in capture manifest.",
          entry.sourceHtmlPath,
        ),
      );
    }

    const snapshot = await readJsonOrNull<TeamContextSnapshot>(absoluteJsonPath);
    if (!snapshot) {
      issues.push(error("team_context_json_invalid", "Team context JSON is invalid.", entry.jsonPath));
      continue;
    }

    validateTeamContextSnapshot(entry, snapshot, issues);
  }

  return {
    checkedAtUtc: new Date().toISOString(),
    captures: {
      manifestPath: captureManifestPath,
      entries: captureEntries.length,
    },
    teamStats: {
      indexPath: teamStatsIndexPath,
      entries: teamStatsEntries.length,
    },
    teamContext: {
      indexPath: teamContextIndexPath,
      entries: teamContextEntries.length,
    },
    issues,
  };
}

function validateTeamStatsSnapshot(
  entry: TeamStatsIndex["entries"][number],
  snapshot: TeamStatsSeasonSnapshot,
  issues: TeamDataValidationIssue[],
): void {
  if (snapshot.source.provider !== "fotmob") {
    issues.push(error("team_stats_provider_invalid", 'team_stats source.provider must be "fotmob".', entry.jsonPath));
  }

  if (snapshot.team.id !== entry.teamId) {
    issues.push(error("team_stats_team_mismatch", "team_stats team id does not match index entry.", entry.jsonPath));
  }

  if (snapshot.competition.id !== entry.competitionId) {
    issues.push(error("team_stats_competition_mismatch", "team_stats competition id does not match index entry.", entry.jsonPath));
  }

  if (!snapshot.team.name || !snapshot.season.id || !snapshot.availability.status) {
    issues.push(error("team_stats_required_fields_missing", "team_stats JSON is missing required fields.", entry.jsonPath));
  }
}

function validateTeamContextSnapshot(
  entry: TeamContextIndex["entries"][number],
  snapshot: TeamContextSnapshot,
  issues: TeamDataValidationIssue[],
): void {
  if (snapshot.source.provider !== "soccer-rating") {
    issues.push(
      error("team_context_provider_invalid", 'team_context source.provider must be "soccer-rating".', entry.jsonPath),
    );
  }

  if (snapshot.team.id !== entry.teamId) {
    issues.push(error("team_context_team_mismatch", "team_context team id does not match index entry.", entry.jsonPath));
  }

  if (!snapshot.team.name || !snapshot.season.id || !snapshot.availability.status) {
    issues.push(error("team_context_required_fields_missing", "team_context JSON is missing required fields.", entry.jsonPath));
  }
}

async function readJsonOrNull<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizePath(value: string): string {
  return value.replaceAll(path.sep, "/");
}

function error(code: string, message: string, filePath: string | null): TeamDataValidationIssue {
  return { severity: "error", code, message, path: filePath };
}

function warning(code: string, message: string, filePath: string | null): TeamDataValidationIssue {
  return { severity: "warning", code, message, path: filePath };
}
