import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { PublicFixtureSnapshot } from "../../domain/fixture.js";
import type {
  TeamCoverageCompetitionReport,
  TeamCoverageReport,
  TeamCoverageSourceMatch,
  TeamCoverageTeamReport,
} from "../../domain/team-coverage.js";
import type { TeamContextIndex, TeamContextIndexEntry } from "../../domain/team-context.js";
import type { TeamStatsIndex, TeamStatsIndexEntry } from "../../domain/team-stats.js";

export interface GenerateTeamCoverageReportOptions {
  snapshotPath?: string;
  outputPath?: string;
  write: boolean;
}

export interface GenerateTeamCoverageReportResult {
  report: TeamCoverageReport;
  outputPath: string | null;
}

export async function generateTeamCoverageReport(
  repoRoot: string,
  options: GenerateTeamCoverageReportOptions,
): Promise<GenerateTeamCoverageReportResult> {
  const snapshotPath = path.resolve(
    repoRoot,
    options.snapshotPath ?? path.join("data", "fixtures", "latest.json"),
  );
  const snapshot = await readJsonRequired<PublicFixtureSnapshot>(
    snapshotPath,
    `Public fixture snapshot not found at ${snapshotPath}.`,
  );
  const preferredSeasonFs = deriveSeasonFsFromMatchDate(snapshot.referenceDate);
  const [teamStatsIndex, teamContextIndex] = await Promise.all([
    readJsonOptional<TeamStatsIndex>(path.join(repoRoot, "data", "team-stats", "fotmob", "index.json")),
    readJsonOptional<TeamContextIndex>(
      path.join(repoRoot, "data", "team-context", "soccer-rating", "index.json"),
    ),
  ]);

  const competitionMap = new Map<string, TeamCoverageCompetitionReport>();

  for (const fixture of snapshot.fixtures) {
    const competitionKey = buildCompetitionKey(
      fixture.competitionId,
      fixture.competitionName,
      fixture.countryName,
    );
    let competition = competitionMap.get(competitionKey);

    if (!competition) {
      competition = {
        competitionId: fixture.competitionId,
        competitionName: fixture.competitionName,
        countryName: fixture.countryName,
        teamCount: 0,
        coverage: {
          teamsWithFotmob: 0,
          teamsWithSoccerRating: 0,
          teamsComplete: 0,
          teamsMissingBoth: 0,
        },
        teams: [],
      };
      competitionMap.set(competitionKey, competition);
    }

    registerTeam(competition, {
      teamId: fixture.homeTeamId,
      teamName: fixture.homeTeamName,
      competitionId: fixture.competitionId,
      teamStatsIndex,
      teamContextIndex,
      preferredSeasonFs,
    });
    registerTeam(competition, {
      teamId: fixture.awayTeamId,
      teamName: fixture.awayTeamName,
      competitionId: fixture.competitionId,
      teamStatsIndex,
      teamContextIndex,
      preferredSeasonFs,
    });
  }

  const competitions = Array.from(competitionMap.values())
    .map((competition) => finalizeCompetition(competition))
    .sort(compareCompetitionReports);

  const report: TeamCoverageReport = {
    source: "fixtures-window",
    generatedAtUtc: new Date().toISOString(),
    referenceDate: snapshot.referenceDate,
    preferredSeasonFs,
    snapshotPath: toProjectRelativePath(repoRoot, snapshotPath),
    summary: {
      competitions: competitions.length,
      teams: competitions.reduce((total, competition) => total + competition.teamCount, 0),
      teamsWithFotmob: competitions.reduce(
        (total, competition) => total + competition.coverage.teamsWithFotmob,
        0,
      ),
      teamsWithSoccerRating: competitions.reduce(
        (total, competition) => total + competition.coverage.teamsWithSoccerRating,
        0,
      ),
      teamsComplete: competitions.reduce(
        (total, competition) => total + competition.coverage.teamsComplete,
        0,
      ),
      teamsMissingBoth: competitions.reduce(
        (total, competition) => total + competition.coverage.teamsMissingBoth,
        0,
      ),
    },
    competitions,
  };

  if (!options.write) {
    return { report, outputPath: null };
  }

  const outputPath = path.resolve(
    repoRoot,
    options.outputPath ?? path.join("data", "team-coverage", "latest.json"),
  );
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2), "utf8");

  return {
    report,
    outputPath,
  };
}

function registerTeam(
  competition: TeamCoverageCompetitionReport,
  params: {
    teamId: string | null;
    teamName: string;
    competitionId: string | null;
    teamStatsIndex: TeamStatsIndex | null;
    teamContextIndex: TeamContextIndex | null;
    preferredSeasonFs: string;
  },
): void {
  const existing = competition.teams.find(
    (team) =>
      (params.teamId && team.sofascoreTeamId === params.teamId) ||
      normalizeTeamToken(team.teamName) === normalizeTeamToken(params.teamName),
  );

  if (existing) {
    existing.fixtureAppearances += 1;
    return;
  }

  const fotmob = resolveTeamStatsMatch({
    teamId: params.teamId,
    teamName: params.teamName,
    competitionId: params.competitionId,
    index: params.teamStatsIndex,
    preferredSeasonFs: params.preferredSeasonFs,
  });
  const soccerRating = resolveTeamContextMatch({
    teamId: params.teamId,
    teamName: params.teamName,
    index: params.teamContextIndex,
    preferredSeasonFs: params.preferredSeasonFs,
  });

  const recommendedNextSteps: string[] = [];
  if (!fotmob.available) {
    recommendedNextSteps.push("capture_fotmob");
  }
  if (!soccerRating.available) {
    recommendedNextSteps.push("capture_soccer_rating");
  }

  competition.teams.push({
    sofascoreTeamId: params.teamId,
    teamName: params.teamName,
    fixtureAppearances: 1,
    sources: {
      fotmob,
      soccerRating,
    },
    recommendedNextSteps,
  });
}

function finalizeCompetition(competition: TeamCoverageCompetitionReport): TeamCoverageCompetitionReport {
  competition.teams.sort((left, right) => left.teamName.localeCompare(right.teamName));
  competition.teamCount = competition.teams.length;
  competition.coverage = competition.teams.reduce(
    (summary, team) => {
      if (team.sources.fotmob.available) {
        summary.teamsWithFotmob += 1;
      }
      if (team.sources.soccerRating.available) {
        summary.teamsWithSoccerRating += 1;
      }
      if (team.sources.fotmob.available && team.sources.soccerRating.available) {
        summary.teamsComplete += 1;
      }
      if (!team.sources.fotmob.available && !team.sources.soccerRating.available) {
        summary.teamsMissingBoth += 1;
      }
      return summary;
    },
    {
      teamsWithFotmob: 0,
      teamsWithSoccerRating: 0,
      teamsComplete: 0,
      teamsMissingBoth: 0,
    },
  );

  return competition;
}

function resolveTeamStatsMatch(params: {
  teamId: string | null;
  teamName: string;
  competitionId: string | null;
  index: TeamStatsIndex | null;
  preferredSeasonFs: string;
}): TeamCoverageSourceMatch {
  if (!params.index?.entries?.length || !params.competitionId) {
    return unavailableMatch();
  }

  const exactCandidates = params.index.entries
    .filter((entry) => entry.competitionId === params.competitionId)
    .filter((entry) => params.teamId && entry.sofascoreTeamId === params.teamId)
    .sort((left, right) => comparePreferredSeason(left.season, right.season, params.preferredSeasonFs));

  const exact = exactCandidates[0] ?? null;
  if (exact) {
    return entryToSourceMatch(exact, "sofascoreTeamId");
  }

  const expectedToken = normalizeTeamToken(params.teamName);
  const fallbackCandidates = params.index.entries
    .filter((entry) => entry.competitionId === params.competitionId)
    .filter((entry) => matchesTeamReference(expectedToken, entry.teamSlug))
    .sort((left, right) => comparePreferredSeason(left.season, right.season, params.preferredSeasonFs));

  const fallback = fallbackCandidates[0] ?? null;
  return fallback ? entryToSourceMatch(fallback, "teamSlug") : unavailableMatch();
}

function resolveTeamContextMatch(params: {
  teamId: string | null;
  teamName: string;
  index: TeamContextIndex | null;
  preferredSeasonFs: string;
}): TeamCoverageSourceMatch {
  if (!params.index?.entries?.length) {
    return unavailableMatch();
  }

  const exactCandidates = params.index.entries
    .filter((entry) => params.teamId && entry.sofascoreTeamId === params.teamId)
    .sort((left, right) => comparePreferredSeason(left.season, right.season, params.preferredSeasonFs));

  const exact = exactCandidates[0] ?? null;
  if (exact) {
    return entryToSourceMatch(exact, "sofascoreTeamId");
  }

  const expectedToken = normalizeTeamToken(params.teamName);
  const fallbackCandidates = params.index.entries
    .filter((entry) => matchesTeamReference(expectedToken, entry.teamSlug))
    .sort((left, right) => comparePreferredSeason(left.season, right.season, params.preferredSeasonFs));

  const fallback = fallbackCandidates[0] ?? null;
  return fallback ? entryToSourceMatch(fallback, "teamSlug") : unavailableMatch();
}

function entryToSourceMatch(
  entry: TeamStatsIndexEntry | TeamContextIndexEntry,
  matchedBy: "sofascoreTeamId" | "teamSlug",
): TeamCoverageSourceMatch {
  return {
    available: true,
    matchedBy,
    sourceTeamId: entry.teamId,
    sourceTeamSlug: entry.teamSlug,
    season: entry.season,
    availabilityStatus: entry.availabilityStatus,
    jsonPath: entry.jsonPath,
  };
}

function unavailableMatch(): TeamCoverageSourceMatch {
  return {
    available: false,
    matchedBy: null,
    sourceTeamId: null,
    sourceTeamSlug: null,
    season: null,
    availabilityStatus: null,
    jsonPath: null,
  };
}

function buildCompetitionKey(
  competitionId: string | null,
  competitionName: string | null,
  countryName: string | null,
): string {
  return [competitionId ?? "", competitionName ?? "", countryName ?? ""].join("::");
}

function compareCompetitionReports(
  left: TeamCoverageCompetitionReport,
  right: TeamCoverageCompetitionReport,
): number {
  return (
    String(left.countryName ?? "").localeCompare(String(right.countryName ?? "")) ||
    String(left.competitionName ?? "").localeCompare(String(right.competitionName ?? ""))
  );
}

function comparePreferredSeason(left: string, right: string, preferredSeasonFs: string): number {
  const leftPreferred = left === preferredSeasonFs ? 0 : 1;
  const rightPreferred = right === preferredSeasonFs ? 0 : 1;
  return leftPreferred - rightPreferred || right.localeCompare(left);
}

function deriveSeasonFsFromMatchDate(matchDate: string): string {
  const [yearText, monthText] = matchDate.split("-", 3);
  const year = Number.parseInt(yearText ?? "", 10);
  const month = Number.parseInt(monthText ?? "", 10);

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new Error(`Invalid matchDate "${matchDate}". Expected YYYY-MM-DD.`);
  }

  return month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

function matchesTeamReference(expectedToken: string, candidateValue: string): boolean {
  const candidateToken = normalizeTeamToken(candidateValue);
  if (!expectedToken || !candidateToken) {
    return false;
  }

  return (
    expectedToken === candidateToken ||
    (expectedToken.length >= 6 && candidateToken.includes(expectedToken)) ||
    (candidateToken.length >= 6 && expectedToken.includes(candidateToken))
  );
}

function normalizeTeamToken(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();
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
