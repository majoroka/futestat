import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getCompetitionTeamSeeds } from "../../config/competition-team-seeds.js";
import { DEFAULT_ALLOWED_COMPETITIONS } from "../../config/competition-whitelist.js";
import type { CompetitionStandingsSnapshot } from "../../domain/competition-standings.js";
import type {
  TeamMappingCompetitionReport,
  TeamMappingReport,
  TeamMappingTeamReport,
} from "../../domain/team-mapping-report.js";
import type {
  TeamSourceRegistry,
  TeamSourceRegistryEntry,
} from "../../domain/team-source-registry.js";
import {
  findBestTeamNameMatch,
  type TeamNameMatchMethod,
} from "../../lib/team-name-matcher.js";

const STANDINGS_TEAM_NAME_CANONICAL_BY_COMPETITION = new Map<string, Map<string, string>>([
  [
    "49",
    new Map([
      ["banik", "Baník Ostrava"],
      ["artis", "SK Artis Brno"],
      ["slovacko", "1. FC Slovácko"],
      ["pardubice", "FK Pardubice"],
      ["zlin", "FC Zlín"],
      ["sigma olomouc", "SK Sigma Olomouc"],
    ]),
  ],
  [
    "211",
    new Map([
      ["dukla", "Banská Bystrica"],
      ["slovan bratislava", "Slovan"],
    ]),
  ],
]);

export interface GenerateTeamMappingReportOptions {
  registryPath?: string;
  outputPath?: string;
  standingsDir?: string;
  write: boolean;
}

export interface GenerateTeamMappingReportResult {
  report: TeamMappingReport;
  outputPath: string | null;
}

export async function generateTeamMappingReport(
  repoRoot: string,
  options: GenerateTeamMappingReportOptions,
): Promise<GenerateTeamMappingReportResult> {
  const registryPath = path.resolve(
    repoRoot,
    options.registryPath ?? path.join("data", "team-source-registry.json"),
  );
  const standingsDir = path.resolve(
    repoRoot,
    options.standingsDir ?? path.join("data", "fixtures", "standings"),
  );

  const registry = await readJsonRequired<TeamSourceRegistry>(
    registryPath,
    `Team source registry not found at ${registryPath}.`,
  );
  const standingsMap = await readStandingsSnapshots(standingsDir);

  const competitions = DEFAULT_ALLOWED_COMPETITIONS
    .map((competition) =>
      buildCompetitionReport(
        competition,
        standingsMap.get(competition.competitionId) ?? null,
        registry,
      ),
    )
    .sort(compareCompetitions);

  const report: TeamMappingReport = {
    source: "team-source-registry",
    generatedAtUtc: new Date().toISOString(),
    referenceDate: registry.referenceDate,
    registryPath: toProjectRelativePath(repoRoot, registryPath),
    summary: {
      competitions: competitions.length,
      whitelistCompetitions: competitions.length,
      competitionsWithRegistryEntries: competitions.filter((competition) => competition.hasRegistryEntries).length,
      competitionsWithoutRegistryEntries: competitions.filter((competition) => !competition.hasRegistryEntries).length,
      teams: competitions.reduce((total, competition) => total + competition.teamCount, 0),
      activeTeams: competitions.reduce((total, competition) => total + competition.activeTeams, 0),
      complete: competitions.reduce((total, competition) => total + competition.coverage.complete, 0),
      partial: competitions.reduce((total, competition) => total + competition.coverage.partial, 0),
      missing: competitions.reduce((total, competition) => total + competition.coverage.missing, 0),
      fotmobMapped: competitions.reduce(
        (total, competition) => total + competition.coverage.fotmobMapped,
        0,
      ),
      soccerRatingMapped: competitions.reduce(
        (total, competition) => total + competition.coverage.soccerRatingMapped,
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
    options.outputPath ?? path.join("data", "team-mapping", "latest.json"),
  );
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");

  return {
    report,
    outputPath,
  };
}

function buildCompetitionReport(
  competition: (typeof DEFAULT_ALLOWED_COMPETITIONS)[number],
  standings: CompetitionStandingsSnapshot | null,
  registry: TeamSourceRegistry,
): TeamMappingCompetitionReport {
  const directRegistryEntries = registry.entries.filter(
    (entry) => entry.competitionId === competition.competitionId,
  );
  const seededTeamNames = getCompetitionTeamSeeds(competition.competitionId).map((entry) => entry.teamName);

  const teams = standings
    ? extractTeamNamesFromStandings(standings).map((teamName) => {
      const matched = findRegistryEntry(
        registry,
        competition.competitionId,
        competition.countryName,
        teamName,
      );

      if (!matched) {
        return createMissingTeamReport(teamName);
      }

      return entryToTeamReport(matched.entry, teamName);
    })
    : seededTeamNames.length > 0
      ? seededTeamNames.map((teamName) => {
        const matched = findRegistryEntry(
          registry,
          competition.competitionId,
          competition.countryName,
          teamName,
        );

        if (!matched) {
          return createMissingTeamReport(teamName);
        }

        return entryToTeamReport(matched.entry, teamName);
      })
      : directRegistryEntries.map((entry) => entryToTeamReport(entry));

  const hasRegistryEntries =
    directRegistryEntries.length > 0 ||
    teams.some((team) => team.mappingState !== "missing");

  return finalizeCompetition({
    competitionId: competition.competitionId,
    competitionName: competition.competitionName,
    countryName: competition.countryName,
    seededFromWhitelist: true,
    hasRegistryEntries,
    teamCount: 0,
    activeTeams: 0,
    coverage: {
      complete: 0,
      partial: 0,
      missing: 0,
      fotmobMapped: 0,
      soccerRatingMapped: 0,
    },
    teams,
  });
}

function entryToTeamReport(
  entry: TeamSourceRegistryEntry,
  displayTeamName = entry.teamName,
): TeamMappingTeamReport {
  const fotmobMapped = entry.sources.fotmob.status === "mapped";
  const soccerRatingMapped = entry.sources.soccerRating.status === "mapped";
  const mappingState = fotmobMapped && soccerRatingMapped
    ? "complete"
    : fotmobMapped || soccerRatingMapped
      ? "partial"
      : "missing";

  const recommendedNextSteps: string[] = [];
  if (!fotmobMapped && entry.sources.fotmob.status !== "not_applicable") {
    recommendedNextSteps.push("map_fotmob");
  }
  if (!soccerRatingMapped && entry.sources.soccerRating.status !== "not_applicable") {
    recommendedNextSteps.push("map_soccer_rating");
  }

  return {
    sofascoreTeamId: entry.sofascoreTeamId,
    teamName: displayTeamName,
    activeInCurrentWindow: entry.activeInCurrentWindow,
    fixtureAppearancesInCurrentWindow: entry.fixtureAppearancesInCurrentWindow,
    firstSeenReferenceDate: entry.firstSeenReferenceDate,
    lastSeenReferenceDate: entry.lastSeenReferenceDate,
    sources: {
      fotmob: {
        status: entry.sources.fotmob.status,
        sourceTeamId: entry.sources.fotmob.sourceTeamId,
        teamSlug: entry.sources.fotmob.teamSlug,
        url: entry.sources.fotmob.url,
        notes: entry.sources.fotmob.notes,
      },
      soccerRating: {
        status: entry.sources.soccerRating.status,
        sourceTeamId: entry.sources.soccerRating.sourceTeamId,
        teamSlug: entry.sources.soccerRating.teamSlug,
        url: entry.sources.soccerRating.url,
        notes: entry.sources.soccerRating.notes,
      },
    },
    mappingState,
    recommendedNextSteps,
  };
}

function createMissingTeamReport(teamName: string): TeamMappingTeamReport {
  return {
    sofascoreTeamId: "",
    teamName,
    activeInCurrentWindow: false,
    fixtureAppearancesInCurrentWindow: 0,
    firstSeenReferenceDate: "",
    lastSeenReferenceDate: "",
    sources: {
      fotmob: {
        status: "pending",
        sourceTeamId: null,
        teamSlug: null,
        url: null,
        notes: null,
      },
      soccerRating: {
        status: "pending",
        sourceTeamId: null,
        teamSlug: null,
        url: null,
        notes: null,
      },
    },
    mappingState: "missing",
    recommendedNextSteps: ["map_fotmob", "map_soccer_rating"],
  };
}

function findRegistryEntry(
  registry: TeamSourceRegistry,
  competitionId: string,
  countryName: string,
  teamName: string,
): { entry: TeamSourceRegistryEntry; matchMethod: TeamNameMatchMethod } | null {
  const sameCompetition = matchRegistryEntries(
    registry.entries.filter((entry) => entry.competitionId === competitionId),
    teamName,
  );
  if (sameCompetition) {
    return sameCompetition;
  }

  const sameCountry = matchRegistryEntries(
    registry.entries.filter((entry) => entry.countryName === countryName),
    teamName,
  );
  if (sameCountry) {
    return sameCountry;
  }

  return matchRegistryEntries(registry.entries, teamName);
}

function matchRegistryEntries(
  entries: TeamSourceRegistryEntry[],
  teamName: string,
): { entry: TeamSourceRegistryEntry; matchMethod: TeamNameMatchMethod } | null {
  const bestMatch = findBestTeamNameMatch(
    teamName,
    entries.map((entry) => ({
      candidate: entry,
      name: entry.teamName,
    })),
  );

  if (!bestMatch) {
    return null;
  }

  return {
    entry: bestMatch.candidate,
    matchMethod: bestMatch.matchMethod,
  };
}

function finalizeCompetition(competition: TeamMappingCompetitionReport): TeamMappingCompetitionReport {
  competition.teams.sort(compareTeams);
  competition.teamCount = competition.teams.length;
  competition.activeTeams = competition.teams.filter((team) => team.activeInCurrentWindow).length;
  competition.coverage = competition.teams.reduce(
    (summary, team) => {
      if (team.mappingState === "complete") {
        summary.complete += 1;
      } else if (team.mappingState === "partial") {
        summary.partial += 1;
      } else {
        summary.missing += 1;
      }

      if (team.sources.fotmob.status === "mapped") {
        summary.fotmobMapped += 1;
      }
      if (team.sources.soccerRating.status === "mapped") {
        summary.soccerRatingMapped += 1;
      }
      return summary;
    },
    {
      complete: 0,
      partial: 0,
      missing: 0,
      fotmobMapped: 0,
      soccerRatingMapped: 0,
    },
  );

  return competition;
}

function extractTeamNamesFromStandings(snapshot: CompetitionStandingsSnapshot): string[] {
  const teams = new Set<string>();

  for (const table of snapshot.tables ?? []) {
    for (const row of table.rows ?? []) {
      const teamName = canonicalizeStandingsTeamName(
        snapshot.competitionId,
        String(row.teamName ?? "").trim(),
      );
      if (teamName) {
        teams.add(teamName);
      }
    }
  }

  return Array.from(teams);
}

function canonicalizeStandingsTeamName(
  competitionId: string | null,
  teamName: string,
): string {
  if (!competitionId || !teamName) {
    return teamName;
  }

  const competitionAliases = STANDINGS_TEAM_NAME_CANONICAL_BY_COMPETITION.get(competitionId);
  if (!competitionAliases) {
    return teamName;
  }

  return competitionAliases.get(normalizeAliasKey(teamName)) ?? teamName;
}

function normalizeAliasKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
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
  left: TeamMappingCompetitionReport,
  right: TeamMappingCompetitionReport,
): number {
  return (
    Number(right.hasRegistryEntries) - Number(left.hasRegistryEntries) ||
    String(left.countryName ?? "").localeCompare(String(right.countryName ?? "")) ||
    String(left.competitionName ?? "").localeCompare(String(right.competitionName ?? "")) ||
    String(left.competitionId ?? "").localeCompare(String(right.competitionId ?? ""))
  );
}

function compareTeams(left: TeamMappingTeamReport, right: TeamMappingTeamReport): number {
  return (
    Number(right.activeInCurrentWindow) - Number(left.activeInCurrentWindow) ||
    compareMappingState(left.mappingState, right.mappingState) ||
    left.teamName.localeCompare(right.teamName)
  );
}

function compareMappingState(
  left: TeamMappingTeamReport["mappingState"],
  right: TeamMappingTeamReport["mappingState"],
): number {
  return mappingPriority(left) - mappingPriority(right);
}

function mappingPriority(value: TeamMappingTeamReport["mappingState"]): number {
  switch (value) {
    case "missing":
      return 0;
    case "partial":
      return 1;
    case "complete":
      return 2;
  }
}

async function readJsonRequired<T>(filePath: string, missingMessage: string): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(missingMessage);
  }
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
