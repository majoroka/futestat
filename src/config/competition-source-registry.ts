import competitionSourceRegistryJson from "../../data/competition-source-registry.json" with { type: "json" };

import type {
  CompetitionSourceRegistry,
  CompetitionSourceRegistryEntry,
} from "../domain/competition-source-registry.js";
import {
  matchesCompetitionIdentity,
  normalizeCompetitionToken,
  type FixtureCompetitionIdentity,
} from "../lib/competition-matcher.js";

export const DEFAULT_COMPETITION_SOURCE_REGISTRY =
  competitionSourceRegistryJson as CompetitionSourceRegistry;

const DEFAULT_COMPETITION_SOURCE_REGISTRY_BY_ID = new Map(
  DEFAULT_COMPETITION_SOURCE_REGISTRY.entries.map((entry) => [entry.sofascoreCompetitionId, entry]),
);

export function getCompetitionSourceRegistry(): CompetitionSourceRegistry {
  return DEFAULT_COMPETITION_SOURCE_REGISTRY;
}

export function getCompetitionSourceRegistryEntryById(
  competitionId: string | null | undefined,
): CompetitionSourceRegistryEntry | null {
  if (!competitionId) {
    return null;
  }

  return DEFAULT_COMPETITION_SOURCE_REGISTRY_BY_ID.get(competitionId) ?? null;
}

export function listCompetitionSourceRegistryEntries(options?: {
  competitionIds?: ReadonlySet<string> | null;
  standingsEnabledOnly?: boolean;
}): CompetitionSourceRegistryEntry[] {
  const competitionIds = options?.competitionIds ?? null;
  const standingsEnabledOnly = options?.standingsEnabledOnly ?? false;

  return DEFAULT_COMPETITION_SOURCE_REGISTRY.entries
    .filter((entry) => !competitionIds || competitionIds.has(entry.sofascoreCompetitionId))
    .filter((entry) => !standingsEnabledOnly || entry.standings.enabled)
    .sort((left, right) => left.sofascoreCompetitionId.localeCompare(right.sofascoreCompetitionId));
}

export function findCompetitionSourceRegistryEntry(
  fixture: FixtureCompetitionIdentity,
): CompetitionSourceRegistryEntry | null {
  let bestMatch: CompetitionSourceRegistryEntry | null = null;
  let bestScore = -1;

  for (const entry of DEFAULT_COMPETITION_SOURCE_REGISTRY.entries) {
    if (
      !matchesCompetitionIdentity(
        {
          competitionId: entry.sofascoreCompetitionId,
          competitionName: entry.competitionName,
          countryName: entry.countryName,
          competitionAliases: entry.competitionAliases,
          countryAliases: entry.countryAliases,
        },
        fixture,
      )
    ) {
      continue;
    }

    const score = registryEntrySpecificityScore(entry, fixture);
    if (score > bestScore) {
      bestMatch = entry;
      bestScore = score;
    }
  }

  return bestMatch;
}

function registryEntrySpecificityScore(
  entry: CompetitionSourceRegistryEntry,
  fixture: FixtureCompetitionIdentity,
): number {
  const competitionValue = normalizeCompetitionToken(fixture.competitionName);
  if (!competitionValue) {
    return 0;
  }

  return [entry.competitionName, ...entry.competitionAliases]
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
