import { matchesCompetitionIdentity, type FixtureCompetitionIdentity } from "../lib/competition-matcher.js";

export interface AllowedCompetition {
  countryName: string;
  competitionName: string;
  competitionId: string;
  competitionAliases?: string[];
  countryAliases?: string[];
}

export const DEFAULT_ALLOWED_COMPETITIONS: AllowedCompetition[] = [
  {
    countryName: "Europe",
    competitionName: "UEFA Champions League",
    competitionId: "7",
    competitionAliases: ["UEFA Champions League, Qualification"],
  },
  {
    countryName: "Europe",
    competitionName: "UEFA Europa League",
    competitionId: "679",
    competitionAliases: ["UEFA Europa League, Qualification"],
  },
  {
    countryName: "Europe",
    competitionName: "UEFA Conference League",
    competitionId: "17015",
    competitionAliases: ["UEFA Conference League, Qualification"],
  },
  { countryName: "England", competitionName: "Premier League", competitionId: "17" },
  {
    countryName: "England",
    competitionName: "Championship",
    competitionId: "18",
    competitionAliases: ["EFL Championship"],
  },
  { countryName: "Spain", competitionName: "LaLiga", competitionId: "8" },
  {
    countryName: "Spain",
    competitionName: "LaLiga 2",
    competitionId: "54",
    competitionAliases: ["Segunda Division", "Segunda División", "LaLiga Hypermotion"],
  },
  { countryName: "Italy", competitionName: "Serie A", competitionId: "23" },
  { countryName: "Italy", competitionName: "Serie B", competitionId: "53" },
  { countryName: "Germany", competitionName: "Bundesliga", competitionId: "35" },
  { countryName: "Germany", competitionName: "2. Bundesliga", competitionId: "44" },
  { countryName: "France", competitionName: "Ligue 1", competitionId: "34" },
  { countryName: "France", competitionName: "Ligue 2", competitionId: "182" },
  { countryName: "Portugal", competitionName: "Liga Portugal", competitionId: "238" },
  { countryName: "Portugal", competitionName: "Liga Portugal 2", competitionId: "239" },
  { countryName: "Portugal", competitionName: "Liga 3", competitionId: "17101" },
  { countryName: "Netherlands", competitionName: "Eredivisie", competitionId: "37" },
  {
    countryName: "Netherlands",
    competitionName: "Eerste Divisie",
    competitionId: "131",
    competitionAliases: ["Keuken Kampioen Divisie"],
  },
  { countryName: "Belgium", competitionName: "Pro League", competitionId: "40" },
  { countryName: "Scotland", competitionName: "Premiership", competitionId: "36" },
  { countryName: "Turkey", competitionName: "Super Lig", competitionId: "52" },
  { countryName: "Austria", competitionName: "Bundesliga", competitionId: "45" },
  { countryName: "Switzerland", competitionName: "Super League", competitionId: "215" },
  { countryName: "Denmark", competitionName: "Superliga", competitionId: "39" },
  { countryName: "Norway", competitionName: "Eliteserien", competitionId: "20" },
  { countryName: "Sweden", competitionName: "Allsvenskan", competitionId: "43" },
  { countryName: "Finland", competitionName: "Veikkausliiga", competitionId: "67" },
  { countryName: "Poland", competitionName: "Ekstraklasa", competitionId: "47" },
  { countryName: "Czech Republic", competitionName: "Chance Liga", competitionId: "49" },
  { countryName: "Romania", competitionName: "SuperLiga", competitionId: "152" },
  { countryName: "Hungary", competitionName: "NB I", competitionId: "187" },
  { countryName: "Croatia", competitionName: "HNL", competitionId: "170" },
  { countryName: "Serbia", competitionName: "SuperLiga", competitionId: "210" },
  {
    countryName: "Slovakia",
    competitionName: "Niké Liga",
    competitionId: "211",
    competitionAliases: ["Nike Liga"],
  },
  { countryName: "Slovenia", competitionName: "PrvaLiga", competitionId: "212" },
  { countryName: "Bulgaria", competitionName: "Parva Liga", competitionId: "247" },
  { countryName: "Greece", competitionName: "Super League", competitionId: "185" },
  { countryName: "Ukraine", competitionName: "Premier League", competitionId: "218" },
  { countryName: "Russia", competitionName: "Premier League", competitionId: "203" },
  { countryName: "Israel", competitionName: "Premier League", competitionId: "59" },
  {
    countryName: "Brazil",
    competitionName: "Brasileirao Serie A",
    competitionId: "325",
    competitionAliases: ["Brasileirao Betano", "Brasileirão Betano"],
  },
  {
    countryName: "Argentina",
    competitionName: "Liga Profesional",
    competitionId: "155",
    competitionAliases: ["Liga Profesional, Clausura", "Liga Profesional, Apertura"],
  },
];

const DEFAULT_ALLOWED_COMPETITIONS_BY_ID = new Map(
  DEFAULT_ALLOWED_COMPETITIONS.map((competition) => [competition.competitionId, competition]),
);

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

export function getCanonicalCompetitionNameById(competitionId: string | null): string | null {
  if (!competitionId) {
    return null;
  }

  return DEFAULT_ALLOWED_COMPETITIONS_BY_ID.get(competitionId)?.competitionName ?? null;
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
    isAllowedCompetitionFixture(fixture, allowedCompetitionIds),
  );
}

export function isAllowedCompetitionFixture(
  fixture: FixtureCompetitionIdentity,
  allowedCompetitionIds: ReadonlySet<string>,
): boolean {
  if (!isAllowedCompetitionId(fixture.competitionId, allowedCompetitionIds)) {
    return false;
  }

  if (!fixture.competitionId) {
    return false;
  }

  const curated = DEFAULT_ALLOWED_COMPETITIONS_BY_ID.get(fixture.competitionId);
  if (!curated) {
    return true;
  }

  if (!fixture.competitionName && !fixture.countryName) {
    return true;
  }

  return matchesCompetitionIdentity(curated, fixture);
}
