import type {
  TeamStatsAttack,
  TeamStatsAvailability,
  TeamStatsAvailabilityStatus,
  TeamStatsCoverage,
  TeamStatsDefense,
  TeamStatsDiscipline,
  TeamStatsOverview,
  TeamStatsSeasonSnapshot,
} from "../../domain/team-stats.js";

const FOTMOB_BASE_URL = "https://www.fotmob.com";

interface FotmobNextData {
  props?: {
    url?: string;
    pageProps?: {
      fallback?: Record<string, unknown>;
    };
  };
}

interface TeamPathMetadata {
  seasonFs: string | null;
  seasonLabel: string | null;
  competitionId: string | null;
  competitionSlug: string | null;
  teamId: string | null;
  teamSlug: string | null;
}

export interface ParseFotmobTeamStatsOptions {
  html: string;
  inputPath: string;
  collectedAtUtc: string;
  season?: string;
  competitionId?: string;
  competitionSlug?: string;
  teamId?: string;
  teamSlug?: string;
}

export interface ParsedFotmobTeamStatsResult {
  snapshot: TeamStatsSeasonSnapshot;
  metricsExtractedCount: number;
  seasonFs: string;
  competitionSlug: string;
  teamSlug: string;
  competitionId: string;
  teamId: string;
}

type MetricLeafIndex = Map<string, unknown[]>;

export function parseFotmobTeamStatsHtml(
  options: ParseFotmobTeamStatsOptions,
): ParsedFotmobTeamStatsResult {
  const nextData = extractNextData(options.html);
  const routeUrl = stringifyOrNull(nextData.props?.url);
  const fallback = nextData.props?.pageProps?.fallback;

  if (!fallback || typeof fallback !== "object") {
    throw new Error("FotMob HTML does not contain a valid fallback payload.");
  }

  const teamEntry = selectTeamEntry(fallback);
  const details = asRecord(teamEntry.details);
  const overview = asRecord(teamEntry.overview);
  const stats = asRecord(teamEntry.stats);
  const sportsTeamJsonLd = asRecord(details.sportsTeamJSONLD);

  const inputMeta = parseFotmobInputPath(options.inputPath);
  const latestSeasonLabel =
    normalizeSeasonLabel(stringifyOrNull(details.latestSeason)) ??
    normalizeSeasonLabel(stringifyOrNull(overview.selectedSeason)) ??
    normalizeSeasonLabel(stringifyOrNull(overview.season));
  const selectedSeasonLabel =
    normalizeSeasonLabel(options.season) ??
    inputMeta.seasonLabel ??
    normalizeSeasonLabel(stringifyOrNull(overview.selectedSeason)) ??
    normalizeSeasonLabel(stringifyOrNull(overview.season)) ??
    latestSeasonLabel;

  if (!selectedSeasonLabel) {
    throw new Error("Unable to determine the FotMob season label.");
  }

  const tournamentSeason = selectTournamentSeason(stats.tournamentSeasons, selectedSeasonLabel);
  const teamId =
    options.teamId ??
    inputMeta.teamId ??
    stringifyOrNull(details.id) ??
    extractTeamIdFromFallbackKey(fallback);
  const teamSlug =
    options.teamSlug ??
    inputMeta.teamSlug ??
    extractTeamSlugFromRoute(routeUrl) ??
    slugify(stringifyOrNull(details.name) ?? "team");
  const competitionId =
    options.competitionId ??
    inputMeta.competitionId ??
    stringifyOrNull(tournamentSeason?.parentLeagueId) ??
    stringifyOrNull(details.primaryLeagueId) ??
    stringifyOrNull(stats.tournamentId);
  const competitionName =
    stringifyOrNull(tournamentSeason?.leagueName) ??
    stringifyOrNull(details.primaryLeagueName) ??
    extractLeagueNameFromTable(teamEntry.table);
  const competitionSlug =
    options.competitionSlug ??
    inputMeta.competitionSlug ??
    slugify(competitionName ?? "competition");

  if (!teamId) {
    throw new Error("Unable to determine the FotMob team id.");
  }

  if (!competitionId) {
    throw new Error("Unable to determine the FotMob competition id.");
  }

  if (!competitionName) {
    throw new Error("Unable to determine the FotMob competition name.");
  }

  const teamMetricsIndex = collectTeamMetricsIndex(stats.teams);
  const fallbackMetricsIndex = collectMetricLeaves(asRecord(teamEntry.statsMetrics));
  const metricsIndex = mergeMetricIndexes(teamMetricsIndex, fallbackMetricsIndex);
  const overviewMetrics: TeamStatsOverview = {
    teamRating: pickMetric(metricsIndex, ["rating_team", "teamRating", "rating", "averageRating"]),
    goalsPerMatch: pickMetric(metricsIndex, ["goals_team_match", "goalsPerMatch", "goals_avg"]),
    goalsConcededPerMatch: pickMetric(metricsIndex, [
      "goals_conceded_team_match",
      "goalsConcededPerMatch",
      "goalsAgainstPerMatch",
      "concededPerMatch",
    ]),
    averagePossessionPct: pickMetric(metricsIndex, [
      "possession_percentage_team",
      "averagePossessionPct",
      "averagePossession",
      "possessionPct",
      "possessionPercentage",
    ]),
    cleanSheets: pickMetric(metricsIndex, ["clean_sheet_team", "cleanSheets", "cleanSheetCount"]),
    attendanceAverage: pickMetric(metricsIndex, ["attendanceAverage", "avgAttendance"]),
  };
  const attackMetrics: TeamStatsAttack = {
    xg: pickMetric(metricsIndex, ["expected_goals_team", "xg", "expectedGoals"]),
    xgDiff: pickMetric(metricsIndex, ["_xg_diff_team", "xgDiff", "expectedGoalsDiff"]),
    shotsOnTargetPerMatch: pickMetric(metricsIndex, [
      "ontarget_scoring_att_team",
      "shotsOnTargetPerMatch",
      "shotsOnTargetAvg",
    ]),
    bigChances: pickMetric(metricsIndex, ["big_chance_team", "bigChances", "bigChancesCreated"]),
    bigChancesMissed: pickMetric(metricsIndex, ["big_chance_missed_team", "bigChancesMissed"]),
    accuratePassesPerMatch: pickMetric(metricsIndex, [
      "accurate_pass_team",
      "accuratePassesPerMatch",
      "passesAccuratePerMatch",
    ]),
    accurateLongBallsPerMatch: pickMetric(metricsIndex, [
      "accurate_long_balls_team",
      "accurateLongBallsPerMatch",
      "longBallsAccuratePerMatch",
    ]),
    accurateCrossesPerMatch: pickMetric(metricsIndex, [
      "accurate_cross_team",
      "accurateCrossesPerMatch",
      "crossesAccuratePerMatch",
    ]),
    penaltiesAwarded: pickMetric(metricsIndex, ["penaltiesAwarded", "penaltyGoalsAwarded"]),
    touchesInOppBoxPerMatch: pickMetric(metricsIndex, [
      "touches_in_opp_box_team",
      "touchesInOppBoxPerMatch",
      "touchesInOppositionBoxPerMatch",
    ]),
    cornersPerMatch: pickMetric(metricsIndex, ["corner_taken_team", "cornersPerMatch"]),
    setPieceGoals: pickMetric(metricsIndex, ["setPieceGoals"]),
  };
  const defenseMetrics: TeamStatsDefense = {
    xgConceded: pickMetric(metricsIndex, [
      "expected_goals_conceded_team",
      "xgConceded",
      "expectedGoalsConceded",
    ]),
    interceptionsPerMatch: pickMetric(metricsIndex, ["interception_team", "interceptionsPerMatch"]),
    tacklesPerMatch: pickMetric(metricsIndex, ["total_tackle_team", "tacklesPerMatch"]),
    clearancesPerMatch: pickMetric(metricsIndex, ["effective_clearance_team", "clearancesPerMatch"]),
    finalThirdRecoveriesPerMatch: pickMetric(metricsIndex, [
      "poss_won_att_3rd_team",
      "finalThirdRecoveriesPerMatch",
      "finalThirdRecoveriesAvg",
    ]),
    setPieceGoalsConceded: pickMetric(metricsIndex, ["setPieceGoalsConceded"]),
    penaltiesConceded: pickMetric(metricsIndex, ["penaltiesConceded"]),
    savesPerMatch: pickMetric(metricsIndex, ["saves_team", "savesPerMatch"]),
  };
  const disciplineMetrics: TeamStatsDiscipline = {
    foulsPerMatch: pickMetric(metricsIndex, ["fk_foul_lost_team", "foulsPerMatch"]),
    yellowCardsPerMatch: pickMetric(metricsIndex, ["total_yel_card_team", "yellowCardsPerMatch"]),
    redCardsPerMatch: pickMetric(metricsIndex, ["redCardsPerMatch"]),
  };

  const metricsExtractedCount = countMetrics([
    ...Object.values(overviewMetrics),
    ...Object.values(attackMetrics),
    ...Object.values(defenseMetrics),
    ...Object.values(disciplineMetrics),
  ]);
  const seasonIsCurrent = latestSeasonLabel === selectedSeasonLabel;
  const availability = buildAvailability({
    seasonIsCurrent,
    metricsExtractedCount,
  });
  const teamName = stringifyOrNull(details.name) ?? "Unknown team";
  const teamCountry =
    stringifyOrNull(asRecord(sportsTeamJsonLd.location)?.address?.addressCountry) ??
    stringifyOrNull(details.country);
  const teamLogoUrl = stringifyOrNull(sportsTeamJsonLd.logo);

  const seasonFs = selectedSeasonLabel.replaceAll("/", "-");
  const sourceUrl = routeUrl ? new URL(routeUrl, FOTMOB_BASE_URL).toString() : FOTMOB_BASE_URL;

  return {
    snapshot: {
      team: {
        id: teamId,
        name: teamName,
        slug: teamSlug,
        country: teamCountry,
        logoUrl: teamLogoUrl,
      },
      competition: {
        id: competitionId,
        name: competitionName,
      },
      season: {
        id: selectedSeasonLabel,
        label: selectedSeasonLabel,
        isCurrent: seasonIsCurrent,
      },
      source: {
        provider: "fotmob",
        url: sourceUrl,
        collectedAtUtc: options.collectedAtUtc,
      },
      availability,
      overview: overviewMetrics,
      attack: attackMetrics,
      defense: defenseMetrics,
      discipline: disciplineMetrics,
    },
    metricsExtractedCount,
    seasonFs,
    competitionSlug,
    teamSlug,
    competitionId,
    teamId,
  };
}

function extractNextData(html: string): FotmobNextData {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );

  if (!match) {
    throw new Error('FotMob HTML does not contain the "__NEXT_DATA__" script.');
  }

  return JSON.parse(match[1]) as FotmobNextData;
}

function selectTeamEntry(fallback: Record<string, unknown>): Record<string, unknown> {
  const entry = Object.entries(fallback).find(([key]) => key.startsWith("team-"))?.[1];

  if (!entry || typeof entry !== "object") {
    throw new Error("FotMob fallback does not contain a team entry.");
  }

  return entry as Record<string, unknown>;
}

function selectTournamentSeason(
  value: unknown,
  selectedSeasonLabel: string,
): Record<string, unknown> | null {
  if (!Array.isArray(value)) {
    return null;
  }

  for (const item of value) {
    const record = asRecord(item);
    if (normalizeSeasonLabel(stringifyOrNull(record.season)) === selectedSeasonLabel) {
      return record;
    }
  }

  return null;
}

function parseFotmobInputPath(inputPath: string): TeamPathMetadata {
  const normalized = inputPath.replaceAll("\\", "/");
  const marker = "/fotmob/";
  const index = normalized.lastIndexOf(marker);

  if (index === -1) {
    return emptyPathMetadata();
  }

  const tail = normalized.slice(index + marker.length).split("/");
  if (tail.length < 3) {
    return emptyPathMetadata();
  }

  const [seasonFs, competitionDir, teamFile] = tail;
  const competitionId = competitionDir.split("-", 1)[0] ?? null;
  const competitionSlug =
    competitionDir.startsWith(`${competitionId}-`) && competitionId
      ? competitionDir.slice(competitionId.length + 1)
      : null;
  const teamStem = teamFile.replace(/\.html$/i, "");
  const teamId = teamStem.split("-", 1)[0] ?? null;
  const teamSlug =
    teamStem.startsWith(`${teamId}-`) && teamId ? teamStem.slice(teamId.length + 1) : null;

  return {
    seasonFs: seasonFs || null,
    seasonLabel: normalizeSeasonLabel(seasonFs),
    competitionId: competitionId || null,
    competitionSlug,
    teamId: teamId || null,
    teamSlug,
  };
}

function emptyPathMetadata(): TeamPathMetadata {
  return {
    seasonFs: null,
    seasonLabel: null,
    competitionId: null,
    competitionSlug: null,
    teamId: null,
    teamSlug: null,
  };
}

function collectTeamMetricsIndex(value: unknown): MetricLeafIndex {
  const index = new Map<string, unknown[]>();

  if (!Array.isArray(value)) {
    return index;
  }

  for (const item of value) {
    const record = asRecord(item);
    const participant = asRecord(record.participant);
    const stat = asRecord(participant.stat);
    const metricName =
      stringifyOrNull(stat.name) ??
      stringifyOrNull(record.stat) ??
      stringifyOrNull(record.name) ??
      stringifyOrNull(record.localizedTitleId);
    const metricValue = stat.value ?? participant.value ?? null;

    if (!metricName || metricValue === null || metricValue === undefined) {
      continue;
    }

    const normalizedKey = normalizeMetricKey(metricName);
    const existing = index.get(normalizedKey) ?? [];
    existing.push(metricValue);
    index.set(normalizedKey, existing);
  }

  return index;
}

function collectMetricLeaves(value: unknown): MetricLeafIndex {
  const index = new Map<string, unknown[]>();
  visitLeaves(value, index);
  return index;
}

function mergeMetricIndexes(...indexes: MetricLeafIndex[]): MetricLeafIndex {
  const merged = new Map<string, unknown[]>();

  for (const index of indexes) {
    for (const [key, values] of index.entries()) {
      const existing = merged.get(key) ?? [];
      existing.push(...values);
      merged.set(key, existing);
    }
  }

  return merged;
}

function visitLeaves(value: unknown, index: MetricLeafIndex, parentKey?: string): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      visitLeaves(item, index, parentKey);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      visitLeaves(child, index, key);
    }
    return;
  }

  if (!parentKey) {
    return;
  }

  const normalizedKey = normalizeMetricKey(parentKey);
  const existing = index.get(normalizedKey) ?? [];
  existing.push(value);
  index.set(normalizedKey, existing);
}

function pickMetric(index: MetricLeafIndex, candidateKeys: string[]): number | null {
  for (const key of candidateKeys) {
    const values = index.get(normalizeMetricKey(key));
    if (!values) {
      continue;
    }

    for (const value of values) {
      const parsed = parseNumberLike(value);
      if (parsed !== null) {
        return parsed;
      }
    }
  }

  return null;
}

function parseNumberLike(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  let normalized = trimmed.replace(/[%\s]/g, "");
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(normalized)) {
    normalized = normalized.replaceAll(",", "");
  } else if (/^\d+,\d+$/.test(normalized)) {
    normalized = normalized.replace(",", ".");
  } else {
    normalized = normalized.replaceAll(",", "");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function countMetrics(values: Array<number | null>): number {
  return values.filter((value) => value !== null).length;
}

function buildAvailability(input: {
  seasonIsCurrent: boolean;
  metricsExtractedCount: number;
}): TeamStatsAvailability {
  const { seasonIsCurrent, metricsExtractedCount } = input;
  let status: TeamStatsAvailabilityStatus;

  if (metricsExtractedCount === 0) {
    status = seasonIsCurrent ? "not_started" : "unavailable";
  } else if (seasonIsCurrent) {
    status = metricsExtractedCount >= 8 ? "available" : "partial";
  } else {
    status = "archived";
  }

  return {
    status,
    coverage: buildCoverage(metricsExtractedCount),
    notes: buildAvailabilityNotes(status),
  };
}

function buildCoverage(metricsExtractedCount: number): TeamStatsCoverage {
  if (metricsExtractedCount === 0) {
    return "low";
  }

  if (metricsExtractedCount >= 16) {
    return "high";
  }

  if (metricsExtractedCount >= 8) {
    return "medium";
  }

  return "low";
}

function buildAvailabilityNotes(status: TeamStatsAvailabilityStatus): string | null {
  switch (status) {
    case "not_started":
      return "Epoca atual ainda sem estatisticas agregadas disponiveis no HTML capturado.";
    case "partial":
      return "HTML capturado com cobertura parcial de metricas agregadas.";
    case "archived":
      return "Epoca anterior capturada para referencia estrutural.";
    case "unavailable":
      return "HTML capturado sem blocos estatisticos agregados extraiveis.";
    default:
      return null;
  }
}

function extractLeagueNameFromTable(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const first = asRecord(value[0]);
  const data = asRecord(first.data);
  return stringifyOrNull(data.leagueName);
}

function extractTeamIdFromFallbackKey(fallback: Record<string, unknown>): string | null {
  const key = Object.keys(fallback).find((entry) => entry.startsWith("team-"));
  return key ? key.replace("team-", "") : null;
}

function extractTeamSlugFromRoute(routeUrl: string | null): string | null {
  if (!routeUrl) {
    return null;
  }

  const parts = routeUrl.split("/").filter(Boolean);
  const statsIndex = parts.indexOf("stats");
  if (statsIndex !== -1 && parts.length > statsIndex + 1) {
    return parts[statsIndex + 1] ?? null;
  }

  return null;
}

function normalizeSeasonLabel(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (/^\d{4}\/\d{4}$/.test(value)) {
    return value;
  }

  if (/^\d{4}-\d{4}$/.test(value)) {
    return value.replace("-", "/");
  }

  return null;
}

function normalizeMetricKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function stringifyOrNull(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
}
