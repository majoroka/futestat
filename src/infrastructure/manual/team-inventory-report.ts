import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { DEFAULT_ALLOWED_COMPETITIONS } from "../../config/competition-whitelist.js";
import type { CompetitionStandingsSnapshot } from "../../domain/competition-standings.js";
import type {
  TeamInventoryCompetitionReport,
  TeamInventoryReport,
  TeamInventoryTeamReport,
} from "../../domain/team-inventory.js";
import type {
  TeamSourceRegistry,
  TeamSourceRegistryEntry,
} from "../../domain/team-source-registry.js";
import {
  findBestTeamNameMatch,
  type TeamNameMatchMethod,
} from "../../lib/team-name-matcher.js";

export interface GenerateTeamInventoryReportOptions {
  registryPath?: string;
  standingsDir?: string;
  outputPath?: string;
  write: boolean;
}

export interface GenerateTeamInventoryReportResult {
  report: TeamInventoryReport;
  outputPath: string | null;
}

export async function generateTeamInventoryReport(
  repoRoot: string,
  options: GenerateTeamInventoryReportOptions,
): Promise<GenerateTeamInventoryReportResult> {
  const registryPath = path.resolve(
    repoRoot,
    options.registryPath ?? path.join("data", "team-source-registry.json"),
  );
  const standingsDir = path.resolve(
    repoRoot,
    options.standingsDir ?? path.join("data", "fixtures", "standings"),
  );
  const registry = await readJsonOptional<TeamSourceRegistry>(registryPath);
  const standingsMap = await readStandingsSnapshots(standingsDir);

  const competitions = DEFAULT_ALLOWED_COMPETITIONS
    .map((competition) => buildCompetitionReport(repoRoot, competition, standingsMap, registry))
    .sort(compareCompetitions);

  const report: TeamInventoryReport = {
    source: "whitelist-plus-standings",
    generatedAtUtc: new Date().toISOString(),
    referenceDate: registry?.referenceDate ?? null,
    registryPath: registry ? toProjectRelativePath(repoRoot, registryPath) : null,
    standingsDir: toProjectRelativePath(repoRoot, standingsDir),
    summary: {
      competitions: competitions.length,
      competitionsWithStandings: competitions.filter((competition) => competition.hasStandingsSnapshot).length,
      competitionsWithoutStandings: competitions.filter((competition) => !competition.hasStandingsSnapshot).length,
      teams: competitions.reduce((total, competition) => total + competition.teamCount, 0),
      matchedRegistryTeams: competitions.reduce(
        (total, competition) => total + competition.matchedRegistryTeams,
        0,
      ),
      missingRegistryTeams: competitions.reduce(
        (total, competition) => total + competition.missingRegistryTeams,
        0,
      ),
    },
    competitions,
  };

  if (!options.write) {
    return {
      report,
      outputPath: null,
    };
  }

  const outputPath = path.resolve(
    repoRoot,
    options.outputPath ?? path.join("data", "team-inventory", "latest.json"),
  );
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");

  return {
    report,
    outputPath,
  };
}

function buildCompetitionReport(
  repoRoot: string,
  competition: (typeof DEFAULT_ALLOWED_COMPETITIONS)[number],
  standingsMap: Map<string, CompetitionStandingsSnapshot>,
  registry: TeamSourceRegistry | null,
): TeamInventoryCompetitionReport {
  const standings = standingsMap.get(competition.competitionId) ?? null;
  const inventoryTeams = standings
    ? extractTeamNamesFromStandings(standings)
    : extractTeamsFromRegistry(registry, competition.competitionId);

  const teams = inventoryTeams
    .map((teamName) => buildTeamReport(teamName, registry, competition.competitionId))
    .sort(compareTeams);

  return {
    competitionId: competition.competitionId,
    competitionName: competition.competitionName,
    countryName: competition.countryName,
    hasStandingsSnapshot: standings !== null,
    standingsPath: standings ? toProjectRelativePath(repoRoot, path.join("data", "fixtures", "standings", `${competition.competitionId}.json`)) : null,
    teamCount: teams.length,
    matchedRegistryTeams: teams.filter((team) => team.matchedRegistry).length,
    missingRegistryTeams: teams.filter((team) => !team.matchedRegistry).length,
    teams,
  };
}

function buildTeamReport(
  inventoryTeamName: string,
  registry: TeamSourceRegistry | null,
  competitionId: string,
): TeamInventoryTeamReport {
  const registryMatch = findRegistryEntry(registry, competitionId, inventoryTeamName);

  if (!registryMatch) {
    return {
      inventoryTeamName,
      source: "standings",
      matchedRegistry: false,
      matchMethod: null,
      sofascoreTeamId: null,
      registryTeamName: null,
      sources: {
        fotmob: {
          status: "unknown",
          sourceTeamId: null,
          url: null,
        },
        soccerRating: {
          status: "unknown",
          sourceTeamId: null,
          url: null,
        },
      },
    };
  }

  return {
    inventoryTeamName,
    source: "standings",
    matchedRegistry: true,
    matchMethod: registryMatch.matchMethod,
    sofascoreTeamId: emptyToNull(registryMatch.entry.sofascoreTeamId),
    registryTeamName: registryMatch.entry.teamName,
    sources: {
      fotmob: {
        status: registryMatch.entry.sources.fotmob.status,
        sourceTeamId: registryMatch.entry.sources.fotmob.sourceTeamId,
        url: registryMatch.entry.sources.fotmob.url,
      },
      soccerRating: {
        status: registryMatch.entry.sources.soccerRating.status,
        sourceTeamId: registryMatch.entry.sources.soccerRating.sourceTeamId,
        url: registryMatch.entry.sources.soccerRating.url,
      },
    },
  };
}

function findRegistryEntry(
  registry: TeamSourceRegistry | null,
  competitionId: string,
  inventoryTeamName: string,
): { entry: TeamSourceRegistryEntry; matchMethod: TeamNameMatchMethod } | null {
  if (!registry) {
    return null;
  }

  const bestMatch = findBestTeamNameMatch(
    inventoryTeamName,
    registry.entries
      .filter((entry) => entry.competitionId === competitionId)
      .map((entry) => ({
        candidate: entry,
        name: entry.teamName,
      })),
  );

  if (bestMatch) {
    return {
      entry: bestMatch.candidate,
      matchMethod: bestMatch.matchMethod,
    };
  }

  return null;
}

function extractTeamNamesFromStandings(snapshot: CompetitionStandingsSnapshot): string[] {
  const teams = new Set<string>();

  for (const table of snapshot.tables ?? []) {
    for (const row of table.rows ?? []) {
      const teamName = String(row.teamName ?? "").trim();
      if (teamName) {
        teams.add(teamName);
      }
    }
  }

  return Array.from(teams);
}

function extractTeamsFromRegistry(
  registry: TeamSourceRegistry | null,
  competitionId: string,
): string[] {
  if (!registry) {
    return [];
  }

  return registry.entries
    .filter((entry) => entry.competitionId === competitionId)
    .map((entry) => entry.teamName);
}

async function readStandingsSnapshots(
  standingsDir: string,
): Promise<Map<string, CompetitionStandingsSnapshot>> {
  const map = new Map<string, CompetitionStandingsSnapshot>();

  try {
    const files = await readdir(standingsDir);

    for (const fileName of files) {
      if (!fileName.endsWith(".json")) {
        continue;
      }

      const filePath = path.join(standingsDir, fileName);
      const snapshot = await readJsonOptional<CompetitionStandingsSnapshot>(filePath);
      if (snapshot?.competitionId) {
        map.set(snapshot.competitionId, snapshot);
      }
    }
  } catch {
    return map;
  }

  return map;
}

function compareCompetitions(
  left: TeamInventoryCompetitionReport,
  right: TeamInventoryCompetitionReport,
): number {
  return (
    Number(right.hasStandingsSnapshot) - Number(left.hasStandingsSnapshot) ||
    left.countryName.localeCompare(right.countryName) ||
    left.competitionName.localeCompare(right.competitionName) ||
    left.competitionId.localeCompare(right.competitionId)
  );
}

function compareTeams(left: TeamInventoryTeamReport, right: TeamInventoryTeamReport): number {
  return (
    Number(right.matchedRegistry) - Number(left.matchedRegistry) ||
    left.inventoryTeamName.localeCompare(right.inventoryTeamName, "pt")
  );
}

function emptyToNull(value: string | null | undefined): string | null {
  return value && value.trim() ? value : null;
}

async function readJsonOptional<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function toProjectRelativePath(repoRoot: string, filePath: string): string {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}
