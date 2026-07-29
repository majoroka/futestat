export interface CompetitionIdentity {
  competitionId: string;
  competitionName: string;
  countryName: string;
  competitionAliases?: string[];
  countryAliases?: string[];
}

export interface FixtureCompetitionIdentity {
  competitionId: string | null;
  competitionName?: string | null;
  countryName?: string | null;
}

export function matchesCompetitionIdentity(
  definition: CompetitionIdentity,
  fixture: FixtureCompetitionIdentity,
): boolean {
  if (!fixture.competitionId || fixture.competitionId !== definition.competitionId) {
    return false;
  }

  if (fixture.countryName && !matchesCountryName(fixture.countryName, definition)) {
    return false;
  }

  if (fixture.competitionName && !matchesCompetitionName(fixture.competitionName, definition)) {
    return false;
  }

  return true;
}

export function matchesCompetitionName(
  value: string,
  definition: Pick<CompetitionIdentity, "competitionName" | "competitionAliases">,
): boolean {
  const normalizedValue = normalizeCompetitionToken(value);
  const candidates = [definition.competitionName, ...(definition.competitionAliases ?? [])]
    .map(normalizeCompetitionToken)
    .filter(Boolean);

  return candidates.some((candidate) => {
    if (!candidate) {
      return false;
    }

    return (
      normalizedValue === candidate ||
      normalizedValue.startsWith(candidate) ||
      candidate.startsWith(normalizedValue)
    );
  });
}

export function matchesCountryName(
  value: string,
  definition: Pick<CompetitionIdentity, "countryName" | "countryAliases">,
): boolean {
  const normalizedValue = normalizeCompetitionToken(value);
  const candidates = [definition.countryName, ...(definition.countryAliases ?? [])]
    .map(normalizeCompetitionToken)
    .filter(Boolean);

  return candidates.includes(normalizedValue);
}

export function normalizeCompetitionToken(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();
}
