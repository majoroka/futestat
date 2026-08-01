import { readFile } from "node:fs/promises";
import path from "node:path";

import type { CompetitionStandingsSnapshot, CompetitionStandingsTable } from "../../domain/competition-standings.js";
import type { FixtureDay, MatchFixture } from "../../domain/fixture.js";
import type { MatchDetailSnapshot } from "../../domain/match-detail.js";
import type { MatchViewSnapshot } from "../../domain/match-view.js";
import type { TeamContextIndex, TeamContextIndexEntry, TeamContextSnapshot } from "../../domain/team-context.js";
import type { TeamStatsIndex, TeamStatsIndexEntry, TeamStatsSeasonSnapshot } from "../../domain/team-stats.js";
import { JsonMatchViewStore } from "../storage/json-match-view-store.js";

export interface BuildMatchViewOptions {
  fixtureId: string;
  matchDate: string;
  output?: string;
  force: boolean;
}

export interface BuildMatchViewResult {
  fixtureId: string;
  matchDate: string;
  outputPath: string;
  indexPath: string;
  homeTeamResolved: boolean;
  awayTeamResolved: boolean;
  standingsAvailable: boolean;
  sources: MatchViewSnapshot["sources"];
}

export async function buildMatchView(
  repoRoot: string,
  options: BuildMatchViewOptions,
): Promise<BuildMatchViewResult> {
  const fixtureDayPath = path.join(repoRoot, "data", "fixtures", "days", `${options.matchDate}.json`);
  const fixtureDay = await readJsonRequired<FixtureDay>(
    fixtureDayPath,
    `Fixture day file not found for ${options.matchDate}.`,
  );
  const fixture = fixtureDay.fixtures.find((candidate) => candidate.sourceEventId === options.fixtureId) ?? null;

  if (!fixture) {
    throw new Error(`Fixture ${options.fixtureId} not found in ${fixtureDayPath}.`);
  }

  const preferredSeasonFs = deriveSeasonFsFromMatchDate(options.matchDate);
  const detailPath = path.join(repoRoot, "data", "fixtures", "details", `${options.fixtureId}.json`);
  const standingsPath = fixture.competitionId
    ? path.join(repoRoot, "data", "fixtures", "standings", `${fixture.competitionId}.json`)
    : null;

  const [matchDetail, standingsSnapshot, teamStatsIndex, teamContextIndex] = await Promise.all([
    readJsonOptional<MatchDetailSnapshot>(detailPath),
    standingsPath ? readJsonOptional<CompetitionStandingsSnapshot>(standingsPath) : Promise.resolve(null),
    readJsonOptional<TeamStatsIndex>(path.join(repoRoot, "data", "team-stats", "fotmob", "index.json")),
    readJsonOptional<TeamContextIndex>(path.join(repoRoot, "data", "team-context", "soccer-rating", "index.json")),
  ]);

  const homeStats = await resolveTeamStats(repoRoot, teamStatsIndex, fixture, "home", preferredSeasonFs);
  const awayStats = await resolveTeamStats(repoRoot, teamStatsIndex, fixture, "away", preferredSeasonFs);
  const homeContext = await resolveTeamContext(repoRoot, teamContextIndex, fixture, "home", preferredSeasonFs);
  const awayContext = await resolveTeamContext(repoRoot, teamContextIndex, fixture, "away", preferredSeasonFs);

  const season = resolveMatchSeason(preferredSeasonFs, [
    homeStats.snapshot?.season.id,
    awayStats.snapshot?.season.id,
    homeContext.snapshot?.season.id,
    awayContext.snapshot?.season.id,
  ]);

  const selectedTable = selectStandingsTable(standingsSnapshot?.tables ?? [], fixture);
  const builtAtUtc = new Date().toISOString();
  const snapshot: MatchViewSnapshot = {
    builtAtUtc,
    match: {
      id: fixture.sourceEventId,
      date: fixture.matchDate,
      status: fixture.status,
      resultLabel: fixture.resultLabel,
      homeScore: fixture.homeScore,
      awayScore: fixture.awayScore,
      matchUrl: fixture.matchUrl,
      kickoffAtUtc: fixture.kickoffAtUtc,
      competition: {
        id: fixture.competitionId,
        name: fixture.competitionName,
        country: fixture.countryName,
        logoUrl: fixture.competitionLogoUrl,
      },
      season,
      details: {
        competitionStage: matchDetail?.overview.competitionStage ?? null,
        venueName: matchDetail?.overview.venueName ?? null,
        venueCity: matchDetail?.overview.venueCity ?? null,
        venueCountry: matchDetail?.overview.venueCountry ?? null,
        refereeName: matchDetail?.overview.refereeName ?? null,
        refereeCountry: matchDetail?.overview.refereeCountry ?? null,
        odds: matchDetail?.odds ?? null,
        watch: matchDetail?.watch ?? null,
        tieContext: matchDetail?.tieContext ?? null,
      },
    },
    homeTeam: buildTeamBlock({
      fixtureId: fixture.homeTeamId,
      fixtureName: fixture.homeTeamName,
      fixtureLogoUrl: fixture.homeTeamLogoUrl,
      stats: homeStats.snapshot,
      context: homeContext.snapshot,
    }),
    awayTeam: buildTeamBlock({
      fixtureId: fixture.awayTeamId,
      fixtureName: fixture.awayTeamName,
      fixtureLogoUrl: fixture.awayTeamLogoUrl,
      stats: awayStats.snapshot,
      context: awayContext.snapshot,
    }),
    standings: {
      available: Boolean(selectedTable && standingsSnapshot),
      competitionId: fixture.competitionId,
      sourceStatus: standingsSnapshot?.status ?? "missing",
      tableName: selectedTable?.name ?? null,
      tableType: selectedTable?.type ?? null,
      rows:
        selectedTable?.rows.map((row) => ({
          ...row,
          highlight: resolveStandingHighlight(row.teamName, fixture),
        })) ?? [],
    },
    sources: {
      fixture: {
        available: true,
        path: toProjectRelativePath(repoRoot, fixtureDayPath),
        matchedBy: "sourceEventId",
      },
      matchDetail: {
        available: matchDetail !== null,
        path: matchDetail ? toProjectRelativePath(repoRoot, detailPath) : null,
        matchedBy: matchDetail ? "sourceEventId" : null,
      },
      competitionStandings: {
        available: standingsSnapshot !== null && selectedTable !== null,
        path: standingsSnapshot && standingsPath ? toProjectRelativePath(repoRoot, standingsPath) : null,
        matchedBy: standingsSnapshot ? "competitionId" : null,
      },
      homeTeamStats: sourceRefFromResolved(homeStats),
      awayTeamStats: sourceRefFromResolved(awayStats),
      homeTeamContext: sourceRefFromResolved(homeContext),
      awayTeamContext: sourceRefFromResolved(awayContext),
    },
  };

  const store = new JsonMatchViewStore(repoRoot);
  const outputPath = path.resolve(
    repoRoot,
    options.output ?? store.deriveOutputPath(options.matchDate, options.fixtureId),
  );
  const writeResult = await store.writeSnapshot({
    snapshot,
    outputPath,
    fixtureId: options.fixtureId,
    matchDate: options.matchDate,
    builtAtUtc,
    force: options.force,
  });

  return {
    fixtureId: options.fixtureId,
    matchDate: options.matchDate,
    outputPath: writeResult.outputPath,
    indexPath: writeResult.indexPath,
    homeTeamResolved: true,
    awayTeamResolved: true,
    standingsAvailable: snapshot.standings.available,
    sources: snapshot.sources,
  };
}

async function resolveTeamStats(
  repoRoot: string,
  index: TeamStatsIndex | null,
  fixture: MatchFixture,
  side: "home" | "away",
  preferredSeasonFs: string,
): Promise<ResolvedSource<TeamStatsIndexEntry, TeamStatsSeasonSnapshot>> {
  if (!index?.entries?.length || !fixture.competitionId) {
    return unavailableSource();
  }

  const teamName = side === "home" ? fixture.homeTeamName : fixture.awayTeamName;
  const teamToken = normalizeTeamToken(teamName);
  const candidates = index.entries
    .filter((entry) => entry.competitionId === fixture.competitionId)
    .filter((entry) => matchesTeamReference(teamToken, entry.teamSlug))
    .sort((left, right) => comparePreferredSeason(left.season, right.season, preferredSeasonFs));

  const entry = candidates[0] ?? null;
  if (!entry) {
    return unavailableSource();
  }

  const absolutePath = path.resolve(repoRoot, entry.jsonPath);
  const snapshot = await readJsonOptional<TeamStatsSeasonSnapshot>(absolutePath);
  if (!snapshot) {
    return unavailableSource();
  }

  return {
    entry,
    snapshot,
    path: toProjectRelativePath(repoRoot, absolutePath),
    matchedBy: "teamSlug",
  };
}

async function resolveTeamContext(
  repoRoot: string,
  index: TeamContextIndex | null,
  fixture: MatchFixture,
  side: "home" | "away",
  preferredSeasonFs: string,
): Promise<ResolvedSource<TeamContextIndexEntry, TeamContextSnapshot>> {
  if (!index?.entries?.length) {
    return unavailableSource();
  }

  const teamName = side === "home" ? fixture.homeTeamName : fixture.awayTeamName;
  const teamToken = normalizeTeamToken(teamName);
  const candidates = index.entries
    .filter((entry) => matchesTeamReference(teamToken, entry.teamSlug))
    .sort((left, right) => comparePreferredSeason(left.season, right.season, preferredSeasonFs));

  const entry = candidates[0] ?? null;
  if (!entry) {
    return unavailableSource();
  }

  const absolutePath = path.resolve(repoRoot, entry.jsonPath);
  const snapshot = await readJsonOptional<TeamContextSnapshot>(absolutePath);
  if (!snapshot) {
    return unavailableSource();
  }

  return {
    entry,
    snapshot,
    path: toProjectRelativePath(repoRoot, absolutePath),
    matchedBy: "teamSlug",
  };
}

function buildTeamBlock(params: {
  fixtureId: string | null;
  fixtureName: string;
  fixtureLogoUrl: string | null;
  stats: TeamStatsSeasonSnapshot | null;
  context: TeamContextSnapshot | null;
}): MatchViewSnapshot["homeTeam"] {
  return {
    identity: {
      id: params.fixtureId,
      name: params.fixtureName,
      logoUrl: params.fixtureLogoUrl,
      sourceIds: {
        sofascore: params.fixtureId,
        fotmob: params.stats?.team.id ?? null,
        soccerRating: params.context?.team.id ?? null,
      },
    },
    headerStats: {
      overallRating: params.context?.ratings.overall ?? null,
      nationalRank: params.context?.rankings.national ?? null,
      europeRank: params.context?.rankings.europe ?? null,
      formLast3: params.context?.form.last3 ?? [],
      xgFor: params.stats?.attack.xg ?? null,
      xgAgainst: params.stats?.defense.xgConceded ?? null,
      averagePossessionPct: params.stats?.overview.averagePossessionPct ?? null,
      cleanSheets: params.stats?.overview.cleanSheets ?? null,
    },
    overview: {
      prediction: params.context?.prediction ?? null,
      squadHealth: params.context?.squadHealth ?? null,
      expectedLineup: params.context?.expectedLineup ?? null,
      oddsMarket: params.context?.oddsMarket ?? null,
    },
    statistics: {
      overview: params.stats
        ? {
            goalsPerMatch: params.stats.overview.goalsPerMatch,
            goalsConcededPerMatch: params.stats.overview.goalsConcededPerMatch,
            averagePossessionPct: params.stats.overview.averagePossessionPct,
            attendanceAverage: params.stats.overview.attendanceAverage,
          }
        : null,
      attack: params.stats ? { ...params.stats.attack } : null,
      defense: params.stats ? { ...params.stats.defense } : null,
      discipline: params.stats
        ? {
            ...params.stats.discipline,
            penaltiesConceded: params.stats.defense.penaltiesConceded,
          }
        : null,
    },
    squad: params.context?.squad ?? [],
    history: params.context?.recentMatches ?? [],
    similarTeams: params.context?.similarTeams ?? [],
  };
}

function selectStandingsTable(
  tables: CompetitionStandingsTable[],
  fixture: MatchFixture,
): CompetitionStandingsTable | null {
  if (tables.length === 0) {
    return null;
  }

  const homeToken = normalizeTeamToken(fixture.homeTeamName);
  const awayToken = normalizeTeamToken(fixture.awayTeamName);
  const ranked = tables
    .map((table) => ({
      table,
      score: table.rows.reduce((total, row) => {
        const teamToken = normalizeTeamToken(row.teamName);
        return (
          total +
          (matchesTeamReference(homeToken, teamToken) ? 2 : 0) +
          (matchesTeamReference(awayToken, teamToken) ? 2 : 0)
        );
      }, 0),
    }))
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.table ?? null;
}

function resolveStandingHighlight(
  teamName: string,
  fixture: MatchFixture,
): "home" | "away" | null {
  const teamToken = normalizeTeamToken(teamName);
  if (matchesTeamReference(normalizeTeamToken(fixture.homeTeamName), teamToken)) {
    return "home";
  }
  if (matchesTeamReference(normalizeTeamToken(fixture.awayTeamName), teamToken)) {
    return "away";
  }
  return null;
}

function resolveMatchSeason(preferredSeasonFs: string, candidates: Array<string | null | undefined>) {
  const first = candidates.find((value): value is string => Boolean(value)) ?? seasonLabelFromFs(preferredSeasonFs);
  return {
    id: first,
    label: first,
  };
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

  if (month >= 7) {
    return `${year}-${year + 1}`;
  }

  return `${year - 1}-${year}`;
}

function seasonLabelFromFs(seasonFs: string): string {
  return seasonFs.replace("-", "/");
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

function sourceRefFromResolved<TEntry, TSnapshot>(
  source: ResolvedSource<TEntry, TSnapshot>,
): MatchViewSnapshot["sources"]["homeTeamStats"] {
  return {
    available: source.snapshot !== null,
    path: source.path,
    matchedBy: source.matchedBy,
  };
}

function unavailableSource<TEntry = never, TSnapshot = never>(): ResolvedSource<TEntry, TSnapshot> {
  return {
    entry: null,
    snapshot: null,
    path: null,
    matchedBy: null,
  };
}

async function readJsonRequired<T>(filePath: string, message: string): Promise<T> {
  const raw = await readFile(filePath, "utf8").catch(() => null);
  if (raw === null) {
    throw new Error(message);
  }
  return JSON.parse(raw) as T;
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

interface ResolvedSource<TEntry, TSnapshot> {
  entry: TEntry | null;
  snapshot: TSnapshot | null;
  path: string | null;
  matchedBy: string | null;
}
