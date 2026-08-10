import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { DEFAULT_ALLOWED_COMPETITIONS } from "../../config/competition-whitelist.js";
import type {
  TeamMappingCompetitionReport,
  TeamMappingReport,
  TeamMappingTeamReport,
} from "../../domain/team-mapping-report.js";
import type { TeamSourceRegistry } from "../../domain/team-source-registry.js";

export interface GenerateTeamMappingReportOptions {
  registryPath?: string;
  outputPath?: string;
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
  const registry = await readJsonRequired<TeamSourceRegistry>(
    registryPath,
    `Team source registry not found at ${registryPath}.`,
  );

  const competitionMap = new Map<string, TeamMappingCompetitionReport>();
  seedWhitelistCompetitions(competitionMap);

  for (const entry of registry.entries) {
    const competitionKey = buildCompetitionKey(
      entry.competitionId,
      entry.competitionName,
      entry.countryName,
    );
    let competition = competitionMap.get(competitionKey);

    if (!competition) {
      competition = {
        competitionId: entry.competitionId,
        competitionName: entry.competitionName,
        countryName: entry.countryName,
        seededFromWhitelist: false,
        hasRegistryEntries: false,
        teamCount: 0,
        activeTeams: 0,
        coverage: {
          complete: 0,
          partial: 0,
          missing: 0,
          fotmobMapped: 0,
          soccerRatingMapped: 0,
        },
        teams: [],
      };
      competitionMap.set(competitionKey, competition);
    }

    competition.hasRegistryEntries = true;
    if (!competition.competitionName && entry.competitionName) {
      competition.competitionName = entry.competitionName;
    }
    if (!competition.countryName && entry.countryName) {
      competition.countryName = entry.countryName;
    }
    competition.teams.push(entryToTeamReport(entry));
  }

  const competitions = Array.from(competitionMap.values())
    .map(finalizeCompetition)
    .sort(compareCompetitions);

  const report: TeamMappingReport = {
    source: "team-source-registry",
    generatedAtUtc: new Date().toISOString(),
    referenceDate: registry.referenceDate,
    registryPath: toProjectRelativePath(repoRoot, registryPath),
    summary: {
      competitions: competitions.length,
      whitelistCompetitions: competitions.filter((competition) => competition.seededFromWhitelist).length,
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

function entryToTeamReport(entry: TeamSourceRegistry["entries"][number]): TeamMappingTeamReport {
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
    teamName: entry.teamName,
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

function seedWhitelistCompetitions(
  competitionMap: Map<string, TeamMappingCompetitionReport>,
): void {
  for (const competition of DEFAULT_ALLOWED_COMPETITIONS) {
    const key = buildCompetitionKey(
      competition.competitionId,
      competition.competitionName,
      competition.countryName,
    );

    if (competitionMap.has(key)) {
      continue;
    }

    competitionMap.set(key, {
      competitionId: competition.competitionId,
      competitionName: competition.competitionName,
      countryName: competition.countryName,
      seededFromWhitelist: true,
      hasRegistryEntries: false,
      teamCount: 0,
      activeTeams: 0,
      coverage: {
        complete: 0,
        partial: 0,
        missing: 0,
        fotmobMapped: 0,
        soccerRatingMapped: 0,
      },
      teams: [],
    });
  }
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

function buildCompetitionKey(
  competitionId: string | null,
  competitionName: string | null,
  countryName: string | null,
): string {
  if (competitionId) {
    return `id::${competitionId}`;
  }

  return [competitionId ?? "", competitionName ?? "", countryName ?? ""].join("::");
}

async function readJsonRequired<T>(filePath: string, missingMessage: string): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(missingMessage);
  }
}

function toProjectRelativePath(repoRoot: string, filePath: string): string {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}
