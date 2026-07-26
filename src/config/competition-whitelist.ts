export interface AllowedCompetition {
  countryName: string;
  competitionName: string;
  competitionId: string;
}

export const DEFAULT_ALLOWED_COMPETITIONS: AllowedCompetition[] = [
  { countryName: "England", competitionName: "Premier League", competitionId: "17" },
  { countryName: "Spain", competitionName: "LaLiga", competitionId: "8" },
  { countryName: "Italy", competitionName: "Serie A", competitionId: "23" },
  { countryName: "Germany", competitionName: "Bundesliga", competitionId: "35" },
  { countryName: "France", competitionName: "Ligue 1", competitionId: "34" },
  { countryName: "Portugal", competitionName: "Liga Portugal", competitionId: "238" },
  { countryName: "Netherlands", competitionName: "Eredivisie", competitionId: "37" },
  { countryName: "Belgium", competitionName: "Pro League", competitionId: "40" },
  { countryName: "Scotland", competitionName: "Premiership", competitionId: "36" },
  { countryName: "Turkey", competitionName: "Super Lig", competitionId: "52" },
  { countryName: "Austria", competitionName: "Bundesliga", competitionId: "45" },
  { countryName: "Switzerland", competitionName: "Super League", competitionId: "46" },
  { countryName: "Denmark", competitionName: "Superliga", competitionId: "39" },
  { countryName: "Norway", competitionName: "Eliteserien", competitionId: "20" },
  { countryName: "Sweden", competitionName: "Allsvenskan", competitionId: "43" },
  { countryName: "Finland", competitionName: "Veikkausliiga", competitionId: "67" },
  { countryName: "Poland", competitionName: "Ekstraklasa", competitionId: "47" },
  { countryName: "Czech Republic", competitionName: "Chance Liga", competitionId: "49" },
  { countryName: "Romania", competitionName: "SuperLiga", competitionId: "152" },
  { countryName: "Hungary", competitionName: "NB I", competitionId: "53" },
  { countryName: "Croatia", competitionName: "HNL", competitionId: "170" },
  { countryName: "Serbia", competitionName: "SuperLiga", competitionId: "210" },
  { countryName: "Slovakia", competitionName: "Nike Liga", competitionId: "211" },
  { countryName: "Slovenia", competitionName: "PrvaLiga", competitionId: "212" },
  { countryName: "Bulgaria", competitionName: "Parva Liga", competitionId: "247" },
  { countryName: "Greece", competitionName: "Super League", competitionId: "185" },
  { countryName: "Ukraine", competitionName: "Premier League", competitionId: "218" },
  { countryName: "Russia", competitionName: "Premier League", competitionId: "203" },
  { countryName: "Israel", competitionName: "Premier League", competitionId: "59" },
  { countryName: "Brazil", competitionName: "Brasileirao Serie A", competitionId: "325" },
  { countryName: "Argentina", competitionName: "Liga Profesional", competitionId: "155" },
];

export function buildAllowedCompetitionIdSet(rawValue?: string): Set<string> {
  if (rawValue === undefined) {
    return new Set(DEFAULT_ALLOWED_COMPETITIONS.map((competition) => competition.competitionId));
  }

  const ids = rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    throw new Error("FUTESTAT_ALLOWED_COMPETITION_IDS must include at least one id.");
  }

  return new Set(ids);
}

export function isAllowedCompetitionId(
  competitionId: string | null,
  allowedCompetitionIds: ReadonlySet<string>,
): boolean {
  return competitionId !== null && allowedCompetitionIds.has(competitionId);
}

export function filterFixturesByCompetition<T extends { competitionId: string | null }>(
  fixtures: T[],
  allowedCompetitionIds: ReadonlySet<string>,
): T[] {
  return fixtures.filter((fixture) =>
    isAllowedCompetitionId(fixture.competitionId, allowedCompetitionIds),
  );
}
