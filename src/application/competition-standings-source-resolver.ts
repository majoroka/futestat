import {
  DEFAULT_COMPETITION_STANDINGS_SOURCES,
  type CompetitionStandingsSource,
} from "../config/competition-standings-sources.js";
import {
  findCompetitionSourceRegistryEntry,
  getCompetitionSourceRegistryEntryById,
  listCompetitionSourceRegistryEntries,
} from "../config/competition-source-registry.js";
import {
  matchesCompetitionIdentity,
  normalizeCompetitionToken,
  type FixtureCompetitionIdentity,
} from "../lib/competition-matcher.js";

const ENABLED_STANDINGS_SOURCES = DEFAULT_COMPETITION_STANDINGS_SOURCES.filter(
  (source) => source.enabled,
);

export function listPrimaryCompetitionStandingsSources(options?: {
  competitionIds?: ReadonlySet<string> | null;
}): CompetitionStandingsSource[] {
  return listCompetitionSourceRegistryEntries({
    competitionIds: options?.competitionIds ?? null,
    standingsEnabledOnly: true,
  }).map((entry) => resolvePrimaryCompetitionStandingsSource(entry.sofascoreCompetitionId));
}

export function resolveCompetitionStandingsSourceForFixture(
  fixture: FixtureCompetitionIdentity,
): CompetitionStandingsSource | null {
  const registryEntry = findCompetitionSourceRegistryEntry(fixture);
  if (!registryEntry?.standings.enabled) {
    return null;
  }

  const candidates = ENABLED_STANDINGS_SOURCES.filter(
    (source) => source.competitionId === registryEntry.sofascoreCompetitionId,
  );

  let bestMatch: CompetitionStandingsSource | null = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    if (!matchesCompetitionIdentity(candidate, fixture)) {
      continue;
    }

    const score = standingsSourceSpecificityScore(candidate, fixture);
    if (score > bestScore) {
      bestMatch = candidate;
      bestScore = score;
    }
  }

  return bestMatch ?? resolvePrimaryCompetitionStandingsSource(registryEntry.sofascoreCompetitionId);
}

export function resolvePrimaryCompetitionStandingsSource(
  competitionId: string,
): CompetitionStandingsSource {
  const registryEntry = getCompetitionSourceRegistryEntryById(competitionId);
  if (!registryEntry) {
    throw new Error(`Competition ${competitionId} not found in competition-source-registry.`);
  }

  const byUrl =
    ENABLED_STANDINGS_SOURCES.find(
      (source) =>
        source.competitionId === competitionId &&
        source.zerozeroUrl === registryEntry.standings.primaryZerozeroUrl,
    ) ?? null;
  if (byUrl) {
    return byUrl;
  }

  const exactName =
    ENABLED_STANDINGS_SOURCES.find(
      (source) =>
        source.competitionId === competitionId &&
        source.competitionName === registryEntry.competitionName &&
        source.countryName === registryEntry.countryName,
    ) ?? null;
  if (exactName) {
    return exactName;
  }

  const first = ENABLED_STANDINGS_SOURCES.find((source) => source.competitionId === competitionId) ?? null;
  if (first) {
    return first;
  }

  throw new Error(`No enabled standings source configured for competition ${competitionId}.`);
}

function standingsSourceSpecificityScore(
  source: CompetitionStandingsSource,
  fixture: FixtureCompetitionIdentity,
): number {
  const competitionValue = normalizeCompetitionToken(fixture.competitionName);
  if (!competitionValue) {
    return 0;
  }

  return [source.competitionName, ...(source.competitionAliases ?? [])]
    .map(normalizeCompetitionToken)
    .filter(Boolean)
    .reduce((best, candidate) => {
      if (
        competitionValue === candidate ||
        competitionValue.startsWith(candidate) ||
        candidate.startsWith(competitionValue)
      ) {
        return Math.max(best, candidate.length);
      }

      return best;
    }, 0);
}
